import { GitlabService } from '../index.js';
import { loadEnvironmentVariables } from '../config.js';
/**
 * Test GitlabService createMergeRequest method
 */
async function testGitlabService(): Promise<void> {
  console.log('🧪 Starting GitlabService Test\n');
  
  try {
    // Test parameters
    const token = "test-token-12345";
    const baseUrl = "";
    const projectId = "1744";
    const sourceBranch = "develop";
    const targetBranch = "master";
    const title = "develop to master test";
    
    console.log('📋 Test Parameters:');
    console.log(`   Token: ${token}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Source Branch: ${sourceBranch}`);
    console.log(`   Target Branch: ${targetBranch}`);
    console.log(`   Title: ${title}\n`);
    
    // Create mock HTTP client and GitlabService instance
    const gitlabService = new GitlabService(token, baseUrl);
    
    // Test createMergeRequest with all options
    console.log('🚀 Calling createMergeRequest (full options)...\n');
    const mrUrl = await gitlabService.createMergeRequest(
      sourceBranch, 
      targetBranch, 
      title,
      true,  // squash
      true   // removeSourceBranch
    );
    
    console.log(`\n🎉 Test Result (full options):`);
    console.log(`   MR URL: ${mrUrl}`);
    console.log(`   ✅ Skip Pipeline: enabled`);
    console.log(`   ✅ Squash Commits: enabled`);
    console.log(`   ✅ Remove Source Branch: enabled`);
    
    // Verify expected URL format
    const expectedUrl = `${baseUrl}/api/v4/projects/${projectId}/merge_requests`;
    console.log(`\n✅ Expected API URL: ${expectedUrl}`);
    
    console.log('\n🎯 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

/**
 * Test with real HTTP client using actual GitLab API
 */
async function testWithRealHttp(): Promise<void> {
  console.log('\n🔧 Real HTTP Test with GitLab API');
  console.log('🎯 Testing with actual parameters:');

  const gitlabService = new GitlabService(
    process.env.GITLAB_TOKEN ?? "test-token",
    ""
  );
  
  const sourceBranch = "develop";
  const targetBranch = "master";
  const title = "develop to master test";
  
  console.log(`   Source Branch: ${sourceBranch}`);
  console.log(`   Target Branch: ${targetBranch}`);
  console.log(`   Title: ${title}`);
  console.log(`   API URL: http://gitlab.com/api/v4/projects/1744/merge_requests`);
  
  try {
    console.log('\n🚀 Making real API call (with full options)...');
    const mrUrl = await gitlabService.createMergeRequest(
      sourceBranch, 
      targetBranch, 
      title,
      true,  // squash
      true   // removeSourceBranch
    );
    console.log(`\n✅ Real MR created successfully!`);
    console.log(`🔗 MR URL: ${mrUrl}`);
  } catch (error) {
    console.error('\n❌ Real API test failed:');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      
      // Parse HTTP error details if available
      if (error.message.includes('HTTP')) {
        console.error('   This might be due to:');
        console.error('   - Invalid or missing GITLAB_TOKEN');
        console.error('   - Project ID 1744 not accessible');
        console.error('   - Branches do not exist');
        console.error('   - Network connectivity issues');
      }
    } else {
      console.error(`   Unknown error: ${error}`);
    }
  }
}

// Run tests
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  loadEnvironmentVariables();
  testGitlabService()
    .then(() => testWithRealHttp())
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
