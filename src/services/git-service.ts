import { Shell } from '../shell.js';
import { StringUtil } from '../utils/string-util.js';
import { logger } from '../logger.js';

/**
 * Git file status interface
 */
export interface GitFileStatus {
  /** File path relative to repository root */
  path: string;
  /** Index status (staged changes) */
  indexStatus: string;
  /** Working tree status (unstaged changes) */
  workTreeStatus: string;
  /** Whether file is untracked */
  isUntracked: boolean;
  /** Human readable status description */
  statusDescription: string;
}

/**
 * Git operations service
 */
export class GitService {
  private readonly shell: Shell;
  private static readonly protocolCache = new Map<string, string>();
  private static readonly instances = new Map<string, GitService>();
  private remote_name?: string;
  private remote_urls = new Map<string, string>();

  private constructor(shell?: Shell) {
    this.shell = shell || Shell.instance();
    logger.debug('GitService initialized');
  }

  /**
   * Safely checkout to the specified branch with the following steps:
   * 1. Automatically stash working directory and staged changes (including untracked files)
   * 2. Fetch remote branch and validate its existence
   * 3. If local branch exists: checkout and attempt fast-forward to remote/<branch>
   *    - Only fast-forward (--ff-only) to avoid merge commits
   *    - If fast-forward fails, preserve current commit with warning
   * 4. If local branch doesn't exist: create tracking branch from remote/<branch>
   * 5. Finally attempt stash pop (if conflicts occur, preserve and prompt for manual resolution)
   * 
   * @param branchName The name of the branch to checkout
   */
  checkout(branchName: string): void {
    logger.info(`Checking out branch: ${branchName}`);

    const remoteName = this.getRemoteName();
    const currentHead = this.getCurrentHead();
    const stashResult = this.handleWorkingDirectoryChanges(branchName);

    if (!this.fetchAndValidateRemoteBranch(branchName, remoteName, stashResult.pushedStash)) {
      return;
    }

    const localExists = this.checkLocalBranchExists(branchName);

    if (localExists) {
      this.checkoutExistingBranch(branchName, remoteName, stashResult.pushedStash);
    } else {
      this.createTrackingBranch(branchName, remoteName, stashResult.pushedStash);
    }

    this.restoreWorkingDirectoryChanges(stashResult.pushedStash);
    this.logCheckoutCompletion(currentHead, branchName);
  }

  /**
   * Gets the current HEAD commit hash.
   * @returns The short commit hash or empty string if failed
   */
  private getCurrentHead(): string {
    return this.executeGitCommand(
      'git rev-parse --short=12 HEAD',
      'Reading current HEAD'
    ).output;
  }

  /**
   * Handles uncommitted changes by stashing them if necessary.
   * @param branchName The target branch name for stash message
   * @returns Object containing stash status
   */
  private handleWorkingDirectoryChanges(branchName: string): { pushedStash: boolean } {
    const isDirty = !this.executeGitCommand('git diff --quiet && git diff --cached --quiet').success;
    let pushedStash = false;

    if (isDirty) {
      const stashMessage = `auto-stash: checkout -> ${branchName}`;
      const stashResult = this.executeGitCommand(
        `git stash push -u -m "${stashMessage}"`,
        'Saving working directory changes to stash'
      );

      if (!stashResult.success) {
        logger.error('Uncommitted changes detected and unable to auto-stash. Operation aborted.');
        return { pushedStash: false };
      }
      pushedStash = true;
    }

    return { pushedStash };
  }

  /**
   * Fetches and validates the remote branch exists.
   * @param branchName The branch name to fetch and validate
   * @param remoteName The remote name to use
   * @param pushedStash Whether stash was pushed (for rollback)
   * @returns True if remote branch exists and was fetched successfully
   */
  private fetchAndValidateRemoteBranch(branchName: string, remoteName: string, pushedStash: boolean): boolean {
    // Fetch only the target branch to reduce overhead (removed --prune to avoid deleting other remote tracking branches)
    const fetchResult = this.executeGitCommand(
      `git fetch ${remoteName} "${branchName}":"refs/remotes/${remoteName}/${branchName}"`,
      'Fetching target branch'
    );

    if (!fetchResult.success) {
      logger.error(`Remote branch ${remoteName}/${branchName} does not exist or fetch failed.`);
      this.rollbackStash(pushedStash);
      return false;
    }

    // Double-check remote branch existence for safety
    const remoteProbe = this.executeGitCommand(
      `git ls-remote --heads ${remoteName} "${branchName}"`
    ).output;

    if (!remoteProbe) {
      logger.error(`Remote branch not found: ${remoteName}/${branchName}.`);
      this.rollbackStash(pushedStash);
      return false;
    }

    return true;
  }

