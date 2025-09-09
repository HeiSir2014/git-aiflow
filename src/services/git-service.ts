import { Shell } from '../shell.js';
import { StringUtil } from '../utils/string-util.js';

/**
 * Git operations service
 */
export class GitService {
  private readonly shell: Shell;
  private static readonly protocolCache = new Map<string, string>();

  constructor(shell?: Shell) {
    this.shell = shell || new Shell();
  }

  getUserName(): string {
    return StringUtil.sanitizeName(this.shell.run("git config user.name"));
  }

  getDiff(): string {
    return this.shell.run("git diff --cached");
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
    return this.shell.run(`git diff ${files}`).trim();
  }

  /**
   * Add specific file to staging area
   * @param filePath File path to add
   */
  addFile(filePath: string): void {
    console.log(`➕ Adding file: ${filePath}`);
    this.shell.run(`git add "${filePath}"`);
  }

  /**
   * Add multiple files to staging area
   * @param filePaths Array of file paths to add
   */
  addFiles(filePaths: string[]): void {
    filePaths.forEach(filePath => this.addFile(filePath));
  }

  /**
   * Create a new branch
   * @param branchName Branch name to create
   */
  createBranch(branchName: string): void {
    console.log(`🌿 Creating branch: ${branchName}`);
    this.shell.run(`git checkout -b "${branchName}"`);
  }

