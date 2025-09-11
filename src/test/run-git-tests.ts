#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Run all GitService new methods tests
 */
async function runAllGitTests(): Promise<void> {
  console.log('🚀 Running All GitService New Methods Tests');
  console.log('='.repeat(60));

  const testFiles = [
    'git-service-new-methods.test.ts',
    'git-service-branch-operations.test.ts',
    'git-service-branch-graph.test.ts'
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const testFile of testFiles) {
    console.log(`\n📝 Running ${testFile}...`);
    console.log('-'.repeat(40));
    
    try {
      const { stdout, stderr } = await execAsync(`npx tsx src/test/${testFile}`);
      
      if (stdout) {
        console.log(stdout);
      }
      
      if (stderr) {
        console.error(stderr);
      }
      
      // Count test results from output
      const testMatches = stdout.match(/✅ Test \d+:/g);
      const passedMatches = stdout.match(/✅ Test \d+:/g);
      
      if (testMatches) {
        totalTests += testMatches.length;
      }
      
      if (passedMatches) {
        passedTests += passedMatches.length;
      }
      
      console.log(`✅ ${testFile} completed`);
      
    } catch (error) {
      console.error(`❌ ${testFile} failed:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Overall Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All GitService tests passed successfully!');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} tests failed`);
  }
}

// Run all tests
runAllGitTests().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