  /**
   * Checks if local branch exists.
   * @param branchName The branch name to check
   * @returns True if local branch exists
   */
  private checkLocalBranchExists(branchName: string): boolean {
    const result = this.executeGitCommand(`git rev-parse --verify --quiet "${branchName}"`);
    return result.success && result.output.trim() !== '';
  }

  /**
   * Checkouts to existing local branch and attempts fast-forward.
   * @param branchName The branch name to checkout
   * @param remoteName The remote name to use
   * @param pushedStash Whether stash was pushed (for rollback)
   */
  private checkoutExistingBranch(branchName: string, remoteName: string, pushedStash: boolean): void {
    const checkoutResult = this.executeGitCommand(
      `git checkout "${branchName}"`,
      `Switching to local branch ${branchName}`
    );

    if (!checkoutResult.success) {
      this.rollbackStash(pushedStash);
      return;
    }

    // Check if remote branch still exists before attempting merge
    const remoteBranchExists = this.executeGitCommand(
      `git ls-remote --heads ${remoteName} "${branchName}"`
    );

    if (!remoteBranchExists.success || !remoteBranchExists.output.trim()) {
      logger.warn(`Remote branch ${remoteName}/${branchName} does not exist. Unset upstream tracking.`);

      // Unset upstream tracking to avoid "upstream branch does not exist" warnings
      this.executeGitCommand(
        `git branch --unset-upstream`,
        'Unsetting upstream tracking'
      );

      logger.info(`Checked out to local branch ${branchName} without remote tracking.`);
      return;
    }

    // Attempt safe fast-forward to remote (no merge commits)
    const fastForwardResult = this.executeGitCommand(
      `git merge --ff-only "${remoteName}/${branchName}"`,
      'Fast-forwarding to remote'
    );

    if (!fastForwardResult.success) {
      logger.warn(
        `Unable to fast-forward to ${remoteName}/${branchName} (local branch may have additional commits). ` +
        `Current commit preserved. To discard local divergence, manually run: git reset --hard ${remoteName}/${branchName}`
      );
    }
  }

  /**
   * Creates a new tracking branch from remote.
   * @param branchName The branch name to create
   * @param remoteName The remote name to use
   * @param pushedStash Whether stash was pushed (for rollback)
   */
  private createTrackingBranch(branchName: string, remoteName: string, pushedStash: boolean): void {
    const createResult = this.executeGitCommand(
      `git checkout -b "${branchName}" "${remoteName}/${branchName}"`,
      `Creating local tracking branch ${branchName}`
    );

    if (!createResult.success) {
      this.rollbackStash(pushedStash);
    }
  }

  /**
   * Restores working directory changes from stash if applicable.
   * @param pushedStash Whether stash was pushed
   */
  private restoreWorkingDirectoryChanges(pushedStash: boolean): void {
    if (!pushedStash) return;

    const popResult = this.executeGitCommand(
      'git stash pop',
      'Restoring previous changes (stash pop)'
    );

    if (!popResult.success) {
      logger.warn(
        'Conflicts may have occurred during stash pop. Please resolve conflicts manually and commit. ' +
        'Conflicted files have been marked.'
      );
    }
  }

  /**
   * Logs the completion of checkout operation.
   * @param previousHead The previous HEAD commit hash
   * @param branchName The target branch name
   */
  private logCheckoutCompletion(previousHead: string, branchName: string): void {
    const newHead = this.executeGitCommand('git rev-parse --short=12 HEAD').output;
    logger.info(
      `Checkout completed: ${previousHead || '(unknown)'} → ${newHead} @ ${branchName}`
    );
  }

  /**
   * Rolls back stash if it was pushed.
   * @param pushedStash Whether stash was pushed
   */
  private rollbackStash(pushedStash: boolean): void {
    if (pushedStash) {
      this.executeGitCommand('git stash pop', 'Rollback: restoring stash');
    }
  }


