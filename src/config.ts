import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import readline from 'readline';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

/**
 * Get cross-platform user data directory for global config
 */
function getUserDataDir(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      return process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support');
    default:
      return process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  }
}

/**
 * Normalize config types based on AiflowConfig interface definition.
 * Ensures string fields remain strings (even if they look like numbers)
 * and number fields are properly converted to numbers.
 */
function normalizeConfigTypes(config: any): void {
  if (!config || typeof config !== 'object') return;

  // OpenAI config - key, baseUrl, model are strings; max_context_tokens is number
  if (config.openai) {
    if (config.openai.key !== undefined) config.openai.key = String(config.openai.key);
    if (config.openai.baseUrl !== undefined) config.openai.baseUrl = String(config.openai.baseUrl);
    if (config.openai.model !== undefined) config.openai.model = String(config.openai.model);
    if (config.openai.max_context_tokens !== undefined) {
      config.openai.max_context_tokens = toNumber(config.openai.max_context_tokens);
    }
    // reasoning can be boolean or object, leave as-is
  }

  // git_access_tokens - all values are strings
  if (config.git_access_tokens) {
    for (const key of Object.keys(config.git_access_tokens)) {
      config.git_access_tokens[key] = String(config.git_access_tokens[key]);
    }
  }

  // git_platforms - access_token and usernames are strings
  if (config.git_platforms) {
    for (const hostname of Object.keys(config.git_platforms)) {
      const platform = config.git_platforms[hostname];
      if (platform.access_token !== undefined) {
        platform.access_token = String(platform.access_token);
      }
      if (platform.merge_request) {
        if (platform.merge_request.assignee !== undefined) {
          platform.merge_request.assignee = String(platform.merge_request.assignee);
        }
        if (Array.isArray(platform.merge_request.assignees)) {
          platform.merge_request.assignees = platform.merge_request.assignees.map((v: any) => String(v));
        }
        if (Array.isArray(platform.merge_request.reviewers)) {
          platform.merge_request.reviewers = platform.merge_request.reviewers.map((v: any) => String(v));
        }
      }
    }
  }

  // conan config - all strings
  if (config.conan) {
    if (config.conan.remoteBaseUrl !== undefined) config.conan.remoteBaseUrl = String(config.conan.remoteBaseUrl);
    if (config.conan.remoteRepo !== undefined) config.conan.remoteRepo = String(config.conan.remoteRepo);
  }

  // wecom config - webhook is string, enable is boolean
  if (config.wecom) {
    if (config.wecom.webhook !== undefined) config.wecom.webhook = String(config.wecom.webhook);
    // enable is boolean, leave as-is (yaml handles booleans correctly)
  }

  // git config - all strings except booleans
  if (config.git) {
    if (config.git.generation_lang !== undefined) config.git.generation_lang = String(config.git.generation_lang);
    // squashCommits and removeSourceBranch are booleans, leave as-is
  }

  // merge_request config (legacy) - IDs are numbers
  if (config.merge_request) {
    if (config.merge_request.assignee_id !== undefined) {
      config.merge_request.assignee_id = toNumber(config.merge_request.assignee_id);
    }
    if (Array.isArray(config.merge_request.assignee_ids)) {
      config.merge_request.assignee_ids = config.merge_request.assignee_ids.map((v: any) => toNumber(v));
    }
    if (Array.isArray(config.merge_request.reviewer_ids)) {
      config.merge_request.reviewer_ids = config.merge_request.reviewer_ids.map((v: any) => toNumber(v));
    }
  }
}

/**
 * Safely convert a value to number, returning 0 for invalid values
 */
function toNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * ESM/CommonJS compatibility helper for getting current directory.
 * @return {string} The current directory path
 */
function getDirname(): string {
  // ESM environment
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  // CommonJS environment
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  // Fallback
  return process.cwd();
}

/**
 * Load environment variables with ESM/CommonJS compatibility.
 * Searches for .env file in current directory, parent directory, and working directory.
 * This function should be called early in the application lifecycle.
 */
export function loadEnvironmentVariables(): void {
  const currentDir = getDirname();
  let envPath = path.join(currentDir, '.env');

  if (!fs.existsSync(envPath)) {
    envPath = path.join(currentDir, '../.env');
  }

  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '.env');
  }

  if (fs.existsSync(envPath)) {
    dotenvConfig({ path: envPath, debug: false, quiet: true });
  } else {
    // Fallback to default dotenv behavior
    dotenvConfig({ debug: false, quiet: true });
  }
}

export interface AiflowConfig {
  // OpenAI Configuration
  openai?: {
    key?: string;
    baseUrl?: string;
    model?: string;
    max_context_tokens?: number;
    reasoning?: boolean | {
      enabled?: boolean;
      effort?: 'high' | 'medium' | 'low';
      max_tokens?: number;
      exclude?: boolean;
    };
  };

  // Git Access Tokens for multiple platforms (legacy, kept for backward compatibility)
  git_access_tokens?: {
    [hostname: string]: string;
  };

  // Git Platform Configuration - supports multiple Git hosting platforms with per-platform settings
  git_platforms?: {
    [hostname: string]: {
      access_token: string;
      merge_request?: {
        assignee?: string;      // Single assignee username
        assignees?: string[];   // Multiple assignee usernames
        reviewers?: string[];   // Reviewer usernames
      };
    };
  };

  // Conan Configuration
  conan?: {
    remoteBaseUrl?: string;
    remoteRepo?: string;
  };

  // WeChat Work Configuration
  wecom?: {
    webhook?: string;
    enable?: boolean;
  };

  // Git MR Configuration
  git?: {
    squashCommits?: boolean;
    removeSourceBranch?: boolean;
    generation_lang?: string;
  };

  // Merge Request Configuration (legacy, kept for backward compatibility)
  merge_request?: {
    assignee_id?: number | string;
    assignee_ids?: (number | string)[];
    reviewer_ids?: (number | string)[];
  };
}

export interface ConfigSource {
  source: 'cli' | 'local' | 'global' | 'env';
  path?: string;
}

export interface LoadedConfig extends AiflowConfig {
  _sources: Map<string, ConfigSource>;
}

/**
 * Configuration loader with priority-based merging
 * Priority order: CLI args > Local config > Global config > Environment variables
 */
export class ConfigLoader {
  private static readonly LOCAL_CONFIG_PATH = '.aiflow/config.yaml';
  private static readonly GLOBAL_CONFIG_DIR = 'aiflow';
  private static readonly GLOBAL_CONFIG_FILE = 'config.yaml';

  private readonly warnings: string[] = [];

  /**
   * Load configuration with priority merging
   */
  async loadConfig(cliArgs: Partial<AiflowConfig> = {}): Promise<LoadedConfig> {
    const config: LoadedConfig = { _sources: new Map() };

    // Load from environment variables (lowest priority)
    this.mergeEnvConfig(config);

    // Load from global config file
    await this.mergeGlobalConfig(config);

    // Load from local config file
    await this.mergeLocalConfig(config);

    // Apply CLI arguments (highest priority)
    this.mergeCliConfig(config, cliArgs);

    // Validate and warn about missing required configs
    this.validateConfig(config);

    return config;
  }

