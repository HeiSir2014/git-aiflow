import { GitPlatformService, GitPlatformProject, MergeRequestResponse } from './git-platform-service.js';
import { GitService } from './git-service.js';
import { HttpClient } from '../http/http-client.js';

/**
 * GitLab API project response
 */
interface GitlabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
}

/**
 * GitLab API merge request response
 */
interface GitlabMergeRequest {
  web_url: string;
  id: number;
  title: string;
}

/**
 * GitLab platform service implementation
 */
export class GitlabPlatformService extends GitPlatformService {
  constructor(token: string, baseUrl: string, gitService: GitService, http: HttpClient) {
    super(token, baseUrl, gitService, http);
  }

  getPlatformName(): string {
    return 'gitlab';
  }

  async getProjectByPath(projectPath: string): Promise<GitPlatformProject> {
    const encodedPath = encodeURIComponent(projectPath);
    const apiUrl = `${this.baseUrl}/api/v4/projects/${encodedPath}`;

    console.log(`🔍 Fetching GitLab project info from: ${apiUrl}`);

    try {
      const project = await this.http.requestJson<GitlabProject>(
        apiUrl,
        'GET',
        {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json'
        }
      );

      console.log(`✅ Found GitLab project: ${project.name} (ID: ${project.id})`);
      console.log(`📋 Full path: ${project.path_with_namespace}`);

      return {
        id: project.id.toString(),
        name: project.name,
        full_name: project.path_with_namespace,
        web_url: project.web_url
      };
    } catch (error) {
      throw new Error(`Failed to get GitLab project info for path "${projectPath}": ${error}`);
    }
  }

  protected async createMergeRequestInternal(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    squash: boolean = true,
    removeSourceBranch: boolean = true
  ): Promise<MergeRequestResponse> {
    // Get project information
    const project = await this.getProject();

    // Build request body with all parameters
    const bodyParams = [
      `source_branch=${encodeURIComponent(sourceBranch)}`,
      `target_branch=${encodeURIComponent(targetBranch)}`,
      `title=${encodeURIComponent(title)}`,
      `squash=${squash}`,                           // Squash all commits into one
      `remove_source_branch=${removeSourceBranch}` // Delete source branch after merge
    ];

    console.log(`📋 Creating GitLab merge request for project ${project.id}`);

    try {
      const resp = await this.http.requestJson<GitlabMergeRequest>(
        `${this.baseUrl}/api/v4/projects/${project.id}/merge_requests`,
        'POST',
        {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        bodyParams.join('&')
      );

      console.log(`✅ Created GitLab merge request: ${resp.web_url}`);
      
      // Convert to unified response format
      return {
        web_url: resp.web_url,
        id: resp.id,
        title: resp.title
      };
    } catch (error) {
      throw new Error(`Failed to create GitLab merge request: ${error}`);
    }
  }
}