  /**
   * Executes a git command and returns structured result.
   * @param command The git command to execute
   * @param description Optional description for logging
   * @returns Object containing success status and output
   */
  private executeGitCommand(command: string, description?: string): { success: boolean; output: string } {
    try {
      const output = this.shell.run(command);
      if (description) {
        logger.debug(`${description} ✓`);
      }
      return { success: true, output: (output ?? '').toString().trim() };
    } catch (error: unknown) {
      if (description) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`${description} ✗: ${errorMessage}`);
      }
      return { success: false, output: '' };
    }
  }

  getUserName(): string {
    return StringUtil.sanitizeName(this.shell.runProcess("git", "config", "user.name"));
  }

  getDiff(): string {
    return this.shell.runProcess("git", "diff", "--cached", "--text");
  }

  /**
   * Get git diff of specific files (unstaged changes)
   * @param filePaths Array of file paths to check diff for
   * @returns Git diff output
   */
  getDiffForFiles(filePaths: string[]): string {
    if (filePaths.length === 0) {
      return '';
    }

    const files = filePaths.join(' ');
    return this.shell.runProcess("git", "diff", "--text", files);
  }

  /**
   * Get diff between two branches
   * @param baseBranch Base branch name
   * @param targetBranch Target branch name
   * @returns Git diff output between branches
   */
  getDiffBetweenBranches(baseBranch: string, targetBranch: string): string {
    try {
      if (!baseBranch || !targetBranch) {
        logger.warn('Both baseBranch and targetBranch must be provided');
        return '';
      }

      const diffOutput = this.shell.runProcess("git", "diff", "--text", `${baseBranch}...${targetBranch}`);
      logger.debug(`Got diff between ${baseBranch} and ${targetBranch}`);
      return diffOutput;
    } catch (error) {
      logger.error(`Error getting diff between branches ${baseBranch} and ${targetBranch}:`, error);
      return '';
    }
  }

  /**
   * Get list of changed files between two branches
   * @param baseBranch Base branch name
   * @param targetBranch Target branch name
   * @returns Array of changed file paths
   */
  getChangedFilesBetweenBranches(baseBranch: string, targetBranch: string): string[] {
    try {
      if (!baseBranch || !targetBranch) {
        logger.warn('Both baseBranch and targetBranch must be provided');
        return [];
      }

      const filesOutput = this.shell.runProcess("git", "diff", "--name-only", `${baseBranch}...${targetBranch}`).trim();
      const files = filesOutput ? filesOutput.split('\n').filter(Boolean) : [];

      logger.debug(`Found ${files.length} changed files between ${baseBranch} and ${targetBranch}`);
      return files;
    } catch (error) {
      logger.error(`Error getting changed files between branches ${baseBranch} and ${targetBranch}:`, error);
      return [];
    }
  }

  /**
   * Add specific file to staging area
   * @param filePath File path to add
   */
  addFile(filePath: string): void {
    logger.info(`Adding file: ${filePath}`);
    this.shell.runProcess("git", "add", "-f", filePath);
  }

  /**
   * Add multiple files to staging area
   * @param filePaths Array of file paths to add
   */
  addFiles(filePaths: string[], batchSize = 1000): void {
    if (filePaths.length === 0) return;

    logger.info(`Adding ${filePaths.length} files in batches of ${batchSize}`);
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      this.shell.runProcess("git", "add", "-f", ...batch);
    }
  }

  /**
   * Create a new branch
   * @param branchName Branch name to create
   */
  createBranch(branchName: string): void {
    logger.info(`Creating branch: ${branchName}`);
    this.shell.runProcess("git", "checkout", "-b", branchName);
  }

  /**
   * Commit staged changes
   * @param message Commit message
   */
  commit(message: string): void {
    logger.info('Committing changes...');
    logger.debug(`Commit message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    if (!message.includes("\n")) {
      // 单行 commit
      const escapedMessage = message
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/`/g, "\\`");

      this.shell.runProcess("git", "commit", "-m", escapedMessage);
      return;
    }
    const lines = message.split(/\r?\n/).map(line => line.trimEnd());
    const args: string[] = ["commit"];
    for (const line of lines) {
      args.push("-m", line);
    }
    this.shell.runProcess("git", ...args);
  }

  /**
   * Push current branch to remote
   * @param branchName Branch name to push
   */
  push(branchName: string): void {
    logger.info(`Pushing branch: ${branchName}`);
    this.shell.runProcess("git", "push", "-u", this.getRemoteName(), branchName);
  }

  /**
   * Create branch, commit and push (legacy method)
   * @param branch Branch name
   * @param message Commit message
   */
  commitAndPush(branch: string, message: string): boolean {
    if (this.checkLocalBranchExists(branch)) {
      logger.info(`Branch ${branch} already exists, skipping creation`);
      return false;
    }
    this.createBranch(branch);
    this.commit(message);
    this.push(branch);
    return true;
  }

  getChangedFiles(limit?: number): string[] {
    const files = this.shell.runProcess("git", "diff", "--cached", "--name-only").trim().split("\n").filter(Boolean);
    if (limit) {
      return files.slice(0, limit);
    }
    return files;
  }

  /**
   * Get git repository root directory
   */
  getRepositoryRoot(): string {
    return this.shell.runProcess("git", "rev-parse", "--show-toplevel").trim();
  }

  /**
   * Gets the default remote name for the current repository.
   * Tries to detect the most appropriate remote in the following order:
   * 1. 'origin' (most common)
   * 2. 'upstream' (common in fork workflows)  
   * 3. First available remote
   * @returns The default remote name or 'origin' as fallback
   */
  getRemoteName(): string {
    if (this.remote_name) {
      return this.remote_name;
    }

    try {
      const remotesOutput = this.shell.runProcess("git", "remote").trim();
      if (!remotesOutput) {
        logger.warn('No remotes found, using "origin" as fallback');
        this.remote_name = 'origin';
        return this.remote_name;
      }

      const remotes = remotesOutput.split('\n').map(r => r.trim()).filter(r => r);

      // Prefer 'origin' if it exists
      if (remotes.includes('origin')) {
        this.remote_name = 'origin';
        return this.remote_name;
      }

      // Fall back to 'upstream' if it exists
      if (remotes.includes('upstream')) {
        this.remote_name = 'upstream';
        logger.debug('Using "upstream" as default remote');
        return this.remote_name;
      }

      // Use the first available remote
      if (remotes.length > 0) {
        this.remote_name = remotes[0];
        logger.debug(`Using "${this.remote_name}" as default remote`);
        return this.remote_name;
      }

    } catch (error) {
      logger.warn('Failed to detect remotes, using "origin" as fallback');
    }

    // Final fallback
    this.remote_name = 'origin';
    return this.remote_name;
  }

  /**
   * Get remote URL for specified remote
   */
  getRemoteUrl(remoteName?: string): string {
    remoteName = remoteName || this.getRemoteName();
    if (!remoteName) {
      return 'No remote configured';
    }
    let remote_url = this.remote_urls.get(remoteName);
    if (remote_url) {
      return remote_url;
    }
    try {
      remote_url = this.shell.runProcess("git", "remote", "get-url", remoteName).trim();
      this.remote_urls.set(remoteName, remote_url);
      return remote_url;
    } catch (error) {
      return `Error getting URL for remote '${remoteName}' ${error}`;
    }
  }

  /**
   * Extract hostname from Git remote URL
   * @param remoteUrl Git remote URL (optional, will get current remote if not provided)
   * @returns Hostname (e.g., 'github.com', 'gitlab.example.com')
   */
  extractHostnameFromRemoteUrl(remoteUrl?: string): string {
    const url = remoteUrl || this.getRemoteUrl();

    try {
      // Handle SSH URLs (git@hostname:user/repo.git)
      if (url.startsWith('git@')) {
        const match = url.match(/git@([^:]+):/);
        return match ? match[1] : '';
      }

      // Handle HTTPS URLs (https://hostname/user/repo.git)
      if (url.startsWith('http')) {
        const urlObj = new URL(url);
        return urlObj.hostname;
      }

      return '';
    } catch (error) {
      logger.warn(`Could not extract hostname from Git URL: ${url}`);
      return '';
    }
  }

  /**
   * Extract base URL from Git remote URL with protocol detection
   * @param remoteUrl Git remote URL (optional, will get current remote if not provided)
   * @returns Base URL (e.g., "https://github.com", "https://gitlab.example.com")
   */
  async extractBaseUrlFromRemoteUrl(remoteUrl?: string): Promise<string> {
    const url = remoteUrl || this.getRemoteUrl();

    try {
      // Handle SSH URLs (git@hostname:user/repo.git)
      if (url.startsWith('git@')) {
        const match = url.match(/git@([^:]+):/);
        if (match) {
          const hostname = match[1];
          // Auto-detect protocol by trying HTTPS first, then fallback to HTTP
          return await this.detectProtocolForHost(hostname);
        }
      }

      // Handle HTTPS/HTTP URLs (https://hostname/user/repo.git)
      if (url.startsWith('http')) {
        const match = url.match(/^(https?:\/\/[^\/]+)/);
        return match ? match[1] : '';
      }

      return '';
    } catch (error) {
      logger.warn(`Could not extract base URL from Git URL: ${url}`);
      return '';
    }
  }

  /**
   * Parse project path from Git remote URL
   * @param remoteUrl Git remote URL (optional, will get current remote if not provided)
   * @returns Project path (e.g., "user/repo")
   */
  parseProjectPathFromUrl(remoteUrl?: string): string | null {
    const url = remoteUrl || this.getRemoteUrl();

    try {
      // Handle SSH URLs (git@hostname:user/repo.git)
      const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return sshMatch[2];
      }

      // Handle HTTPS/HTTP URLs (https://hostname/user/repo.git)
      const httpMatch = url.match(/^https?:\/\/[^\/]+\/(.+?)(?:\.git)?$/);
      if (httpMatch) {
        return httpMatch[1];
      }

      return null;
    } catch (error) {
      logger.error(`Failed to parse git remote URL: ${url}`, error);
      return null;
    }
  }

  /**
   * Detect the appropriate protocol (HTTPS/HTTP) for a given hostname
   * @param hostname The hostname to check
   * @returns Base URL with detected protocol
   */
  private async detectProtocolForHost(hostname: string): Promise<string> {
    // Check cache first
    if (GitService.protocolCache.has(hostname)) {
      return GitService.protocolCache.get(hostname)!;
    }

    // Well-known HTTPS-only hosts
    const httpsOnlyHosts = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'gitee.com',
      'codeberg.org',
      'git.sr.ht',
      'coding.net'
    ];

    if (httpsOnlyHosts.includes(hostname)) {
      const result = `https://${hostname}`;
      GitService.protocolCache.set(hostname, result);
      return result;
    }
    // Start probing
    return await this.probeProtocolForHost(hostname);
  }

  /**
   * Probe a hostname to detect HTTPS/HTTP support in background
   * Updates the cache when detection is complete
   * @param hostname The hostname to probe
   * @returns Promise<string> The URL with the detected protocol
   */
  private async probeProtocolForHost(hostname: string): Promise<string> {
    const httpsUrl = `https://${hostname}`;
    try {
      logger.debug(`Probing protocol support for: ${hostname}`);
      // Try HTTPS first (modern standard)
      if (await this.isProtocolSupported(httpsUrl)) {
        logger.debug(`HTTPS supported for: ${hostname}`);
        GitService.protocolCache.set(hostname, httpsUrl);
        return httpsUrl;
      }

      // Fallback to HTTP
      const httpUrl = `http://${hostname}`;
      if (await this.isProtocolSupported(httpUrl)) {
        logger.debug(`HTTP supported for: ${hostname} (HTTPS not available)`);
        GitService.protocolCache.set(hostname, httpUrl);
        return httpUrl;
      }

      // If both fail, keep HTTPS as fallback (already in cache)
      logger.warn(`Could not connect to ${hostname}, keeping HTTPS as default`);
    } catch (error) {
      logger.warn(`Error probing ${hostname}:`, error);
    }
    return httpsUrl;
  }

  /**
   * Get detected protocol for hostname (synchronous, may return cached result)
   * @param hostname The hostname to check
   * @returns Base URL with detected protocol
   */
  async getDetectedProtocolForHost(hostname: string): Promise<string> {
    return await this.detectProtocolForHost(hostname);
  }

  /**
   * Clear protocol cache for a specific hostname or all hostnames
   * @param hostname Optional hostname to clear, if not provided clears all cache
   */
  static clearProtocolCache(hostname?: string): void {
    if (hostname) {
      GitService.protocolCache.delete(hostname);
      logger.debug(`Cleared protocol cache for: ${hostname}`);
    } else {
      GitService.protocolCache.clear();
      logger.debug('Cleared all protocol cache');
    }
  }

  /**
   * Get current protocol cache (for debugging)
   * @returns Copy of current cache entries
   */
  static getProtocolCache(): Record<string, string> {
    return Object.fromEntries(GitService.protocolCache);
  }

  /**
   * Force re-detection of protocol for hostname (asynchronous)
   * @param hostname The hostname to re-detect
   * @returns Promise<Base URL with detected protocol>
   */
  async forceDetectProtocolForHost(hostname: string): Promise<string> {
    // Clear cache for this hostname
    GitService.protocolCache.delete(hostname);

    // Try HTTPS first
    const httpsUrl = `https://${hostname}`;
    if (await this.isProtocolSupported(httpsUrl)) {
      logger.debug(`HTTPS supported for: ${hostname}`);
      GitService.protocolCache.set(hostname, httpsUrl);
      return httpsUrl;
    }

    // Fallback to HTTP
    const httpUrl = `http://${hostname}`;
    if (await this.isProtocolSupported(httpUrl)) {
      logger.debug(`HTTP supported for: ${hostname} (HTTPS not available)`);
      GitService.protocolCache.set(hostname, httpUrl);
      return httpUrl;
    }

    // If both fail, use HTTPS as fallback
    logger.warn(`Could not connect to ${hostname}, defaulting to HTTPS`);
    GitService.protocolCache.set(hostname, httpsUrl);
    return httpsUrl;
  }

  /**
   * Test if a protocol is supported for a given URL
   * @param baseUrl Base URL to test (e.g., "https://example.com")
   * @returns True if the protocol is supported
   */
  private async isProtocolSupported(baseUrl: string): Promise<boolean> {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    try {

      // Try to make a simple HEAD request to test connectivity
      await fetch(baseUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'AIFlow-Git-Probe/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      // Any response (even 404) indicates the protocol is supported
      return true;
    } catch (error) {
      // Connection failed, protocol not supported or host unreachable
      return false;
    }
    finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    try {
      return this.shell.runProcess("git", "branch", "--show-current").trim();
    } catch (error) {
      // Fallback for older git versions
      try {
        const result = this.shell.runProcess("git", "rev-parse", "--abbrev-ref", "HEAD").trim();
        return result === 'HEAD' ? 'detached' : result;
      } catch (fallbackError) {
        return 'unknown';
      }
    }
  }

  /**
   * Get target branch for merge request (default branch or fallback)
   * @returns Target branch name
   */
  getTargetBranch(): string {
    try {
      // Try to get the default branch from git remote
      const currentBranch = this.getCurrentBranch();
      if (this.hasRemoteBranch(`${this.getRemoteName()}/${currentBranch}`)) {
        return currentBranch;
      }

      logger.debug(`Current branch ${currentBranch} does not exist in remote`);

      const baseBranch = this.getBaseBranch();
      if (baseBranch) {
        return baseBranch;
      }

      // Common default branch names to try
      const defaultBranches = ['main', 'master', 'develop'];

      // If current branch is one of the default branches, use it
      if (defaultBranches.includes(currentBranch)) {
        return currentBranch;
      }

      // Otherwise, try to find the default branch by checking which exists
      for (const branch of defaultBranches) {
        if (this.hasRemoteBranch(`${this.getRemoteName()}/${branch}`)) {
          return branch;
        }
      }

      // Fallback to main if nothing else works
      return 'main';
    } catch (error) {
      logger.warn(`Could not determine target branch, using 'main': ${error}`);
      return 'main';
    }
  }

  /**
   * Get current commit hash
   */
  getCurrentCommit(): string {
    return this.shell.run("git rev-parse HEAD").trim();
  }

  /**
   * Check if a remote branch exists
   * @param branchName Branch name to check (e.g., 'origin/main')
   * @returns True if branch exists, false otherwise
   */
  hasRemoteBranch(branchName: string): boolean {
    try {
      this.shell.runProcess("git", "rev-parse", "--verify", branchName).trim();
      return true;
    } catch (error) {
      logger.debug(`Remote branch ${branchName} does not exist`);
      return false;
    }
  }

  /**
   * Get short commit hash
   */
  getShortCommit(): string {
    return this.shell.runProcess("git", "rev-parse", "--short", "HEAD").trim();
  }

  /**
   * Check if repository has uncommitted changes
   */
  hasUncommittedChanges(): boolean {
    const status = this.shell.runProcess("git", "status", "--porcelain").trim();
    return status.length > 0;
  }

  /**
   * Check if repository has staged changes
   */
  hasStagedChanges(): boolean {
    const status = this.shell.runProcess("git", "diff", "--cached", "--name-only").trim();
    return status.length > 0;
  }

  /**
   * Get git repository status for all files
   * @returns Array of GitFileStatus objects representing file changes
   */
  status(): GitFileStatus[] {
    try {
      const statusOutput = this.shell.runProcess("git", "status", "--short", "--ignore-submodules", "--porcelain", "--untracked-files=all");

      if (!statusOutput) {
        return [];
      }

      return statusOutput.split('\n').map(line => this.parseStatusLine(line)).filter(Boolean) as GitFileStatus[];
    } catch (error) {
      logger.error('Error getting git status:', error);
      return [];
    }
  }

  /**
   * Parse a single git status line
   * @param line Git status output line (format: "XY filename")
   * @returns GitFileStatus object or null if invalid line
   */
  private parseStatusLine(line: string): GitFileStatus | null {
    if (!line || line.length < 3) {
      return null;
    }

    // Git status format: XY filename
    // X = index status, Y = working tree status
    const indexStatus = line[0];
    const workTreeStatus = line[1];
    const path = line.substring(3).trim();

    if (!path || path.startsWith('.aiflow')) {
      return null;
    }

    // Determine if file is untracked
    const isUntracked = indexStatus === '?' && workTreeStatus === '?';

    // Generate human readable status description
    const statusDescription = this.getStatusDescription(indexStatus, workTreeStatus);

    return {
      path,
      indexStatus,
      workTreeStatus,
      isUntracked,
      statusDescription
    };
  }

  /**
   * Get human readable description for git status codes
   * @param indexStatus Index status character
   * @param workTreeStatus Working tree status character
   * @returns Human readable status description
   */
  private getStatusDescription(indexStatus: string, workTreeStatus: string): string {
    // Handle untracked files
    if (indexStatus === '?' && workTreeStatus === '?') {
      return 'Untracked';
    }

    const descriptions: string[] = [];

    // Index status (staged changes)
    switch (indexStatus) {
      case 'A': descriptions.push('Added to index'); break;
      case 'M': descriptions.push('Modified in index'); break;
      case 'D': descriptions.push('Deleted from index'); break;
      case 'R': descriptions.push('Renamed in index'); break;
      case 'C': descriptions.push('Copied in index'); break;
      case 'U': descriptions.push('Updated but unmerged'); break;
      case ' ': break; // No change in index
      default: descriptions.push(`Index: ${indexStatus}`); break;
    }

    // Working tree status (unstaged changes)
    switch (workTreeStatus) {
      case 'M': descriptions.push('Modified in working tree'); break;
      case 'D': descriptions.push('Deleted in working tree'); break;
      case 'A': descriptions.push('Added in working tree'); break;
      case 'U': descriptions.push('Updated but unmerged'); break;
      case ' ': break; // No change in working tree
      default: descriptions.push(`Working tree: ${workTreeStatus}`); break;
    }

    return descriptions.length > 0 ? descriptions.join(', ') : 'No changes';
  }

  /**
   * Display comprehensive Git repository information
   */
  showGitInfo(): void {
    logger.info('Git Repository Information');
    logger.info('─'.repeat(50));

    try {
      // Current working directory
      const currentDir = process.cwd();
      logger.info(`Current Working Directory: ${currentDir}`);

      // Repository root
      const repoRoot = this.getRepositoryRoot();
      logger.info(`Repository Root: ${repoRoot}`);

      // Check if we're in the repository
      const isInRepo = currentDir.startsWith(repoRoot.replace(/\//g, '\\')) ||
        currentDir.startsWith(repoRoot.replace(/\\/g, '/'));
      logger.info(`Working in Repository: ${isInRepo ? 'Yes' : 'No'}`);

      // Current branch
      const currentBranch = this.getCurrentBranch();
      logger.info(`Current Branch: ${currentBranch}`);

      // Current commit
      const currentCommit = this.getCurrentCommit();
      const shortCommit = this.getShortCommit();
      logger.info(`Current Commit: ${shortCommit} (${currentCommit})`);

      // Remote information
      const remoteName = this.getRemoteName();
      if (remoteName) {
        const remoteUrl = this.getRemoteUrl(remoteName);
        logger.info(`Remote Name: ${remoteName}`);
        logger.info(`Remote URL: ${remoteUrl}`);
      } else {
        logger.info('Remote: No remote configured');
      }

      // Repository status
      const hasUncommitted = this.hasUncommittedChanges();
      const hasStaged = this.hasStagedChanges();

      logger.info('Repository Status:');
      logger.info(`   Uncommitted changes: ${hasUncommitted ? 'Yes' : 'No'}`);
      logger.info(`   Staged changes: ${hasStaged ? 'Yes' : 'No'}`);

      // Show some recent files if there are changes
      if (hasUncommitted) {
        const statusOutput = this.shell.run("git status --porcelain").trim();
        const files = statusOutput.split('\n').slice(0, 5);
        logger.info('Recent Changes (top 5):');
        files.forEach(file => {
          const status = file.substring(0, 2);
          const fileName = file.substring(3);
          const statusIcon = status.includes('M') ? 'Modified' :
            status.includes('A') ? 'Added' :
              status.includes('D') ? 'Deleted' :
                status.includes('??') ? 'Untracked' : 'Changed';
          logger.info(`   ${statusIcon}: ${fileName}`);
        });
      }

      // User information
      const userName = this.getUserName();
      const userEmail = this.shell.runProcess("git", "config", "user.email").trim();
      logger.info(`Git User: ${userName} <${userEmail}>`);

    } catch (error) {
      logger.error(`Error getting Git information: ${error}`);
    }

    logger.info('─'.repeat(50));
  }

  /**
   * Get the most likely parent branch of the current branch
   * @returns Base branch name or null if not found or in detached HEAD
   */
  getBaseBranch(): string | null {
    try {
      const currentBranch = this.getCurrentBranch();
      if (!currentBranch || currentBranch === 'HEAD') return null;

      const logGraph = this.shell.runProcess("git", "log", "--graph", "--oneline", "--decorate", "--all", "--simplify-by-decoration");
      const lines = logGraph.split('\n');

      // 本地和远程分支列表
      const localBranches = this.shell
        .runProcess("git","for-each-ref", "--format=%(refname:short)", "refs/heads/")
        .trim()
        .split('\n')
        .map(b => b.trim());
      const remotes = this.shell.runProcess("git", "remote").trim().split('\n').map(r => r.trim());

      for (const line of lines) {
        const match = line.match(/\((.*?)\)/);
        if (!match) continue;

        const refs = match[1].split(',').map(r => r.trim());
        const candidate = refs.find(r => r !== currentBranch && !r.startsWith('HEAD'));
        if (!candidate) continue;

        let cleanBranch = candidate;

        // Check if it's a remote branch and extract the local branch name
        for (const remote of remotes) {
          const prefix = `${remote}/`;
          if (candidate.startsWith(prefix)) {
            cleanBranch = candidate.slice(prefix.length);
            break;
          }
        }

        // Skip if the clean branch is the same as current branch
        if (cleanBranch === currentBranch) {
          continue;
        }

        // Only consider this branch if the clean branch name exists locally
        if (!localBranches.includes(cleanBranch)) {
          continue;
        }

        logger.debug(`Detected base branch: ${cleanBranch}`);
        return cleanBranch;
      }

      return null;
    } catch (error) {
      logger.error('Error determining base branch from log graph:', error);
      return null;
    }
  }

  /**
   * Get merge-base commit hash between current branch and target branch
   * @param otherBranch Target branch name
   * @returns Merge-base commit hash or null if not found
   */
  getMergeBase(otherBranch: string): string | null {
    try {
      if (!otherBranch || otherBranch.trim() === '') {
        logger.warn('Empty branch name provided for merge-base');
        return null;
      }

      const mergeBase = this.shell.runProcess("git", "merge-base", "HEAD", otherBranch).trim();

      if (!mergeBase || mergeBase === '') {
        logger.warn(`No merge-base found between current branch and ${otherBranch}`);
        return null;
      }

      logger.debug(`Merge-base between current branch and ${otherBranch}: ${mergeBase}`);
      return mergeBase;
    } catch (error) {
      logger.error(`Error getting merge-base with branch ${otherBranch}:`, error);
      return null;
    }
  }

  /**
   * Get simplified branch graph visualization (similar to GitLens)
   * @param limit Maximum number of commits to show (default: 20)
   * @returns String representation of branch graph
   */
  getBranchGraph(limit: number = 20): string {
    try {
      if (limit <= 0) {
        logger.warn('Invalid limit for branch graph, using default value 20');
        limit = 20;
      }

      // Use git log with graph, oneline, decorate, and color options
      const graphOutput = this.shell.runProcess("git", "log", "--oneline", "--graph", "--decorate", "--color=always", "--all", "-n", `${limit}`).trim();

      if (!graphOutput) {
        logger.debug('No branch graph output generated');
        return '';
      }

      logger.debug(`Generated branch graph with ${limit} commits`);
      return graphOutput;
    } catch (error) {
      logger.error('Error getting branch graph:', error);
      return '';
    }
  }

  static instance(): GitService {
    const pwd = process.cwd();
    if (GitService.instances.get(pwd)) {
      return GitService.instances.get(pwd)!;
    }
    const gitService = new GitService();
    GitService.instances.set(pwd, gitService);
    return gitService;
  }
}