  /**
   * Get configuration warnings
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Clear warnings
   */
  clearWarnings(): void {
    this.warnings.length = 0;
  }

  /**
   * Get user data directory path
   */
  private getUserDataDir(): string {
    return getUserDataDir();
  }

  /**
   * Merge environment variables into config
   */
  private mergeEnvConfig(config: LoadedConfig): void {

    // Initialize environment variables
    loadEnvironmentVariables();

    const envMapping = {
      'OPENAI_KEY': 'openai.key',
      'OPENAI_BASE_URL': 'openai.baseUrl',
      'OPENAI_MODEL': 'openai.model',
      'OPENAI_MAX_CONTEXT_TOKENS': 'openai.max_context_tokens',
      'OPENAI_REASONING': 'openai.reasoning',
      'CONAN_REMOTE_BASE_URL': 'conan.remoteBaseUrl',
      'CONAN_REMOTE_REPO': 'conan.remoteRepo',
      'WECOM_WEBHOOK': 'wecom.webhook',
      'WECOM_ENABLE': 'wecom.enable',
      'SQUASH_COMMITS': 'git.squashCommits',
      'REMOVE_SOURCE_BRANCH': 'git.removeSourceBranch',
      'GIT_GENERATION_LANG': 'git.generation_lang',
      'MERGE_REQUEST_ASSIGNEE_ID': 'merge_request.assignee_id',
      'MERGE_REQUEST_ASSIGNEE_IDS': 'merge_request.assignee_ids',
      'MERGE_REQUEST_REVIEWER_IDS': 'merge_request.reviewer_ids',
    };

    // Handle git access token environment variables
    for (const [envKey, envValue] of Object.entries(process.env)) {
      if (envKey.startsWith('GIT_ACCESS_TOKEN_') && envValue) {
        const hostname = envKey.replace('GIT_ACCESS_TOKEN_', '').toLowerCase().replace(/_/g, '.');
        const configPath = `git_access_tokens.${hostname}`;
        this.setNestedValue(config, configPath, envValue);
        config._sources.set(configPath, { source: 'env' });
      }
    }

    for (const [envKey, configPath] of Object.entries(envMapping)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        let parsedValue = this.parseEnvValue(envValue);

        // Handle number fields
        if (configPath === 'openai.max_context_tokens') {
          if (typeof parsedValue === 'string') {
            const num = parseInt(parsedValue, 10);
            parsedValue = isNaN(num) ? undefined : num;
          }
        }
        // Handle array fields for merge request configuration
        else if (configPath === 'merge_request.assignee_ids' || configPath === 'merge_request.reviewer_ids') {
          if (typeof parsedValue === 'string') {
            // Parse comma-separated string to number array
            parsedValue = parsedValue.split(',').map(id => {
              const num = parseInt(id.trim(), 10);
              return isNaN(num) ? 0 : num;
            }).filter(id => id >= 0);
          }
        } else if (configPath === 'merge_request.assignee_id') {
          if (typeof parsedValue === 'string') {
            const num = parseInt(parsedValue, 10);
            parsedValue = isNaN(num) ? 0 : num;
          }
        }

        this.setNestedValue(config, configPath, parsedValue);
        config._sources.set(configPath, { source: 'env' });
      }
    }
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): any {
    // Handle boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Return as string for other values
    return value;
  }

  /**
   * Merge global config file into config
   */
  private async mergeGlobalConfig(config: LoadedConfig): Promise<void> {
    const globalConfigPath = path.join(
      this.getUserDataDir(),
      ConfigLoader.GLOBAL_CONFIG_DIR,
      ConfigLoader.GLOBAL_CONFIG_FILE
    );

    await this.mergeYamlConfig(config, globalConfigPath, 'global');
  }

  /**
   * Merge local config file into config
   */
  private async mergeLocalConfig(config: LoadedConfig): Promise<void> {
    const localConfigPath = path.join(process.cwd(), ConfigLoader.LOCAL_CONFIG_PATH);
    await this.mergeYamlConfig(config, localConfigPath, 'local');
  }

  /**
   * Merge YAML config file into config
   */
  private async mergeYamlConfig(
    config: LoadedConfig,
    configPath: string,
    source: 'local' | 'global'
  ): Promise<void> {
    try {
      if (!fs.existsSync(configPath)) {
        return;
      }

      const yamlContent = fs.readFileSync(configPath, 'utf8');
      const yamlConfig = yaml.load(yamlContent) as AiflowConfig;

      if (yamlConfig && typeof yamlConfig === 'object') {
        normalizeConfigTypes(yamlConfig);
        this.mergeConfigRecursively(config, yamlConfig, source, configPath);
      }
    } catch (error) {
      this.warnings.push(`Failed to load ${source} config from ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Merge CLI arguments into config
   */
  private mergeCliConfig(config: LoadedConfig, cliArgs: Partial<AiflowConfig>): void {
    this.mergeConfigRecursively(config, cliArgs, 'cli');
  }

  /**
   * Recursively merge config objects
   */
  private mergeConfigRecursively(
    target: LoadedConfig,
    source: any,
    sourceType: 'cli' | 'local' | 'global',
    sourcePath?: string,
    keyPrefix: string = ''
  ): void {
    for (const [key, value] of Object.entries(source)) {
      if (key === '_sources') continue;

      const fullKey = keyPrefix ? `${keyPrefix}.${key}` : key;

      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Ensure the nested object exists
          if (!target[key as keyof AiflowConfig]) {
            (target as any)[key] = {};
          }

          // Recursively merge nested objects
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (nestedValue !== undefined && nestedValue !== null) {
              const nestedTarget = target[key as keyof AiflowConfig] as any;
              nestedTarget[nestedKey] = nestedValue;
              target._sources.set(`${key}.${nestedKey}`, { source: sourceType, path: sourcePath });
            }
          }
        } else {
          (target as any)[key] = value;
          target._sources.set(fullKey, { source: sourceType, path: sourcePath });
        }
      }
    }
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Validate configuration and generate warnings
   */
  private validateConfig(config: LoadedConfig): void {
    const requiredConfigs = [
      { path: 'openai.key', name: 'OPENAI_KEY', description: 'OpenAI API key for AI-powered features' },
      { path: 'openai.baseUrl', name: 'OPENAI_BASE_URL', description: 'OpenAI API base URL for API requests' },
      { path: 'openai.model', name: 'OPENAI_MODEL', description: 'OpenAI model name for AI operations' },
    ];

    const optionalConfigs = [
      { path: 'conan.remoteBaseUrl', name: 'CONAN_REMOTE_BASE_URL', description: 'Conan remote base URL (required for conan operations)' },
      { path: 'conan.remoteRepo', name: 'CONAN_REMOTE_REPO', description: 'Conan remote repository name (optional)' },
      { path: 'wecom.webhook', name: 'WECOM_WEBHOOK', description: 'WeChat Work webhook URL (optional)' },
      { path: 'wecom.enable', name: 'WECOM_ENABLE', description: 'WeChat Work notifications enable flag (optional)' },
    ];

    // Check if at least one git access token is configured
    const gitTokens = this.getNestedValue(config, 'git_access_tokens');
    if (!gitTokens || Object.keys(gitTokens).length === 0) {
      this.warnings.push(`⚠️  No Git access tokens configured. Please configure at least one token for Git operations`);
    }

    // Check required configurations
    for (const { path, name, description } of requiredConfigs) {
      if (!this.getNestedValue(config, path)) {
        this.warnings.push(`⚠️  Missing required configuration: ${name} - ${description}`);
      }
    }

    // Report missing optional configurations
    for (const { path, name, description } of optionalConfigs) {
      if (!this.getNestedValue(config, path)) {
        logger.info(`ℹ️  Optional configuration not set: ${name} - ${description}`);
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Print configuration sources for debugging
   */
  printConfigSources(config: LoadedConfig): void {
    logger.info('\n📋 Configuration Sources:');
    for (const [key, source] of config._sources.entries()) {
      const sourceName = source.source.toUpperCase();
      const sourcePath = source.path ? ` (${source.path})` : '';
      logger.info(`  ${key}: ${sourceName}${sourcePath}`);
    }
  }

  /**
   * Create example configuration files
   */
  async createExampleConfigs(): Promise<void> {
    const exampleConfig: AiflowConfig = {
      openai: {
        key: 'your-openai-api-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        reasoning: false,
      },
      git_access_tokens: {
        'github.com': 'your-github-access-token',
        'gitlab.example.com': 'your-gitlab-access-token',
        'gitee.com': 'your-gitee-access-token',
      },
      conan: {
        remoteBaseUrl: 'https://conan.example.com',
        remoteRepo: 'repo',
      },
      wecom: {
        webhook: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key',
        enable: true,
      },
      git: {
        squashCommits: true,
        removeSourceBranch: true,
      },
      merge_request: {
        assignee_id: 0,
        assignee_ids: [],
        reviewer_ids: [],
      },
    };

    // Create local example config
    const localConfigDir = path.join(process.cwd(), '.aiflow');
    const localConfigPath = path.join(localConfigDir, 'config.example.yaml');

    if (!fs.existsSync(localConfigDir)) {
      fs.mkdirSync(localConfigDir, { recursive: true });
    }

    // Generate YAML with detailed comments
    const yamlContent = `# AIFlow 配置文件
# 这是一个示例配置文件，复制到 config.yaml 并根据需要修改
# 配置优先级: 命令行参数 > 本地配置(.aiflow/config.yaml) > 全局配置(~/.config/aiflow/config.yaml) > 环境变量

# OpenAI API 配置 - 用于AI驱动的功能
openai:
  # OpenAI API 密钥 (必需) - 用于生成提交信息和代码分析
  key: ${exampleConfig.openai?.key}
  
  # OpenAI API 基础URL (必需) - API请求的端点地址
  baseUrl: ${exampleConfig.openai?.baseUrl}
  
  # OpenAI 模型名称 (必需) - 指定使用的AI模型，如 gpt-3.5-turbo, gpt-4
  model: ${exampleConfig.openai?.model}
  
  # 启用推理模式 (可选) - 对于o1等推理模型，可以启用更深度的思考模式
  reasoning: ${exampleConfig.openai?.reasoning}

# Git 访问令牌配置 - 支持多个Git托管平台
git_access_tokens:
  # GitHub 访问令牌 - 格式: ghp_xxxxxxxxxxxxxxxxxxxx
  github.com: ${exampleConfig.git_access_tokens?.['github.com']}
  
  # GitLab 访问令牌 - 格式: glpat-xxxxxxxxxxxxxxxxxxxx  
  gitlab.example.com: ${exampleConfig.git_access_tokens?.['gitlab.example.com']}
  
  # Gitee 访问令牌 - 格式: gitee_xxxxxxxxxxxxxxxxxxxx
  gitee.com: ${exampleConfig.git_access_tokens?.['gitee.com']}
  
  # 您可以添加更多Git托管平台的令牌
  # 格式: 主机名: 访问令牌

# Conan 包管理器配置 - 用于C++包管理和版本更新
conan:
  # Conan 远程仓库基础URL (Conan操作时必需) - Conan包仓库的API地址
  remoteBaseUrl: ${exampleConfig.conan?.remoteBaseUrl}
  
  # Conan 远程仓库名称 (可选) - 默认使用的仓库名称，默认为'repo'
  remoteRepo: ${exampleConfig.conan?.remoteRepo}

# 企业微信通知配置 - 用于发送操作结果通知
wecom:
  # 启用企业微信通知 (可选) - 是否开启通知功能，默认为false
  enable: ${exampleConfig.wecom?.enable}
  
  # 企业微信机器人Webhook地址 (可选) - 用于发送通知消息的机器人地址
  webhook: ${exampleConfig.wecom?.webhook}

# Git 合并请求配置 - 控制MR的默认行为
git:
  # 压缩提交 (可选) - 合并时是否将多个提交压缩为一个，默认为true
  squashCommits: ${exampleConfig.git?.squashCommits}
  
  # 删除源分支 (可选) - 合并后是否删除源分支，默认为true
  removeSourceBranch: ${exampleConfig.git?.removeSourceBranch}

# 合并请求指派配置 - 配置指派人和审查者
merge_request:
  # 单个指派人用户ID (可选) - 设置为0或留空取消指派
  assignee_id: ${exampleConfig.merge_request?.assignee_id || 0}
  
  # 指派人用户ID数组 (可选) - 多个指派人，设置为空数组取消所有指派
  assignee_ids: []
  
  # 审查者用户ID数组 (可选) - 设置为空数组不添加审查者
  reviewer_ids: []
`;

    fs.writeFileSync(localConfigPath, yamlContent);
    logger.info(`📝 Created example config: ${localConfigPath}`);

    // Create global example config
    const globalConfigDir = path.join(this.getUserDataDir(), ConfigLoader.GLOBAL_CONFIG_DIR);
    const globalExamplePath = path.join(globalConfigDir, 'config.example.yaml');

    if (!fs.existsSync(globalConfigDir)) {
      fs.mkdirSync(globalConfigDir, { recursive: true });
    }

    fs.writeFileSync(globalExamplePath, yamlContent);
    logger.info(`📝 Created global example config: ${globalExamplePath}`);
  }
}

// Singleton instance
export const configLoader = new ConfigLoader();

/**
 * Get configuration value with fallback
 */
export function getConfigValue<T>(
  config: LoadedConfig,
  path: string,
  fallback?: T
): T | undefined {
  const keys = path.split('.');
  let current: any = config;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return fallback;
    }
  }

  return current !== undefined ? current : fallback;
}

/**
 * Get Git access token for a specific hostname
 * @param config Loaded configuration
 * @param hostname Git hostname (e.g., 'github.com', 'gitlab.example.com')
 * @returns Access token for the hostname or undefined if not found
 */
export function getGitAccessToken(
  config: LoadedConfig,
  hostname: string
): string | undefined {
  // Try new git_platforms format first
  const platforms = getConfigValue(config, 'git_platforms', {} as Record<string, any>);
  if (platforms?.[hostname]?.access_token) {
    return platforms[hostname].access_token;
  }

  // Fall back to legacy git_access_tokens format
  const tokens = getConfigValue(config, 'git_access_tokens', {} as Record<string, string>);
  return tokens?.[hostname];
}

/**
 * Get all configured Git access tokens
 * @param config Loaded configuration
 * @returns Object with hostname -> token mappings
 */
export function getAllGitAccessTokens(
  config: LoadedConfig
): Record<string, string> {
  const result: Record<string, string> = {};

  // Get tokens from new git_platforms format
  const platforms = getConfigValue(config, 'git_platforms', {} as Record<string, any>);
  if (platforms) {
    for (const [hostname, platformConfig] of Object.entries(platforms)) {
      if (platformConfig?.access_token) {
        result[hostname] = platformConfig.access_token;
      }
    }
  }

  // Merge with legacy git_access_tokens format (legacy takes lower priority)
  const legacyTokens = getConfigValue(config, 'git_access_tokens', {} as Record<string, string>) || {};
  for (const [hostname, token] of Object.entries(legacyTokens)) {
    if (!result[hostname]) {
      result[hostname] = token;
    }
  }

  return result;
}

/**
 * Get Git platform merge request configuration for a specific hostname
 * @param config Loaded configuration
 * @param hostname Git hostname (e.g., 'gitlab.example.com')
 * @returns Merge request configuration for the platform or undefined if not found
 */
export function getGitPlatformMergeRequestConfig(
  config: LoadedConfig,
  hostname: string
): { assignee?: string; assignees?: string[]; reviewers?: string[] } | undefined {
  const platforms = getConfigValue(config, 'git_platforms', {} as Record<string, any>);
  return platforms?.[hostname]?.merge_request;
}

/**
 * Parse CLI arguments to config format
 * Supports both long (--key) and short (-k) argument formats
 */
export function parseCliArgs(args: string[]): Partial<AiflowConfig> {
  const config: Partial<AiflowConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    let key: string;
    let isShort = false;

    if (arg.startsWith('--')) {
      key = arg.slice(2);
    } else if (arg.startsWith('-') && !arg.startsWith('--')) {
      key = arg.slice(1);
      isShort = true;
    } else {
      continue;
    }

    const value = args[i + 1];

    // Map short arguments to their long equivalents
    if (isShort) {
      key = getShortArgMapping(key);
    }

    switch (key) {
      case 'openai-key':
        config.openai = { ...config.openai, key: value };
        i++;
        break;
      case 'openai-base-url':
        config.openai = { ...config.openai, baseUrl: value };
        i++;
        break;
      case 'openai-model':
        config.openai = { ...config.openai, model: value };
        i++;
        break;
      case 'openai-max-context-tokens':
        const maxTokens = parseInt(value, 10);
        config.openai = { ...config.openai, max_context_tokens: isNaN(maxTokens) ? undefined : maxTokens };
        i++;
        break;
      case 'openai-reasoning':
        config.openai = { ...config.openai, reasoning: value !== 'false' };
        i++;
        break;
      case 'git-access-token':
        // Parse format: hostname=token
        if (value && value.includes('=')) {
          const [hostname, token] = value.split('=', 2);
          if (hostname && token) {
            config.git_access_tokens = { ...config.git_access_tokens, [hostname]: token };
          }
        }
        i++;
        break;
      case 'conan-remote-base-url':
        config.conan = { ...config.conan, remoteBaseUrl: value };
        i++;
        break;
      case 'conan-remote-repo':
        config.conan = { ...config.conan, remoteRepo: value };
        i++;
        break;
      case 'wecom-webhook':
        config.wecom = { ...config.wecom, webhook: value };
        i++;
        break;
      case 'wecom-enable':
        config.wecom = { ...config.wecom, enable: value !== 'false' };
        i++;
        break;
      case 'squash-commits':
        config.git = { ...config.git, squashCommits: value !== 'false' };
        i++;
        break;
      case 'remove-source-branch':
        config.git = { ...config.git, removeSourceBranch: value !== 'false' };
        i++;
        break;
      case 'git-generation-lang':
        config.git = { ...config.git, generation_lang: value };
        i++;
        break;
      case 'merge-request-assignee-id':
        const assigneeId = parseInt(value, 10);
        config.merge_request = { ...config.merge_request, assignee_id: isNaN(assigneeId) ? 0 : assigneeId };
        i++;
        break;
      case 'merge-request-assignee-ids':
        // Parse comma-separated string to number array
        if (value) {
          const assigneeIds = value.split(',').map(id => {
            const num = parseInt(id.trim(), 10);
            return isNaN(num) ? 0 : num;
          }).filter(id => id >= 0);
          config.merge_request = { ...config.merge_request, assignee_ids: assigneeIds };
        }
        i++;
        break;
      case 'merge-request-reviewer-ids':
        // Parse comma-separated string to number array
        if (value) {
          const reviewerIds = value.split(',').map(id => {
            const num = parseInt(id.trim(), 10);
            return isNaN(num) ? 0 : num;
          }).filter(id => id >= 0);
          config.merge_request = { ...config.merge_request, reviewer_ids: reviewerIds };
        }
        i++;
        break;
    }
  }

  return config;
}

/**
 * Map short argument names to their long equivalents
 */
function getShortArgMapping(shortKey: string): string {
  const shortArgMap: Record<string, string> = {
    // OpenAI shortcuts (OpenAI Key, OpenAI Base Url, OpenAI Model, OpenAI Max Context Tokens, OpenAI Reasoning)
    'ok': 'openai-key',
    'obu': 'openai-base-url',
    'om': 'openai-model',
    'omct': 'openai-max-context-tokens',
    'or': 'openai-reasoning',

    // Git access token shortcuts (Git Access Token)
    'gat': 'git-access-token',

    // Conan shortcuts (Conan Remote Base Url, Conan Remote Repo)
    'crbu': 'conan-remote-base-url',
    'crr': 'conan-remote-repo',

    // WeChat Work shortcuts (WeChat Work webhook, WeChat Work Enable)
    'ww': 'wecom-webhook',
    'we': 'wecom-enable',

    // Git shortcuts (Squash Commits, Remove Source Branch, Generate Language)
    'sc': 'squash-commits',
    'rsb': 'remove-source-branch',
    'ggl': 'git-generation-lang',

    // Merge Request shortcuts (Merge Request Assignee ID, Assignee IDs, Reviewer IDs)
    'mrai': 'merge-request-assignee-id',
    'mrais': 'merge-request-assignee-ids',
    'mrris': 'merge-request-reviewer-ids',
  };

  return shortArgMap[shortKey] || shortKey;
}

/**
 * Get help text for CLI arguments
 */
export function getCliHelp(): string {
  // Calculate actual global config path
  const userDataDir = getUserDataDir();
  const globalConfigPath = path.join(userDataDir, 'aiflow', 'config.yaml');

  return `
AIFlow CLI 配置选项

配置优先级: 命令行参数 > 本地配置(.aiflow/config.yaml) > 全局配置(${globalConfigPath}) > 环境变量

OpenAI 配置 - AI功能支持:
  -ok, --openai-key <key>               OpenAI API密钥 (必需，用于AI生成提交信息)
  -obu, --openai-base-url <url>         OpenAI API地址 (必需，API请求端点)
  -om, --openai-model <model>           OpenAI模型 (必需，如gpt-3.5-turbo、gpt-4)
  -omct, --openai-max-context-tokens <num>  模型最大上下文token数 (可选，默认8192)
  -or, --openai-reasoning <bool>        启用推理模式 (可选，适用于o1等推理模型)

Git 访问令牌配置 - 多平台支持:
  -gat, --git-access-token <host=token> Git访问令牌 (格式: 主机名=令牌)
                                        支持多个平台，如:
                                        github.com=ghp_xxxxx
                                        gitlab.example.com=glpat_xxxxx
                                        gitee.com=gitee_xxxxx

Conan 配置 - C++包管理:
  -crbu, --conan-remote-base-url <url>  Conan仓库API地址 (Conan操作时必需)
  -crr, --conan-remote-repo <repo>      Conan仓库名称 (可选，默认为'repo')

企业微信配置 - 通知功能:
  -ww, --wecom-webhook <url>            企业微信机器人Webhook地址 (可选)
  -we, --wecom-enable <bool>            启用企业微信通知 (可选，true/false)

Git 配置 - 合并请求行为:
  -sc, --squash-commits <bool>          压缩提交 (可选，合并时压缩多个提交)
  -rsb, --remove-source-branch <bool>   删除源分支 (可选，合并后删除分支)
  -ggl, --git-generation-lang <lang>      生成语言 (可选，AI生成内容的语言，如: zh-CN, en, ja)

合并请求配置 - 指派和审查者:
  -mrai, --merge-request-assignee-id <id>      单个指派人用户ID (可选，设置为0取消指派)
  -mrais, --merge-request-assignee-ids <ids>   指派人用户ID列表 (可选，逗号分隔，如: 1,2,3)
  -mrris, --merge-request-reviewer-ids <ids>   审查者用户ID列表 (可选，逗号分隔，如: 1,2,3)

使用示例:
  # 基本配置
  aiflow -ok sk-abc123 -gat github.com=ghp_xyz789
  
  # 多平台访问令牌
  aiflow -ok sk-abc123 -gat gitlab.example.com=glpat-abc123 -gat github.com=ghp_def456
  
  # 完整配置
  aiflow -ok sk-abc123 -gat gitlab.company.com=glpat-xyz789 -crbu https://conan.company.com -we true
  
  # 配置合并请求指派和审查者
  aiflow -ok sk-abc123 -mrai 123 -mrris 456,789
  
  # 使用长参数名
  aiflow --openai-key sk-abc123 --git-access-token gitlab.example.com=glpat-xyz789 --merge-request-assignee-ids 1,2,3

环境变量格式:
  GIT_ACCESS_TOKEN_GITHUB_COM=ghp_xxxxx
  GIT_ACCESS_TOKEN_GITLAB_EXAMPLE_COM=glpat_xxxxx
  GIT_ACCESS_TOKEN_GITEE_COM=gitee_xxxxx
  MERGE_REQUEST_ASSIGNEE_ID=123
  MERGE_REQUEST_ASSIGNEE_IDS=1,2,3
  MERGE_REQUEST_REVIEWER_IDS=4,5,6

配置文件位置:
  本地: .aiflow/config.yaml
  全局: ${globalConfigPath}
  
运行 'aiflow --create-config' 可生成示例配置文件
`;
}

/**
 * Interactive configuration initialization
 */
export async function initConfig(isGlobal: boolean = false): Promise<void> {
  // Calculate actual config path
  let configPath: string;
  if (isGlobal) {
    const userDataDir = getUserDataDir();
    configPath = path.join(userDataDir, 'aiflow', 'config.yaml');
  } else {
    configPath = path.join(process.cwd(), '.aiflow', 'config.yaml');
  }

  console.log(`🔧 AIFlow 配置初始化${isGlobal ? ' (全局)' : ' (本地)'}`);
  console.log(`📁 配置位置: ${configPath}`);
  console.log('💡 提示：直接回车使用默认值或跳过可选配置\n');

  // Check if this is incremental configuration
  const hasExistingConfig = fs.existsSync(configPath);
  let hasGlobalConfig = false;
  let globalConfigPath = '';

  if (!isGlobal) {
    // For local config, check if global config exists
    const userDataDir = getUserDataDir();
    globalConfigPath = path.join(userDataDir, 'aiflow', 'config.yaml');
    hasGlobalConfig = fs.existsSync(globalConfigPath);

    if (hasGlobalConfig) {
      console.log('📋 检测到全局配置，您可以选择增量配置模式');
      console.log('💡 增量配置模式：基于全局配置，只配置您想要在本地覆盖的模块\n');
    }
  } else if (hasExistingConfig) {
    console.log('📋 检测到现有全局配置，您可以选择增量配置模式');
    console.log('💡 增量配置模式：只配置您想要修改的模块，其他保持不变\n');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    // Incremental configuration mode selection
    let configModules: string[] = [];
    let isIncrementalMode = false;
    const canUseIncrementalMode = (hasExistingConfig && isGlobal) || (hasGlobalConfig && !isGlobal);

    if (canUseIncrementalMode) {
      const incrementalMode = await question('是否使用增量配置模式？(y/N): ');
      if (incrementalMode.toLowerCase() === 'y' || incrementalMode.toLowerCase() === 'yes') {
        isIncrementalMode = true;
        console.log('\n📋 请选择要配置的模块 (可多选，用逗号分隔):');
        console.log('  1. openai     - OpenAI API 配置');
        console.log('  2. git-tokens - Git 平台配置 (含访问令牌和MR设置)');
        console.log('  3. conan      - Conan 配置');
        console.log('  4. wecom      - 企业微信配置');
        console.log('  5. git        - Git 行为配置');
        console.log('  all           - 配置所有模块\n');

        const selectedModules = await question('选择模块 (例如: 1,5 或 openai,git): ');
        if (selectedModules.trim()) {
          const modules = selectedModules.split(',').map(m => m.trim().toLowerCase());
          configModules = modules.flatMap(module => {
            switch (module) {
              case '1': case 'openai': return ['openai'];
              case '2': case 'git-tokens': case 'git-platforms': return ['git-tokens'];
              case '3': case 'conan': return ['conan'];
              case '4': case 'wecom': return ['wecom'];
              case '5': case 'git': return ['git'];
              case 'all': return ['openai', 'git-tokens', 'conan', 'wecom', 'git'];
              default: return [];
            }
          }).filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
        }

        if (configModules.length === 0) {
          console.log('❌ 未选择任何模块，退出配置');
          rl.close();
          return;
        }

        console.log(`\n✅ 将配置以下模块: ${configModules.join(', ')}\n`);
      } else {
        // Full configuration mode
        configModules = ['openai', 'git-tokens', 'conan', 'wecom', 'git'];
      }
    } else {
      // Full configuration mode for new configs
      configModules = ['openai', 'git-tokens', 'conan', 'wecom', 'git'];
    }
    // Load existing configuration if available
    let configData: any = {
      openai: {},
      git_platforms: {},
      git_access_tokens: {},  // Legacy, for backward compatibility
      conan: {},
      wecom: {},
      git: {},
      merge_request: {}  // Legacy, for backward compatibility
    };

    // For local config, first try to load global config as base
    if (!isGlobal && hasGlobalConfig) {
      try {
        const globalConfigContent = fs.readFileSync(globalConfigPath, 'utf8');
        const globalConfig = yaml.load(globalConfigContent) as any;
        if (globalConfig) {
          normalizeConfigTypes(globalConfig);
          configData = {
            openai: globalConfig.openai || {},
            git_platforms: globalConfig.git_platforms || {},
            git_access_tokens: globalConfig.git_access_tokens || {},
            conan: globalConfig.conan || {},
            wecom: globalConfig.wecom || {},
            git: globalConfig.git || {},
            merge_request: globalConfig.merge_request || {}
          };
          console.log('📋 已加载全局配置作为基础配置\n');
        }
      } catch (error) {
        console.log('⚠️  读取全局配置文件失败，将使用空配置\n');
      }
    }

    // Then try to load existing local/current config file to override
    if (fs.existsSync(configPath)) {
      try {
        const existingConfigContent = fs.readFileSync(configPath, 'utf8');
        const existingConfig = yaml.load(existingConfigContent) as any;
        if (existingConfig) {
          normalizeConfigTypes(existingConfig);
          // Merge existing config over the base config
          configData = {
            openai: { ...configData.openai, ...(existingConfig.openai || {}) },
            git_platforms: { ...configData.git_platforms, ...(existingConfig.git_platforms || {}) },
            git_access_tokens: { ...configData.git_access_tokens, ...(existingConfig.git_access_tokens || {}) },
            conan: { ...configData.conan, ...(existingConfig.conan || {}) },
            wecom: { ...configData.wecom, ...(existingConfig.wecom || {}) },
            git: { ...configData.git, ...(existingConfig.git || {}) },
            merge_request: { ...configData.merge_request, ...(existingConfig.merge_request || {}) }
          };
          console.log(`📋 发现现有${isGlobal ? '全局' : '本地'}配置文件，将作为默认值使用\n`);
        }
      } catch (error) {
        console.log('⚠️  读取现有配置文件失败，将创建新配置\n');
      }
    }

    // OpenAI configuration
    if (configModules.includes('openai')) {
      console.log('🤖 OpenAI 配置:');
      const currentKey = configData.openai.key ? '已设置' : '';
      const openaiKey = await question(`  OpenAI API 密钥 (必需)${currentKey ? ` [${currentKey}]` : ''}: `);
      if (openaiKey.trim()) configData.openai.key = openaiKey.trim();

      const currentBaseUrl = configData.openai.baseUrl || 'https://api.openai.com/v1';
      const openaiBaseUrl = await question(`  OpenAI API 地址 [${currentBaseUrl}]: `);
      configData.openai.baseUrl = openaiBaseUrl.trim() || currentBaseUrl;

      const currentModel = configData.openai.model || 'gpt-3.5-turbo';
      const openaiModel = await question(`  OpenAI 模型 [${currentModel}]: `);
      configData.openai.model = openaiModel.trim() || currentModel;

      const currentReasoning = configData.openai.reasoning !== undefined ? configData.openai.reasoning : false;
      const openaiReasoning = await question(`  启用推理模式 (推荐用于o1等推理模型) [${currentReasoning}]: `);
      configData.openai.reasoning = openaiReasoning.trim() === '' ? currentReasoning : openaiReasoning.trim() !== 'false';
    }

    // Git platforms configuration (new format)
    if (configModules.includes('git-tokens')) {
      console.log('\n🔑 Git 平台配置:');

      // Initialize git_platforms if not exists
      if (!configData.git_platforms) {
        configData.git_platforms = {};
      }

      // Migrate legacy git_access_tokens to git_platforms if exists
      if (configData.git_access_tokens && Object.keys(configData.git_access_tokens).length > 0) {
        console.log('  检测到旧格式的 git_access_tokens 配置');
        for (const [host, token] of Object.entries(configData.git_access_tokens)) {
          if (!configData.git_platforms[host]) {
            configData.git_platforms[host] = { access_token: token };
            console.log(`    ✅ 已迁移 ${host} 的配置到新格式`);
          }
        }
        console.log('');
      }

      // Show existing platforms
      const existingHosts = Object.keys(configData.git_platforms);
      if (existingHosts.length > 0) {
        console.log('  现有配置的Git平台:');
        existingHosts.forEach(host => {
          const hasMRConfig = configData.git_platforms[host]?.merge_request;
          console.log(`    • ${host}: 已设置${hasMRConfig ? ' (含MR配置)' : ''}`);
        });
        console.log('');
      }

      console.log('  您可以添加新的Git平台或修改现有配置，直接回车跳过');

      // Git platform configuration loop
      while (true) {
        const gitHost = await question('  Git 平台主机名 (如: github.com, gitlab.example.com, gitee.com，留空结束): ');
        if (!gitHost.trim()) break;

        const hostname = gitHost.trim();
        const currentPlatform = configData.git_platforms[hostname];

        // Configure access token
        const tokenPrompt = currentPlatform?.access_token
          ? `  ${hostname} 访问令牌 [已设置]: `
          : `  ${hostname} 访问令牌: `;

        const gitToken = await question(tokenPrompt);

        // Initialize or update platform config
        if (!configData.git_platforms[hostname]) {
          configData.git_platforms[hostname] = {};
        }

        if (gitToken.trim()) {
          configData.git_platforms[hostname].access_token = gitToken.trim();
          console.log(`    ✅ 已${currentPlatform ? '更新' : '添加'} ${hostname} 的访问令牌`);
        } else if (!configData.git_platforms[hostname].access_token) {
          console.log(`    ⚠️  未设置访问令牌，跳过 ${hostname}`);
          delete configData.git_platforms[hostname];
          continue;
        }

        // Detect platform type and ask for merge request config if GitLab
        const isGitLab = hostname.includes('gitlab');

        if (isGitLab) {
          console.log(`\n  检测到 GitLab 平台: ${hostname}`);
          const configureMR = await question('  是否配置 Merge Request 默认设置？(y/N): ');

          if (configureMR.toLowerCase() === 'y' || configureMR.toLowerCase() === 'yes') {
            // Initialize merge_request config
            if (!configData.git_platforms[hostname].merge_request) {
              configData.git_platforms[hostname].merge_request = {};
            }

            const mrConfig = configData.git_platforms[hostname].merge_request;

            // Configure assignee (single)
            const currentAssignee = mrConfig.assignee || '';
            const assignee = await question(`    单个指派人用户名 (可选)${currentAssignee ? ` [${currentAssignee}]` : ''}: `);
            if (assignee.trim()) {
              mrConfig.assignee = assignee.trim();
            } else if (currentAssignee) {
              // Keep current value if just pressed enter
            } else {
              delete mrConfig.assignee;
            }

            // Configure assignees (multiple)
            const currentAssignees = mrConfig.assignees || [];
            const assigneesStr = currentAssignees.length > 0 ? currentAssignees.join(', ') : '';
            const assignees = await question(`    多个指派人用户名 (可选，逗号分隔)${assigneesStr ? ` [${assigneesStr}]` : ''}: `);
            if (assignees.trim()) {
              mrConfig.assignees = assignees.split(',').map(s => s.trim()).filter(s => s);
            } else if (assigneesStr) {
              // Keep current value if just pressed enter
            } else {
              delete mrConfig.assignees;
            }

            // Configure reviewers
            const currentReviewers = mrConfig.reviewers || [];
            const reviewersStr = currentReviewers.length > 0 ? currentReviewers.join(', ') : '';
            const reviewers = await question(`    审查者用户名 (可选，逗号分隔)${reviewersStr ? ` [${reviewersStr}]` : ''}: `);
            if (reviewers.trim()) {
              mrConfig.reviewers = reviewers.split(',').map(s => s.trim()).filter(s => s);
            } else if (reviewersStr) {
              // Keep current value if just pressed enter
            } else {
              delete mrConfig.reviewers;
            }

            // Remove merge_request if empty
            if (Object.keys(mrConfig).length === 0) {
              delete configData.git_platforms[hostname].merge_request;
            } else {
              console.log(`    ✅ 已配置 ${hostname} 的 Merge Request 设置`);
            }
          }
        }

        console.log('');
        const continueAdding = await question('  是否继续添加/修改其他 Git 平台？(y/N): ');
        if (continueAdding.toLowerCase() !== 'y' && continueAdding.toLowerCase() !== 'yes') {
          break;
        }
      }

      // Clear legacy git_access_tokens after migration
      if (Object.keys(configData.git_platforms).length > 0) {
        delete configData.git_access_tokens;
      }
    }

    // Conan configuration
    if (configModules.includes('conan')) {
      console.log('\n📦 Conan 配置:');
      const currentConanUrl = configData.conan.remoteBaseUrl || '';
      const conanBaseUrl = await question(`  Conan 仓库 API 地址 (可选)${currentConanUrl ? ` [${currentConanUrl}]` : ''}: `);
      if (conanBaseUrl.trim()) {
        configData.conan.remoteBaseUrl = conanBaseUrl.trim();
      } else if (!currentConanUrl) {
        delete configData.conan.remoteBaseUrl;
      }

      const currentConanRepo = configData.conan.remoteRepo || 'repo';
      const conanRepo = await question(`  Conan 仓库名称 [${currentConanRepo}]: `);
      configData.conan.remoteRepo = conanRepo.trim() || currentConanRepo;
    }

    // WeChat Work configuration
    if (configModules.includes('wecom')) {
      console.log('\n💬 企业微信配置:');
      const currentWebhook = configData.wecom.webhook || '';
      const wecomWebhook = await question(`  企业微信 Webhook 地址 (可选)${currentWebhook ? ` [已设置]` : ''}: `);
      if (wecomWebhook.trim()) {
        configData.wecom.webhook = wecomWebhook.trim();
      } else if (!currentWebhook) {
        delete configData.wecom.webhook;
      }

      const currentEnable = configData.wecom.enable !== undefined ? configData.wecom.enable : true;
      const wecomEnable = await question(`  启用企业微信通知 [${currentEnable}]: `);
      configData.wecom.enable = wecomEnable.trim() === '' ? currentEnable : wecomEnable.trim() !== 'false';
    }

    // Git configuration
    if (configModules.includes('git')) {
      console.log('\n🌿 Git 配置:');
      const currentSquash = configData.git.squashCommits !== undefined ? configData.git.squashCommits : true;
      const squashCommits = await question(`  压缩提交 [${currentSquash}]: `);
      configData.git.squashCommits = squashCommits.trim() === '' ? currentSquash : squashCommits.trim() !== 'false';

      const currentRemove = configData.git.removeSourceBranch !== undefined ? configData.git.removeSourceBranch : true;
      const removeSourceBranch = await question(`  删除源分支 [${currentRemove}]: `);
      configData.git.removeSourceBranch = removeSourceBranch.trim() === '' ? currentRemove : removeSourceBranch.trim() !== 'false';

      const currentLang = configData.git.generation_lang || 'en';
      const generationLang = await question(`  AI生成语言 (en=英文, zh-CN=中文, ja=日文等) [${currentLang}]: `);
      configData.git.generation_lang = generationLang.trim() || currentLang;
    }

    // Note: Merge Request configuration has been integrated into git-tokens module
    // MR settings are now configured per-platform for GitLab

    rl.close();

    // Create configuration file
    await createConfigFile(configData, isGlobal, configModules, isIncrementalMode);

    console.log('\n✅ 配置初始化完成！');
    if (canUseIncrementalMode && configModules.length < 5) {
      if (isGlobal) {
        console.log(`📁 已更新${configModules.join(', ')}模块的全局配置`);
        console.log('💡 其他模块配置保持不变');
      } else {
        console.log(`📁 已创建本地配置，覆盖${configModules.join(', ')}模块`);
        console.log('💡 其他模块将继承全局配置');
      }
    } else {
      console.log(`📁 配置文件已创建: ${isGlobal ? '全局配置' : '本地配置'}`);
      if (!isGlobal && hasGlobalConfig) {
        console.log('💡 本地配置将覆盖全局配置的对应部分');
      }
    }
    console.log('💡 您可以随时手动编辑配置文件进行修改');

  } catch (error) {
    rl.close();
    console.error('❌ 配置初始化失败:', error);
    process.exit(1);
  }
}

/**
 * Create configuration file
 */
export async function createConfigFile(
  configData: any,
  isGlobal: boolean,
  configModules: string[] = ['openai', 'git-tokens', 'conan', 'wecom', 'git'],
  isIncrementalMode: boolean = false
): Promise<void> {
  // Calculate actual global config path
  const userDataDir = getUserDataDir();
  const globalConfigPath = path.join(userDataDir, 'aiflow', 'config.yaml');
  // Generate YAML content with comments
  let yamlContent = '';

  // Load existing global config for incremental updates
  let existingConfig: any = {};
  if (isIncrementalMode && isGlobal && fs.existsSync(globalConfigPath)) {
    try {
      const existingContent = fs.readFileSync(globalConfigPath, 'utf8');
      existingConfig = yaml.load(existingContent) as any || {};
      normalizeConfigTypes(existingConfig);
    } catch (error) {
      console.warn('⚠️  无法读取现有全局配置，将创建新配置');
    }
  }

  if (isIncrementalMode && !isGlobal && configModules.length < 5) {
    // For incremental local config, only include selected modules
    yamlContent = `# AIFlow 本地配置文件 (增量模式)
# 此配置将覆盖全局配置的对应部分
# 配置优先级: 命令行参数 > 本地配置(.aiflow/config.yaml) > 全局配置(${globalConfigPath}) > 环境变量

`;
  } else {
    yamlContent = `# AIFlow 配置文件
# 配置优先级: 命令行参数 > 本地配置(.aiflow/config.yaml) > 全局配置(${globalConfigPath}) > 环境变量

`;
  }

  // Add sections based on selected modules or existing config
  const allModules = ['openai', 'git-tokens', 'conan', 'wecom', 'git'];
  const modulesToInclude = isIncrementalMode && isGlobal
    ? allModules  // In global incremental mode, include all modules
    : configModules;  // In other modes, only include selected modules

  // Helper function to get config for a module (new config for selected, existing for others)
  const getModuleConfig = (moduleName: string, newConfig: any, existingConfig: any) => {
    if (isIncrementalMode && isGlobal) {
      if (configModules.includes(moduleName)) {
        return newConfig;  // Use new config for selected modules
      } else {
        // For non-selected modules, try to find existing config
        // Map module names to config keys
        const configKeyMap: { [key: string]: string } = {
          'openai': 'openai',
          'git-tokens': 'git_platforms',
          'conan': 'conan',
          'wecom': 'wecom',
          'git': 'git'
        };
        const configKey = configKeyMap[moduleName] || moduleName;
        if (existingConfig[configKey]) {
          return existingConfig[configKey];  // Use existing config for non-selected modules
        } else {
          return newConfig;  // Fallback to new config if no existing config
        }
      }
    } else {
      return newConfig;  // Use new config for non-incremental mode
    }
  };

  if (modulesToInclude.includes('openai')) {
    const openaiConfig = getModuleConfig('openai', configData.openai, existingConfig);
    
    yamlContent += `# OpenAI API 配置 - 用于AI驱动的功能
openai:
  # OpenAI API 密钥 (必需) - 用于生成提交信息和代码分析
  key: ${openaiConfig.key || 'your-openai-api-key'}
  
  # OpenAI API 基础URL (必需) - API请求的端点地址
  baseUrl: ${openaiConfig.baseUrl || 'https://api.openai.com/v1'}
  
  # OpenAI 模型名称 (必需) - 指定使用的AI模型，如 gpt-3.5-turbo, gpt-4
  model: ${openaiConfig.model || 'gpt-3.5-turbo'}
  
  # 启用推理模式 (可选) - 对于o1等推理模型，可以启用更深度的思考模式
  reasoning: ${openaiConfig.reasoning !== undefined ? openaiConfig.reasoning : false}

`;
  }

  if (modulesToInclude.includes('git-tokens')) {
    const gitPlatformsConfig = getModuleConfig('git_platforms', configData.git_platforms, existingConfig);

    yamlContent += `# Git 平台配置 - 支持多个Git托管平台及平台级设置
git_platforms:
`;

    if (Object.keys(gitPlatformsConfig || {}).length > 0) {
      // Generate config for each platform
      for (const [hostname, platformConfig] of Object.entries(gitPlatformsConfig)) {
        yamlContent += `  ${hostname}:\n`;
        yamlContent += `    access_token: ${(platformConfig as any).access_token}\n`;

        // Add merge_request config if exists (for GitLab)
        const mrConfig = (platformConfig as any).merge_request;
        if (mrConfig && Object.keys(mrConfig).length > 0) {
          yamlContent += `    merge_request:\n`;

          if (mrConfig.assignee) {
            yamlContent += `      assignee: ${mrConfig.assignee}  # 单个指派人用户名\n`;
          }

          if (mrConfig.assignees && mrConfig.assignees.length > 0) {
            yamlContent += `      assignees:  # 多个指派人用户名\n`;
            mrConfig.assignees.forEach((username: string) => {
              yamlContent += `        - ${username}\n`;
            });
          }

          if (mrConfig.reviewers && mrConfig.reviewers.length > 0) {
            yamlContent += `      reviewers:  # 审查者用户名\n`;
            mrConfig.reviewers.forEach((username: string) => {
              yamlContent += `        - ${username}\n`;
            });
          }
        }

        yamlContent += '\n';
      }
    } else {
      // Show example configuration
      yamlContent += `  # GitHub 平台示例
  # github.com:
  #   access_token: ghp_xxxxxxxxxxxxxxxxxxxxx

  # GitLab 平台示例 (支持 Merge Request 配置)
  # gitlab.example.com:
  #   access_token: glpat-xxxxxxxxxxxxxxxxxxxxx
  #   merge_request:
  #     assignee: username1          # 单个指派人用户名
  #     assignees:                    # 多个指派人用户名
  #       - username2
  #       - username3
  #     reviewers:                    # 审查者用户名
  #       - reviewer1
  #       - reviewer2

  # Gitee 平台示例
  # gitee.com:
  #   access_token: gitee_xxxxxxxxxxxxxxxxxxxxx

`;
    }
  }

  if (modulesToInclude.includes('conan')) {
    const conanConfig = getModuleConfig('conan', configData.conan, existingConfig);
    
    yamlContent += `# Conan 包管理器配置 - 用于C++包管理和版本更新
conan:
  # Conan 远程仓库基础URL (Conan操作时必需) - Conan包仓库的API地址
  ${conanConfig.remoteBaseUrl ? `remoteBaseUrl: ${conanConfig.remoteBaseUrl}` : '# remoteBaseUrl: https://conan.example.com'}
  
  # Conan 远程仓库名称 (可选) - 默认使用的仓库名称，默认为'repo'
  remoteRepo: ${conanConfig.remoteRepo || 'repo'}

`;
  }

  if (modulesToInclude.includes('wecom')) {
    const wecomConfig = getModuleConfig('wecom', configData.wecom, existingConfig);
    
    yamlContent += `# 企业微信通知配置 - 用于发送操作结果通知
wecom:
  # 启用企业微信通知 (可选) - 是否开启通知功能，默认为false
  enable: ${wecomConfig.enable || false}
  
  # 企业微信机器人Webhook地址 (可选) - 用于发送通知消息的机器人地址
  ${wecomConfig.webhook ? `webhook: ${wecomConfig.webhook}` : '# webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key'}

`;
  }

  if (modulesToInclude.includes('git')) {
    const gitConfig = getModuleConfig('git', configData.git, existingConfig);
    
    yamlContent += `# Git 合并请求配置 - 控制MR的默认行为
git:
  # 压缩提交 (可选) - 合并时是否将多个提交压缩为一个，默认为true
  squashCommits: ${gitConfig.squashCommits !== undefined ? gitConfig.squashCommits : true}
  
  # 删除源分支 (可选) - 合并后是否删除源分支，默认为true
  removeSourceBranch: ${gitConfig.removeSourceBranch !== undefined ? gitConfig.removeSourceBranch : true}
  
  # AI生成语言 (可选) - AI生成commit message和MR描述的语言，默认为en
  generation_lang: ${gitConfig.generation_lang || 'en'}

`;
  }

  // Note: 'mr' module has been removed, merge request config is now per-platform in git_platforms

  // Determine config path
  let configPath: string;
  if (isGlobal) {
    configPath = globalConfigPath;
    const configDir = path.dirname(globalConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  } else {
    const configDir = path.join(process.cwd(), '.aiflow');
    configPath = path.join(configDir, 'config.yaml');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  fs.writeFileSync(configPath, yamlContent);
  console.log(`\n📝 配置文件已创建: ${configPath}`);
}
