import { GitService } from './git-service.js';
import { HttpClient } from '../http/http-client.js';
import { LoadedConfig, getGitAccessToken } from '../config.js';
import { logger } from '../logger.js';

/**
 * Git platform merge/pull request response
 */
export interface MergeRequestResponse {
  web_url: string;   // Web URL for the merge/pull request
  id: number;        // Unique ID for the request
  title: string;     // Title of the request
  number?: number;   // Request number (GitHub specific)
}

/**
 * Git platform project information
 */
export interface GitPlatformProject {
  id: string;
  name: string;
  full_name: string;
  web_url: string;
}

/**
 * Merge Request configuration options
 */
export interface MergeRequestOptions {
  assignee_id?: number;
  assignee_ids?: number[];
  reviewer_ids?: number[];
  squash?: boolean;
  removeSourceBranch?: boolean;
  description?: string;
}

/**
 * Abstract base class for Git platform services
 */
export abstract class GitPlatformService {
  protected readonly token: string;
  protected readonly baseUrl: string;
  protected readonly http: HttpClient;
  protected readonly gitService: GitService;

  protected constructor(token: string, baseUrl: string, gitService: GitService, http: HttpClient) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.gitService = gitService;
    this.http = http;

    logger.info(`Initialized ${this.getPlatformName()} service`, {
      baseUrl: this.baseUrl,
      tokenLength: this.token.length
    });
  }

  /**
   * Get the platform name (e.g., 'gitlab', 'github')
   */
  abstract getPlatformName(): string;

  /**
   * Get project information by path
   * @param projectPath Project path (e.g., 'user/repo')
   * @returns Project information
   */
  abstract getProjectByPath(projectPath: string): Promise<GitPlatformProject>;

  /**
   * Get project information from current Git remote
   * @returns Project information
   */
  async getProject(): Promise<GitPlatformProject> {
    const remoteUrl = this.gitService.getRemoteUrl();
    logger.info(`🔍 Git remote URL: ${remoteUrl}`);

    // Check for error messages from git commands
    if (remoteUrl.startsWith('Error getting URL') || remoteUrl === 'No remote configured') {
      throw new Error(`Git remote URL error: ${remoteUrl}`);
    }

    const projectPath = this.gitService.parseProjectPathFromUrl(remoteUrl);
    if (!projectPath) {
      throw new Error(`Failed to parse project path from git remote URL: ${remoteUrl}`);
    }

    logger.info(`📋 Parsed project path: ${projectPath}`);
    return await this.getProjectByPath(projectPath);
  }

  /**
   * Create a merge/pull request (internal implementation)
   * @param sourceBranch Source branch name
   * @param targetBranch Target branch name
   * @param title Request title
   * @param options Merge request options including assignees, reviewers, squash, etc.
   * @returns Raw platform response
   */
  protected abstract createMergeRequestInternal(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    options?: MergeRequestOptions
  ): Promise<MergeRequestResponse>;

  /**
   * Create a merge/pull request
   * @param sourceBranch Source branch name
   * @param targetBranch Target branch name
   * @param title Request title
   * @param options Merge request options including assignees, reviewers, squash, etc.
   * @returns Web URL of the created request
   */
  async createMergeRequest(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    options?: MergeRequestOptions
  ): Promise<string> {
    const response = await this.createMergeRequestInternal(sourceBranch, targetBranch, title, options);
    return response.web_url;
  }

  /**
   * Create a merge/pull request (legacy method for backward compatibility)
   * @param sourceBranch Source branch name
   * @param targetBranch Target branch name
   * @param title Request title
   * @param squash Whether to squash commits
   * @param removeSourceBranch Whether to remove source branch after merge
   * @returns Web URL of the created request
   * @deprecated Use createMergeRequest with options parameter instead
   */
  async createMergeRequestLegacy(
    sourceBranch: string,
    targetBranch: string,
    title: string,
    squash?: boolean,
    removeSourceBranch?: boolean
  ): Promise<string> {
    const options: MergeRequestOptions = {
      squash,
      removeSourceBranch
    };
    return this.createMergeRequest(sourceBranch, targetBranch, title, options);
  }

  /**
   * Get the base URL of this service
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * Supported Git platforms
 */
