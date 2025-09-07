import { HttpClient } from '../http/http-client.js';
import { GitService } from './git-service.js';
import { Shell } from '../shell.js';

/**
 * GitLab project information
 */
interface GitlabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
}

/**
 * GitLab Merge Request service
 */
export class GitlabService {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly http: HttpClient;
  private readonly gitService?: GitService;

  constructor(token: string, baseUrl?: string, gitService?: GitService | null, http?: HttpClient) {
    this.token = token;
    this.http = http || new HttpClient();

    if (gitService instanceof GitService && gitService) {
      // New usage: GitService for auto-detection
      this.gitService = gitService;
    } else {
      // Create a default GitService with Shell for auto-detection
      this.gitService = new GitService(new Shell());
    }

    // Auto-detect baseUrl from git remote if not provided
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    } else {
      this.baseUrl = this.extractBaseUrlFromRemote();
    }
  }

  /**
   * Extract GitLab base URL from git remote URL
   * @returns Base URL (e.g., "http://gitlab.com")
   */
  private extractBaseUrlFromRemote(): string {
    const remoteUrl = this.gitService?.getRemoteUrl() || '';
    
    const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return `http://${sshMatch[1]}`;
    }
    
    const httpMatch = remoteUrl.match(/^(https?:\/\/[^\/]+)/);
    if (httpMatch) {
      return httpMatch[1];
    }
    
    // Fallback if no remote URL detected
    console.warn('⚠️  Could not extract GitLab base URL from remote, using default');
    return 'http://gitlab.example.com';
  }

  private parseProjectPathFromUrl(remoteUrl: string): string | null {
    try {
      const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return sshMatch[2];
      }
      const httpMatch = remoteUrl.match(/^https?:\/\/[^\/]+\/(.+?)(?:\.git)?$/);
      if (httpMatch) {
        return httpMatch[1];
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to parse git remote URL: ${remoteUrl}`, error);
      return null;
    }
  }

  /**
   * Get project ID from GitLab API using project path
   * @param projectPath Project path
   * @returns Project ID
   */
  async getProjectIdByPath(projectPath: string): Promise<string> {
    const encodedPath = encodeURIComponent(projectPath);
    const apiUrl = `${this.baseUrl}/api/v4/projects/${encodedPath}`;

    console.log(`🔍 Fetching project info from: ${apiUrl}`);

    try {
      const project = await this.http.requestJson<GitlabProject>(
        apiUrl,
        "GET",
        {
          "PRIVATE-TOKEN": this.token,
          "Content-Type": "application/json"
        }
      );

      console.log(`✅ Found project: ${project.name} (ID: ${project.id})`);
      console.log(`📋 Full path: ${project.path_with_namespace}`);

      return project.id.toString();
    } catch (error) {
      throw new Error(`Failed to get project info for path "${projectPath}": ${error}`);
    }
  }

  /**
   * Get project ID (auto-detect if not provided)
   * @returns Project ID
   */
  async getProjectId(): Promise<string> {
    // Auto-detect project ID from git remote URL
    if (this.gitService) {
      const remoteUrl = this.gitService.getRemoteUrl();
      console.log(`🔍 Git remote URL: ${remoteUrl}`);

      // Check for error messages from git commands
      if (remoteUrl.startsWith('Error getting URL') || remoteUrl === 'No remote configured') {
        throw new Error(`Git remote URL error: ${remoteUrl}`);
      }

      const projectPath = this.parseProjectPathFromUrl(remoteUrl);
      if (!projectPath) {
        throw new Error(`Failed to parse project path from git remote URL: ${remoteUrl}`);
      }

      console.log(`📋 Parsed project path: ${projectPath}`);

      // Get and cache project ID
      return await this.getProjectIdByPath(projectPath);
    }

    throw new Error('No project ID provided and no GitService available for auto-detection');
  }

  async createMergeRequest(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    squash: boolean = true,
    removeSourceBranch: boolean = true
  ): Promise<string> {
    type MrResp = { web_url: string };

    // Get project ID (auto-detect if needed)
    const projectId = await this.getProjectId();

    // Build request body with all parameters
    const bodyParams = [
      `source_branch=${encodeURIComponent(sourceBranch)}`,
      `target_branch=${encodeURIComponent(targetBranch)}`,
      `title=${encodeURIComponent(title)}`,
      `squash=${squash}`,                           // Squash all commits into one
      `remove_source_branch=${removeSourceBranch}` // Delete source branch after merge
    ];

    const resp = await this.http.requestJson<MrResp>(
      `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests`,
      "POST",
      {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      bodyParams.join('&')
    );
    return resp.web_url;
  }
}
