#!/usr/bin/env node

import { BaseAiflowApp } from './aiflow-app.js';
import { MergeRequestOptions } from './services/git-platform-service.js';
import { StringUtil } from './utils/string-util.js';
import { ConanService } from './services/conan-service.js';
import { FileUpdaterService } from './services/file-updater-service.js';
import { UpdateChecker } from './utils/update-checker.js';
import { ColorUtil } from './utils/color-util.js';
import { parseCliArgs, getConfigValue, getCliHelp, initConfig } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import clipboardy from 'clipboardy';
import { readFileSync } from 'fs';
import { logger } from './logger.js';
/**
 * Conan package update application with automated MR creation
 */
export class ConanPkgUpdateApp extends BaseAiflowApp {
  private conan!: ConanService;
  private fileUpdater!: FileUpdaterService;

  /**
   * Initialize services with configuration (override to add Conan-specific services)
   */
  protected async initializeServices(cliConfig: any = {}): Promise<void> {
    // Call parent initialization
    await super.initializeServices(cliConfig);

    // Initialize Conan-specific services
    this.conan = new ConanService(
      getConfigValue(this.config, 'conan.remoteBaseUrl', '') || '',
      this.http
    );

    this.fileUpdater = new FileUpdaterService(this.conan, this.git);
  }


