#!/usr/bin/env node

import { GitService } from '../services/git-service.js';
import { Shell } from '../shell.js';

/**
 * Test GitService branch graph functionality
 */
async function testGitServiceBranchGraph(): Promise<void> {
  console.log('🧪 Testing GitService Branch Graph Functionality');
  console.log('='.repeat(60));

  const shell = Shell.instance();
  const git = GitService.instance();

  try {
    // Test 1: Basic branch graph generation
    console.log('\n📝 Test 1: Basic branch graph generation');
    const basicGraph = git.getBranchGraph();
    console.log(`✅ Generated branch graph (${basicGraph.length} characters)`);
    
    if (basicGraph) {
      console.log('📊 Graph preview:');
      console.log(basicGraph.split('\n').slice(0, 10).join('\n'));
      if (basicGraph.split('\n').length > 10) {
        console.log('...');
      }
    }

    // Test 2: Branch graph with different limits
    console.log('\n📝 Test 2: Branch graph with different limits');
    const limits = [5, 10, 20, 50];
    
    for (const limit of limits) {
      const graph = git.getBranchGraph(limit);
      console.log(`   Limit ${limit}: ${graph.length} characters`);
    }

    // Test 3: Branch graph with invalid limits
    console.log('\n📝 Test 3: Branch graph with invalid limits');
    const invalidLimits = [0, -1, -10];
    
    for (const limit of invalidLimits) {
      const graph = git.getBranchGraph(limit);
      console.log(`   Invalid limit ${limit}: ${graph.length} characters (should use default)`);
    }

    // Test 4: Compare branch graph with git log
    console.log('\n📝 Test 4: Compare branch graph with git log');
    const gitLogCommand = 'git log --oneline --graph --decorate --all -n 10';
    const gitLogOutput = shell.run(gitLogCommand).trim();
    
    console.log('📊 Git log output:');
    console.log(gitLogOutput);
    
    const branchGraph = git.getBranchGraph(10);
    console.log('\n📊 Branch graph output:');
    console.log(branchGraph);

    // Test 5: Branch graph content analysis
    console.log('\n📝 Test 5: Branch graph content analysis');
    if (branchGraph) {
      const lines = branchGraph.split('\n');
      const graphLines = lines.filter(line => line.includes('*') || line.includes('|') || line.includes('/') || line.includes('\\'));
      const commitLines = lines.filter(line => line.includes('*') && line.includes(' '));
      
      console.log(`   Total lines: ${lines.length}`);
      console.log(`   Graph lines: ${graphLines.length}`);
      console.log(`   Commit lines: ${commitLines.length}`);
      
      // Check for common git log patterns
      const hasCommits = commitLines.length > 0;
      const hasGraph = graphLines.length > 0;
      
      console.log(`   Contains commits: ${hasCommits ? '✅' : '❌'}`);
      console.log(`   Contains graph: ${hasGraph ? '✅' : '❌'}`);
    }

    // Test 6: Branch graph with different repository states
    console.log('\n📝 Test 6: Branch graph with different repository states');
    
    // Check if we're in a git repository
    try {
      const repoRoot = git.getRepositoryRoot();
      console.log(`   Repository root: ${repoRoot}`);
      
      // Check current branch
      const currentBranch = git.getCurrentBranch();
      console.log(`   Current branch: ${currentBranch}`);
      
      // Check if there are any commits
      const currentCommit = git.getCurrentCommit();
      console.log(`   Current commit: ${currentCommit.substring(0, 8)}...`);
      
    } catch (error) {
      console.log(`   ⚠️  Not in a git repository: ${error}`);
    }

    // Test 7: Branch graph performance
    console.log('\n📝 Test 7: Branch graph performance');
    const performanceTests = [
      { limit: 5, name: 'Small (5 commits)' },
      { limit: 20, name: 'Medium (20 commits)' },
      { limit: 100, name: 'Large (100 commits)' }
    ];
    
    for (const test of performanceTests) {
      const startTime = Date.now();
      const graph = git.getBranchGraph(test.limit);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`   ${test.name}: ${duration}ms (${graph.length} chars)`);
    }

    // Test 8: Branch graph error handling
    console.log('\n📝 Test 8: Branch graph error handling');
    
    // Test with very large limit
    const largeGraph = git.getBranchGraph(10000);
    console.log(`   Large limit (10000): ${largeGraph.length} characters`);
    
    // Test with string limit (should be handled gracefully)
    try {
      // @ts-ignore - Testing error handling
      const stringGraph = git.getBranchGraph('invalid');
      console.log(`   String limit: ${stringGraph.length} characters`);
    } catch (error) {
      console.log(`   String limit error: ${error}`);
    }

    console.log('\n✅ All branch graph tests completed successfully!');

  } catch (error) {
    console.error('❌ Branch graph test failed:', error);
    process.exit(1);
  }
}

// Run tests
testGitServiceBranchGraph().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
