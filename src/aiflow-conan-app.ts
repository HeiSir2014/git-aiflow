#!/usr/bin/env node

import { BaseAiflowApp } from './aiflow-app.js';
import { MergeRequestOptions } from './services/git-platform-service.js';
import { StringUtil } from './utils/string-util.js';
import { ConanService } from './services/conan-service.js';
import { FileUpdaterService } from './services/file-updater-service.js';
import { UpdateChecker } from './utils/update-checker.js';
import { parseCliArgs, getConfigValue, getCliHelp, initConfig } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import clipboardy from 'clipboardy';
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

      const changedFiles = this.git.getChangedFiles();

      // Step 3: Determine target branch
      const targetBranch = this.git.getTargetBranch();
      console.log(`🎯 Target branch: ${targetBranch}`);

      // Step 4: Generate commit message and branch name using AI
      console.log(`🤖 Generating commit message and branch name...`);
      const { commit, branch, description } = await this.openai.generateCommitAndBranch(diff, getConfigValue(this.config, 'git.generation_lang', 'en'));
      console.log("✅ Generated MR description:", description);

      // Step 5: Create new branch
      const gitUser = this.git.getUserName();
      const aiBranch = StringUtil.sanitizeBranch(branch);
      const dateSuffix = new Date().toISOString().slice(0, 19).replace(/-|T|:/g, "");
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

      const mrTitle = `chore: update ${packageName} package to latest version`;
      const mrUrl = await this.gitPlatform.createMergeRequest(
        branchName,
        targetBranch,
        mrTitle,
        mergeRequestOptions
      );
      console.log(`🎉 ${this.gitPlatform.getPlatformName() === 'github' ? 'Pull Request' : 'Merge Request'} created:`, mrUrl);

      // Step 9: Send notification
      console.log(`📢 Sending notification...`);
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
      console.log(consoleMrInfo);
      await clipboardy.write(outputMrInfo);

      console.log(`✅ Conan package update workflow completed successfully!`);

    } catch (error) {
      console.error(`❌ Error during package update:`, error);
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
      console.warn(`⚠️  Conan remote base URL not configured. Some features may not work.`);
    }

    console.log(`✅ Conan configuration validation passed`);
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

    // Check for updates at startup (for global installations only)
    try {
      const updateChecker = new UpdateChecker();
      await updateChecker.checkAndUpdate();
    } catch (error) {
      // Don't let update check failures block the main application
      console.warn('⚠️ Update check failed:', error instanceof Error ? error.message : 'Unknown error');
    }

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

const isMain = path.basename(fileURLToPath(import.meta.url)).toLowerCase() === path.basename(process.argv[1]).toLowerCase();
if (isMain) {
  ConanPkgUpdateApp.main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}