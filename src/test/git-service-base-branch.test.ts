#!/usr/bin/env node

import { GitService } from '../services/git-service.js';
import { Shell } from '../shell.js';

/**
 * Comprehensive unit tests for GitService branch operations
 */
async function testGitServiceBranchOperations(): Promise<void> {
  console.log('🧪 Testing GitService Branch Operations');
  console.log('='.repeat(60));

  const shell = Shell.instance();
  const git = GitService.instance();

  let testCount = 0;
  let passedCount = 0;

  function runTest(testName: string, testFn: () => boolean | Promise<boolean>): void {
    testCount++;
    try {
      const result = testFn();
      if (result instanceof Promise) {
        result.then(passed => {
          if (passed) {
            console.log(`✅ Test ${testCount}: ${testName}`);
            passedCount++;
          } else {
            console.log(`❌ Test ${testCount}: ${testName}`);
          }
        });
      } else {
        if (result) {
          console.log(`✅ Test ${testCount}: ${testName}`);
          passedCount++;
        } else {
          console.log(`❌ Test ${testCount}: ${testName}`);
        }
      }
    } catch (error) {
      console.log(`❌ Test ${testCount}: ${testName} - Error: ${error}`);
    }
  }

  // Test 1: getBaseBranch() with valid repository
  runTest('getBaseBranch() returns string or null', () => {
    const result = git.getBaseBranch();
    console.log('getBaseBranch() result:', result);
    return typeof result === 'string' || result === null;
  });

  // Test 10.5: getTargetBranch() returns valid branch name
  runTest('getTargetBranch() returns valid branch name', () => {
    const result = git.getTargetBranch();
    console.log('getTargetBranch() result:', result);
    return typeof result === 'string' && result.length > 0;
  });

  // Wait for async tests to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${passedCount}/${testCount} tests passed`);
  
  if (passedCount === testCount) {
    console.log('🎉 All tests passed successfully!');
  } else {
    console.log(`⚠️  ${testCount - passedCount} tests failed`);
  }
}

// Run tests
testGitServiceBranchOperations().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
