import { GitPlatformService, GitPlatformProject, MergeRequestResponse } from './git-platform-service.js';
import { GitService } from './git-service.js';
import { HttpClient } from '../http/http-client.js';

/**
 * GitHub API repository response
 */
interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
}

/**
 * GitHub API pull request response
 */
interface GithubPullRequest {
  html_url: string;
  id: number;
  title: string;
  number: number;
}

/**
 * GitHub platform service implementation
 */
export class GithubPlatformService extends GitPlatformService {
  constructor(token: string, baseUrl: string, gitService: GitService, http: HttpClient) {
    super(token, baseUrl, gitService, http);
  }

  getPlatformName(): string {
    return 'github';
  }

  async getProjectByPath(projectPath: string): Promise<GitPlatformProject> {
    const apiUrl = `${this.getApiBaseUrl()}/repos/${projectPath}`;

    console.log(`🔍 Fetching GitHub repository info from: ${apiUrl}`);

    try {
      const repo = await this.http.requestJson<GithubRepository>(
        apiUrl,
        'GET',
        {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        }
      );

      console.log(`✅ Found GitHub repository: ${repo.name} (ID: ${repo.id})`);
      console.log(`📋 Full name: ${repo.full_name}`);

      return {
        id: repo.id.toString(),
        name: repo.name,
        full_name: repo.full_name,
        web_url: repo.html_url
      };
    } catch (error) {
      throw new Error(`Failed to get GitHub repository info for path "${projectPath}": ${error}`);
    }
  }

  protected async createMergeRequestInternal(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    squash: boolean = true,
    removeSourceBranch: boolean = true
  ): Promise<MergeRequestResponse> {
    // Get repository information
    const project = await this.getProject();
    
    // GitHub uses different terminology: Pull Request instead of Merge Request
    const requestBody = {
      title: title,
      head: sourceBranch,    // Source branch
      base: targetBranch,    // Target branch
      body: `Auto-generated pull request created by AIFlow.\n\nSource: ${sourceBranch}\nTarget: ${targetBranch}\n\nSquash commits: ${squash ? 'Yes' : 'No'}\nDelete source branch: ${removeSourceBranch ? 'Yes' : 'No'}`,
      maintainer_can_modify: true  // Allow maintainer to modify the PR
    };

    const apiUrl = `${this.getApiBaseUrl()}/repos/${project.full_name}/pulls`;
    console.log(`📋 Creating GitHub pull request for repository ${project.full_name}`);

    try {
      const resp = await this.http.requestJson<GithubPullRequest>(
        apiUrl,
        'POST',
        {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        JSON.stringify(requestBody)
      );

      console.log(`✅ Created GitHub pull request: ${resp.html_url}`);
      
      // Note: GitHub doesn't support auto-squash and auto-delete via API during PR creation
      // These settings would need to be configured in the repository settings or during merge
      if (squash || removeSourceBranch) {
        console.log(`💡 Note: GitHub squash (${squash}) and delete branch (${removeSourceBranch}) settings will apply during merge`);
      }

      // Convert to unified response format
      return {
        web_url: resp.html_url,  // Map html_url to web_url for consistency
        id: resp.id,
        title: resp.title,
        number: resp.number
      };
    } catch (error) {
      throw new Error(`Failed to create GitHub pull request: ${error}`);
    }
  }

  /**
   * Get GitHub API base URL
   * For github.com, use api.github.com
   * For GitHub Enterprise, use hostname/api/v3
   */
  private getApiBaseUrl(): string {
    if (this.baseUrl.includes('github.com')) {
      return 'https://api.github.com';
    } else {
      // GitHub Enterprise
      return `${this.baseUrl}/api/v3`;
    }
  }
}
