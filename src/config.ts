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
  };

  // Git Access Tokens for multiple platforms
  git_access_tokens?: {
    [hostname: string]: string;
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

  // Merge Request Configuration
  merge_request?: {
    assignee_id?: number;
    assignee_ids?: number[];
    reviewer_ids?: number[];
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

        // Handle array fields for merge request configuration
        if (configPath === 'merge_request.assignee_ids' || configPath === 'merge_request.reviewer_ids') {
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
  return getConfigValue(config, 'git_access_tokens', {} as Record<string, string>) || {};
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
    // OpenAI shortcuts (OpenAI Key, OpenAI Base Url, OpenAI Model)
    'ok': 'openai-key',
    'obu': 'openai-base-url',
    'om': 'openai-model',

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
        console.log('  2. git-tokens - Git 访问令牌配置');
        console.log('  3. conan      - Conan 配置');
        console.log('  4. wecom      - 企业微信配置');
        console.log('  5. git        - Git 行为配置');
        console.log('  6. mr         - 合并请求配置');
        console.log('  all           - 配置所有模块\n');

        const selectedModules = await question('选择模块 (例如: 1,5 或 openai,git): ');
        if (selectedModules.trim()) {
          const modules = selectedModules.split(',').map(m => m.trim().toLowerCase());
          configModules = modules.flatMap(module => {
            switch (module) {
              case '1': case 'openai': return ['openai'];
              case '2': case 'git-tokens': return ['git-tokens'];
              case '3': case 'conan': return ['conan'];
              case '4': case 'wecom': return ['wecom'];
              case '5': case 'git': return ['git'];
              case '6': case 'mr': return ['mr'];
              case 'all': return ['openai', 'git-tokens', 'conan', 'wecom', 'git', 'mr'];
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
        configModules = ['openai', 'git-tokens', 'conan', 'wecom', 'git', 'mr'];
      }
    } else {
      // Full configuration mode for new configs
      configModules = ['openai', 'git-tokens', 'conan', 'wecom', 'git', 'mr'];
    }
    // Load existing configuration if available
    let configData: any = {
      openai: {},
      git_access_tokens: {},
      conan: {},
      wecom: {},
      git: {},
      merge_request: {}
    };

    // For local config, first try to load global config as base
    if (!isGlobal && hasGlobalConfig) {
      try {
        const globalConfigContent = fs.readFileSync(globalConfigPath, 'utf8');
        const globalConfig = yaml.load(globalConfigContent) as any;
        if (globalConfig) {
          configData = {
            openai: globalConfig.openai || {},
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
          // Merge existing config over the base config
          configData = {
            openai: { ...configData.openai, ...(existingConfig.openai || {}) },
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
    }

    // Git access tokens configuration
    if (configModules.includes('git-tokens')) {
      console.log('\n🔑 Git 访问令牌配置:');
      // Keep existing tokens, don't reset
      if (!configData.git_access_tokens) {
        configData.git_access_tokens = {};
      }

      // Show existing tokens
      const existingHosts = Object.keys(configData.git_access_tokens);
      if (existingHosts.length > 0) {
        console.log('  现有配置的Git平台:');
        existingHosts.forEach(host => {
          console.log(`    • ${host}: 已设置`);
        });
        console.log('');
      }

      console.log('  您可以添加新的Git平台访问令牌或修改现有配置，直接回车跳过');
      // Git platform tokens with loop for multiple platforms
      while (true) {
        const gitHost = await question('  Git 平台主机名 (如: github.com, gitlab.example.com, gitee.com，留空结束): ');
        if (!gitHost.trim()) break;

        const currentToken = configData.git_access_tokens[gitHost.trim()];
        const tokenPrompt = currentToken
          ? `  ${gitHost.trim()} 访问令牌 [已设置]: `
          : `  ${gitHost.trim()} 访问令牌: `;

        const gitToken = await question(tokenPrompt);
        if (gitToken.trim()) {
          configData.git_access_tokens[gitHost.trim()] = gitToken.trim();
          console.log(`    ✅ 已${currentToken ? '更新' : '添加'} ${gitHost.trim()} 的访问令牌`);
        }

        const continueAdding = await question('  是否继续添加其他 Git 平台令牌？(y/N): ');
        if (continueAdding.toLowerCase() !== 'y' && continueAdding.toLowerCase() !== 'yes') {
          break;
        }
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

    // Merge Request configuration
    if (configModules.includes('mr')) {
      console.log('\n🔀 合并请求指派配置:');
      const currentAssigneeId = configData.merge_request.assignee_id || 0;
      const assigneeId = await question(`  单个指派人用户ID (可选，0表示取消指派) [${currentAssigneeId}]: `);
      const parsedAssigneeId = parseInt(assigneeId.trim(), 10);
      configData.merge_request.assignee_id = isNaN(parsedAssigneeId) ? currentAssigneeId : parsedAssigneeId;

      const currentAssigneeIds = configData.merge_request.assignee_ids || [];
      const assigneeIdsStr = currentAssigneeIds.length > 0 ? currentAssigneeIds.join(',') : '';
      const assigneeIds = await question(`  指派人用户ID列表 (可选，逗号分隔，如: 1,2,3)${assigneeIdsStr ? ` [${assigneeIdsStr}]` : ''}: `);
      if (assigneeIds.trim()) {
        configData.merge_request.assignee_ids = assigneeIds.split(',').map(id => {
          const num = parseInt(id.trim(), 10);
          return isNaN(num) ? 0 : num;
        }).filter(id => id >= 0);
      } else if (!assigneeIdsStr) {
        configData.merge_request.assignee_ids = [];
      }

      const currentReviewerIds = configData.merge_request.reviewer_ids || [];
      const reviewerIdsStr = currentReviewerIds.length > 0 ? currentReviewerIds.join(',') : '';
      const reviewerIds = await question(`  审查者用户ID列表 (可选，逗号分隔，如: 1,2,3)${reviewerIdsStr ? ` [${reviewerIdsStr}]` : ''}: `);
      if (reviewerIds.trim()) {
        configData.merge_request.reviewer_ids = reviewerIds.split(',').map(id => {
          const num = parseInt(id.trim(), 10);
          return isNaN(num) ? 0 : num;
        }).filter(id => id >= 0);
      } else if (!reviewerIdsStr) {
        configData.merge_request.reviewer_ids = [];
      }
    }

    rl.close();

    // Create configuration file
    await createConfigFile(configData, isGlobal, configModules, isIncrementalMode);

    console.log('\n✅ 配置初始化完成！');
    if (canUseIncrementalMode && configModules.length < 6) {
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
  configModules: string[] = ['openai', 'git-tokens', 'conan', 'wecom', 'git', 'mr'],
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
    } catch (error) {
      console.warn('⚠️  无法读取现有全局配置，将创建新配置');
    }
  }

  if (isIncrementalMode && !isGlobal && configModules.length < 6) {
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
  const allModules = ['openai', 'git-tokens', 'conan', 'wecom', 'git', 'mr'];
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
          'git-tokens': 'git_access_tokens',
          'conan': 'conan',
          'wecom': 'wecom',
          'git': 'git',
          'mr': 'merge_request'
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

`;
  }

  if (modulesToInclude.includes('git-tokens')) {
    const gitTokensConfig = getModuleConfig('git_access_tokens', configData.git_access_tokens, existingConfig);
    
    yamlContent += `# Git 访问令牌配置 - 支持多个Git托管平台
git_access_tokens:
${Object.keys(gitTokensConfig || {}).length > 0
        ? Object.entries(gitTokensConfig).map(([host, token]) => `  # ${host} 访问令牌\n  ${host}: ${token}`).join('\n\n')
        : `  # GitHub 访问令牌 - 格式: ghp_xxxxxxxxxxxxxxxxxxxx
  # github.com: ghp_xxxxxxxxxxxxxxxxxxxxx
  
  # GitLab 访问令牌 - 格式: glpat-xxxxxxxxxxxxxxxxxxxx  
  # gitlab.example.com: glpat-xxxxxxxxxxxxxxxxxxxxx
  
  # Gitee 访问令牌 - 格式: gitee_xxxxxxxxxxxxxxxxxxxx
  # gitee.com: gitee_xxxxxxxxxxxxxxxxxxxxx`}

`;
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

  if (modulesToInclude.includes('mr')) {
    const mrConfig = getModuleConfig('mr', configData.merge_request, existingConfig);
    
    yamlContent += `# 合并请求指派配置 - 配置指派人和审查者
merge_request:
  # 单个指派人用户ID (可选) - 设置为0或留空取消指派
  assignee_id: ${mrConfig?.assignee_id || 0}
  
  # 指派人用户ID数组 (可选) - 多个指派人，设置为空数组取消所有指派
  assignee_ids: ${mrConfig?.assignee_ids ? JSON.stringify(mrConfig.assignee_ids) : '[]'}
  
  # 审查者用户ID数组 (可选) - 设置为空数组不添加审查者
  reviewer_ids: ${mrConfig?.reviewer_ids ? JSON.stringify(mrConfig.reviewer_ids) : '[]'}
`;
  }

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
