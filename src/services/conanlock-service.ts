import * as fs from 'fs';
import * as path from 'path';
import _ from 'lodash';
const { escapeRegExp } = _;

/**
 * Interface for Conan lock file entry
 */
interface ConanLockEntry {
  packageRef: string;  // e.g., "zterm/1.0.0.24"
  hash: string;        // e.g., "9bbcb882c9c62af94fcfd21f98e3b711"
  timestamp: string;   // e.g., "1756995353.576"
}

/**
 * Service for managing conan.win.lock file updates
 */
export class ConanLockService {
  private readonly filePath: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.filePath = path.join(workingDirectory, 'conan.win.lock');
  }

  /**
   * Check if conan.win.lock exists
   */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  /**
   * Read and parse conan.win.lock content
   */
  readContent(): string {
    if (!this.exists()) {
      throw new Error(`conan.win.lock not found at ${this.filePath}`);
    }
    return fs.readFileSync(this.filePath, 'utf-8');
  }

  /**
   * Parse lock file entry from string
   * @param lockEntry Entry like "zterm/1.0.0.24#9bbcb882c9c62af94fcfd21f98e3b711%1756995353.576"
   * @returns Parsed entry object
   */
  private parseLockEntry(lockEntry: string): ConanLockEntry | null {
    // Pattern: packageName/version#hash%timestamp
    const pattern = /^([^#]+)#([^%]+)%(.+)$/;
    const match = lockEntry.match(pattern);
    
    if (!match) {
      return null;
    }
    
    return {
      packageRef: match[1],
      hash: match[2],
      timestamp: match[3]
    };
  }

  /**
   * Build lock entry string from components
   */
  private buildLockEntry(packageRef: string, hash: string, timestamp: string): string {
    return `${packageRef}#${hash}%${timestamp}`;
  }

  /**
   * Update package version in conan.win.lock
   * @param packageName Package name (e.g., "zterm")
   * @param newVersion New version (e.g., "1.0.0.25")
   * @param newRevision New revision hash (e.g., "9bbcb882c9c62af94fcfd21f98e3b711")
   * @param newTimestamp New timestamp (e.g., "1757090078.826")
   * @returns Updated content
   */
  updatePackageVersion(packageName: string, newVersion: string, newRevision: string, newTimestamp: string): string {
    const content = this.readContent();
    
    // Pattern to match package lock entries
    // Matches: "packageName/version#hash%timestamp"
    const safePackageName = escapeRegExp(packageName);
    const lockPattern = new RegExp(
      `"${safePackageName}\/[^#]+#[^%]+%[^"]+"`,'g'
    );
    
    let updatedContent = content;
    let matchCount = 0;
    
    updatedContent = content.replace(lockPattern, (match) => {
      // Remove quotes for parsing
      const entryWithoutQuotes = match.slice(1, -1);
      const parsed = this.parseLockEntry(entryWithoutQuotes);
      
      if (parsed) {
        matchCount++;
        const newPackageRef = `${packageName}/${newVersion}`;
        const newEntry = this.buildLockEntry(newPackageRef, newRevision, newTimestamp);
        return `"${newEntry}"`;
      }
      
      return match;
    });
    
    if (matchCount === 0) {
      console.warn(`⚠️  No lock entries for package "${packageName}" found in conan.win.lock`);
    } else {
      console.log(`✅ Updated ${matchCount} lock entries for ${packageName} in conan.win.lock`);
    }
    
    return updatedContent;
  }

  /**
   * Write updated content to conan.win.lock
   */
  writeContent(content: string): void {
    fs.writeFileSync(this.filePath, content, 'utf-8');
    console.log(`📝 Updated ${this.filePath}`);
  }

  /**
   * Update package version and save file
   * @param packageName Package name
   * @param newVersion New version
   * @param newRevision New revision hash
   * @param newTimestamp New timestamp
   */
  updateAndSave(packageName: string, newVersion: string, newRevision: string, newTimestamp: string): void {
    const updatedContent = this.updatePackageVersion(packageName, newVersion, newRevision, newTimestamp);
    this.writeContent(updatedContent);
  }

  /**
   * Get current package info from conan.win.lock
   * @param packageName Package name
   * @returns Current lock entry info or null if not found
   */
  getCurrentLockInfo(packageName: string): ConanLockEntry | null {
    const content = this.readContent();
    
    const safePackageName = _.escapeRegExp(packageName);
    // Pattern to find package lock entry
    const lockPattern = new RegExp(
      `"(${safePackageName}\/[^#]+#[^%]+%[^"]+)"`, 'g'
    );
    
    const match = lockPattern.exec(content);
    if (match) {
      return this.parseLockEntry(match[1]);
    }
    
    return null;
  }

  /**
   * Extract timestamp from package version info (if available from ConanService)
   * This is a helper method to generate timestamp from lastModified date
   * @param lastModifiedISO ISO date string from ConanService
   * @returns Timestamp string for lock file
   */
  static generateTimestamp(lastModifiedISO: string): string {
    const date = new Date(lastModifiedISO);
    const timestamp = Math.floor(date.getTime() / 1000);
    const milliseconds = date.getMilliseconds();
    return `${timestamp}.${milliseconds.toString().padStart(3, '0')}`;
  }
}
