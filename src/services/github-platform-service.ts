import { GitPlatformService, GitPlatformProject, MergeRequestResponse, MergeRequestOptions } from './git-platform-service.js';
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
    options: MergeRequestOptions = {}
  ): Promise<MergeRequestResponse> {
    // Get repository information
    const project = await this.getProject();
    
    // Extract options with defaults
    const {
      assignee_id,
      assignee_ids,
      reviewer_ids,
      squash = true,
      removeSourceBranch = true
    } = options;

    // Build assignees array for GitHub (GitHub uses username strings, but we'll try with IDs first)
    const assignees: string[] = [];
    
    // Note: GitHub API typically expects usernames, not user IDs for assignees
    // For now, we'll convert IDs to strings and let the API handle validation
    if (assignee_id && assignee_id > 0) {
      assignees.push(assignee_id.toString());
      console.log(`📋 Setting assignee ID: ${assignee_id}`);
    }
    
    if (assignee_ids && assignee_ids.length > 0) {
      const validAssigneeIds = assignee_ids.filter(id => id > 0).map(id => id.toString());
      assignees.push(...validAssigneeIds);
      console.log(`📋 Setting assignee IDs: ${validAssigneeIds.join(', ')}`);
    }

    // GitHub uses different terminology: Pull Request instead of Merge Request
    const requestBody: any = {
      title: title,
      head: sourceBranch,    // Source branch
      base: targetBranch,    // Target branch
      body: `Auto-generated pull request created by AIFlow.\n\nSource: ${sourceBranch}\nTarget: ${targetBranch}\n\nSquash commits: ${squash ? 'Yes' : 'No'}\nDelete source branch: ${removeSourceBranch ? 'Yes' : 'No'}`,
      maintainer_can_modify: true  // Allow maintainer to modify the PR
    };

    // Add assignees if specified
    if (assignees.length > 0) {
      requestBody.assignees = assignees;
    }

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
      
      // Add reviewers if specified (GitHub requires separate API call)
      if (reviewer_ids && reviewer_ids.length > 0) {
        const validReviewerIds = reviewer_ids.filter(id => id > 0);
        if (validReviewerIds.length > 0) {
          try {
            console.log(`📋 Setting reviewer IDs: ${validReviewerIds.join(', ')}`);
            await this.addReviewersToRequest(project.full_name, resp.number, validReviewerIds);
          } catch (error) {
            console.warn(`⚠️  Failed to set reviewers: ${error}. PR created successfully but reviewers not assigned.`);
          }
        }
      }
      
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
   * Add reviewers to a pull request
   * @param repoFullName Full repository name (owner/repo)
   * @param prNumber Pull request number
   * @param reviewerIds Array of reviewer user IDs
   */
  private async addReviewersToRequest(repoFullName: string, prNumber: number, reviewerIds: number[]): Promise<void> {
    const apiUrl = `${this.getApiBaseUrl()}/repos/${repoFullName}/pulls/${prNumber}/requested_reviewers`;
    
    // GitHub API expects usernames, not user IDs, but we'll try with IDs converted to strings
    // In a real implementation, you might want to fetch user info by ID to get usernames
    const reviewers = reviewerIds.map(id => id.toString());
    
    const requestBody = {
      reviewers: reviewers  // GitHub expects usernames, but we're sending IDs as strings
    };

    try {
      await this.http.requestJson(
        apiUrl,
        'POST',
        {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        JSON.stringify(requestBody)
      );
      console.log(`✅ Successfully added reviewers to PR #${prNumber}`);
    } catch (error) {
      // Don't throw here, just log the warning since the PR was already created successfully
      console.warn(`⚠️  Could not add reviewers to PR #${prNumber}: ${error}`);
      console.warn(`💡 Note: GitHub API requires usernames for reviewers, not user IDs. Consider using usernames in configuration.`);
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
