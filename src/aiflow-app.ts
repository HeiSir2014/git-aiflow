#!/usr/bin/env node

import { Shell } from './shell.js';
import { HttpClient } from './http/http-client.js';
import { StringUtil } from './utils/string-util.js';
import { GitService } from './services/git-service.js';
import { OpenAiService } from './services/openai-service.js';
import { GitPlatformServiceFactory, GitPlatformService, getGitAccessTokenForCurrentRepo } from './services/git-platform-service.js';
import { WecomNotifier } from './services/wecom-notifier.js';
import { configLoader, parseCliArgs, getConfigValue, getCliHelp, LoadedConfig, initConfig } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import clipboard from 'clipboardy';

/**
 * Base class for AI-powered Git automation applications
 */
export abstract class BaseAiflowApp {
  protected readonly shell = new Shell();
  protected readonly http = new HttpClient();
  protected readonly git = new GitService(this.shell);

  protected config!: LoadedConfig;
  protected openai!: OpenAiService;
  protected gitPlatform!: GitPlatformService;
  protected wecom!: WecomNotifier;

  /**
   * Initialize services with configuration
   */
  protected async initializeServices(cliConfig: any = {}): Promise<void> {
    // Load configuration with priority merging
    this.config = await configLoader.loadConfig(cliConfig);

    // Initialize services with configuration
    this.openai = new OpenAiService(
      getConfigValue(this.config, 'openai.key', '') || '',
      getConfigValue(this.config, 'openai.baseUrl', 'https://api.openai.com/v1') || 'https://api.openai.com/v1',
      getConfigValue(this.config, 'openai.model', 'gpt-3.5-turbo') || 'gpt-3.5-turbo',
      this.http
    );

    // Create platform-specific service using factory (fully automatic)
    const platformService = await GitPlatformServiceFactory.create();

    if (!platformService) {
      throw new Error('Unsupported Git platform. Currently supported: GitLab, GitHub');
    }

    this.gitPlatform = platformService;

    this.wecom = new WecomNotifier(
      getConfigValue(this.config, 'wecom.webhook', '') || ''
    );

    // Display configuration warnings
    const warnings = configLoader.getWarnings();
    if (warnings.length > 0) {
      console.log('\n⚠️  Configuration warnings:');
      warnings.forEach(warning => console.log(`  ${warning}`));
      console.log('');
    }
  }

  /**
   * Get target branch for merge request (default branch or fallback)
   * @returns Target branch name
   */
  protected getTargetBranch(): string {
    try {
      // Try to get the default branch from git remote
      const currentBranch = this.git.getCurrentBranch();
      try {
        this.shell.run(`git rev-parse --verify origin/${currentBranch}`).trim();
        return currentBranch;
      } catch (fallbackError) {
        console.warn(`⚠️  Could not determine target branch, check: ${fallbackError}`);
      }

      // Common default branch names to try
      const defaultBranches = ['main', 'master', 'develop'];

      // If current branch is one of the default branches, use it
      if (defaultBranches.includes(currentBranch)) {
        return currentBranch;
      }

      // Otherwise, try to find the default branch by checking which exists
      for (const branch of defaultBranches) {
        try {
          // Check if remote branch exists
          this.shell.run(`git rev-parse --verify origin/${branch}`);
          return branch;
        } catch {
          // Branch doesn't exist, try next
        }
      }

      // Fallback to main if nothing else works
      return 'main';
    } catch (error) {
      console.warn(`⚠️  Could not determine target branch, using 'main': ${error}`);
      return 'main';
    }
  }

