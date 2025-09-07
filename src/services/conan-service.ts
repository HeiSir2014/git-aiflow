import { HttpClient } from '../http/http-client.js';

/**
 * Conan package version query service using Conan v2 REST API
 */
export class ConanService {
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(baseUrl: string, http?: HttpClient) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.http = http || new HttpClient();
  }

  /**
   * Query all versions of a specific package from a remote repository
   * @param remote Remote repository name (e.g., "repo")
   * @param packageName Package name (e.g., "zterm" or "xxx/winusb")
   * @returns Array of version information
   */
  async getPackageVersions(remote: string, packageName: string): Promise<ConanPackageVersion[]> {
    console.log(`🔍 Searching for package versions: ${packageName} in remote ${remote}`);
    
    try {
      // Use Conan v2 search API to find all versions of the package
      const searchUrl = `${this.baseUrl}/artifactory/api/conan/${remote}/v2/conans/search?q=${encodeURIComponent(packageName)}`;
      console.log(`🔍 Search API endpoint: ${searchUrl}`);
      
      const response = await this.http.requestJson<ConanSearchResponse>(
        searchUrl,
        "GET",
        {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      );

      console.log(`📋 Search Response: found ${response.results?.length || 0} results`);

      if (response.results && response.results.length > 0) {
        // Parse results and extract versions
        const versions = response.results
          .filter(result => result.startsWith(`${packageName}/`))
          .map(result => {
            // Parse format: "packageName/version@user/channel"
            const match = result.match(/^(.+?)\/(.+?)@(.+?)\/(.+?)$/);
            if (match) {
              const [, pkg, version, user, channel] = match;
              // Generate correct URL based on user/channel
              const urlPath = user === '_' && channel === '_' 
                ? `${remote}/_/${pkg}/${version}`
                : `${remote}/${user}/${pkg}/${version}`;
              
              return {
                version,
                packageName: pkg,
                remote,
                url: `${this.baseUrl}/ui/native/${urlPath}`,
                reference: result
              };
            }
            return null;
          })
          .filter((v): v is ConanPackageVersion => v !== null)
          .sort((a, b) => this.compareVersions(b.version, a.version));

        console.log(`✅ Found ${versions.length} versions:`);
        versions.forEach((v, i) => {
          console.log(`   ${i + 1}. ${v.version}`);
        });
        
        return versions;
      }

      console.warn(`⚠️  No versions found for package ${packageName} in remote ${remote}`);
      return [];
      
    } catch (error) {
      console.error(`❌ Failed to get package versions: ${error}`);
      return [];
    }
  }


  /**
   * Get latest version of a package
   */
  async getLatestVersion(remote: string, packageName: string): Promise<ConanPackageVersion | null> {
    const versions = await this.getPackageVersions(remote, packageName);
    return versions.length > 0 ? versions[0] : null;
  }

  /**
   * Get package revision information using Conan v2 API
   * @param remote Remote repository name
   * @param packageName Package name (e.g., "zterm" )
   * @param version Package version (e.g., "1.0.0.25")
   * @param reference Optional full reference (e.g., "zterm/1.0.0.25@_/_") to avoid search API call
   * @returns Package revision information
   */
  async getPackageRevision(remote: string, packageName: string, version: string, reference?: string): Promise<ConanPackageRevision | null> {
    try {
      let targetReference = reference;
      
      // If no reference provided, get it from search results
      if (!targetReference) {
        console.log(`🔍 Finding correct reference path for ${packageName}/${version}`);
        const versions = await this.getPackageVersions(remote, packageName);
        
        // Find the matching version to get the correct reference
        const matchingVersion = versions.find(v => v.version === version);
        if (!matchingVersion) {
          console.warn(`⚠️  Version ${version} not found for package ${packageName}`);
          return null;
        }
        targetReference = matchingVersion.reference;
      }
      // Parse the reference to extract the correct path
      // Format: "packageName/version@user/channel"
      const referenceParts = targetReference.match(/^(.+?)@(.+)$/);
      if (!referenceParts) {
        console.error(`❌ Invalid reference format: ${targetReference}`);
        return null;
      }
      
      const [, packagePath, userChannel] = referenceParts;
      
      // Use Conan v2 revisions API with correct path
      const revisionsUrl = `${this.baseUrl}/artifactory/api/conan/${remote}/v2/conans/${packagePath}/${userChannel}/revisions`;
      
      console.log(`🔍 Fetching revision info: ${revisionsUrl}`);
      console.log(`📋 Using reference: ${targetReference}`);
      
      const response = await this.http.requestJson<ConanRevisionsResponse>(
        revisionsUrl,
        "GET",
        {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      );

      console.log(`📋 Revisions Response: reference=${response.reference}, revisions=${response.revisions?.length || 0}`);

      if (response.revisions && response.revisions.length > 0) {
        // Get the latest revision (first one)
        const latestRevision = response.revisions[0];
        
        // Convert time to timestamp
        const timestamp = this.convertTimeToTimestamp(latestRevision.time);
        
        const revisionInfo: ConanPackageRevision = {
          packageName,
          version,
          reference: response.reference,
          revision: latestRevision.revision,
          time: latestRevision.time,
          timestamp,
          lockEntry: `${packageName}/${version}#${latestRevision.revision}%${timestamp}`
        };
        
        console.log(`✅ Found revision: ${latestRevision.revision}`);
        console.log(`⏰ Time: ${latestRevision.time} → Timestamp: ${timestamp}`);
        console.log(`🔒 Lock entry: ${revisionInfo.lockEntry}`);
        
        return revisionInfo;
      }

      console.warn(`⚠️  No revisions found for ${packageName}/${version}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Failed to get revision info: ${error}`);
      return null;
    }
  }

  /**
   * Convert Conan time format to timestamp
   * @param timeStr Time string like "2025-09-06T00:34:38.826+0800"
   * @returns Timestamp string like "1757090078.826"
   */
  private convertTimeToTimestamp(timeStr: string): string {
    try {
      // Parse the time string to Date object
      const date = new Date(timeStr);
      
      // Get timestamp in seconds with milliseconds
      const timestampMs = date.getTime();
      const timestampSec = Math.floor(timestampMs / 1000);
      const milliseconds = timestampMs % 1000;
      
      // Format as "seconds.milliseconds"
      return `${timestampSec}.${milliseconds.toString().padStart(3, '0')}`;
      
    } catch (error) {
      console.error(`❌ Failed to convert time "${timeStr}": ${error}`);
      // Fallback: use current time
      const now = Date.now();
      const timestampSec = Math.floor(now / 1000);
      const milliseconds = now % 1000;
      return `${timestampSec}.${milliseconds.toString().padStart(3, '0')}`;
    }
  }

  /**
   * Get complete package information including revision
   * @param remote Remote repository name
   * @param packageName Package name
   * @param version Package version (optional, gets latest if not provided)
   * @returns Complete package information with revision
   */
  async getCompletePackageInfo(remote: string, packageName: string, version?: string): Promise<ConanCompletePackageInfo | null> {
    try {
      let targetVersionInfo: ConanPackageVersion | null = null;
      
      // If no version specified, get the latest
      if (!version) {
        targetVersionInfo = await this.getLatestVersion(remote, packageName);
        if (!targetVersionInfo) {
          console.error(`❌ No versions found for package ${packageName}`);
          return null;
        }
      } else {
        // Find the specific version to get its reference
        const versions = await this.getPackageVersions(remote, packageName);
        targetVersionInfo = versions.find(v => v.version === version) || null;
        if (!targetVersionInfo) {
          console.error(`❌ Version ${version} not found for package ${packageName}`);
          return null;
        }
      }
      
      // Get revision information using the reference from version info
      const revisionInfo = await this.getPackageRevision(
        remote, 
        packageName, 
        targetVersionInfo.version, 
        targetVersionInfo.reference
      );
      if (!revisionInfo) {
        console.error(`❌ No revision info found for ${packageName}/${targetVersionInfo.version}`);
        return null;
      }
      
      return {
        packageName,
        version: targetVersionInfo.version,
        remote,
        revision: revisionInfo.revision,
        timestamp: revisionInfo.timestamp,
        lockEntry: revisionInfo.lockEntry,
        reference: revisionInfo.reference,
        time: revisionInfo.time
      };
      
    } catch (error) {
      console.error(`❌ Failed to get complete package info: ${error}`);
      return null;
    }
  }



  /**
   * Compare semantic versions for sorting
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      const parts = version.split(/[.-]/).map(part => {
        const num = parseInt(part, 10);
        return isNaN(num) ? part : num;
      });
      return parts;
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (typeof aPart === 'number' && typeof bPart === 'number') {
        if (aPart !== bPart) return aPart - bPart;
      } else {
        const aStr = String(aPart);
        const bStr = String(bPart);
        if (aStr !== bStr) return aStr.localeCompare(bStr);
      }
    }

    return 0;
  }
}

/**
 * Conan package version information
 */
export interface ConanPackageVersion {
  version: string;
  packageName: string;
  remote: string;
  url: string;
  reference: string;
  lastModified?: string;
}


/**
 * Conan package revision information
 */
export interface ConanPackageRevision {
  packageName: string;
  version: string;
  reference: string;
  revision: string;
  time: string;
  timestamp: string;
  lockEntry: string;
}

/**
 * Complete Conan package information including revision
 */
export interface ConanCompletePackageInfo {
  packageName: string;
  version: string;
  remote: string;
  revision: string;
  timestamp: string;
  lockEntry: string;
  reference: string;
  time: string;
}

/**
 * Conan v2 search API response format
 */
interface ConanSearchResponse {
  results: string[];
}

/**
 * Conan v2 revisions API response format
 */
interface ConanRevisionsResponse {
  reference: string;
  revisions: Array<{
    revision: string;
    time: string;
  }>;
}