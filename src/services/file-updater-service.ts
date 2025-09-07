import { ConanDataService } from './conandata-service.js';
import { ConanLockService } from './conanlock-service.js';
import { ConanService, ConanPackageVersion, ConanCompletePackageInfo } from './conan-service.js';
import { GitService } from './git-service.js';

/**
 * Service for updating Conan package files and managing git operations
 */
export class FileUpdaterService {
  private readonly conanDataService: ConanDataService;
  private readonly conanLockService: ConanLockService;
  private readonly conanService: ConanService;
  private readonly gitService: GitService;

  constructor(
    conanService: ConanService,
    gitService: GitService,
    workingDirectory?: string
  ) {
    this.conanService = conanService;
    this.gitService = gitService;
    this.conanDataService = new ConanDataService(workingDirectory);
    this.conanLockService = new ConanLockService(workingDirectory);
  }

  /**
   * Check if required files exist
   */
  validateFiles(): void {
    const missing: string[] = [];
    
    if (!this.conanDataService.exists()) {
      missing.push('conandata.yml');
    }
    
    if (!this.conanLockService.exists()) {
      missing.push('conan.win.lock');
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required files: ${missing.join(', ')}`);
    }
  }

  /**
   * Get latest version for a package
   * @param remote Remote repository name
   * @param packageName Package name
   * @returns Latest version info
   */
  async getLatestVersion(remote: string, packageName: string): Promise<ConanPackageVersion> {
    console.log(`🔍 Fetching latest version for ${packageName} from ${remote}...`);
    
    const latestVersion = await this.conanService.getLatestVersion(remote, packageName);
    if (!latestVersion) {
      throw new Error(`No versions found for package ${packageName} in remote ${remote}`);
    }
    
    console.log(`📦 Latest version: ${latestVersion.version} (${latestVersion.lastModified})`);
    return latestVersion;
  }

  /**
   * Get complete package information including revision
   * @param remote Remote repository name
   * @param packageName Package name
   * @returns Complete package info with revision
   */
  async getCompletePackageInfo(remote: string, packageName: string): Promise<ConanCompletePackageInfo> {
    console.log(`🔍 Fetching complete package info for ${packageName} from ${remote}...`);
    
    const completeInfo = await this.conanService.getCompletePackageInfo(remote, packageName);
    if (!completeInfo) {
      throw new Error(`No complete package info found for ${packageName} in remote ${remote}`);
    }
    
    console.log(`📦 Complete info: ${completeInfo.packageName}/${completeInfo.version}`);
    console.log(`🔒 Revision: ${completeInfo.revision}`);
    console.log(`⏰ Timestamp: ${completeInfo.timestamp}`);
    return completeInfo;
  }

  /**
   * Check if package needs update (comparing both version and revision)
   * @param packageName Package name
   * @param completeInfo Complete package info with version and revision
   * @returns True if update is needed
   */
  needsUpdate(packageName: string, completeInfo: ConanCompletePackageInfo): boolean {
    const currentDataVersion = this.conanDataService.getCurrentVersion(packageName);
    const currentLockInfo = this.conanLockService.getCurrentLockInfo(packageName);
    
    console.log(`📋 Current versions:`);
    console.log(`   conandata.yml: ${currentDataVersion || 'not found'}`);
    console.log(`   conan.win.lock: ${currentLockInfo?.packageRef || 'not found'}`);
    console.log(`   conan.win.lock revision: ${currentLockInfo?.hash || 'not found'}`);
    console.log(`   Latest available: ${packageName}/${completeInfo.version}`);
    console.log(`   Latest revision: ${completeInfo.revision}`);
    
    if (!currentDataVersion && !currentLockInfo) {
      console.log(`⚠️  Package ${packageName} not found in either file`);
      return false;
    }
    
    // Check both version and revision
    const versionNeedsUpdate = currentDataVersion !== completeInfo.version;
    const revisionNeedsUpdate = currentLockInfo?.hash !== completeInfo.revision;
    const packageRefNeedsUpdate = currentLockInfo?.packageRef !== `${packageName}/${completeInfo.version}`;
    
    const needsUpdate = versionNeedsUpdate || revisionNeedsUpdate || packageRefNeedsUpdate;
    
    if (needsUpdate) {
      console.log(`🔄 Update needed for ${packageName}:`);
      if (versionNeedsUpdate) {
        console.log(`   📦 Version: ${currentDataVersion} → ${completeInfo.version}`);
      }
      if (revisionNeedsUpdate) {
        console.log(`   🔒 Revision: ${currentLockInfo?.hash || 'none'} → ${completeInfo.revision}`);
      }
    } else {
      console.log(`✅ Package ${packageName} is already up to date`);
    }
    
    return needsUpdate;
  }

  /**
   * Update package in both files using complete package info
   * @param completeInfo Complete package information with revision
   */
  updatePackageFiles(completeInfo: ConanCompletePackageInfo): void {
    console.log(`📝 Updating ${completeInfo.packageName} to version ${completeInfo.version}...`);
    console.log(`🔒 Using revision: ${completeInfo.revision}`);
    console.log(`⏰ Using timestamp: ${completeInfo.timestamp}`);
    
    // Update conandata.yml
    this.conanDataService.updateAndSave(completeInfo.packageName, completeInfo.version);
    
    // Update conan.win.lock with correct revision and timestamp
    this.conanLockService.updateAndSave(
      completeInfo.packageName, 
      completeInfo.version, 
      completeInfo.revision,
      completeInfo.timestamp
    );
    
    console.log(`✅ Successfully updated ${completeInfo.packageName} in both files`);
    console.log(`🔒 Lock entry: ${completeInfo.lockEntry}`);
  }

  /**
   * Stage updated files for git commit
   */
  stageFiles(): void {
    console.log(`📋 Staging updated files...`);
    
    const filesToStage = ['conandata.yml', 'conan.win.lock'];
    
    try {
      this.gitService.addFiles(filesToStage);
      console.log(`✅ All files staged successfully`);
    } catch (error) {
      console.error(`❌ Failed to stage files:`, error);
      throw error;
    }
  }

  /**
   * Complete package update workflow (only update files, don't stage)
   * @param remote Remote repository name
   * @param packageName Package name to update
   * @returns Complete package info if update was performed, null if no update needed
   */
  async updatePackage(remote: string, packageName: string): Promise<ConanCompletePackageInfo | null> {
    console.log(`🚀 Starting package update for ${packageName}...`);
    
    // Validate files exist
    this.validateFiles();
    
    // Get complete package information including revision
    const completeInfo = await this.getCompletePackageInfo(remote, packageName);
    
    // Check if update is needed (comparing both version and revision)
    if (!this.needsUpdate(packageName, completeInfo)) {
      console.log(`ℹ️  Package ${packageName} is already up to date (${completeInfo.version}, revision: ${completeInfo.revision})`);
      return null;
    }
    
    // Update files with complete revision information (but don't stage yet)
    this.updatePackageFiles(completeInfo);
    
    console.log(`🎉 Package files updated for ${packageName} (not staged yet)`);
    return completeInfo;
  }
}
