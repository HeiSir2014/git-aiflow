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
 * GitLab API user response
 */
interface GitlabUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
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

  /**
   * Get user ID by username
   * @param username GitLab username
   * @returns User ID, or undefined if not found
   */
  async getUserIdByUsername(username: string): Promise<number | undefined> {
    const apiUrl = `${this.baseUrl}/api/v4/users?username=${encodeURIComponent(username)}`;

    logger.info(`🔍 Fetching GitLab user ID for username: ${username}`);

    try {
      const users = await this.http.requestJson<GitlabUser[]>(
        apiUrl,
        'GET',
        {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json'
        }
      );

      if (users && users.length > 0) {
        const user = users[0];
        logger.info(`✅ Found GitLab user: ${user.name} (@${user.username}, ID: ${user.id})`);
        return user.id;
      } else {
        logger.warn(`⚠️  GitLab user not found: ${username}`);
        return undefined;
      }
    } catch (error) {
      logger.error(`❌ Failed to get GitLab user ID for username "${username}": ${error}`);
      return undefined;
    }
  }

  /**
   * Resolve user identifier (username or ID) to user ID
   * @param userIdentifier Username (string) or user ID (number)
   * @returns User ID, or undefined if not found or invalid
   */
  private async resolveUserId(userIdentifier: number | string): Promise<number | undefined> {
    // If it's already a number (user ID), return it directly
    if (typeof userIdentifier === 'number') {
      return userIdentifier > 0 ? userIdentifier : undefined;
    }

    // If it's a string, try to parse as number first
    if (typeof userIdentifier === 'string') {
      const parsedId = parseInt(userIdentifier, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        // String represents a valid numeric ID
        return parsedId;
      }

      // String is a username, look up the user ID
      return await this.getUserIdByUsername(userIdentifier);
    }

    return undefined;
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

    // Resolve assignee_id if it's a username
    let resolvedAssigneeId: number | undefined;
    if (assignee_id !== undefined) {
      resolvedAssigneeId = await this.resolveUserId(assignee_id);
      if (resolvedAssigneeId === undefined && assignee_id !== 0) {
        logger.warn(`⚠️  Could not resolve assignee: ${assignee_id}`);
      }
    }

    // Resolve assignee_ids if they contain usernames
    let resolvedAssigneeIds: number[] = [];
    if (assignee_ids && assignee_ids.length > 0) {
      const resolvedIds = await Promise.all(
        assignee_ids.map(id => this.resolveUserId(id))
      );
      resolvedAssigneeIds = resolvedIds.filter((id): id is number => id !== undefined && id > 0);

      const failedCount = assignee_ids.length - resolvedAssigneeIds.length;
      if (failedCount > 0) {
        logger.warn(`⚠️  Could not resolve ${failedCount} assignee(s)`);
      }
    }

    // Resolve reviewer_ids if they contain usernames
    let resolvedReviewerIds: number[] = [];
    if (reviewer_ids && reviewer_ids.length > 0) {
      const resolvedIds = await Promise.all(
        reviewer_ids.map(id => this.resolveUserId(id))
      );
      resolvedReviewerIds = resolvedIds.filter((id): id is number => id !== undefined && id > 0);

      const failedCount = reviewer_ids.length - resolvedReviewerIds.length;
      if (failedCount > 0) {
        logger.warn(`⚠️  Could not resolve ${failedCount} reviewer(s)`);
      }
    }

    // Build request body with all parameters
    const bodyParams = [
      `source_branch=${encodeURIComponent(sourceBranch)}`,
      `target_branch=${encodeURIComponent(targetBranch)}`,
      `title=${encodeURIComponent(title)}`,
      `squash=${squash}`,                           // Squash all commits into one
      `remove_source_branch=${removeSourceBranch}` // Delete source branch after merge
    ];

    // Add assignee_id if specified (use resolved ID)
    if (resolvedAssigneeId !== undefined && resolvedAssigneeId > 0) {
      bodyParams.push(`assignee_id=${resolvedAssigneeId}`);
      logger.info(`📋 Setting assignee ID: ${resolvedAssigneeId}`);
    }

    // Add description if specified
    if (description) {
      bodyParams.push(`description=${encodeURIComponent(description)}`);
      logger.info(`📋 Setting description: ${description}`);
    }

    // Add assignee_ids if specified and not empty (use resolved IDs)
    if (resolvedAssigneeIds.length > 0) {
      resolvedAssigneeIds.forEach(id => {
        bodyParams.push(`assignee_ids[]=${id}`);
      });
      logger.info(`📋 Setting assignee IDs: ${resolvedAssigneeIds.join(', ')}`);
    }

    // Add reviewer_ids if specified and not empty (use resolved IDs)
    if (resolvedReviewerIds.length > 0) {
      resolvedReviewerIds.forEach(id => {
        bodyParams.push(`reviewer_ids[]=${id}`);
      });
      logger.info(`📋 Setting reviewer IDs: ${resolvedReviewerIds.join(', ')}`);
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
