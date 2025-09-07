import { Shell } from '../shell.js';
import { StringUtil } from '../utils/string-util.js';

/**
 * Git operations service
 */
export class GitService {
  private readonly shell: Shell;

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

  getChangedFiles(limit = 5): string[] {
    const files = this.shell.run("git diff --cached --name-only");
    return files.split("\n").filter(Boolean).slice(0, limit);
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