  /**
   * Commit staged changes
   * @param message Commit message
   */
  commit(message: string): void {
    console.log(`📝 Committing changes...`);

    // Use PowerShell here-string for multiline messages
    if (message.includes('\n')) {
      // Escape single quotes in the message for PowerShell here-string
      const escapedMessage = message.replace(/'/g, "''");

      // Use PowerShell here-string syntax with git commit -m
      const powershellCommand = `git commit -m @'
${escapedMessage}
'@`;

      this.shell.run(powershellCommand);
    } else {
      // For single line messages, use standard escaping
      const escapedMessage = message.replace(/"/g, '\\"').replace(/`/g, '\\`');
      this.shell.run(`git commit -m "${escapedMessage}"`);
    }
  }

  /**
   * Push current branch to origin
   * @param branchName Branch name to push
   */
  push(branchName: string): void {
    console.log(`📤 Pushing branch: ${branchName}`);
    this.shell.run(`git push -u origin "${branchName}"`);
  }

  /**
   * Create branch, commit and push (legacy method)
   * @param branch Branch name
   * @param message Commit message
   */
  commitAndPush(branch: string, message: string): void {
    this.createBranch(branch);
    this.commit(message);
    this.push(branch);
  }

  getChangedFiles(limit?: number): string[] {
    const files = this.shell.run("git diff --cached --name-only").trim().split("\n").filter(Boolean);
    if (limit) {
      return files.slice(0, limit);
    }
    return files;
  }

  /**
   * Get git repository root directory
   */
  getRepositoryRoot(): string {
    return this.shell.run("git rev-parse --show-toplevel").trim();
  }

  /**
   * Get remote name (usually 'origin')
   */
  getRemoteName(): string {
    const remotes = this.shell.run("git remote").trim();
    return remotes.split('\n').filter(Boolean)[0] || '';
  }

  /**
   * Get remote URL for specified remote
   */
  getRemoteUrl(remoteName?: string): string {
    const remote = remoteName || this.getRemoteName();
    if (!remote) {
      return 'No remote configured';
    }
    try {
      return this.shell.run(`git remote get-url ${remote}`).trim();
    } catch (error) {
      return `Error getting URL for remote '${remote}'`;
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
      console.warn(`⚠️  Could not extract hostname from Git URL: ${url}`);
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
      console.warn(`⚠️  Could not extract base URL from Git URL: ${url}`);
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
      console.error(`❌ Failed to parse git remote URL: ${url}`, error);
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
      console.log(`🔍 Probing protocol support for: ${hostname}`);
      // Try HTTPS first (modern standard)
      if (await this.isProtocolSupported(httpsUrl)) {
        console.log(`✅ HTTPS supported for: ${hostname}`);
        GitService.protocolCache.set(hostname, httpsUrl);
        return httpsUrl;
      }

      // Fallback to HTTP
      const httpUrl = `http://${hostname}`;
      if (await this.isProtocolSupported(httpUrl)) {
        console.log(`✅ HTTP supported for: ${hostname} (HTTPS not available)`);
        GitService.protocolCache.set(hostname, httpUrl);
        return httpUrl;
      }

      // If both fail, keep HTTPS as fallback (already in cache)
      console.warn(`⚠️  Could not connect to ${hostname}, keeping HTTPS as default`);
    } catch (error) {
      console.warn(`⚠️  Error probing ${hostname}:`, error);
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
      console.log(`🗑️  Cleared protocol cache for: ${hostname}`);
    } else {
      GitService.protocolCache.clear();
      console.log(`🗑️  Cleared all protocol cache`);
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
      console.log(`✅ HTTPS supported for: ${hostname}`);
      GitService.protocolCache.set(hostname, httpsUrl);
      return httpsUrl;
    }

    // Fallback to HTTP
    const httpUrl = `http://${hostname}`;
    if (await this.isProtocolSupported(httpUrl)) {
      console.log(`✅ HTTP supported for: ${hostname} (HTTPS not available)`);
      GitService.protocolCache.set(hostname, httpUrl);
      return httpUrl;
    }

    // If both fail, use HTTPS as fallback
    console.warn(`⚠️  Could not connect to ${hostname}, defaulting to HTTPS`);
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
      return this.shell.run("git branch --show-current").trim();
    } catch (error) {
      // Fallback for older git versions
      try {
        const result = this.shell.run("git rev-parse --abbrev-ref HEAD").trim();
        return result === 'HEAD' ? 'detached' : result;
      } catch (fallbackError) {
        return 'unknown';
      }
    }
  }

  /**
   * Get current commit hash
   */
  getCurrentCommit(): string {
    return this.shell.run("git rev-parse HEAD").trim();
  }

  /**
   * Get short commit hash
   */
  getShortCommit(): string {
    return this.shell.run("git rev-parse --short HEAD").trim();
  }

  /**
   * Check if repository has uncommitted changes
   */
  hasUncommittedChanges(): boolean {
    const status = this.shell.run("git status --porcelain").trim();
    return status.length > 0;
  }

  /**
   * Check if repository has staged changes
   */
  hasStagedChanges(): boolean {
    const status = this.shell.run("git diff --cached --name-only").trim();
    return status.length > 0;
  }

  /**
   * Display comprehensive Git repository information
   */
  showGitInfo(): void {
    console.log('📋 Git Repository Information');
    console.log('─'.repeat(50));

    try {
      // Current working directory
      const currentDir = process.cwd();
      console.log(`📂 Current Working Directory: ${currentDir}`);

      // Repository root
      const repoRoot = this.getRepositoryRoot();
      console.log(`📁 Repository Root: ${repoRoot}`);

      // Check if we're in the repository
      const isInRepo = currentDir.startsWith(repoRoot.replace(/\//g, '\\')) ||
        currentDir.startsWith(repoRoot.replace(/\\/g, '/'));
      console.log(`🎯 Working in Repository: ${isInRepo ? '✅ Yes' : '❌ No'}`);

      // Current branch
      const currentBranch = this.getCurrentBranch();
      console.log(`🌿 Current Branch: ${currentBranch}`);

      // Current commit
      const currentCommit = this.getCurrentCommit();
      const shortCommit = this.getShortCommit();
      console.log(`📝 Current Commit: ${shortCommit} (${currentCommit})`);

      // Remote information
      const remoteName = this.getRemoteName();
      if (remoteName) {
        const remoteUrl = this.getRemoteUrl(remoteName);
        console.log(`🌐 Remote Name: ${remoteName}`);
        console.log(`🔗 Remote URL: ${remoteUrl}`);
      } else {
        console.log(`🌐 Remote: No remote configured`);
      }

      // Repository status
      const hasUncommitted = this.hasUncommittedChanges();
      const hasStaged = this.hasStagedChanges();

      console.log(`📊 Repository Status:`);
      console.log(`   Uncommitted changes: ${hasUncommitted ? '✅ Yes' : '❌ No'}`);
      console.log(`   Staged changes: ${hasStaged ? '✅ Yes' : '❌ No'}`);

      // Show some recent files if there are changes
      if (hasUncommitted) {
        const statusOutput = this.shell.run("git status --porcelain").trim();
        const files = statusOutput.split('\n').slice(0, 5);
        console.log(`📄 Recent Changes (top 5):`);
        files.forEach(file => {
          const status = file.substring(0, 2);
          const fileName = file.substring(3);
          const statusIcon = status.includes('M') ? '📝' :
            status.includes('A') ? '➕' :
              status.includes('D') ? '➖' :
                status.includes('??') ? '❓' : '📄';
          console.log(`   ${statusIcon} ${fileName}`);
        });
      }

      // User information
      const userName = this.getUserName();
      const userEmail = this.shell.run("git config user.email").trim();
      console.log(`👤 Git User: ${userName} <${userEmail}>`);

    } catch (error) {
      console.error(`❌ Error getting Git information: ${error}`);
    }

    console.log('─'.repeat(50));
  }
}
