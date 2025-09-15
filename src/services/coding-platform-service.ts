import { GitPlatformService, MergeRequestOptions, MergeRequestResponse, GitPlatformProject } from './git-platform-service.js';
import { GitService } from './git-service.js';
import { HttpClient } from '../http/http-client.js';
import { logger } from '../logger.js';


/**
 * CODING.net API response for merge request creation
 */
interface CodingMergeRequestResponse {
  Response: {
    Request: {
      DepotId: string;
      DepotPath: string;
      IId: string;
      MergeId: string;
      ProjectId: string;
    };
  };
  RequestId: string;
}

/**
 * CODING.net merge request creation payload
 */
interface CodingMergeRequestPayload {
  Content: string;
  DepotId?: number;
  DepotPath?: string;
  DestBranch: string;
  SrcBranch: string;
  Title: string;
}

/**
 * Git platform service implementation for CODING.net
 * 
 * CODING.net uses a different API structure compared to GitLab/GitHub:
 * - Uses https://e.coding.net/open-api with Action parameter
 * - Requires Bearer token authorization
 * - Uses DepotId/DepotPath instead of project ID/path
 */
export class CodingPlatformService extends GitPlatformService {
  /**
   * CODING.net Open API base URL
   */
  private static readonly CODING_API_BASE = 'https://e.coding.net/open-api';

  constructor(token: string, baseUrl: string, gitService: GitService, httpClient: HttpClient) {
    super(token, baseUrl, gitService, httpClient);
  }

  getPlatformName(): string {
    return 'coding';
  }

  /**
   * Get project information by depot path
   * @param projectPath Project path in format 'team/project/depot'
   * @returns Project information
   */
  async getProjectByPath(projectPath: string): Promise<GitPlatformProject> {
    logger.info(`Getting CODING project info for path: ${projectPath}`);
    
    // CODING.net project path format: team/project/depot
    const pathParts = projectPath.split('/');
    if (pathParts.length < 3) {
      throw new Error(`Invalid CODING project path format. Expected 'team/project/depot', got: ${projectPath}`);
    }

    const [team, project, depot] = pathParts;
    const fullDepotPath = `${team}/${project}/${depot}`;

    // For CODING.net, we construct the project info from the path
    // since the API doesn't have a direct project info endpoint
    const projectInfo: GitPlatformProject = {
      id: fullDepotPath,
      name: depot,
      full_name: fullDepotPath,
      web_url: `${this.baseUrl}/${team}/${project}/d/${depot}/git`
    };

    logger.info(`CODING project info constructed:`, projectInfo);
    return projectInfo;
  }

  /**
   * Create a merge request on CODING.net
   * @param sourceBranch Source branch name
   * @param targetBranch Target branch name  
   * @param title Request title
   * @param options Merge request options
   * @returns Merge request response
   */
  protected async createMergeRequestInternal(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    options?: MergeRequestOptions
  ): Promise<MergeRequestResponse> {
    logger.info(`Creating CODING merge request: ${sourceBranch} -> ${targetBranch}`);

    const project = await this.getProject();
    const projectPath = project.id; // This is the full depot path

    const payload: CodingMergeRequestPayload = {
      Content: options?.description || `Merge request from ${sourceBranch} to ${targetBranch}`,
      DepotPath: projectPath,
      DestBranch: targetBranch,
      SrcBranch: sourceBranch,
      Title: title
    };

    logger.debug('CODING merge request payload:', payload);

    try {
      const response = await this.http.requestJson<CodingMergeRequestResponse>(
        `${CodingPlatformService.CODING_API_BASE}?action=CreateGitMergeRequest`,
        'POST',
        {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        JSON.stringify(payload)
      );

      logger.info('CODING merge request created successfully:', response);

      // Construct the web URL for the merge request
      // CODING.net merge request URL format: https://team.coding.net/p/project/d/depot/git/mergerequests/id
      const pathParts = projectPath.split('/');
      const [team, project, depot] = pathParts;
      const mergeRequestId = response.Response.Request.MergeId;
      const webUrl = `https://${team}.coding.net/p/${project}/d/${depot}/git/mergerequests/${mergeRequestId}`;

      return {
        web_url: webUrl,
        id: parseInt(mergeRequestId, 10),
        title: title
      };

    } catch (error) {
      logger.error('Failed to create CODING merge request:', error);
      throw new Error(`Failed to create CODING merge request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract depot path from CODING.net git URL
   * @param gitUrl Git repository URL
   * @returns Depot path in format 'team/project/depot'
   */
  static extractDepotPath(gitUrl: string): string | null {
    // CODING.net git URL formats:
    // https://e.coding.net/team/project/depot.git
    // git@e.coding.net:team/project/depot.git
    // https://team.coding.net/p/project/d/depot/git
    
    const httpsRegex = /https:\/\/e\.coding\.net\/([^\/]+)\/([^\/]+)\/([^\/]+)(?:\.git)?/;
    const sshRegex = /git@e\.coding\.net:([^\/]+)\/([^\/]+)\/([^\/]+)(?:\.git)?/;
    const legacyRegex = /https:\/\/([^\.]+)\.coding\.net\/p\/([^\/]+)\/d\/([^\/]+)\/git/;

    let match = gitUrl.match(httpsRegex);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]}`;
    }

    match = gitUrl.match(sshRegex);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]}`;
    }

    match = gitUrl.match(legacyRegex);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]}`;
    }

    return null;
  }
}