  /**
   * Validate required configuration for the application
   */
  protected validateConfiguration(): void {
    const requiredConfigs = [
      { key: 'openai.key', name: 'OpenAI API Key' },
      { key: 'openai.baseUrl', name: 'OpenAI Base URL' },
      { key: 'openai.model', name: 'OpenAI Model' },
    ];

    const missing: string[] = [];

    for (const config of requiredConfigs) {
      const value = getConfigValue(this.config, config.key, '');
      if (!value) {
        missing.push(config.name);
      }
    }

    // Validate Git access token for current repository
    try {
      getGitAccessTokenForCurrentRepo(this.config, this.git);
    } catch (error) {
      missing.push('Git Access Token for current repository');
      console.error(`❌ ${error instanceof Error ? error.message : 'Unknown Git token error'}`);
    }

    if (missing.length > 0) {
      console.error(`❌ Missing required configuration: ${missing.join(', ')}`);
      console.error(`💡 Please run 'aiflow init' to configure or check your config files`);
      process.exit(1);
    }

    console.log(`✅ Configuration validation passed`);
  }

  /**
   * Create automated merge request from staged changes
   */
  async run(): Promise<void> {
    console.log(`🚀 AIFlow Tool`);
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('─'.repeat(50));

    try {
      // Step 1: Check for staged changes
      const diff = this.git.getDiff();
      if (!diff) {
        console.error("❌ No staged changes found. Please run git add . first.");
        process.exit(1);
      }
      const changedFiles = this.git.getChangedFiles();

      // Step 2: Determine target branch
      const targetBranch = this.getTargetBranch();
      console.log(`🎯 Target branch: ${targetBranch}`);

      // Step 3: Generate commit message and branch name using AI
      console.log(`🤖 Generating commit message and branch name...`);
      const { commit, branch } = await this.openai.generateCommitAndBranch(diff);

      console.log("✅ Generated commit message:", commit);
      console.log("✅ Generated branch suggestion:", branch);

      // Step 4: Create branch name
      const gitUser = this.git.getUserName();
      const aiBranch = StringUtil.sanitizeBranch(branch);
      const dateSuffix = new Date().toISOString().slice(0, 19).replace(/-|T|:/g, "");
      const branchName = `${gitUser}/${aiBranch}-${dateSuffix}`;
      console.log("✅ Generated branch name:", branchName);

      // Step 5: Commit and push
      console.log(`📤 Creating branch and pushing changes...`);
      this.git.commitAndPush(branchName, commit);

      // Step 6: Create Merge Request
      console.log(`📋 Creating Merge Request...`);
      const squashCommits = getConfigValue(this.config, 'git.squashCommits', true);
      const removeSourceBranch = getConfigValue(this.config, 'git.removeSourceBranch', true);

      const mrUrl = await this.gitPlatform.createMergeRequest(
        branchName,
        targetBranch,
        commit,
        squashCommits,
        removeSourceBranch
      );
      console.log(`🎉 ${this.gitPlatform.getPlatformName() === 'github' ? 'Pull Request' : 'Merge Request'} created:`, mrUrl);

      // Step 7: Send notification
      if (getConfigValue(this.config, 'wecom.enable', false) && getConfigValue(this.config, 'wecom.webhook', '')) {
        console.log(`📢 Sending notification...`);
        await this.wecom.sendMergeRequestNotice(branchName, targetBranch, mrUrl, commit, changedFiles);
        console.log("📢 Notification sent via WeCom webhook.");
      }

      console.log(`✅ AIFlow workflow completed successfully!`);

      // Step 8: Print the MR info and copy to clipboard
      // Format MR information for sharing
      const isGitHub = this.gitPlatform.getPlatformName() === 'github';
      const requestType = isGitHub ? 'Pull Request' : 'Merge Request';
      const requestAbbr = isGitHub ? 'PR' : 'MR';

      const outputMrInfo = `🎉 ${requestType}创建成功，请及时进行代码审查！
📋 ${requestAbbr} 链接: ${mrUrl}
📝 提交信息:
${commit}
🌿 分支信息: ${branchName} ->  ${targetBranch}
📁 变更文件 (${changedFiles.length} 个)${changedFiles.length > 10 ? `前10个: ` : ': '}
${changedFiles.slice(0, 10).map(file => `• ${file}`).join('\n')}${changedFiles.length > 10 ? `\n...${changedFiles.length - 10}个文件` : ''}`;
      const consoleMrInfo = `
${'-'.repeat(50)}
${outputMrInfo}
${'-'.repeat(50)}
`;
      console.log(consoleMrInfo);
      await clipboard.write(outputMrInfo);
      console.log("📋 MR info copied to clipboard.");
    } catch (error) {
      console.error(`❌ Error during MR creation:`, error);
      process.exit(1);
    }
  }

}

