#!/usr/bin/env node

import { OpenAiService, ThroughputStats } from '../services/openai-service.js';
import { shutdownLogger } from '../logger.js';

interface TestResult {
  run: number;
  standardTime: number;
  standardSuccess: boolean;
  standardCommit: string;
  standardThroughput: ThroughputStats | null;
  error?: string;
}

/**
 * Run 5 tests and generate a comprehensive report table
 */
async function testOpenAiSdk() {
  console.log('🧪 Testing OpenAI SDK Integration (5 runs)');
  console.log('=' .repeat(60));

  const apiKey = process.env.OPENAI_KEY || 'ollma-donot-use-this-key';
  const baseUrl = process.env.OPENAI_BASE_URL || 'http://ai.hellortc.cn/v1';

  if (!apiKey) {
    console.error('❌ OPENAI_KEY environment variable is required');
    console.log('💡 Set your OpenAI API key:');
    console.log('   export OPENAI_KEY=your-api-key');
    process.exit(1);
  }

  // Generate random test data to avoid model caching
  const generateRandomDiff = (runNumber: number) => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const sessionId = Math.random().toString(16).substring(2, 10);
    
    // Various programming patterns to test
    const patterns = [
      // Function additions
      {
        type: 'function',
        functionNames: ['processData', 'validateInput', 'calculateSum', 'handleRequest', 'formatOutput', 'parseResponse'],
        messages: ['Processing user data', 'Validating form input', 'Calculating total sum', 'Handling HTTP request', 'Formatting API response', 'Parsing JSON data'],
        fileTypes: ['js', 'ts', 'py', 'java']
      },
      // Class additions
      {
        type: 'class',
        functionNames: ['UserService', 'DataProcessor', 'ApiClient', 'ValidationHelper', 'ConfigManager', 'LoggerUtil'],
        messages: ['User management service', 'Data processing utility', 'HTTP API client', 'Input validation helper', 'Configuration manager', 'Logging utility'],
        fileTypes: ['js', 'ts', 'py', 'java', 'cpp']
      },
      // Bug fixes
      {
        type: 'fix',
        functionNames: ['fixNullPointer', 'handleEdgeCase', 'validateBounds', 'sanitizeInput', 'preventMemoryLeak', 'optimizeQuery'],
        messages: ['Fix null pointer exception', 'Handle edge case scenario', 'Add bounds validation', 'Sanitize user input', 'Prevent memory leak', 'Optimize database query'],
        fileTypes: ['js', 'ts', 'py', 'java', 'cpp', 'go']
      }
    ];
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const funcName = pattern.functionNames[Math.floor(Math.random() * pattern.functionNames.length)];
    const message = pattern.messages[Math.floor(Math.random() * pattern.messages.length)];
    const fileType = pattern.fileTypes[Math.floor(Math.random() * pattern.fileTypes.length)];
    const fileName = `${pattern.type}_${runNumber}_${randomId}.${fileType}`;
    
    // Generate different code structures based on type
    let codeContent = '';
    switch (pattern.type) {
      case 'function':
        codeContent = `+// ${message} - Generated at ${timestamp}
+// Session: ${sessionId}, Run: ${runNumber}
+function ${funcName}_${randomId}(input) {
+  const timestamp = ${timestamp};
+  console.log('${message}', input, timestamp);
+  return input?.data || null;
+}`;
        break;
      case 'class':
        codeContent = `+// ${message} - Generated at ${timestamp}
+// Session: ${sessionId}, Run: ${runNumber}
+class ${funcName}_${randomId} {
+  constructor(config = {}) {
+    this.config = { timestamp: ${timestamp}, ...config };
+    this.id = '${randomId}';
+  }
+  
+  process(data) {
+    console.log('${message}', data);
+    return { ...data, processedAt: ${timestamp} };
+  }
+}`;
        break;
      case 'fix':
        codeContent = `+// ${message} - Generated at ${timestamp}
+// Session: ${sessionId}, Run: ${runNumber}
+function ${funcName}_${randomId}(data) {
+  // Fix applied at ${timestamp}
+  if (!data || typeof data !== 'object') {
+    throw new Error('Invalid input: ${randomId}');
+  }
+  
+  const result = { ...data, fixedAt: ${timestamp}, sessionId: '${sessionId}' };
+  console.log('${message}', result);
+  return result;
+}`;
        break;
    }
    
    const lineCount = codeContent.split('\n').length;
    
    return `diff --git a/${fileName} b/${fileName}
new file mode 100644
index 0000000..${randomId}${sessionId}
--- /dev/null
+++ b/${fileName}
@@ -0,0 +1,${lineCount} @@
${codeContent}`;
  };

  const results: TestResult[] = [];
  const totalRuns = 5;

  // Run 5 tests
  for (let i = 1; i <= totalRuns; i++) {
    console.log(`\n🚀 Running Test ${i}/${totalRuns}...`);
    
    const result: TestResult = {
      run: i,
      standardTime: 0,
      standardSuccess: false,
      standardCommit: '',
      standardThroughput: null
    };

    try {
      // Generate unique test data for this run to avoid model caching
      const testDiff = generateRandomDiff(i);
      const fileName = testDiff.split('\n')[0].split(' ')[3].split('/')[1];
      const fileType = fileName.split('_')[0]; // function, class, or fix
      
      console.log(`   📋 Testing with random data (Run ${i})...`);
      console.log(`   🎲 Generated: ${fileName} (${fileType} pattern)`);
      
      const service = new OpenAiService(apiKey, baseUrl, 'qwen3', false);
      
      const startTime = Date.now();
      const result1 = await service.generateCommitAndBranch(testDiff, 'zh-CN');
      result.standardTime = Date.now() - startTime;
      result.standardSuccess = true;
      result.standardCommit = result1.commit.substring(0, 50) + '...';
      
      // Get throughput stats
      result.standardThroughput = service.getLastThroughputStats();
      
      console.log(`   ✅ Success: ${result.standardTime}ms`);
      console.log(`   📝 Generated commit: ${result1.commit.substring(0, 80)}...`);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Error in run ${i}: ${result.error}`);
    }
    
    results.push(result);
    
    // Add delay between tests to avoid rate limiting
    if (i < totalRuns) {
      console.log('   ⏳ Waiting 2s before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate report table
  generateReportTable(results);
  
  await shutdownLogger();
}

/**
 * Generate and print comprehensive report table with perfect alignment
 */
function generateReportTable(results: TestResult[]) {
  console.log('\n📊 Test Results Report');
  console.log('=' .repeat(80));
  console.log('🎲 Note: Each test uses randomly generated diff data with unique timestamps');
  console.log('   to avoid model caching and ensure accurate performance measurements.');
  
  // Header - Precisely aligned for monospace fonts
  // Column analysis: │ Run │ Time (ms)   │ Success     │ Throughput  │ Commit Message... │
  //                   │(1+3+1)│(1+11+1)    │(1+11+1)    │(1+11+1)    │(1+47+1)          │ = 93 total
  const headerTop    = '┌─────┬─────────────┬─────────────┬─────────────┬─────────────────────────────────────────────────┐';
  const headerMid    = '│ Run │ Time (ms) │ Success     │ Throughput  │ Commit Message                                  │';
  const headerBottom = '├─────┼─────────────┼─────────────┼─────────────┼─────────────────────────────────────────────────┤';
  
  console.log(headerTop);
  console.log(headerMid);
  console.log(headerBottom);
  
  // Data rows - Strictly controlled column widths
  results.forEach(result => {
    // Column 1: Run (3 chars, centered)
    const run = result.run.toString().padStart(2).padEnd(3);
    
    // Column 2: Time (11 chars, right-aligned to match "Time (ms)   " header)
    const time = result.standardSuccess 
      ? result.standardTime.toString().padStart(11)
      : '      ERROR'.padStart(11);
    
    // Column 3: Success (11 chars, centered)
    const success = result.standardSuccess ? '     ✅     ' : '     ❌     ';
    
    // Column 4: Throughput (11 chars, right-aligned)
    const throughput = result.standardThroughput 
      ? `${result.standardThroughput.tokensPerSecond.toFixed(1)} tok/s`.padStart(11)
      : '        N/A'.padStart(11);
    
    // Column 5: Commit Message (47 chars, left-aligned, truncated if needed)
    const commit = result.standardCommit.length > 47 
      ? result.standardCommit.substring(0, 44) + '...'
      : result.standardCommit.padEnd(47);
    
    console.log(`│ ${run} │${time} │${success} │${throughput} │ ${commit} │`);
  });
  
  // Bottom border - must match header exactly
  const footerBottom = '└─────┴─────────────┴─────────────┴─────────────┴─────────────────────────────────────────────────┘';
  console.log(footerBottom);
  
  // Statistics
  const successful = results.filter(r => r.standardSuccess);
  
  const avgTime = successful.length > 0 
    ? Math.round(successful.reduce((sum, r) => sum + r.standardTime, 0) / successful.length)
    : 0;

  // Calculate throughput averages
  const withThroughput = successful.filter(r => r.standardThroughput);
  
  const avgThroughput = withThroughput.length > 0
    ? withThroughput.reduce((sum, r) => sum + r.standardThroughput!.tokensPerSecond, 0) / withThroughput.length
    : 0;
  
  console.log('\n📈 Performance Statistics:');
  // Statistics table: │ Metric(19+2) │ Value(11+2) │ Assessment(11+2) │ = 47 chars total
  const statsTop    = '┌─────────────────────┬─────────────┬─────────────┐';
  const statsMid    = '│ Metric              │ Value       │ Assessment  │';
  const statsBottom = '├─────────────────────┼─────────────┼─────────────┤';
  const statsFooter = '└─────────────────────┴─────────────┴─────────────┘';
  
  console.log(statsTop);
  console.log(statsMid);
  console.log(statsBottom);
  
  // Strictly control column widths for statistics
  const formatStatRow = (metric: string, value: string, assessment: string = '-') => {
    const metricCol = metric.padEnd(19);
    const valueCol = value.padStart(11);
    const assessCol = assessment.padStart(11);
    return `│ ${metricCol} │${valueCol} │${assessCol} │`;
  };
  
  console.log(formatStatRow('Success Count', `${successful.length}/5`));
  console.log(formatStatRow('Success Rate', `${(successful.length/5*100).toFixed(0)}%`));
  console.log(formatStatRow('Average Time (ms)', avgTime.toString()));
  console.log(formatStatRow('Avg Throughput', `${avgThroughput.toFixed(1)} tok/s`));
  
  if (successful.length > 0) {
    const minTime = Math.min(...successful.map(r => r.standardTime));
    const maxTime = Math.max(...successful.map(r => r.standardTime));
    
    console.log(formatStatRow('Min Time (ms)', minTime.toString()));
    console.log(formatStatRow('Max Time (ms)', maxTime.toString()));
  }
  
  console.log(statsFooter);
  
  // Error summary
  const errorResults = results.filter(r => r.error);
  if (errorResults.length > 0) {
    console.log('\n❌ Error Summary:');
    errorResults.forEach(result => {
      console.log(`   Run ${result.run}: ${result.error}`);
    });
  }
  
  // Overall result
  const overallSuccess = successful.length === 5;
  // Detailed throughput analysis
  if (withThroughput.length > 0) {
    console.log('\n🚀 Detailed Throughput Analysis:');
    
    const tokens = withThroughput.map(r => r.standardThroughput!.totalTokens);
    const avgTokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;
    const totalTokens = tokens.reduce((a, b) => a + b, 0);
    
    console.log(`   📊 Performance Summary: ${avgThroughput.toFixed(1)} tok/s avg, ${avgTokens.toFixed(0)} tokens avg`);
    console.log(`   📝 Total Tokens Processed: ${totalTokens} tokens across ${withThroughput.length} successful requests`);
    
    // Performance assessment
    let performanceAssessment = '';
    if (avgThroughput >= 50) {
      performanceAssessment = '🏆 Excellent performance detected!';
    } else if (avgThroughput >= 20) {
      performanceAssessment = '✅ Good performance overall';
    } else if (avgThroughput >= 10) {
      performanceAssessment = '⚠️  Average performance';
    } else if (avgThroughput >= 5) {
      performanceAssessment = '🐌 Slow performance';
    } else {
      performanceAssessment = '🚨 Very slow performance - check configuration';
    }
    console.log(`   ${performanceAssessment}`);
  }

  console.log('\n' + '=' .repeat(80));
  if (overallSuccess) {
    console.log('🎉 All tests passed! OpenAI SDK integration is working correctly.');
    console.log(`📊 Average performance: ${avgTime}ms response time, ${avgThroughput.toFixed(1)} tok/s throughput`);
  } else {
    console.log(`⚠️  Some tests failed. Success rate: ${successful.length}/5`);
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Check your OPENAI_KEY is valid');
    console.log('   2. Verify network connectivity');
    console.log('   3. Check if the model is available');
    console.log('   4. Try with a different base URL if using a custom provider');
  }
}

// Execute test
testOpenAiSdk().catch(console.error);

