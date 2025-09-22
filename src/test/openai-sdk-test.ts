#!/usr/bin/env node

import { OpenAiService } from '../services/openai-service.js';
import { shutdownLogger } from '../logger.js';

/**
 * Simple test to verify OpenAI SDK integration
 */
async function testOpenAiSdk() {
  console.log('🧪 Testing OpenAI SDK Integration');
  console.log('=' .repeat(40));

  const apiKey = process.env.OPENAI_KEY || 'ollma-donot-use-this-key';
  const baseUrl = process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1';

  if (!apiKey) {
    console.error('❌ OPENAI_KEY environment variable is required');
    console.log('💡 Set your OpenAI API key:');
    console.log('   export OPENAI_KEY=your-api-key');
    process.exit(1);
  }

  // Simple test diff
  const testDiff = `diff --git a/test.js b/test.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/test.js
@@ -0,0 +1,3 @@
+function hello() {
+  console.log('Hello, World!');
+}`;

  try {
    console.log('🚀 Testing basic functionality...');
    
    // Test standard mode
    console.log('\n📋 Testing Standard Mode:');
    const service1 = new OpenAiService(apiKey, baseUrl, 'qwen3', false);
    
    const startTime1 = Date.now();
    const result1 = await service1.generateCommitAndBranch(testDiff, 'en');
    const duration1 = Date.now() - startTime1;
    
    console.log(`✅ Standard Mode Success (${duration1}ms)`);
    console.log(`   Commit: ${result1.commit}`);
    console.log(`   Branch: ${result1.branch}`);
    console.log(`   Title: ${result1.title}`);
    
    // Test reasoning mode (if available)
    console.log('\n🧠 Testing Reasoning Mode:');
    const service2 = new OpenAiService(apiKey, baseUrl, 'qwen3', true);
    
    const startTime2 = Date.now();
    const result2 = await service2.generateCommitAndBranch(testDiff, 'en');
    const duration2 = Date.now() - startTime2;
    
    console.log(`✅ Reasoning Mode Success (${duration2}ms)`);
    console.log(`   Commit: ${result2.commit}`);
    console.log(`   Branch: ${result2.branch}`);
    console.log(`   Title: ${result2.title}`);
    
    console.log('\n📊 Performance Comparison:');
    console.log(`   Standard Mode: ${duration1}ms`);
    console.log(`   Reasoning Mode: ${duration2}ms`);
    console.log(`   Difference: ${duration2 - duration1}ms (${((duration2 - duration1) / duration1 * 100).toFixed(1)}%)`);
    
    console.log('\n🎉 All tests passed! OpenAI SDK integration is working correctly.');
    
    await shutdownLogger();
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Check your OPENAI_KEY is valid');
    console.log('   2. Verify network connectivity');
    console.log('   3. Check if the model is available');
    console.log('   4. Try with a different base URL if using a custom provider');
    await shutdownLogger();
    process.exit(1);
  }
}

// Execute test
testOpenAiSdk().catch(console.error);

