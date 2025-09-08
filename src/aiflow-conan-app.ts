#!/usr/bin/env node

import { Shell } from './shell.js';
import { HttpClient } from './http/http-client.js';
import { StringUtil } from './utils/string-util.js';
import { GitService } from './services/git-service.js';
import { OpenAiService } from './services/openai-service.js';
import { GitlabService } from './services/gitlab-service.js';
import { WecomNotifier } from './services/wecom-notifier.js';
import { ConanService } from './services/conan-service.js';
import { FileUpdaterService } from './services/file-updater-service.js';
import { configLoader, parseCliArgs, getConfigValue, getCliHelp, LoadedConfig, initConfig } from './config.js';

/**
 * Conan package update application with automated MR creation
 */
export class ConanPkgUpdateApp {
  private readonly shell = new Shell();
  private readonly http = new HttpClient();

  public config!: LoadedConfig;
  private openai!: OpenAiService;
  private gitlab!: GitlabService;
  private wecom!: WecomNotifier;
  private conan!: ConanService;
  private fileUpdater!: FileUpdaterService;

  private readonly git = new GitService(this.shell);

  /**
   * Initialize services with configuration
   */
  private async initializeServices(cliConfig: any = {}): Promise<void> {
    // Load configuration with CLI overrides
    this.config = await configLoader.loadConfig(cliConfig);

    // Display configuration warnings if any
    const warnings = configLoader.getWarnings();
    if (warnings.length > 0) {
      console.log('\n⚠️  配置警告:');
      warnings.forEach(warning => console.log(`  ${warning}`));
      console.log('');
    }

    // Initialize services with configuration values
    this.openai = new OpenAiService(
      getConfigValue(this.config, 'openai.key', '') || '',
      getConfigValue(this.config, 'openai.baseUrl', 'https://api.openai.com/v1') || 'https://api.openai.com/v1',
      getConfigValue(this.config, 'openai.model', 'gpt-3.5-turbo') || 'gpt-3.5-turbo',
      this.http
    );

    this.gitlab = new GitlabService(
      getConfigValue(this.config, 'gitlab.token', '') || '',
      getConfigValue(this.config, 'gitlab.baseUrl', '') || '',
      this.git,
      this.http
    );

    this.wecom = new WecomNotifier(
      getConfigValue(this.config, 'wecom.webhook', '') || ''
    );

    this.conan = new ConanService(
      getConfigValue(this.config, 'conan.remoteBaseUrl', '') || '',
      this.http
    );

    this.fileUpdater = new FileUpdaterService(this.conan, this.git);
  }

