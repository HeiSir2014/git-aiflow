import updateNotifier from 'update-notifier';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Shell } from '../shell.js';

/**
 * Interface for update cache data
 */
interface UpdateCache {
  lastCheckTime: number;
  lastVersion?: string;
}

/**
 * Update checker utility for managing version checks and automatic updates
 */
export class UpdateChecker {
  private readonly shell = new Shell();
  private readonly packageJson: any;
  private readonly cacheFilePath: string;
  private readonly checkIntervalMs = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Try multiple possible locations for package.json
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFilePath);
    
    const possiblePaths = [
      // When running from built dist directory
      join(currentDir, '..', '..', 'package.json'),
      join(currentDir, '..', 'package.json'),
      // When running from source
      join(currentDir, '..', '..', 'package.json'),
      // When running from global installation
      join(currentDir, 'package.json'),
      // Alternative paths for different installation scenarios
      join(dirname(dirname(currentDir)), 'package.json')
    ];
    
    let packageJsonPath = '';
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        packageJsonPath = path;
        break;
      }
    }
    
    if (!packageJsonPath) {
      throw new Error('Could not locate package.json file');
    }
    
    try {
      this.packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to read package.json from ${packageJsonPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Set cache file path in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const cacheDir = join(homeDir, '.aiflow');
    this.cacheFilePath = join(cacheDir, 'update-cache.json');

    // Ensure cache directory exists
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }

  /**
   * Check if the current installation is a global npm installation
   */
  isGlobalInstallation(): boolean {
    try {
      // Check if the script is running from a global npm installation
      const scriptPath = process.argv[1];
      
      // Common patterns for global npm installations
      const globalPatterns = [
        '/usr/local/lib/node_modules/',
        '/usr/lib/node_modules/',
        '\\AppData\\Roaming\\npm\\node_modules\\',
        '\\Program Files\\nodejs\\node_modules\\',
        '/opt/homebrew/lib/node_modules/',
        '/.nvm/versions/node/',
        '/.volta/tools/image/node/',
        '/node_modules/.bin/',
        '\\node_modules\\.bin\\'
      ];

      const isGlobal = globalPatterns.some(pattern => 
        scriptPath.includes(pattern) || scriptPath.includes(pattern.replace(/\//g, '\\'))
      );

      // Additional check: try to run 'npm list -g --depth=0' to see if our package is listed
      if (isGlobal) {
        try {
          // Cross-platform approach: let the shell handle errors gracefully
          const result = this.shell.run('npm list -g --depth=0 git-aiflow');
          return result.includes('git-aiflow');
        } catch {
          // If npm command fails, fall back to path-based detection
          // This is expected if the package is not globally installed
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Failed to detect installation type:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Load update cache from file
   */
  private loadCache(): UpdateCache {
    try {
      if (existsSync(this.cacheFilePath)) {
        const cacheData = readFileSync(this.cacheFilePath, 'utf8');
        return JSON.parse(cacheData);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load update cache:', error instanceof Error ? error.message : 'Unknown error');
    }

    return { lastCheckTime: 0 };
  }

  /**
   * Save update cache to file
   */
  private saveCache(cache: UpdateCache): void {
    try {
      writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      console.warn('⚠️ Failed to save update cache:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check if it's time to check for updates (based on 10-minute interval)
   */
  private shouldCheckForUpdates(): boolean {
    const cache = this.loadCache();
    const now = Date.now();
    return (now - cache.lastCheckTime) >= this.checkIntervalMs;
  }

  /**
   * Perform automatic update installation
   */
  private async performAutoUpdate(latestVersion: string): Promise<boolean> {
    try {
      console.log(`🔄 Updating git-aiflow from ${this.packageJson.version} to ${latestVersion}...`);
      
      // Run npm install -g git-aiflow@latest
      const result = this.shell.run('npm install -g git-aiflow@latest');

      // Check if the command was successful by looking for success indicators in output
      if (result.includes('added') || result.includes('changed') || result.includes('updated')) {
        console.log(`✅ Successfully updated to git-aiflow@${latestVersion}`);
        console.log('🔄 Please restart the command to use the new version.');
        return true;
      } else {
        console.error(`❌ Failed to update git-aiflow:`, result);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error during auto-update:`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check for updates and automatically update if available
   */
  async checkAndUpdate(): Promise<void> {
    try {
      // Only check if this is a global installation
      if (!this.isGlobalInstallation()) {
        console.log('🔄 Skipping update check (not a global installation)');
        return;
      }

      console.log('🔄 Checking for updates...');

      // Only check if enough time has passed since last check
      if (!this.shouldCheckForUpdates()) {
        console.log('🔄 Skipping update check (not enough time has passed since last check)');
        return;
      }

      // Use update-notifier to check for updates
      const notifier = updateNotifier({
        pkg: this.packageJson,
        updateCheckInterval: 0 // We handle the interval ourselves
      });

      // Update the cache with current check time
      const cache = this.loadCache();
      cache.lastCheckTime = Date.now();
      
      if (notifier.update) {
        console.log(`📦 Update available: ${this.packageJson.version} → ${notifier.update.latest}`);
        
        // Store the latest version in cache
        cache.lastVersion = notifier.update.latest;
        this.saveCache(cache);

        // Perform automatic update
        const updateSuccess = await this.performAutoUpdate(notifier.update.latest);
        
        if (updateSuccess) {
          // Exit the process after successful update so user can restart with new version
          console.log('🚀 Update completed! Please run the command again.');
          return;
        }
      } else {
        // No update available, just save the cache
        this.saveCache(cache);
      }
    } catch (error) {
      console.warn('⚠️ Update check failed:', error instanceof Error ? error.message : 'Unknown error');
      
      // Still update the cache to avoid repeated failed checks
      const cache = this.loadCache();
      cache.lastCheckTime = Date.now();
      this.saveCache(cache);
    }
  }

  /**
   * Force check for updates (ignoring cache)
   */
  async forceCheckAndUpdate(): Promise<void> {
    // Clear cache to force check
    const cache = this.loadCache();
    cache.lastCheckTime = 0;
    this.saveCache(cache);
    
    await this.checkAndUpdate();
  }

  /**
   * Get current version info
   */
  getVersionInfo(): { name: string; version: string } {
    return {
      name: this.packageJson.name,
      version: this.packageJson.version
    };
  }
}