  /**
   * Update package and create MR
   * @param packageName Package name to update (e.g., "zterm")
   * @param remote
   */
  async updatePackage(packageName: string, remote: string = "repo"): Promise<void> {
    logger.info(`🚀 AIFlow Conan Tool - Package Update`);
    logger.info(`📦 Package: ${packageName}`);
    logger.info(`🌐 Remote: ${remote}`);
    logger.info(`📁 Working directory: ${process.cwd()}`);
    logger.info(`⏰ Started at: ${new Date().toISOString()}`);
    logger.info('─'.repeat(50));

    try {
      // Step 1: Update package files and check for changes
      logger.info(`📦 Updating package ${packageName} from remote ${remote}...`);
      const completeInfo = await this.fileUpdater.updatePackage(remote, packageName);

      if (!completeInfo) {
        logger.info(`✅ Package ${packageName} is already up to date. No MR needed.`);
        return;
      }

      // Step 2: Show git status and stage updated files
      this.git.showGitInfo();
      this.fileUpdater.stageFiles();

      const diff = this.git.getDiff();
      if (!diff) {
        logger.info(`⚠️  No changes detected in files after update. Skipping MR creation.`);
        return;
      }

      const changedFiles = this.git.getChangedFiles();

      // Step 3: Determine target branch and current branch
      const currentBranch = this.git.getCurrentBranch();
      const targetBranch = this.git.getTargetBranch();
      logger.info(`🌿 Current branch: ${currentBranch}`);
      logger.info(`🎯 Target branch: ${targetBranch}`);

      // Step 4: Generate commit message and branch name using AI
      logger.info(`🤖 Generating commit message and branch name...`);
      const { commit, branch, description, title } = await this.openai.generateCommitAndBranch(diff, getConfigValue(this.config, 'git.generation_lang', 'en'));
      logger.info(`✅ Generated commit message length: ${commit && commit.length}`);
      logger.info(`✅ Generated branch suggestion: ${branch}`);
      logger.info(`✅ Generated MR description length: ${description && description.length}`);
      logger.info(`✅ Generated MR title: ${title}`);

      // Step 5: Create new branch
      const gitUser = this.git.getUserName();
      const aiBranch = StringUtil.sanitizeBranch(branch);
      const dateSuffix = new Date().toISOString().slice(0, 19).replace(/-|T|:/g, "");
      const branchName = `${gitUser}/conan-update-${packageName}-${aiBranch}-${dateSuffix}`;

      logger.info(`✅ Generated branch name: ${branchName}`);

      // Step 6: Commit changes
      const enhancedCommit = commit;
      logger.info(`✅ Generated commit message: ${enhancedCommit}`);

      // Dynamic countdown before committing and pushing
      await ColorUtil.countdown(3, `Creating branch(${branchName}) and pushing`, 'Committing now...');
      this.git.createBranch(branchName);
      this.git.commit(enhancedCommit);

      // Step 7: Push branch to remote
      logger.info(`📤 Pushing branch to remote...`);
      this.git.push(branchName);

      // Step 8: Create Merge Request
      logger.info(`📋 Creating Merge Request...`);
      const squashCommits = getConfigValue(this.config, 'git.squashCommits', true);
      const removeSourceBranch = getConfigValue(this.config, 'git.removeSourceBranch', true);

      // Get merge request configuration
      const assigneeId = getConfigValue(this.config, 'merge_request.assignee_id');
      const assigneeIds = getConfigValue(this.config, 'merge_request.assignee_ids');
      const reviewerIds = getConfigValue(this.config, 'merge_request.reviewer_ids');

      const mergeRequestOptions: MergeRequestOptions = {
        squash: squashCommits,
        removeSourceBranch: removeSourceBranch,
        description: description
      };

      // Add assignee configuration if specified
      if (typeof assigneeId === 'number' && assigneeId > 0) {
        mergeRequestOptions.assignee_id = assigneeId;
      }

      if (assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0) {
        mergeRequestOptions.assignee_ids = assigneeIds;
      }

      if (reviewerIds && Array.isArray(reviewerIds) && reviewerIds.length > 0) {
        mergeRequestOptions.reviewer_ids = reviewerIds;
      }

      const mrTitle = title;

      // Dynamic countdown before creating MR
      await ColorUtil.countdown(3, 'Creating merge request in', 'Creating merge request now...');

      const mrUrl = await this.gitPlatform.createMergeRequest(
        branchName,
        targetBranch,
        mrTitle,
        mergeRequestOptions
      );
      logger.info(`🎉 ${this.gitPlatform.getPlatformName() === 'github' ? 'Pull Request' : 'Merge Request'} created:`, mrUrl);

      // Step 9: Switch back to original branch if different
      if (currentBranch && currentBranch !== branchName) {
        logger.info(`✅ Auto checkout to ${currentBranch}`);
        this.git.checkout(currentBranch);
      }

      // Step 10: Send notification
      if (getConfigValue(this.config, 'wecom.enable', false) && getConfigValue(this.config, 'wecom.webhook', '')) {
        logger.info(`📢 Sending notification...`);
        await this.wecom.sendMergeRequestNotice(
          branchName,
          targetBranch,
          mrUrl,
          mrTitle,
          enhancedCommit,
          changedFiles
        );
        logger.info("📢 Notification sent via WeCom webhook.");
      }

      logger.info(`✅ AIFlow Conan workflow completed successfully!`);

      // Step 11: Print the MR info and copy to clipboard
      // Format MR information for sharing
      const isGitHub = this.gitPlatform.getPlatformName() === 'github';
      const requestType = isGitHub ? 'Pull Request' : 'Merge Request';
      const requestAbbr = isGitHub ? 'PR' : 'MR';

      const outputMrInfo = `🎉 Conan - ${packageName} 包更新${requestType}创建成功！
📋 ${requestAbbr} 链接: ${mrUrl}
🌿 分支信息: ${branchName} ->  ${targetBranch}
📝 提交信息:
${enhancedCommit}
📁 变更文件 (${changedFiles.length} 个)${changedFiles.length > 10 ? `前10个: ` : ': '}
${changedFiles.slice(0, 10).map(file => `• ${file}`).join('\n')}${changedFiles.length > 10 ? `\n...${changedFiles.length - 10}个文件` : ''}`;
      const consoleMrInfo = `
${'-'.repeat(50)}
${outputMrInfo}
${'-'.repeat(50)}
`;
      logger.info(consoleMrInfo);
      await clipboardy.write(outputMrInfo);
      logger.info("📋 MR info copied to clipboard.");

    } catch (error) {
      logger.error(`❌ Error during package update:`, error);
      process.exit(1);
    }
  }

