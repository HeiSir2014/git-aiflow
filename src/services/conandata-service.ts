import * as fs from 'fs';
import * as path from 'path';
import _ from 'lodash';
const { escapeRegExp } = _;

/**
 * Service for managing conandata.yml file updates
 */
export class ConanDataService {
  private readonly filePath: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.filePath = path.join(workingDirectory, 'conandata.yml');
  }

  /**
   * Check if conandata.yml exists
   */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  /**
   * Read and parse conandata.yml content
   */
  readContent(): string {
    if (!this.exists()) {
      throw new Error(`conandata.yml not found at ${this.filePath}`);
    }
    return fs.readFileSync(this.filePath, 'utf-8');
  }

  /**
   * Update package version in conandata.yml
   * @param packageName Package name (e.g., "zterm")
   * @param newVersion New version (e.g., "1.0.0.25")
   * @returns Updated content
   */
  updatePackageVersion(packageName: string, newVersion: string): string {
    const content = this.readContent();
    
    const safePackageName = escapeRegExp(packageName);
    // Pattern to match package references like "- zterm/1.0.0.24"
    const packagePattern = new RegExp(
      `^(\\s*-\\s+)${safePackageName}\/[^\\s]+`,
      'gm'
    );
    
    let updatedContent = content;
    let matchCount = 0;
    
    updatedContent = content.replace(packagePattern, (_, prefix) => {
      matchCount++;
      return `${prefix}${packageName}/${newVersion}`;
    });
    
    if (matchCount === 0) {
      console.warn(`⚠️  No references to package "${packageName}" found in conandata.yml`);
    } else {
      console.log(`✅ Updated ${matchCount} references to ${packageName} in conandata.yml`);
    }
    
    return updatedContent;
  }

  /**
   * Write updated content to conandata.yml
   */
  writeContent(content: string): void {
    fs.writeFileSync(this.filePath, content, 'utf-8');
    console.log(`📝 Updated ${this.filePath}`);
  }

  /**
   * Update package version and save file
   * @param packageName Package name
   * @param newVersion New version
   */
  updateAndSave(packageName: string, newVersion: string): void {
    const updatedContent = this.updatePackageVersion(packageName, newVersion);
    this.writeContent(updatedContent);
  }

  /**
   * Get current package version from conandata.yml
   * @param packageName Package name
   * @returns Current version or null if not found
   */
  getCurrentVersion(packageName: string): string | null {
    const content = this.readContent();
    
    const safePackageName = escapeRegExp(packageName);
    // Pattern to extract version from "- packageName/version"
    const versionPattern = new RegExp(
      `^\\s*-\\s+${safePackageName}\/([^\\s]+)`,
      'm'
    );
    
    const match = content.match(versionPattern);
    return match ? match[1] : null;
  }
}
