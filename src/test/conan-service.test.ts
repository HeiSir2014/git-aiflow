import { ConanService } from '../index.js';
import { loadEnvironmentVariables } from '../config.js';

/**
 * Test ConanService with real HTTP client using actual Conan API
 */
async function testConanService(): Promise<void> {
  console.log('🧪 ConanService Real API Test');
  console.log('🎯 Testing with actual Conan repository:\n');
  
  const conanService = new ConanService(process.env.CONAN_REMOTE_BASE_URL ?? '');
  
  const remote = process.env.CONAN_REMOTE_REPO || "repo";
  const simplePackage = "zterm";
  const namespacedPackage = "winusb"; // Test namespaced package
  
  console.log('📋 Test Configuration:');
  console.log(`   Base URL: ${process.env.CONAN_REMOTE_BASE_URL ?? ''}`);
  console.log(`   Remote: ${remote}`);
  console.log(`   Simple Package: ${simplePackage}`);
  console.log(`   Namespaced Package: ${namespacedPackage}\n`);

  try {
    // Test 1: Get package versions for simple package
    console.log('🚀 Test 1: Getting simple package versions...');
    const simpleVersions = await conanService.getPackageVersions(remote, simplePackage);
    
    if (simpleVersions.length > 0) {
      console.log(`✅ Found ${simpleVersions.length} versions for ${simplePackage}:`);
      
      // Show first 3 versions
      const displayVersions = simpleVersions.slice(0, 3);
      displayVersions.forEach((version, index) => {
        console.log(`   ${index + 1}. ${version.version} (${version.lastModified})`);
      });
      
      if (simpleVersions.length > 3) {
        console.log(`   ... and ${simpleVersions.length - 3} more versions`);
      }
    } else {
      console.log(`⚠️  No versions found for ${simplePackage}`);
    }

    // Test 2: Get package versions for namespaced package
    console.log('\n🚀 Test 2: Getting namespaced package versions...');
    const namespacedVersions = await conanService.getPackageVersions(remote, namespacedPackage);
    
    if (namespacedVersions.length > 0) {
      console.log(`✅ Found ${namespacedVersions.length} versions for ${namespacedPackage}:`);
      
      // Show first 3 versions
      const displayVersions = namespacedVersions.slice(0, 3);
      displayVersions.forEach((version, index) => {
        console.log(`   ${index + 1}. ${version.version} (${version.lastModified})`);
      });
      
      if (namespacedVersions.length > 3) {
        console.log(`   ... and ${namespacedVersions.length - 3} more versions`);
      }
    } else {
      console.log(`⚠️  No versions found for ${namespacedPackage}`);
    }

    // Test 3: Get latest version for simple package
    console.log('\n🚀 Test 3: Getting latest version for simple package...');
    const simpleLatest = await conanService.getLatestVersion(remote, simplePackage);
    if (simpleLatest) {
      console.log(`✅ Latest version of ${simplePackage}: ${simpleLatest.version}`);
      console.log(`   Last modified: ${simpleLatest.lastModified}`);
      console.log(`   URL: ${simpleLatest.url}`);
    } else {
      console.log(`⚠️  No latest version found for ${simplePackage}`);
    }

    // Test 4: Search packages with different patterns
    console.log('\n🚀 Test 4: Searching packages...');
    
    const searchPatterns = [
      "zterm",
      "boost",        // Exact match
      "winusb",     // Reverse namespace pattern
    ];
    
    for (const pattern of searchPatterns) {
      console.log(`\n🔍 Searching for pattern: "${pattern}"`);
      const packages = await conanService.getPackageVersions(remote, pattern);
      
      if (packages.length > 0) {
        console.log(`✅ Found ${packages.length} packages:`);
        packages.slice(0, 3).forEach((pkg, index) => {
          console.log(`   ${index + 1}. ${pkg.packageName} (${pkg.lastModified})`);
        });
        if (packages.length > 3) {
          console.log(`   ... and ${packages.length - 3} more packages`);
        }
      } else {
        console.log(`⚠️  No packages found for pattern: ${pattern}`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ API test failed:');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      
      if (error.message.includes('HTTP')) {
        console.error('\n   Possible causes:');
        console.error('   - Network connectivity issues');
        console.error('   - Incorrect base URL or remote name');
        console.error('   - Package does not exist');
        console.error('   - JFrog Artifactory access restrictions');
      }
    } else {
      console.error(`   Unknown error: ${error}`);
    }
    throw error;
  }
}

// Run tests
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  loadEnvironmentVariables();
  testConanService()
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
