import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import readline from 'readline';

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

export interface AiflowConfig {
  // OpenAI Configuration
  openai?: {
    key?: string;
    baseUrl?: string;
    model?: string;
  };

  // GitLab Configuration
  gitlab?: {
    token?: string;
    baseUrl?: string;
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
    const envMapping = {
      'OPENAI_KEY': 'openai.key',
      'OPENAI_BASE_URL': 'openai.baseUrl',
      'OPENAI_MODEL': 'openai.model',
      'GITLAB_TOKEN': 'gitlab.token',
      'GITLAB_BASE_URL': 'gitlab.baseUrl',
      'CONAN_REMOTE_BASE_URL': 'conan.remoteBaseUrl',
      'CONAN_REMOTE_REPO': 'conan.remoteRepo',
      'WECOM_WEBHOOK': 'wecom.webhook',
      'WECOM_ENABLE': 'wecom.enable',
      'SQUASH_COMMITS': 'git.squashCommits',
      'REMOVE_SOURCE_BRANCH': 'git.removeSourceBranch',
    };

    for (const [envKey, configPath] of Object.entries(envMapping)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        this.setNestedValue(config, configPath, this.parseEnvValue(envValue));
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
      { path: 'gitlab.token', name: 'GITLAB_TOKEN', description: 'GitLab personal access token for API operations' },
    ];

    const optionalConfigs = [
      { path: 'gitlab.baseUrl', name: 'GITLAB_BASE_URL', description: 'GitLab base URL (optional, auto-detected)' },
      { path: 'conan.remoteBaseUrl', name: 'CONAN_REMOTE_BASE_URL', description: 'Conan remote base URL (required for conan operations)' },
      { path: 'conan.remoteRepo', name: 'CONAN_REMOTE_REPO', description: 'Conan remote repository name (optional)' },
      { path: 'wecom.webhook', name: 'WECOM_WEBHOOK', description: 'WeChat Work webhook URL (optional)' },
      { path: 'wecom.enable', name: 'WECOM_ENABLE', description: 'WeChat Work notifications enable flag (optional)' },
    ];

    // Check required configurations
    for (const { path, name, description } of requiredConfigs) {
      if (!this.getNestedValue(config, path)) {
        this.warnings.push(`⚠️  Missing required configuration: ${name} - ${description}`);
      }
    }

    // Report missing optional configurations
    for (const { path, name, description } of optionalConfigs) {
      if (!this.getNestedValue(config, path)) {
        console.log(`ℹ️  Optional configuration not set: ${name} - ${description}`);
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
    console.log('\n📋 Configuration Sources:');
    for (const [key, source] of config._sources.entries()) {
      const sourceName = source.source.toUpperCase();
      const sourcePath = source.path ? ` (${source.path})` : '';
      console.log(`  ${key}: ${sourceName}${sourcePath}`);
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
      gitlab: {
        token: 'your-gitlab-token',
        baseUrl: 'https://gitlab.example.com',
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

# GitLab 配置 - 用于仓库操作和合并请求管理
gitlab:
  # GitLab 个人访问令牌 (必需) - 用于API操作，需要api和write_repository权限
  token: ${exampleConfig.gitlab?.token}
  
  # GitLab 基础URL (可选) - 自定义GitLab实例地址，留空时自动从git remote检测
  baseUrl: ${exampleConfig.gitlab?.baseUrl}

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
`;

    fs.writeFileSync(localConfigPath, yamlContent);
    console.log(`📝 Created example config: ${localConfigPath}`);

    // Create global example config
    const globalConfigDir = path.join(this.getUserDataDir(), ConfigLoader.GLOBAL_CONFIG_DIR);
    const globalExamplePath = path.join(globalConfigDir, 'config.example.yaml');
    
    if (!fs.existsSync(globalConfigDir)) {
      fs.mkdirSync(globalConfigDir, { recursive: true });
    }

    fs.writeFileSync(globalExamplePath, yamlContent);
    console.log(`📝 Created global example config: ${globalExamplePath}`);
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
      case 'gitlab-token':
        config.gitlab = { ...config.gitlab, token: value };
        i++;
        break;
      case 'gitlab-base-url':
        config.gitlab = { ...config.gitlab, baseUrl: value };
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
    
    // GitLab shortcuts (GitLab Token, GitLab Base Url)
    'gt': 'gitlab-token',
    'gbu': 'gitlab-base-url',
    
    // Conan shortcuts (Conan Remote Base Url, Conan Remote Repo)
    'crbu': 'conan-remote-base-url',
    'crr': 'conan-remote-repo',
    
    // WeChat Work shortcuts (WeChat Work webhook, WeChat Work Enable)
    'ww': 'wecom-webhook',
    'we': 'wecom-enable',
    
    // Git shortcuts (Squash Commits, Remove Source Branch)
    'sc': 'squash-commits',
    'rsb': 'remove-source-branch',
  };
  
  return shortArgMap[shortKey] || shortKey;
}

/**
 * Get help text for CLI arguments
 */
export function getCliHelp(): string {
  return `
AIFlow CLI 配置选项

配置优先级: 命令行参数 > 本地配置(.aiflow/config.yaml) > 全局配置(~/.config/aiflow/config.yaml) > 环境变量

OpenAI 配置 - AI功能支持:
  -ok, --openai-key <key>               OpenAI API密钥 (必需，用于AI生成提交信息)
  -obu, --openai-base-url <url>         OpenAI API地址 (必需，API请求端点)
  -om, --openai-model <model>           OpenAI模型 (必需，如gpt-3.5-turbo、gpt-4)

GitLab 配置 - 仓库操作:
  -gt, --gitlab-token <token>           GitLab访问令牌 (必需，需要api和write_repository权限)
  -gbu, --gitlab-base-url <url>         GitLab地址 (可选，留空时自动检测)

Conan 配置 - C++包管理:
  -crbu, --conan-remote-base-url <url>  Conan仓库API地址 (Conan操作时必需)
  -crr, --conan-remote-repo <repo>      Conan仓库名称 (可选，默认为'repo')

企业微信配置 - 通知功能:
  -ww, --wecom-webhook <url>            企业微信机器人Webhook地址 (可选)
  -we, --wecom-enable <bool>            启用企业微信通知 (可选，true/false)

Git 配置 - 合并请求行为:
  -sc, --squash-commits <bool>          压缩提交 (可选，合并时压缩多个提交)
  -rsb, --remove-source-branch <bool>   删除源分支 (可选，合并后删除分支)

使用示例:
  # 基本配置
  aiflow -ok sk-abc123 -gt glpat-xyz789
  
  # 完整配置
  aiflow -ok sk-abc123 -gt glpat-xyz789 -crbu https://conan.company.com -we true
  
  # 使用长参数名
  aiflow --openai-key sk-abc123 --gitlab-token glpat-xyz789 --wecom-enable false

配置文件位置:
  本地: .aiflow/config.yaml
  全局: ~/.config/aiflow/config.yaml (Linux/macOS) 或 %APPDATA%/aiflow/config.yaml (Windows)
  
运行 'aiflow --create-config' 可生成示例配置文件
`;
}

/**
 * Interactive configuration initialization
 */
export async function initConfig(isGlobal: boolean = false): Promise<void> {
  console.log(`🔧 AIFlow 配置初始化${isGlobal ? ' (全局)' : ' (本地)'}`);
  console.log(`📁 配置位置: ${isGlobal ? '~/.config/aiflow/config.yaml' : '.aiflow/config.yaml'}`);
  console.log('💡 提示：直接回车使用默认值或跳过可选配置\n');

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
    // Collect configuration
    const configData: any = {
      openai: {},
      gitlab: {},
      conan: {},
      wecom: {},
      git: {}
    };

    // OpenAI configuration
    console.log('🤖 OpenAI 配置:');
    const openaiKey = await question('  OpenAI API 密钥 (必需): ');
    if (openaiKey.trim()) configData.openai.key = openaiKey.trim();

    const openaiBaseUrl = await question('  OpenAI API 地址 [https://api.openai.com/v1]: ');
    configData.openai.baseUrl = openaiBaseUrl.trim() || 'https://api.openai.com/v1';

    const openaiModel = await question('  OpenAI 模型 [gpt-3.5-turbo]: ');
    configData.openai.model = openaiModel.trim() || 'gpt-3.5-turbo';

    // GitLab configuration
    console.log('\n🦊 GitLab 配置:');
    const gitlabToken = await question('  GitLab 访问令牌 (必需): ');
    if (gitlabToken.trim()) configData.gitlab.token = gitlabToken.trim();

    const gitlabBaseUrl = await question('  GitLab 地址 (可选，留空自动检测): ');
    if (gitlabBaseUrl.trim()) configData.gitlab.baseUrl = gitlabBaseUrl.trim();

    // Conan configuration
    console.log('\n📦 Conan 配置:');
    const conanBaseUrl = await question('  Conan 仓库 API 地址 (可选): ');
    if (conanBaseUrl.trim()) configData.conan.remoteBaseUrl = conanBaseUrl.trim();

    const conanRepo = await question('  Conan 仓库名称 [repo]: ');
    configData.conan.remoteRepo = conanRepo.trim() || 'repo';

    // WeChat Work configuration
    console.log('\n💬 企业微信配置:');
    const wecomWebhook = await question('  企业微信 Webhook 地址 (可选): ');
    if (wecomWebhook.trim()) configData.wecom.webhook = wecomWebhook.trim();

    const wecomEnable = await question('  启用企业微信通知 [true]: ');
    configData.wecom.enable = wecomEnable.trim() !== 'false';

    // Git configuration
    console.log('\n🌿 Git 配置:');
    const squashCommits = await question('  压缩提交 [true]: ');
    configData.git.squashCommits = squashCommits.trim() !== 'false';

    const removeSourceBranch = await question('  删除源分支 [true]: ');
    configData.git.removeSourceBranch = removeSourceBranch.trim() !== 'false';

    rl.close();

    // Create configuration file
    await createConfigFile(configData, isGlobal);

    console.log('\n✅ 配置初始化完成！');
    console.log(`📁 配置文件已创建: ${isGlobal ? '全局配置' : '本地配置'}`);
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
export async function createConfigFile(configData: any, isGlobal: boolean): Promise<void> {
  // Generate YAML content with comments
  const yamlContent = `# AIFlow 配置文件
# 配置优先级: 命令行参数 > 本地配置(.aiflow/config.yaml) > 全局配置(~/.config/aiflow/config.yaml) > 环境变量

# OpenAI API 配置 - 用于AI驱动的功能
openai:
  # OpenAI API 密钥 (必需) - 用于生成提交信息和代码分析
  key: ${configData.openai.key || 'your-openai-api-key'}
  
  # OpenAI API 基础URL (必需) - API请求的端点地址
  baseUrl: ${configData.openai.baseUrl}
  
  # OpenAI 模型名称 (必需) - 指定使用的AI模型，如 gpt-3.5-turbo, gpt-4
  model: ${configData.openai.model}

# GitLab 配置 - 用于仓库操作和合并请求管理
gitlab:
  # GitLab 个人访问令牌 (必需) - 用于API操作，需要api和write_repository权限
  token: ${configData.gitlab.token || 'your-gitlab-token'}
  
  # GitLab 基础URL (可选) - 自定义GitLab实例地址，留空时自动从git remote检测
  ${configData.gitlab.baseUrl ? `baseUrl: ${configData.gitlab.baseUrl}` : '# baseUrl: https://gitlab.example.com'}

# Conan 包管理器配置 - 用于C++包管理和版本更新
conan:
  # Conan 远程仓库基础URL (Conan操作时必需) - Conan包仓库的API地址
  ${configData.conan.remoteBaseUrl ? `remoteBaseUrl: ${configData.conan.remoteBaseUrl}` : '# remoteBaseUrl: https://conan.example.com'}
  
  # Conan 远程仓库名称 (可选) - 默认使用的仓库名称，默认为'repo'
  remoteRepo: ${configData.conan.remoteRepo}

# 企业微信通知配置 - 用于发送操作结果通知
wecom:
  # 启用企业微信通知 (可选) - 是否开启通知功能，默认为false
  enable: ${configData.wecom.enable}
  
  # 企业微信机器人Webhook地址 (可选) - 用于发送通知消息的机器人地址
  ${configData.wecom.webhook ? `webhook: ${configData.wecom.webhook}` : '# webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key'}

# Git 合并请求配置 - 控制MR的默认行为
git:
  # 压缩提交 (可选) - 合并时是否将多个提交压缩为一个，默认为true
  squashCommits: ${configData.git.squashCommits}
  
  # 删除源分支 (可选) - 合并后是否删除源分支，默认为true
  removeSourceBranch: ${configData.git.removeSourceBranch}
`;

  // Determine config path
  let configPath: string;
  if (isGlobal) {
    // Use the same getUserDataDir logic for consistency
    const userDataDir = getUserDataDir();
    const configDir = path.join(userDataDir, 'aiflow');
    configPath = path.join(configDir, 'config.yaml');
    
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
