#!/usr/bin/env node

import { UpdateChecker } from '../utils/update-checker.js';

/**
 * Test the UpdateChecker functionality
 */
async function testUpdateChecker() {
  console.log('🧪 Testing UpdateChecker functionality...\n');

  try {
    const updateChecker = new UpdateChecker();
    
    // Test 1: Get version info
    console.log('📋 Test 1: Get version info');
    const versionInfo = updateChecker.getVersionInfo();
    console.log(`  Package: ${versionInfo.name}`);
    console.log(`  Version: ${versionInfo.version}`);
    console.log('  ✅ Version info retrieved successfully\n');

    // Test 2: Check if global installation
    console.log('📋 Test 2: Check global installation status');
    const isGlobal = updateChecker.isGlobalInstallation();
    console.log(`  Is Global Installation: ${isGlobal}`);
    console.log(`  ✅ Global installation check completed\n`);

    // Test 3: Force check for updates (this will actually check npm)
    console.log('📋 Test 3: Force check for updates');
    console.log('  Note: This will make an actual network request to npm registry');
    
    // Only test update check if this is a global installation
    if (isGlobal) {
      console.log('  Running update check for global installation...');
      await updateChecker.forceCheckAndUpdate();
      console.log('  ✅ Update check completed\n');
    } else {
      console.log('  ⏭️  Skipping update check (not a global installation)\n');
    }

    console.log('✅ All UpdateChecker tests completed successfully!');

  } catch (error) {
    console.error('❌ UpdateChecker test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the test
testUpdateChecker().catch(console.error);