  /**
   * Validate configuration (override to add Conan-specific validation)
   */
  protected validateConfiguration(): void {
    // Call parent validation
    super.validateConfiguration();

    // Additional Conan-specific validation
    const conanBaseUrl = getConfigValue(this.config, 'conan.remoteBaseUrl', '');
    if (!conanBaseUrl) {
      logger.warn(`⚠️  Conan remote base URL not configured. Some features may not work.`);
    }

    logger.info(`✅ Conan configuration validation passed`);
  }

  /**
   * Display version information
   */
  static showVersion(): void {
    const packageJson = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'));
    const version = packageJson.version;
    const name = packageJson.name;
    const description = packageJson.description;
    
    logger.info(`
🚀 ${name} Conan Tool v${version}

${description}

📦 Package: ${name}
🔢 Version: ${version}
📅 Built: ${new Date().toISOString().split('T')[0]}
🌐 Repository: https://github.com/HeiSir2014/git-aiflow
📋 License: MIT

💡 For more information, visit: https://github.com/HeiSir2014/git-aiflow
`);
  }

  /**
   * Display usage information
   */
  static showUsage(): void {
    logger.info(`
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
  --version, -v          显示版本信息
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

Examples:
  aiflow-conan init                              # 交互式初始化本地配置
  aiflow-conan init --global                     # 交互式初始化全局配置
  aiflow-conan zterm                             # 使用配置文件运行
  aiflow-conan zterm repo                        # 指定远程仓库
  aiflow-conan -ok sk-123 -gat gitlab.example.com=glpat-456 zterm    # 使用 CLI 参数覆盖配置

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

    // Show version information
    if (args.includes('--version') || args.includes('-v')) {
      ConanPkgUpdateApp.showVersion();
      process.exit(0);
    }

    // Show CLI help
    if (args.includes('--config-help')) {
      logger.info(getCliHelp());
      process.exit(0);
    }

    // Show usage if no arguments or help requested
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      ConanPkgUpdateApp.showUsage();
      process.exit(0);
    }

    // Check for updates at startup (for global installations only)
    try {
      const updateChecker = new UpdateChecker();
      await updateChecker.checkAndUpdate();
    } catch (error) {
      // Don't let update check failures block the main application
      logger.warn('⚠️ Update check failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Parse CLI configuration arguments (filter out package name and remote)
    const configArgs = args.filter(arg => arg.startsWith('-'));
    const cliConfig = parseCliArgs(configArgs);

    // Get non-config arguments (package name and remote)
    const nonConfigArgs = args.filter(arg => !arg.startsWith('-'));
    const packageName = nonConfigArgs[0];
    const remote = nonConfigArgs[1];

    if (!packageName) {
      logger.error('❌ Package name is required');
      ConanPkgUpdateApp.showUsage();
      process.exit(1);
    }

    logger.info(`🚀 AIFlow Conan Tool`);
    logger.info(`📦 Package: ${packageName}`);
    logger.info(`⏰ Started at: ${new Date().toISOString()}`);
    logger.info('─'.repeat(50));

    const app = new ConanPkgUpdateApp();

    // Initialize services with configuration
    await app.initializeServices(cliConfig);

    // Validate configuration before starting
    app.validateConfiguration();

    // Get remote from config or CLI or default
    const finalRemote = remote || getConfigValue(app.config, 'conan.remoteRepo', 'repo') || 'repo';
    logger.info(`🌐 Remote: ${finalRemote}`);

    // Run the update workflow
    await app.updatePackage(packageName, finalRemote);
  }
}

// Only run if this file is executed directly
const run_file = path.basename(process.argv[1]).toLowerCase();
const import_file = path.basename(fileURLToPath(import.meta.url)).toLowerCase();
const isMain = run_file && (['aiflow-conan', 'git-aiflow-conan', import_file].includes(run_file));
isMain && ConanPkgUpdateApp.main().catch((error) => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});
