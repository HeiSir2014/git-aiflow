#!/usr/bin/env node

import { loadEnvironmentVariables } from '../config.js';
import { ConanPkgUpdateApp } from '../aiflow-conan-app.js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
loadEnvironmentVariables();

/**
 * Test the Conan package update functionality
 */
async function testConanPkgUpdate(): Promise<void> {
  console.log('🧪 Conan Package Update Test');
  console.log('🎯 Testing package update workflow...\n');

  // Create test directory and files
  const testDir = path.join(process.cwd(), 'test-conan-update');

  try {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Change to test directory
    const originalCwd = process.cwd();
    process.chdir(testDir);

    // Test the update workflow (dry run mode)
    console.log(`\n🚀 Starting update test...`);

    const app = new ConanPkgUpdateApp();

    await app.updatePackage('zterm', process.env.CONAN_REMOTE_REPO ?? 'repo');

    // Restore original directory
    process.chdir(originalCwd);

    // Cleanup (optional)
    console.log(`\n🧹 Test files created in: ${testDir}`);
    console.log(`   You can manually clean up this directory when done testing.`);

  } catch (error) {
    console.error('❌ Test setup failed:', error);
    process.exit(1);
  }
}

// Execute test only if this file is run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  testConanPkgUpdate().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}
