#!/usr/bin/env node

import { GitService } from '../services/git-service.js';
import { Shell } from '../shell.js';

/**
 * Test new GitService methods for branch operations
 */
async function testGitServiceNewMethods(): Promise<void> {
  console.log('🧪 Testing GitService New Methods');
  console.log('='.repeat(50));

  const shell = new Shell();
  const git = new GitService(shell);

  try {
    // Test 1: getBaseBranch() - Find parent branch
    console.log('\n📝 Test 1: getBaseBranch() - Find parent branch');
    const currentBranch = git.getCurrentBranch();
    console.log(`Current branch: ${currentBranch}`);
    
    const baseBranch = git.getBaseBranch();
    if (baseBranch) {
      console.log(`✅ Base branch detected: ${baseBranch}`);
    } else {
      console.log('⚠️  No base branch detected (might be detached HEAD or no parent branch)');
    }

    // Test 2: getMergeBase() - Get merge base between branches
    console.log('\n📝 Test 2: getMergeBase() - Get merge base between branches');
    if (baseBranch) {
      const mergeBase = git.getMergeBase(baseBranch);
      if (mergeBase) {
        console.log(`✅ Merge base between current branch and ${baseBranch}: ${mergeBase}`);
      } else {
        console.log(`⚠️  No merge base found between current branch and ${baseBranch}`);
      }
    } else {
      console.log('⚠️  Skipping merge base test - no base branch available');
    }

    // Test 3: getBranchGraph() - Get branch visualization
    console.log('\n📝 Test 3: getBranchGraph() - Get branch visualization');
    const branchGraph = git.getBranchGraph(10);
    if (branchGraph) {
      console.log('✅ Branch graph generated:');
      console.log(branchGraph);
    } else {
      console.log('⚠️  No branch graph generated');
    }

    // Test 4: getDiffBetweenBranches() - Get diff between two branches
    console.log('\n📝 Test 4: getDiffBetweenBranches() - Get diff between two branches');
    if (baseBranch) {
      const diff = git.getDiffBetweenBranches(baseBranch, currentBranch);
      if (diff) {
        console.log(`✅ Diff between ${baseBranch} and ${currentBranch}:`);
        console.log(`   Length: ${diff.length} characters`);
        console.log(`   Preview: ${diff.substring(0, 200)}${diff.length > 200 ? '...' : ''}`);
      } else {
        console.log(`✅ No differences between ${baseBranch} and ${currentBranch}`);
      }
    } else {
      console.log('⚠️  Skipping diff test - no base branch available');
    }

    // Test 5: getChangedFilesBetweenBranches() - Get changed files between branches
    console.log('\n📝 Test 5: getChangedFilesBetweenBranches() - Get changed files between branches');
    if (baseBranch) {
      const changedFiles = git.getChangedFilesBetweenBranches(baseBranch, currentBranch);
      console.log(`✅ Changed files between ${baseBranch} and ${currentBranch}: ${changedFiles.length} files`);
      if (changedFiles.length > 0) {
        console.log('   Files:');
        changedFiles.slice(0, 10).forEach((file, index) => {
          console.log(`     ${index + 1}. ${file}`);
        });
        if (changedFiles.length > 10) {
          console.log(`     ... and ${changedFiles.length - 10} more files`);
        }
      }
    } else {
      console.log('⚠️  Skipping changed files test - no base branch available');
    }

    // Test 6: hasRemoteBranch() - Check if remote branch exists
    console.log('\n📝 Test 6: hasRemoteBranch() - Check if remote branch exists');
    const commonBranches = ['main', 'master', 'develop', currentBranch];
    for (const branch of commonBranches) {
      const exists = git.hasRemoteBranch(`origin/${branch}`);
      console.log(`   origin/${branch}: ${exists ? '✅ exists' : '❌ not found'}`);
    }

    // Test 6.5: getTargetBranch() - Get target branch for MR
    console.log('\n📝 Test 6.5: getTargetBranch() - Get target branch for MR');
    const targetBranch = git.getTargetBranch();
    console.log(`✅ Target branch detected: ${targetBranch}`);

    // Test 7: Error handling - Test with invalid parameters
    console.log('\n📝 Test 7: Error handling - Test with invalid parameters');
    
    // Test empty branch names
    const emptyDiff = git.getDiffBetweenBranches('', '');
    console.log(`Empty branch names diff: ${emptyDiff === '' ? '✅ handled correctly' : '❌ unexpected result'}`);
    
    const emptyFiles = git.getChangedFilesBetweenBranches('', '');
    console.log(`Empty branch names files: ${emptyFiles.length === 0 ? '✅ handled correctly' : '❌ unexpected result'}`);
    
    // Test non-existent branch
    const nonExistentDiff = git.getDiffBetweenBranches('non-existent-branch', currentBranch);
    console.log(`Non-existent branch diff: ${nonExistentDiff === '' ? '✅ handled correctly' : '❌ unexpected result'}`);

    // Test 8: Protocol detection methods
    console.log('\n📝 Test 8: Protocol detection methods');
    const hostname = git.extractHostnameFromRemoteUrl();
    console.log(`Extracted hostname: ${hostname || 'None'}`);
    
    const baseUrl = await git.extractBaseUrlFromRemoteUrl();
    console.log(`Extracted base URL: ${baseUrl || 'None'}`);
    
    const projectPath = git.parseProjectPathFromUrl();
    console.log(`Project path: ${projectPath || 'None'}`);

    // Test 9: Cache management
    console.log('\n📝 Test 9: Cache management');
    const initialCache = GitService.getProtocolCache();
    console.log(`Initial protocol cache entries: ${Object.keys(initialCache).length}`);
    
    if (hostname) {
      const detectedProtocol = await git.getDetectedProtocolForHost(hostname);
      console.log(`Detected protocol for ${hostname}: ${detectedProtocol}`);
      
      const updatedCache = GitService.getProtocolCache();
      console.log(`Updated protocol cache entries: ${Object.keys(updatedCache).length}`);
    }

    console.log('\n✅ All GitService new methods tests completed successfully!');

  } catch (error) {
    console.error('❌ GitService new methods test failed:', error);
    process.exit(1);
  }
}

// Run tests
testGitServiceNewMethods().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
