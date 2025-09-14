#!/usr/bin/env node

import { Shell } from './shell.js';
import { HttpClient } from './http/http-client.js';
import { StringUtil } from './utils/string-util.js';
import { GitService, GitFileStatus } from './services/git-service.js';
import { OpenAiService } from './services/openai-service.js';
import { GitPlatformServiceFactory, GitPlatformService, getGitAccessTokenForCurrentRepo, MergeRequestOptions } from './services/git-platform-service.js';
import { WecomNotifier } from './services/wecom-notifier.js';
import { configLoader, parseCliArgs, getConfigValue, getCliHelp, LoadedConfig, initConfig } from './config.js';
import { UpdateChecker } from './utils/update-checker.js';
import { ColorUtil } from './utils/color-util.js';
import path from 'path';
import { fileURLToPath } from 'url';
import clipboard from 'clipboardy';
import readline from 'readline';
import { logger } from './logger.js';
import { readFileSync } from 'fs';
import crypto from 'crypto';
/**
 * Base class for AI-powered Git automation applications
 */
export abstract class BaseAiflowApp {
  protected readonly shell = Shell.instance();
  protected readonly http = new HttpClient();
  protected readonly git = GitService.instance();

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
      logger.info('\n⚠️  Configuration warnings:');
      warnings.forEach(warning => logger.info(`  ${warning}`));
      logger.info('');
    }
  }


  /**
   * Interactive file selection for staging
   * @returns Promise<boolean> - true if files were staged, false if user cancelled
   */
  protected async interactiveFileSelection(): Promise<boolean> {
    const fileStatuses = this.git.status();

    if (fileStatuses.length === 0) {
      console.log(ColorUtil.success("No changes detected in the repository."));
      return false;
    }

    console.log(`\n${ColorUtil.UI_COLORS.emoji('📁')} ${ColorUtil.header('Detected file changes:')}`);
    console.log(ColorUtil.separator());

    // Group files by status for better display
    const untracked = fileStatuses.filter(f => f.isUntracked);
    const modified = fileStatuses.filter(f => !f.isUntracked && f.workTreeStatus === 'M');
    const deleted = fileStatuses.filter(f => !f.isUntracked && f.workTreeStatus === 'D');
    const added = fileStatuses.filter(f => !f.isUntracked && f.indexStatus === 'A');

    let fileIndex = 1;

    // Display files by category
    if (modified.length > 0) {
      console.log(`\n${ColorUtil.UI_COLORS.emoji('📝')} ${ColorUtil.LOG_COLORS.warning('Modified files:')}`);
      modified.forEach((file) => {
        console.log(`  ${ColorUtil.formatFileStatusWithDescription(file.path, 'M', file.statusDescription, fileIndex - 1)}`);
        fileIndex++;
      });
    }

    if (untracked.length > 0) {
      console.log(`\n${ColorUtil.UI_COLORS.emoji('❓')} ${ColorUtil.LOG_COLORS.info('Untracked files:')}`);
      untracked.forEach((file) => {
        console.log(`  ${ColorUtil.formatFileStatusWithDescription(file.path, '?', file.statusDescription, fileIndex - 1)}`);
        fileIndex++;
      });
    }

    if (added.length > 0) {
      console.log(`\n${ColorUtil.UI_COLORS.emoji('➕')} ${ColorUtil.LOG_COLORS.success('Added files:')}`);
      added.forEach((file) => {
        console.log(`  ${ColorUtil.formatFileStatusWithDescription(file.path, 'A', file.statusDescription, fileIndex - 1)}`);
        fileIndex++;
      });
    }

    if (deleted.length > 0) {
      console.log(`\n${ColorUtil.UI_COLORS.emoji('🗑️')} ${ColorUtil.LOG_COLORS.error('Deleted files:')}`);
      deleted.forEach((file) => {
        console.log(`  ${ColorUtil.formatFileStatusWithDescription(file.path, 'D', file.statusDescription, fileIndex - 1)}`);
        fileIndex++;
      });
    }

    return await this.promptFileSelection(fileStatuses);
  }

  /**
   * Prompt user to select files for staging
   * @param fileStatuses Array of file statuses
   * @returns Promise<boolean> - true if files were staged, false if cancelled
   */
  private async promptFileSelection(fileStatuses: GitFileStatus[]): Promise<boolean> {
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
      console.log(`\n${ColorUtil.UI_COLORS.emoji('🎯')} ${ColorUtil.header('File selection options:')}`);
      console.log(`  ${ColorUtil.UI_COLORS.emoji('•')} Enter file numbers (e.g., 1,3,5 or 1-5)`);
      console.log(`  ${ColorUtil.UI_COLORS.emoji('•')} Type "all" to stage all files`);
      console.log(`  ${ColorUtil.UI_COLORS.emoji('•')} Type "modified" to stage only modified files`);
      console.log(`  ${ColorUtil.UI_COLORS.emoji('•')} Type "untracked" to stage only untracked files`);
      console.log(`  ${ColorUtil.UI_COLORS.emoji('•')} Press Enter or type "cancel" to cancel`);

      const input = await question(`\n${ColorUtil.UI_COLORS.emoji('📋')} ${ColorUtil.prompt('Select files to stage: ')}`);

      if (!input.trim() || input.toLowerCase() === 'cancel') {
        console.log(ColorUtil.error('Operation cancelled.'));
        return false;
      }

      const selectedFiles = this.parseFileSelection(input, fileStatuses);

      if (selectedFiles.length === 0) {
        console.log(ColorUtil.error('No valid files selected.'));
        return false;
      }

      // Show selected files for confirmation
      console.log(`\n${ColorUtil.UI_COLORS.emoji('📋')} ${ColorUtil.header('Files to be staged:')}`);
      selectedFiles.forEach(file => {
        console.log(`  ${ColorUtil.UI_COLORS.emoji('✓')} ${ColorUtil.formatFileStatusWithDescription(file.path, file.workTreeStatus || file.indexStatus || '?', file.statusDescription)}`);
      });

      const confirm = await question(`\n${ColorUtil.UI_COLORS.emoji('❓')} ${ColorUtil.prompt('Stage these files? (Y/n): ')}`);

      if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
        console.log(ColorUtil.error('Staging cancelled.'));
        return false;
      }

      // Stage selected files
      console.log(`\n${ColorUtil.UI_COLORS.emoji('📦')} ${ColorUtil.LOG_COLORS.info('Staging selected files...')}`);
      this.git.addFiles(selectedFiles.map(f => f.path));
      
      console.log(ColorUtil.success(`Successfully staged ${selectedFiles.length} file(s).`));
      return true;

    } finally {
      rl.close();
    }
  }

  /**
   * Parse user input for file selection
   * @param input User input string
   * @param fileStatuses Array of file statuses
   * @returns Array of selected files
   */
  private parseFileSelection(input: string, fileStatuses: GitFileStatus[]): GitFileStatus[] {
    const trimmedInput = input.trim().toLowerCase();

    // Handle special keywords
    if (trimmedInput === 'all') {
      return fileStatuses;
    }

    if (trimmedInput === 'modified') {
      return fileStatuses.filter(f => !f.isUntracked && f.workTreeStatus === 'M');
    }

    if (trimmedInput === 'untracked') {
      return fileStatuses.filter(f => f.isUntracked);
    }

    // Parse numeric input (e.g., "1,3,5" or "1-5")
    const selectedFiles: GitFileStatus[] = [];
    const parts = input.split(',').map(p => p.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        // Handle range (e.g., "1-5")
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= fileStatuses.length) {
              selectedFiles.push(fileStatuses[i - 1]);
            }
          }
        }
      } else {
        // Handle single number
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= fileStatuses.length) {
          selectedFiles.push(fileStatuses[num - 1]);
        }
      }
    }

    // Remove duplicates
    return [...new Set(selectedFiles)];
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
      logger.error(`❌ ${error instanceof Error ? error.message : 'Unknown Git token error'}`);
    }

    if (missing.length > 0) {
      logger.error(`❌ Missing required configuration: ${missing.join(', ')}`);
      logger.error(`💡 Please run 'aiflow init' to configure or check your config files`);
      process.exit(1);
    }

    logger.info(`✅ Configuration validation passed`);
  }

  /**
   * Check if commit-only mode is enabled via CLI arguments
   * @returns True if --commit-only or -co or -cmo is present in CLI args
   */
  private isCommitOnlyMode(): boolean {
    const args = process.argv.slice(2);
    return args.includes('--commit-only') || args.includes('-co') || args.includes('-cmo');
  }

  /**
   * Commit only workflow - just commit staged changes without creating MR
   */
  async runCommitOnly(): Promise<void> {
    logger.info(`🚀 AIFlow Tool - Commit Only Mode`);
    logger.info(`📁 Working directory: ${process.cwd()}`);
    logger.info(`⏰ Started at: ${new Date().toISOString()}`);
    logger.info('─'.repeat(50));

    try {
      // Step 1: Check for staged changes
      let diff = this.git.getDiff();
      let changedFiles = this.git.getChangedFiles();

      if (!diff) {
        console.log(`${ColorUtil.UI_COLORS.emoji('📋')} ${ColorUtil.LOG_COLORS.info("No staged changes found. Let's select files to stage...")}`);

        // Interactive file selection
        const filesStaged = await this.interactiveFileSelection();

        if (!filesStaged) {
          console.log(ColorUtil.error("No files were staged. Exiting..."));
          process.exit(1);
        }

        // Re-check for staged changes after interactive selection
        diff = this.git.getDiff();
        changedFiles = this.git.getChangedFiles();

        if (!diff) {
          console.error(ColorUtil.error("❌ Still no staged changes found. Please check your selection."));
          process.exit(1);
        }

        logger.info(`✅ Successfully staged ${changedFiles.length} file(s). Continuing...`);
      }

      // Step 2: Generate commit message using AI
      logger.info(`🤖 Generating commit message...`);
      const { commit } = await this.openai.generateCommitAndBranch(diff, getConfigValue(this.config, 'git.generation_lang', 'en'));

      logger.info("✅ Generated commit message:", commit);

      // Step 3: Commit changes
      // Dynamic countdown display
      logger.info(`📝 Committing changes, starting in 3 seconds...`);
      await ColorUtil.countdown(3, 'Committing in', 'Committing now...');
      this.git.commit(commit);

      logger.info(`✅ Successfully committed changes!`);
      logger.info(`📝 Commit message: ${commit}`);
      logger.info(`📁 Changed files: ${changedFiles.length}`);

    } catch (error) {
      logger.error(`❌ Error during commit:`, error);
      process.exit(1);
    }
  }

  /**
   * Create MR from base branch to current branch when no staged changes
   */
  async runFromBaseBranch(): Promise<void> {
    logger.info(`🔍 No staged changes found. Detecting base branch for MR creation...`);

    // Step 1: Get current branch
    const currentBranch = this.git.getCurrentBranch();
    logger.info(`🌿 Current branch: ${currentBranch}`);

    // Step 2: Detect base branch
    const baseBranch = this.git.getBaseBranch();
    if (!baseBranch) {
      logger.error("❌ Could not detect base branch. Please specify target branch manually or stage some changes.");
      process.exit(1);
    }

    logger.info(`🎯 Detected base branch: ${baseBranch}`);

    // Step 3: Get diff from base branch to current branch
    const baseToCurrentDiff = this.git.getDiffBetweenBranches(baseBranch, currentBranch);

    if (!baseToCurrentDiff) {
      logger.info("✅ No differences found between base branch and current branch.");
      logger.info("💡 Current branch is up to date with base branch.");
      process.exit(0);
    }

    logger.info(`📊 Found changes between ${baseBranch} and ${currentBranch}`);

    // Step 4: Get changed files
    const changedFiles = this.git.getChangedFilesBetweenBranches(baseBranch, currentBranch);
    logger.info(`📁 Changed files: ${changedFiles.length}`);

    // Step 5: Generate commit message and branch name using AI
    logger.info(`🤖 Generating commit message and branch name...`);
    const { commit, branch, description, title } = await this.openai.generateCommitAndBranch(baseToCurrentDiff, getConfigValue(this.config, 'git.generation_lang', 'en'));

    logger.info(`✅ Generated commit message length: ${commit && commit.length}`);
    logger.info(`✅ Generated branch suggestion: ${branch}`);
    logger.info(`✅ Generated MR description length: ${description && description.length}`);
    logger.info(`✅ Generated MR title: ${title}`);

    const branchName = currentBranch;
    logger.info(`✅ Using branch name: ${branchName}`);

    await ColorUtil.countdown(3, `Pushing branch(${branchName})`, 'Pushing branch now...');
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

    // Dynamic countdown before creating MR
    await ColorUtil.countdown(3, 'Creating merge request in', 'Creating merge request now...');

    const mrTitle = title;
    const mrUrl = await this.gitPlatform.createMergeRequest(
      branchName,
      baseBranch,
      mrTitle,
      mergeRequestOptions
    );
    logger.info(`🎉 ${this.gitPlatform.getPlatformName() === 'github' ? 'Pull Request' : 'Merge Request'} created:`, mrUrl);

    // Step 9: Send notification
    if (getConfigValue(this.config, 'wecom.enable', false) && getConfigValue(this.config, 'wecom.webhook', '')) {
      logger.info(`📢 Sending notification...`);
      await this.wecom.sendMergeRequestNotice(branchName, baseBranch, mrUrl, mrTitle, commit, changedFiles);
      logger.info("📢 Notification sent via WeCom webhook.");
    }

    logger.info(`✅ AIFlow workflow completed successfully!`);

    // Step 10: Print the MR info and copy to clipboard
    const isGitHub = this.gitPlatform.getPlatformName() === 'github';
    const requestType = isGitHub ? 'Pull Request' : 'Merge Request';
    const requestAbbr = isGitHub ? 'PR' : 'MR';

    const outputMrInfo = `🎉 ${requestType}创建成功
📋 ${requestAbbr} 链接: ${mrUrl} ${mrTitle}
📝 提交信息:
${commit}
🌿 分支信息: ${branchName} ->  ${baseBranch}
📁 变更文件 (${changedFiles.length} 个)${changedFiles.length > 10 ? `前10个: ` : ': '}
${changedFiles.slice(0, 10).map(file => `• ${file}`).join('\n')}${changedFiles.length > 10 ? `\n...${changedFiles.length - 10}个文件` : ''}`;
    const consoleMrInfo = `
${'-'.repeat(50)}
${outputMrInfo}
${'-'.repeat(50)}
`;
    logger.info(consoleMrInfo);
    await clipboard.write(outputMrInfo);
    logger.info("📋 MR info copied to clipboard.");
  }

  /**
   * Create automated merge request from staged changes
   */
  async run(): Promise<void> {
    logger.info(`🚀 AIFlow Tool`);
    logger.info(`📁 Working directory: ${process.cwd()}`);
    logger.info(`⏰ Started at: ${new Date().toISOString()}`);
    logger.info('─'.repeat(50));

    try {
      // Check if commit-only mode is enabled (from CLI args, not config)
      const commitOnly = this.isCommitOnlyMode();
      if (commitOnly) {
        await this.runCommitOnly();
        return;
      }

      // Step 1: Check for staged changes
      let diff = this.git.getDiff();
      let changedFiles = this.git.getChangedFiles();

      if (!diff) {
        logger.info("📋 No staged changes found. Let's select files to stage...");

        // Interactive file selection
        const filesStaged = await this.interactiveFileSelection();

        if (!filesStaged) {
          logger.info("❌ No files were staged. Trying to create MR from base branch...");
          await this.runFromBaseBranch();
          return;
        }

        // Re-check for staged changes after interactive selection
        diff = this.git.getDiff();
        changedFiles = this.git.getChangedFiles();

        if (!diff) {
          logger.info("❌ Still no staged changes found. Trying to create MR from base branch...");
          await this.runFromBaseBranch();
          return;
        }

        logger.info(`✅ Successfully staged ${changedFiles.length} file(s). Continuing...`);
      }

      // Step 2: Determine target branch
      const currentBranch = this.git.getCurrentBranch();
      logger.info(`🌿 Current branch: ${currentBranch}`);
      const targetBranch = this.git.getTargetBranch();
      logger.info(`🎯 Target branch: ${targetBranch}`);

      // Step 3: Generate commit message and branch name using AI
      logger.info(`🤖 Generating commit message and branch name...`);
      const { commit, branch, description, title } = await this.openai.generateCommitAndBranch(diff, getConfigValue(this.config, 'git.generation_lang', 'en'));

      logger.info(`✅ Generated commit message length: ${commit && commit.length}`);
      logger.info(`✅ Generated branch suggestion: ${branch}`);
      logger.info(`✅ Generated MR description length: ${description && description.length}`);
      logger.info(`✅ Generated MR title: ${title}`);

      // Step 4: Create branch name
      const gitUser = this.git.getUserName();
      const aiBranch = StringUtil.sanitizeBranch(branch);
      const branchName = `${gitUser}/${aiBranch}-${crypto.randomUUID().substring(0, 6)}`;
      logger.info(`✅ Generated branch name: ${branchName}`);

      // Step 5: Commit and push
      logger.info(`📤 Creating branch and pushing changes...`);
      // Dynamic countdown before committing
      await ColorUtil.countdown(3, `Creating branch(${branchName}) and pushing`, 'Committing now...');
      const isSuccess = this.git.commitAndPush(branchName, commit);
      if (!isSuccess) {
        logger.info("❌ Branch already exists, skipping creation");
        return;
      }

      // Step 6: Create Merge Request
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

      // Dynamic countdown before creating MR
      await ColorUtil.countdown(3, 'Creating merge request in', 'Creating merge request now...');
      
      const mrTitle = title;
      const mrUrl = await this.gitPlatform.createMergeRequest(
        branchName,
        targetBranch,
        mrTitle,
        mergeRequestOptions
      );
      logger.info(`🎉 ${this.gitPlatform.getPlatformName() === 'github' ? 'Pull Request' : 'Merge Request'} created:`, mrUrl);


      if (currentBranch && currentBranch !== branchName) {
        logger.info(`✅ Auto checkout to ${currentBranch}`);
        this.git.checkout(currentBranch);
      }

      // Step 7: Send notification
      if (getConfigValue(this.config, 'wecom.enable', false) && getConfigValue(this.config, 'wecom.webhook', '')) {
        logger.info(`📢 Sending notification...`);
        await this.wecom.sendMergeRequestNotice(branchName, targetBranch, mrUrl, mrTitle, commit, changedFiles);
        logger.info("📢 Notification sent via WeCom webhook.");
      }

      logger.info(`✅ AIFlow workflow completed successfully!`);

      // Step 8: Print the MR info and copy to clipboard
      // Format MR information for sharing
      const isGitHub = this.gitPlatform.getPlatformName() === 'github';
      const requestType = isGitHub ? 'Pull Request' : 'Merge Request';
      const requestAbbr = isGitHub ? 'PR' : 'MR';

      const outputMrInfo = `🎉 ${requestType}创建成功
📋 ${requestAbbr} 链接: ${mrUrl} ${mrTitle}
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
      logger.info(consoleMrInfo);
      await clipboard.write(outputMrInfo);
      logger.info("📋 MR info copied to clipboard.");
    } catch (error) {
      logger.error(`❌ Error during MR creation:`, error);
      process.exit(1);
    }
  }

}

/**
 * Git Auto MR application for automated merge request creation
 */
export class GitAutoMrApp extends BaseAiflowApp {


  /**
   * Display version information
   */
  static showVersion(): void {
    const packageJson = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'));
    const version = packageJson.version;
    const name = packageJson.name;
    const description = packageJson.description;
    
    logger.info(`
🚀 ${name} v${version}

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
🔧 AIFlow Tool

Usage:
  aiflow [init] [options]

Commands:
  init                   交互式配置初始化
  init --global, -g      初始化全局配置
  
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
  -co, --commit-only                    仅提交更改，不创建MR

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
  aiflow --commit-only                                   # 仅提交更改，不创建MR
  aiflow -co                                             # 仅提交更改，不创建MR (短参数)
  aiflow -cmo                                             # 仅提交更改，不创建MR (短参数)
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

    // Show version information
    if (args.includes('--version') || args.includes('-v')) {
      GitAutoMrApp.showVersion();
      process.exit(0);
    }

    // Show CLI help
    if (args.includes('--config-help')) {
      logger.info(getCliHelp());
      process.exit(0);
    }

    // Show usage if help requested
    if (args.includes('--help') || args.includes('-h')) {
      GitAutoMrApp.showUsage();
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

    // Check for commit-only mode early (before config validation)
    const isCommitOnly = args.includes('--commit-only') || args.includes('-co') || args.includes('-cmo');

    // Parse CLI configuration arguments
    const cliConfig = parseCliArgs(args);

    const app = new GitAutoMrApp();

    // Initialize services with configuration
    await app.initializeServices(cliConfig);

    // For commit-only mode, skip some validations that are not needed
    if (isCommitOnly) {
      // Only validate OpenAI configuration for commit-only mode
      const requiredConfigs = [
        { key: 'openai.key', name: 'OpenAI API Key' },
        { key: 'openai.baseUrl', name: 'OpenAI Base URL' },
        { key: 'openai.model', name: 'OpenAI Model' },
      ];

      const missing: string[] = [];
      for (const config of requiredConfigs) {
        const value = getConfigValue(app.config, config.key, '');
        if (!value) {
          missing.push(config.name);
        }
      }

      if (missing.length > 0) {
        logger.error(`❌ Missing required configuration for commit-only mode: ${missing.join(', ')}`);
        logger.error(`💡 Please run 'aiflow init' to configure or check your config files`);
        process.exit(1);
      }

      logger.info(`✅ Configuration validation passed for commit-only mode`);
    } else {
      // Full validation for normal MR creation mode
      app.validateConfiguration();
    }

    // Run the MR creation workflow
    await app.run();
  }
}

// Only run if this file is executed directly
const run_file = path.basename(process.argv[1]).toLowerCase();
const import_file = path.basename(fileURLToPath(import.meta.url)).toLowerCase();
const isMain = run_file && (['aiflow', 'git-aiflow', import_file].includes(run_file));
logger.info(`${JSON.stringify(process.argv)} ${JSON.stringify(process.env)}`)

isMain && GitAutoMrApp.main().catch((error) => {
  logger.error('❌ Unhandled error:', error);
  process.exit(1);
});