  /**
   * Get target branch for merge request (default branch or fallback)
   * @returns Target branch name
   */
  private getTargetBranch(): string {
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

      // Fallback to master if nothing else works
      return 'master';
    } catch (error) {
      console.warn(`⚠️  Could not determine target branch, using 'master': ${error}`);
      return 'master';
    }
  }

  /**
   * Update package and create MR
   * @param packageName Package name to update (e.g., "zterm")
   * @param remote
   */
  async updatePackage(packageName: string, remote: string = "repo"): Promise<void> {
    console.log(`🚀 Starting Conan package update for: ${packageName}`);
    console.log(`📦 Remote repository: ${remote}`);
    console.log(`📁 Working directory: ${process.cwd()}`);

    try {
      // Step 1: Update package files and check for changes
      console.log(`📦 Updating package ${packageName} from remote ${remote}...`);
      const completeInfo = await this.fileUpdater.updatePackage(remote, packageName);

      if (!completeInfo) {
        console.log(`✅ Package ${packageName} is already up to date. No MR needed.`);
        return;
      }

      // Step 2: Show git status and stage updated files
      this.git.showGitInfo();
      this.fileUpdater.stageFiles();

      const diff = this.git.getDiff();
      if (!diff) {
        console.log(`⚠️  No changes detected in files after update. Skipping MR creation.`);
        return;
      }

      // Step 3: Determine target branch
      const targetBranch = this.getTargetBranch();
      console.log(`🎯 Target branch: ${targetBranch}`);

      // Step 4: Generate commit message and branch name using AI
      console.log(`🤖 Generating commit message and branch name...`);
      const {commit, branch} = await this.openai.generateCommitAndBranch(diff);

      // Step 5: Create new branch
      const gitUser = this.git.getUserName();
      const aiBranch = StringUtil.sanitizeBranch(branch);
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const branchName = `${gitUser}/conan-update-${packageName}-${aiBranch}-${dateSuffix}`;

      console.log("✅ Generated branch name:", branchName);
      this.git.createBranch(branchName);

      // Step 6: Commit changes
      const enhancedCommit = `chore: update ${packageName} package\n\n${commit}`;
      console.log("✅ Generated commit message:", enhancedCommit);

      this.git.commit(enhancedCommit);

      // Step 7: Push branch to remote
      console.log(`📤 Pushing branch to remote...`);
      this.git.push(branchName);

      // Step 8: Create Merge Request
      console.log(`📋 Creating Merge Request...`);
      const squashCommits = getConfigValue(this.config, 'git.squashCommits', true);
      const removeSourceBranch = getConfigValue(this.config, 'git.removeSourceBranch', true);

      const mrTitle = `chore: update ${packageName} package to latest version`;
      const mrUrl = await this.gitlab.createMergeRequest(
        branchName,
        targetBranch,
        mrTitle,
        squashCommits,
        removeSourceBranch
      );

      // Step 9: Send notification
      console.log(`📢 Sending notification...`);
      const changedFiles = this.git.getChangedFiles(5);
      if (getConfigValue(this.config, 'wecom.enable', false) && getConfigValue(this.config, 'wecom.webhook', '')) {
        await this.wecom.sendMergeRequestNotice(
          branchName,
          targetBranch,
          mrUrl,
          enhancedCommit,
          changedFiles
        );
        console.log("📢 Notification sent via WeCom webhook.");
      }

      // Format MR information for sharing
      const mrInfo = `🎉 Conan - ${packageName} 包更新合并请求创建成功！

📦 包名: ${packageName}
📋 MR 链接: ${mrUrl}

📝 提交信息:
${enhancedCommit}

🌿 分支信息:
• 源分支: ${branchName}
• 目标分支: ${targetBranch}

📁 变更文件 (${changedFiles.length} 个):
${changedFiles.map(file => `• ${file}`).join('\n')}

⚙️ MR 配置:
• 压缩提交: ${squashCommits ? '✅ 是' : '❌ 否'}
• 删除源分支: ${removeSourceBranch ? '✅ 是' : '❌ 否'}

📢 通知状态: ${getConfigValue(this.config, 'wecom.enable', false) ? '✅ 已发送企业微信通知' : '⏭️  未启用通知'}
`;

      console.log(mrInfo);
      console.log(`✅ Conan package update workflow completed successfully!`);

    } catch (error) {
      console.error(`❌ Error during package update:`, error);
      process.exit(1);
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): void {
    const requiredConfigs = [
      {key: 'openai.key', name: 'OpenAI API Key'},
      {key: 'openai.baseUrl', name: 'OpenAI Base URL'},
      {key: 'openai.model', name: 'OpenAI Model'},
      {key: 'gitlab.token', name: 'GitLab Token'}
    ];

    const missing: string[] = [];

    for (const config of requiredConfigs) {
      const value = getConfigValue(this.config, config.key, '');
      if (!value) {
        missing.push(config.name);
      }
    }

    if (missing.length > 0) {
      console.error(`❌ Missing required configuration: ${missing.join(', ')}`);
      console.error(`💡 Please run 'aiflow-conan init' to configure or check your config files`);
      process.exit(1);
    }

    console.log(`✅ Configuration validation passed`);
  }

  /**
   * Display usage information
   */
  static showUsage(): void {
    console.log(`
🔧 AIFlow Conan Tool

Usage:
  aiflow-conan [init] [options] <package-name> [remote]

Commands:
  init                   交互式配置初始化
  init --global, -g      初始化全局配置

Arguments:
  package-name    Name of the Conan package to update (e.g., "zterm")
  remote         Conan remote repository name (default: from config or "repo")

Options:
  --config-help          显示 CLI 配置选项帮助
  --help, -h             显示此帮助信息

Configuration Options (可以通过 CLI 参数覆盖配置文件):
  -ok, --openai-key <key>               OpenAI API 密钥
  -obu, --openai-base-url <url>         OpenAI API 地址
  -om, --openai-model <model>           OpenAI 模型
  -gt, --gitlab-token <token>           GitLab 访问令牌
  -gbu, --gitlab-base-url <url>         GitLab 地址
  -crbu, --conan-remote-base-url <url>  Conan 仓库 API 地址
  -crr, --conan-remote-repo <repo>      Conan 仓库名称
  -ww, --wecom-webhook <url>            企业微信 Webhook 地址
  -we, --wecom-enable <bool>            启用企业微信通知
  -sc, --squash-commits <bool>          压缩提交
  -rsb, --remove-source-branch <bool>   删除源分支

Examples:
  aiflow-conan init                              # 交互式初始化本地配置
  aiflow-conan init --global                     # 交互式初始化全局配置
  aiflow-conan zterm                             # 使用配置文件运行
  aiflow-conan zterm repo                        # 指定远程仓库
  aiflow-conan -ok sk-123 -gt glpat-456 zterm    # 使用 CLI 参数覆盖配置

配置文件位置 (按优先级排序):
  1. 命令行参数 (最高优先级)
  2. .aiflow/config.yaml (本地配置)
  3. ~/.config/aiflow/config.yaml (全局配置)
  4. 环境变量 (最低优先级)

Auto-Detection Features:
  ✅ GitLab project ID from git remote URL (HTTP/SSH supported)
  ✅ GitLab base URL from git remote URL
  ✅ Target branch detection (main/master/develop)

Files Required:
  conandata.yml     Conan data file in current directory
  conan.win.lock    Conan lock file in current directory
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

    // Show usage if no arguments or help requested
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      ConanPkgUpdateApp.showUsage();
      process.exit(0);
    }

    // Parse CLI configuration arguments (filter out package name and remote)
    const configArgs = args.filter(arg => arg.startsWith('-'));
    const cliConfig = parseCliArgs(configArgs);

    // Get non-config arguments (package name and remote)
    const nonConfigArgs = args.filter(arg => !arg.startsWith('-'));
    const packageName = nonConfigArgs[0];
    const remote = nonConfigArgs[1];

    if (!packageName) {
      console.error('❌ Package name is required');
      ConanPkgUpdateApp.showUsage();
      process.exit(1);
    }

    console.log(`🚀 AIFlow Conan Tool`);
    console.log(`📦 Package: ${packageName}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log('─'.repeat(50));

    const app = new ConanPkgUpdateApp();

    // Initialize services with configuration
    await app.initializeServices(cliConfig);

    // Validate configuration before starting
    app.validateConfiguration();

    // Get remote from config or CLI or default
    const finalRemote = remote || getConfigValue(app.config, 'conan.remoteRepo', 'repo') || 'repo';
    console.log(`🌐 Remote: ${finalRemote}`);

    // Run the update workflow
    await app.updatePackage(packageName, finalRemote);
  }
}

ConanPkgUpdateApp.main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});