export enum GitPlatform {
  GITLAB = 'gitlab',
  GITHUB = 'github',
  GITEE = 'gitee',
  GITEE_ORG = 'gitee_org',
  CODING = 'coding',
  CODING_ORG = 'coding_org'
}

/**
 * Get Git access token for current repository
 * @param config Loaded configuration
 * @param gitService GitService instance
 * @returns Access token for the current Git remote hostname
 */
export function getGitAccessTokenForCurrentRepo(config: LoadedConfig, gitService: GitService): string {
  try {
    const hostname = gitService.extractHostnameFromRemoteUrl();

    if (!hostname) {
      throw new Error('Could not determine Git hostname');
    }

    const token = getGitAccessToken(config, hostname);

    if (!token) {
      throw new Error(`No access token configured for ${hostname}`);
    }

    logger.info(`🔑 Using access token for: ${hostname}`);
    return token;
  } catch (error) {
    throw new Error(`Failed to get Git access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Factory for creating Git platform services
 */
export class GitPlatformServiceFactory {
  private static readonly logger = logger;

  /**
   * Create a Git platform service with full automatic detection and configuration
   * Automatically loads configuration, detects Git remote, and creates appropriate platform service
   * @returns Platform service or undefined if not supported
   */
  static async create(): Promise<GitPlatformService | undefined> {
    GitPlatformServiceFactory.logger.info('Starting Git platform service creation');

    try {
      // Create service instances
      const { HttpClient } = await import('../http/http-client.js');
      const { GitService } = await import('./git-service.js');

      const httpClient = new HttpClient();
      const gitSvc = GitService.instance();

      // Load configuration
      const { configLoader } = await import('../config.js');
      const loadedConfig = await configLoader.loadConfig();

      // Get access token for current repository
      GitPlatformServiceFactory.logger.debug('Getting Git access token for current repository');
      const token = getGitAccessTokenForCurrentRepo(loadedConfig, gitSvc);

      // Detect hostname from Git remote
      const hostname = gitSvc.extractHostnameFromRemoteUrl();
      if (!hostname) {
        GitPlatformServiceFactory.logger.warn('Could not detect hostname from Git remote');
        return undefined;
      }

      GitPlatformServiceFactory.logger.info(`Detected Git hostname: ${hostname}`);

      // Detect platform type
      const platform = await GitPlatformServiceFactory.detectPlatform(hostname, gitSvc);
      if (!platform) {
        GitPlatformServiceFactory.logger.warn(`Unsupported Git platform: ${hostname}`);
        return undefined;
      }

      GitPlatformServiceFactory.logger.info(`Platform detected: ${platform}`);

      // Get the correct base URL with protocol detection
      const baseUrl = await gitSvc.extractBaseUrlFromRemoteUrl(`git@${hostname}:dummy/repo.git`);

      // Create platform-specific service with dynamic imports
      switch (platform) {
        case GitPlatform.GITLAB: {
          const module = await import('./gitlab-platform-service.js');
          return new module.GitlabPlatformService(token, baseUrl, gitSvc, httpClient);
        }

        case GitPlatform.GITHUB: {
          const module = await import('./github-platform-service.js');
          return new module.GithubPlatformService(token, baseUrl, gitSvc, httpClient);
        }

        case GitPlatform.CODING:
        case GitPlatform.CODING_ORG: {
          const module = await import('./coding-platform-service.js');
          return new module.CodingPlatformService(token, baseUrl, gitSvc, httpClient);
        }

        default:
          return undefined;
      }
    } catch (error) {
      console.error(`❌ Failed to create Git platform service: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return undefined;
    }
  }

  /**
   * Detect Git platform from hostname
   * @param hostname Git hostname
   * @param gitService GitService instance for API detection
   * @returns Detected platform or undefined
   */
  private static async detectPlatform(hostname: string, gitService: GitService): Promise<GitPlatform | undefined> {
    // Known platforms by hostname
    if (hostname === 'github.com') {
      return GitPlatform.GITHUB;
    }

    if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
      return GitPlatform.GITLAB;
    }

    if (hostname === 'e.coding.net' || hostname === 'coding.net' || hostname.includes('coding.net')) {
      return GitPlatform.CODING;
    }

    // For unknown hostnames, try to detect by API endpoints
    GitPlatformServiceFactory.logger.info(`Unknown hostname ${hostname}, detecting platform via API endpoints`);

    try {
      const baseUrl = await gitService.extractBaseUrlFromRemoteUrl(`git@${hostname}:dummy/repo.git`);

      // Try to detect platform by API endpoints
      const platform = await GitPlatformServiceFactory.detectPlatformByApi(baseUrl);
      if (platform) {
        GitPlatformServiceFactory.logger.info(`Detected ${platform.toUpperCase()} platform for ${hostname}`);
        return platform;
      }
    } catch (error) {
      GitPlatformServiceFactory.logger.warn(`Failed to detect platform for ${hostname}`, error);
    }

    return undefined;
  }

  /**
   * Detect platform by probing API endpoints
   * @param baseUrl Base URL of the Git hosting service
   * @returns Detected platform or undefined
   */
  private static async detectPlatformByApi(baseUrl: string): Promise<GitPlatform | undefined> {
    const timeout = 3000; // 3 second timeout

    try {
      // Test GitLab API endpoint (version endpoint)
      GitPlatformServiceFactory.logger.debug(`Testing GitLab API: ${baseUrl}/api/v4/version`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const gitlabResponse = await fetch(`${baseUrl}/api/v4/version`, {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (gitlabResponse.status === 200 || gitlabResponse.status === 401) {
          // 200: public endpoint, 401: requires auth but endpoint exists
          GitPlatformServiceFactory.logger.info(`GitLab API detected (status: ${gitlabResponse.status})`);
          return GitPlatform.GITLAB;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name !== 'AbortError') {
          GitPlatformServiceFactory.logger.debug(`GitLab API test failed: ${error.message}`);
        }
      }

      // Test GitHub API endpoint
      // Use URL parsing to avoid unsafe substring check (see CodeQL warning)
      let hostname;
      try {
        hostname = new URL(baseUrl).hostname;
      } catch {
        hostname = '';
      }
      const githubApiUrl = hostname === 'github.com' ? 'https://api.github.com' : `${baseUrl}/api/v3`;
      GitPlatformServiceFactory.logger.debug(`Testing GitHub API: ${githubApiUrl}`);

      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), timeout);

      try {
        const githubResponse = await fetch(githubApiUrl, {
          method: 'HEAD',
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);

        if (githubResponse.status === 200) {
          GitPlatformServiceFactory.logger.info(`GitHub API detected (status: ${githubResponse.status})`);
          return GitPlatform.GITHUB;
        }
      } catch (error) {
        clearTimeout(timeoutId2);
        if (error instanceof Error && error.name !== 'AbortError') {
          GitPlatformServiceFactory.logger.debug(`GitHub API test failed: ${error.message}`);
        }
      }

      // Test CODING.net API endpoint
      const codingApiUrl = 'https://e.coding.net/open-api?action=DescribeUserByGK';
      GitPlatformServiceFactory.logger.debug(`Testing CODING API: ${codingApiUrl}`);

      const controller3 = new AbortController();
      const timeoutId3 = setTimeout(() => controller3.abort(), timeout);

      try {
        const codingResponse = await fetch(codingApiUrl, {
          method: 'HEAD',
          signal: controller3.signal
        });
        clearTimeout(timeoutId3);

        if (codingResponse.status === 200 || codingResponse.status === 401 || codingResponse.status === 400) {
          // 200: public endpoint, 401: requires auth, 400: bad request but endpoint exists
          GitPlatformServiceFactory.logger.info(`CODING API detected (status: ${codingResponse.status})`);
          return GitPlatform.CODING;
        }
      } catch (error) {
        clearTimeout(timeoutId3);
        if (error instanceof Error && error.name !== 'AbortError') {
          GitPlatformServiceFactory.logger.debug(`CODING API test failed: ${error.message}`);
        }
      }

      GitPlatformServiceFactory.logger.warn(`No known platform API detected for ${baseUrl}`);
      return undefined;

    } catch (error) {
      GitPlatformServiceFactory.logger.error('Platform detection failed', error);
      return undefined;
    }
  }

  /**
   * Get list of supported platforms
   */
  static getSupportedPlatforms(): GitPlatform[] {
    return [GitPlatform.GITLAB, GitPlatform.GITHUB, GitPlatform.CODING];
  }
}
