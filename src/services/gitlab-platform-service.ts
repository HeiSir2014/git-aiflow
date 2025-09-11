import { GitPlatformService, GitPlatformProject, MergeRequestResponse, MergeRequestOptions } from './git-platform-service.js';
import { GitService } from './git-service.js';
import { HttpClient } from '../http/http-client.js';
import { logger } from '../logger.js';

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

    logger.info(`🔍 Fetching GitLab project info from: ${apiUrl}`);

    try {
      const project = await this.http.requestJson<GitlabProject>(
        apiUrl,
        'GET',
        {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json'
        }
      );

      logger.info(`✅ Found GitLab project: ${project.name} (ID: ${project.id})`);
      logger.info(`📋 Full path: ${project.path_with_namespace}`);

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
    options: MergeRequestOptions = {}
  ): Promise<MergeRequestResponse> {
    // Get project information
    const project = await this.getProject();

    // Extract options with defaults
    const {
      assignee_id,
      assignee_ids,
      reviewer_ids,
      squash = true,
      removeSourceBranch = true,
      description = ''
    } = options;

    // Build request body with all parameters
    const bodyParams = [
      `source_branch=${encodeURIComponent(sourceBranch)}`,
      `target_branch=${encodeURIComponent(targetBranch)}`,
      `title=${encodeURIComponent(title)}`,
      `squash=${squash}`,                           // Squash all commits into one
      `remove_source_branch=${removeSourceBranch}` // Delete source branch after merge
    ];

    // Add assignee_id if specified
    if (assignee_id !== undefined && assignee_id > 0) {
      bodyParams.push(`assignee_id=${assignee_id}`);
      logger.info(`📋 Setting assignee ID: ${assignee_id}`);
    }

    // Add description if specified
    if (description) {
      bodyParams.push(`description=${encodeURIComponent(description)}`);
      logger.info(`📋 Setting description: ${description}`);
    }

    // Add assignee_ids if specified and not empty
    if (assignee_ids && assignee_ids.length > 0) {
      // Filter out invalid IDs and add each one separately
      const validAssigneeIds = assignee_ids.filter(id => id > 0);
      if (validAssigneeIds.length > 0) {
        validAssigneeIds.forEach(id => {
          bodyParams.push(`assignee_ids[]=${id}`);
        });
        logger.info(`📋 Setting assignee IDs: ${validAssigneeIds.join(', ')}`);
      }
    }

    // Add reviewer_ids if specified and not empty
    if (reviewer_ids && reviewer_ids.length > 0) {
      // Filter out invalid IDs and add each one separately
      const validReviewerIds = reviewer_ids.filter(id => id > 0);
      if (validReviewerIds.length > 0) {
        validReviewerIds.forEach(id => {
          bodyParams.push(`reviewer_ids[]=${id}`);
        });
        logger.info(`📋 Setting reviewer IDs: ${validReviewerIds.join(', ')}`);
      }
    }

    logger.info(`📋 Creating GitLab merge request for project ${project.id}`);

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

      logger.info(`✅ Created GitLab merge request: ${resp.web_url}`);
      
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
