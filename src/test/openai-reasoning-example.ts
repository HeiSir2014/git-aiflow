#!/usr/bin/env node

import { OpenAiService } from '../services/openai-service.js';

/**
 * Example demonstrating OpenAI service with reasoning mode
 */
async function demonstrateReasoningMode() {
  console.log('🧠 OpenAI Reasoning Mode Demonstration');
  console.log('=' .repeat(50));

  const apiKey = process.env.OPENAI_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    console.error('❌ OPENAI_KEY environment variable is required');
    process.exit(1);
  }

  // Example diff for testing
  const testDiff = `diff --git a/src/utils/validation.ts b/src/utils/validation.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/utils/validation.ts
@@ -0,0 +1,15 @@
+export interface ValidationRule {
+  field: string;
+  required: boolean;
+  minLength?: number;
+  maxLength?: number;
+}
+
+export function validateInput(data: any, rules: ValidationRule[]): string[] {
+  const errors: string[] = [];
+  
+  for (const rule of rules) {
+    const value = data[rule.field];
+    
+    if (rule.required && (!value || value.trim() === '')) {
+      errors.push(\`\${rule.field} is required\`);
+      continue;
+    }
+    
+    if (value && rule.minLength && value.length < rule.minLength) {
+      errors.push(\`\${rule.field} must be at least \${rule.minLength} characters\`);
+    }
+    
+    if (value && rule.maxLength && value.length > rule.maxLength) {
+      errors.push(\`\${rule.field} must not exceed \${rule.maxLength} characters\`);
+    }
+  }
+  
+  return errors;
+}`;

  try {
    console.log('🔍 Testing different models and reasoning modes...\n');

    // Test configurations
    const testConfigs = [
      { model: 'gpt-4o-mini', reasoning: false, description: 'GPT-4o Mini (Standard)' },
      { model: 'gpt-4o', reasoning: false, description: 'GPT-4o (Standard)' },
      { model: 'o1-mini', reasoning: true, description: 'O1 Mini (Reasoning)' },
      { model: 'o1-preview', reasoning: true, description: 'O1 Preview (Reasoning)' }
    ];

    for (const config of testConfigs) {
      console.log(`🧪 Testing: ${config.description}`);
      console.log(`   Model: ${config.model}`);
      console.log(`   Reasoning: ${config.reasoning ? 'Enabled' : 'Disabled'}`);

      const startTime = Date.now();
      
      try {
        const service = new OpenAiService(
          apiKey,
          baseUrl,
          config.model,
          config.reasoning
        );

        const result = await service.generateCommitAndBranch(testDiff, 'en');
        const duration = Date.now() - startTime;

        console.log(`   ✅ Success (${duration}ms)`);
        console.log(`   📝 Commit: ${result.commit}`);
        console.log(`   🌿 Branch: ${result.branch}`);
        console.log(`   📋 Title: ${result.title}`);
        console.log(`   📄 Description: ${result.description.substring(0, 100)}...`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`   ❌ Failed (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log();
    }

    console.log('🎯 Key Differences:');
    console.log('   • Standard models: Faster response, direct generation');
    console.log('   • Reasoning models: Slower but more thoughtful analysis');
    console.log('   • O1 models automatically enable reasoning when supported');
    console.log('   • Reasoning mode provides more detailed and accurate results');

  } catch (error) {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  }
}

/**
 * Show reasoning support detection
 */
function demonstrateReasoningDetection() {
  console.log('\n🔍 Reasoning Support Detection');
  console.log('-' .repeat(40));

  const testModels = [
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4o',
    'gpt-4o-mini',
    'o1-preview',
    'o1-mini',
    'o1',
    'deepseek-reasoning',
    'claude-3-5-sonnet-reasoning',
    'custom-reasoning-model'
  ];

  for (const model of testModels) {
    // Create a temporary service to test reasoning detection
    const service = new (class extends OpenAiService {
      public testReasoningSupport() {
        return (this as any).isReasoningSupported();
      }
    })('test-key', 'https://api.test.com', model, false);

    const supported = service.testReasoningSupport();
    const icon = supported ? '🧠' : '🤖';
    const status = supported ? 'Reasoning Supported' : 'Standard Mode';
    
    console.log(`   ${icon} ${model.padEnd(25)} - ${status}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Show reasoning detection first
    demonstrateReasoningDetection();
    
    // Then demonstrate actual usage
    await demonstrateReasoningMode();
    
    console.log('\n🎉 Demonstration completed!');
    console.log('\n💡 Usage Tips:');
    console.log('   • Use reasoning mode for complex code analysis');
    console.log('   • Standard mode is faster for simple changes');
    console.log('   • O1 models automatically enable reasoning');
    console.log('   • Set reasoning=true in OpenAiService constructor');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(console.error);
}
