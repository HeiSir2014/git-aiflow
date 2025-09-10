#!/usr/bin/env node

import { GitService } from '../services/git-service.js';
import { Shell } from '../shell.js';

/**
 * Comprehensive unit tests for GitService branch operations
 */
async function testGitServiceBranchOperations(): Promise<void> {
  console.log('🧪 Testing GitService Branch Operations');
  console.log('='.repeat(60));

  const shell = new Shell();
  const git = new GitService(shell);

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

  // Test 2: getMergeBase() with valid branch
  runTest('getMergeBase() handles valid branch', () => {
    const currentBranch = git.getCurrentBranch();
    if (currentBranch === 'detached' || currentBranch === 'unknown') {
      return true; // Skip test for detached HEAD
    }
    
    const result = git.getMergeBase('main');
    return typeof result === 'string' || result === null;
  });

  // Test 3: getMergeBase() with empty branch name
  runTest('getMergeBase() handles empty branch name', () => {
    const result = git.getMergeBase('');
    return result === null;
  });

  // Test 4: getBranchGraph() with different limits
  runTest('getBranchGraph() with limit 5', () => {
    const result = git.getBranchGraph(5);
    return typeof result === 'string';
  });

  runTest('getBranchGraph() with limit 0 (should use default)', () => {
    const result = git.getBranchGraph(0);
    return typeof result === 'string';
  });

  runTest('getBranchGraph() with negative limit (should use default)', () => {
    const result = git.getBranchGraph(-1);
    return typeof result === 'string';
  });

  // Test 5: getDiffBetweenBranches() with valid branches
  runTest('getDiffBetweenBranches() handles valid branches', () => {
    const currentBranch = git.getCurrentBranch();
    const baseBranch = git.getBaseBranch();
    
    if (!baseBranch) {
      return true; // Skip if no base branch
    }
    
    const result = git.getDiffBetweenBranches(baseBranch, currentBranch);
    return typeof result === 'string';
  });

  // Test 6: getDiffBetweenBranches() with empty parameters
  runTest('getDiffBetweenBranches() handles empty parameters', () => {
    const result = git.getDiffBetweenBranches('', '');
    return result === '';
  });

  runTest('getDiffBetweenBranches() handles null parameters', () => {
    const result = git.getDiffBetweenBranches('', 'main');
    return result === '';
  });

  // Test 7: getChangedFilesBetweenBranches() with valid branches
  runTest('getChangedFilesBetweenBranches() handles valid branches', () => {
    const currentBranch = git.getCurrentBranch();
    const baseBranch = git.getBaseBranch();
    
    if (!baseBranch) {
      return true; // Skip if no base branch
    }
    
    const result = git.getChangedFilesBetweenBranches(baseBranch, currentBranch);
    return Array.isArray(result);
  });

  // Test 8: getChangedFilesBetweenBranches() with empty parameters
  runTest('getChangedFilesBetweenBranches() handles empty parameters', () => {
    const result = git.getChangedFilesBetweenBranches('', '');
    return Array.isArray(result) && result.length === 0;
  });

  // Test 9: hasRemoteBranch() with common branch names
  runTest('hasRemoteBranch() checks common branches', () => {
    const commonBranches = ['main', 'master', 'develop'];
    let allValid = true;
    
    for (const branch of commonBranches) {
      const result = git.hasRemoteBranch(`origin/${branch}`);
      if (typeof result !== 'boolean') {
        allValid = false;
        break;
      }
    }
    
    return allValid;
  });

  // Test 10: hasRemoteBranch() with non-existent branch
  runTest('hasRemoteBranch() handles non-existent branch', () => {
    const result = git.hasRemoteBranch('origin/non-existent-branch-12345');
    return result === false;
  });

  // Test 10.5: getTargetBranch() returns valid branch name
  runTest('getTargetBranch() returns valid branch name', () => {
    const result = git.getTargetBranch();
    return typeof result === 'string' && result.length > 0;
  });

  // Test 11: Protocol detection methods
  runTest('extractHostnameFromRemoteUrl() returns string or empty', () => {
    const result = git.extractHostnameFromRemoteUrl();
    return typeof result === 'string';
  });

  runTest('extractBaseUrlFromRemoteUrl() returns Promise<string>', async () => {
    const result = await git.extractBaseUrlFromRemoteUrl();
    return typeof result === 'string';
  });

  runTest('parseProjectPathFromUrl() returns string or null', () => {
    const result = git.parseProjectPathFromUrl();
    return typeof result === 'string' || result === null;
  });

  // Test 12: Cache management
  runTest('getProtocolCache() returns object', () => {
    const result = GitService.getProtocolCache();
    return typeof result === 'object' && result !== null;
  });

  runTest('clearProtocolCache() works without parameters', () => {
    GitService.clearProtocolCache();
    return true; // Should not throw error
  });

  runTest('clearProtocolCache() works with hostname', () => {
    GitService.clearProtocolCache('github.com');
    return true; // Should not throw error
  });

  // Test 13: Force protocol detection
  runTest('forceDetectProtocolForHost() returns Promise<string>', async () => {
    const result = await git.forceDetectProtocolForHost('github.com');
    return typeof result === 'string' && result.startsWith('http');
  });

  // Test 14: Error handling for invalid hostname
  runTest('forceDetectProtocolForHost() handles invalid hostname', async () => {
    const result = await git.forceDetectProtocolForHost('invalid-hostname-12345');
    return typeof result === 'string'; // Should return fallback URL
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