/**
 * Git Auto MR application for automated merge request creation
 */
export class GitAutoMrApp extends BaseAiflowApp {


  /**
   * Display usage information
   */
  static showUsage(): void {
    console.log(`
🔧 AIFlow Tool

Usage:
  aiflow [init] [options]

Commands:
  init                   交互式配置初始化
  init --global, -g      初始化全局配置
  
Options:
  --config-help          显示 CLI 配置选项帮助
  --help, -h             显示此帮助信息
  
Configuration Options (可以通过 CLI 参数覆盖配置文件):
  -ok, --openai-key <key>               OpenAI API 密钥
  -obu, --openai-base-url <url>         OpenAI API 地址
  -om, --openai-model <model>           OpenAI 模型
  -gat, --git-access-token <host=token> Git 访问令牌 (格式: 主机名=令牌)
  -crbu, --conan-remote-base-url <url>  Conan 仓库 API 地址
  -crr, --conan-remote-repo <repo>      Conan 仓库名称
  -ww, --wecom-webhook <url>            企业微信 Webhook 地址
  -we, --wecom-enable <bool>            启用企业微信通知
  -sc, --squash-commits <bool>          压缩提交
  -rsb, --remove-source-branch <bool>   删除源分支

Description:
  使用 AI 生成的提交信息和分支名称自动创建合并请求

Prerequisites:
  1. 暂存您的更改: git add .
  2. 配置必要参数: aiflow init 或手动创建配置文件

配置文件位置 (按优先级排序):
  1. 命令行参数 (最高优先级)
  2. .aiflow/config.yaml (本地配置)
  3. ~/.config/aiflow/config.yaml (全局配置)
  4. 环境变量 (最低优先级)

Auto-Detection Features:
  ✅ Git 托管平台项目 ID 从 git remote URL 自动检测 (支持 HTTP/SSH)
  ✅ Git 托管平台 base URL 从 git remote URL 自动检测
  ✅ 目标分支自动检测 (main/master/develop)
  ✅ Git 访问令牌基于当前仓库主机名自动选择

Workflow:
  1. 分析暂存的更改
  2. 生成 AI 提交信息和分支名称
  3. 创建并推送新分支
  4. 创建合并请求
  5. 发送企业微信通知

Examples:
  aiflow init                                            # 交互式初始化本地配置
  aiflow init --global                                   # 交互式初始化全局配置
  aiflow                                                 # 使用配置文件运行
  aiflow -ok sk-123 -gat github.com=ghp_456             # 使用 CLI 参数覆盖配置
  aiflow -gat gitlab.example.com=glpat-456 -we true     # 多平台访问令牌配置
`);
  }

  /**
   * Main entry point for command line execution
   */
  static async main(): Promise<void> {
    const args = process.argv.slice(2);

    // Handle init command
    if (args.includes('init')) {
      const isGlobal = args.includes('--global') || args.includes('-g');
      await initConfig(isGlobal);
      return;
    }

    // Show CLI help
    if (args.includes('--config-help')) {
      console.log(getCliHelp());
      process.exit(0);
    }

    // Show usage if help requested
    if (args.includes('--help') || args.includes('-h')) {
      GitAutoMrApp.showUsage();
      process.exit(0);
    }

    // Parse CLI configuration arguments
    const cliConfig = parseCliArgs(args);

    const app = new GitAutoMrApp();

    // Initialize services with configuration
    await app.initializeServices(cliConfig);

    // Validate configuration before starting
    app.validateConfiguration();

    // Run the MR creation workflow
    await app.run();
  }
}

// Only run if this file is executed directly
const isMain = path.basename(fileURLToPath(import.meta.url)).toLowerCase() === path.basename(process.argv[1]).toLowerCase();
if (isMain) {
  GitAutoMrApp.main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}