#!/usr/bin/env node

import { OpenAiService } from '../services/openai-service.js';

/**
 * OpenAI Provider Configuration for testing
 */
interface OpenAIProvider {
  name: string;
  baseUrl: string;
  models: string[];
  apiKey: string;
  supportsReasoning?: boolean;
  description: string;
}

/**
 * Test result for a single request
 */
interface TestResult {
  provider: string;
  model: string;
  reasoning: boolean;
  success: boolean;
  responseTime: number;
  tokenCount?: number;
  errorMessage?: string;
  contextLimit?: number;
}

/**
 * Performance statistics
 */
interface PerformanceStats {
  provider: string;
  model: string;
  reasoning: boolean;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  averageTokens?: number;
  contextLimit?: number;
}

/**
 * Test configuration
 */
interface TestConfig {
  providers: OpenAIProvider[];
  testCases: TestCase[];
  iterations: number;
  concurrentRequests: number;
  timeout: number;
}

/**
 * Test case definition
 */
interface TestCase {
  name: string;
  diff: string;
  language: string;
  expectedTokens: number;
}

/**
 * OpenAI Batch Performance Tester
 */
export class OpenAIBatchTester {
  private readonly config: TestConfig;
  private readonly results: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  /**
   * Run comprehensive batch tests
   */
  async runBatchTests(): Promise<void> {
    console.log('🚀 OpenAI Batch Performance Test');
    console.log('=' .repeat(50));
    console.log(`📊 Testing ${this.config.providers.length} providers with ${this.config.testCases.length} test cases`);
    console.log(`🔄 ${this.config.iterations} iterations per test, ${this.config.concurrentRequests} concurrent requests`);
    console.log(`⏱️  Timeout: ${this.config.timeout}ms\n`);

    // Run tests for each provider
    for (const provider of this.config.providers) {
      await this.testProvider(provider);
    }

    // Generate comprehensive report
    this.generateReport();
  }

  /**
   * Test a specific provider
   */
  private async testProvider(provider: OpenAIProvider): Promise<void> {
    console.log(`🔍 Testing Provider: ${provider.name}`);
    console.log(`🌐 Base URL: ${provider.baseUrl}`);
    console.log(`📝 Description: ${provider.description}`);
    console.log(`🤖 Models: ${provider.models.join(', ')}\n`);

    for (const model of provider.models) {
      await this.testModel(provider, model);
    }
  }

  /**
   * Test a specific model
   */
  private async testModel(provider: OpenAIProvider, model: string): Promise<void> {
    console.log(`  🧪 Testing Model: ${model}`);

    // Test without reasoning
    await this.runModelTests(provider, model, false);

    // Test with reasoning if supported
    if (provider.supportsReasoning) {
      await this.runModelTests(provider, model, true);
    }
  }

  /**
   * Run tests for a specific model configuration
   */
  private async runModelTests(provider: OpenAIProvider, model: string, reasoning: boolean): Promise<void> {
    const testLabel = reasoning ? `${model} (reasoning)` : model;
    console.log(`    📋 Testing: ${testLabel}`);

    for (const testCase of this.config.testCases) {
      const testResults = await this.runConcurrentTests(
        provider,
        model,
        reasoning,
        testCase
      );
      this.results.push(...testResults);
    }
  }

  /**
   * Run concurrent tests for a specific configuration
   */
  private async runConcurrentTests(
    provider: OpenAIProvider,
    model: string,
    reasoning: boolean,
    testCase: TestCase
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const batches = Math.ceil(this.config.iterations / this.config.concurrentRequests);

    console.log(`      🎯 Test Case: ${testCase.name} (${testCase.language})`);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(
        this.config.concurrentRequests,
        this.config.iterations - batch * this.config.concurrentRequests
      );

      const promises = Array.from({ length: batchSize }, () =>
        this.runSingleTest(provider, model, reasoning, testCase)
      );

      const batchResults = await Promise.allSettled(promises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            provider: provider.name,
            model,
            reasoning,
            success: false,
            responseTime: 0,
            errorMessage: result.reason?.message || 'Unknown error'
          });
        }
      }

      // Add delay between batches to avoid rate limiting
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`      ✅ Completed: ${successCount}/${results.length} successful`);

    return results;
  }

  /**
   * Run a single test
   */
  private async runSingleTest(
    provider: OpenAIProvider,
    model: string,
    reasoning: boolean,
    testCase: TestCase
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const service = new OpenAiService(
        provider.apiKey,
        provider.baseUrl,
        model,
        reasoning
      );

      // Set timeout for the request
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
      });

      const testPromise = service.generateCommitAndBranch(testCase.diff, testCase.language);
      const result = await Promise.race([testPromise, timeoutPromise]);

      const responseTime = Date.now() - startTime;

      return {
        provider: provider.name,
        model,
        reasoning,
        success: true,
        responseTime,
        tokenCount: this.estimateTokens(result.commit + result.branch + result.description)
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        provider: provider.name,
        model,
        reasoning,
        success: false,
        responseTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Estimate token count for response
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate comprehensive performance report
   */
  private generateReport(): void {
    console.log('\n📊 Performance Report');
    console.log('=' .repeat(80));

    // Group results by provider and model
    const groupedResults = this.groupResults();

    // Calculate statistics for each group
    const stats = this.calculateStatistics(groupedResults);

    // Display detailed statistics
    this.displayStatistics(stats);

    // Display performance comparison
    this.displayComparison(stats);

    // Display error analysis
    this.displayErrorAnalysis();

    // Export results to JSON
    this.exportResults();
  }

  /**
   * Group results by provider, model, and reasoning mode
   */
  private groupResults(): Map<string, TestResult[]> {
    const grouped = new Map<string, TestResult[]>();

    for (const result of this.results) {
      const key = `${result.provider}-${result.model}-${result.reasoning}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(result);
    }

    return grouped;
  }

  /**
   * Calculate performance statistics
   */
  private calculateStatistics(groupedResults: Map<string, TestResult[]>): PerformanceStats[] {
    const stats: PerformanceStats[] = [];

    for (const [key, results] of groupedResults) {
      const [provider, model, reasoning] = key.split('-');
      const successfulResults = results.filter(r => r.success);
      const responseTimes = successfulResults.map(r => r.responseTime);
      const tokenCounts = successfulResults.map(r => r.tokenCount).filter(t => t !== undefined) as number[];

      stats.push({
        provider,
        model,
        reasoning: reasoning === 'true',
        totalRequests: results.length,
        successfulRequests: successfulResults.length,
        averageResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
        maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
        successRate: (successfulResults.length / results.length) * 100,
        averageTokens: tokenCounts.length > 0 ? tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length : undefined
      });
    }

    return stats.sort((a, b) => a.averageResponseTime - b.averageResponseTime);
  }

  /**
   * Display detailed statistics
   */
  private displayStatistics(stats: PerformanceStats[]): void {
    console.log('\n📈 Detailed Statistics:');
    console.log('-' .repeat(120));
    console.log(
      'Provider'.padEnd(15) +
      'Model'.padEnd(20) +
      'Reasoning'.padEnd(10) +
      'Success Rate'.padEnd(12) +
      'Avg Time (ms)'.padEnd(14) +
      'Min (ms)'.padEnd(10) +
      'Max (ms)'.padEnd(10) +
      'Avg Tokens'.padEnd(12)
    );
    console.log('-' .repeat(120));

    for (const stat of stats) {
      console.log(
        stat.provider.padEnd(15) +
        stat.model.padEnd(20) +
        (stat.reasoning ? 'Yes' : 'No').padEnd(10) +
        `${stat.successRate.toFixed(1)}%`.padEnd(12) +
        stat.averageResponseTime.toFixed(0).padEnd(14) +
        stat.minResponseTime.toFixed(0).padEnd(10) +
        stat.maxResponseTime.toFixed(0).padEnd(10) +
        (stat.averageTokens ? stat.averageTokens.toFixed(0) : 'N/A').padEnd(12)
      );
    }
  }

  /**
   * Display performance comparison
   */
  private displayComparison(stats: PerformanceStats[]): void {
    console.log('\n🏆 Performance Ranking (by average response time):');
    console.log('-' .repeat(60));

    stats.forEach((stat, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const reasoningLabel = stat.reasoning ? ' (reasoning)' : '';
      console.log(
        `${medal} ${index + 1}. ${stat.provider} - ${stat.model}${reasoningLabel}: ` +
        `${stat.averageResponseTime.toFixed(0)}ms (${stat.successRate.toFixed(1)}% success)`
      );
    });

    // Best and worst performers
    if (stats.length > 0) {
      const best = stats[0];
      const worst = stats[stats.length - 1];

      console.log('\n🎯 Key Insights:');
      console.log(`✅ Fastest: ${best.provider} - ${best.model} (${best.averageResponseTime.toFixed(0)}ms)`);
      console.log(`🐌 Slowest: ${worst.provider} - ${worst.model} (${worst.averageResponseTime.toFixed(0)}ms)`);
      
      const speedDifference = ((worst.averageResponseTime - best.averageResponseTime) / best.averageResponseTime * 100);
      console.log(`⚡ Speed difference: ${speedDifference.toFixed(1)}% slower`);
    }
  }

  /**
   * Display error analysis
   */
  private displayErrorAnalysis(): void {
    const errors = this.results.filter(r => !r.success);
    
    if (errors.length === 0) {
      console.log('\n✅ No errors occurred during testing!');
      return;
    }

    console.log('\n❌ Error Analysis:');
    console.log('-' .repeat(80));

    // Group errors by type
    const errorGroups = new Map<string, TestResult[]>();
    for (const error of errors) {
      const key = error.errorMessage || 'Unknown error';
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(error);
    }

    // Display error statistics
    for (const [errorType, errorList] of errorGroups) {
      console.log(`\n🔍 ${errorType}:`);
      console.log(`   Count: ${errorList.length}`);
      
      // Group by provider
      const providerGroups = new Map<string, number>();
      for (const error of errorList) {
        const key = `${error.provider}-${error.model}`;
        providerGroups.set(key, (providerGroups.get(key) || 0) + 1);
      }
      
      console.log('   Affected:');
      for (const [provider, count] of providerGroups) {
        console.log(`     ${provider}: ${count} times`);
      }
    }
  }

  /**
   * Export results to JSON file
   */
  private exportResults(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `openai-batch-test-results-${timestamp}.json`;
    
    const exportData = {
      timestamp: new Date().toISOString(),
      config: {
        providers: this.config.providers.map(p => ({ 
          name: p.name, 
          baseUrl: p.baseUrl, 
          models: p.models,
          supportsReasoning: p.supportsReasoning,
          description: p.description
        })),
        testCases: this.config.testCases.map(tc => ({ 
          name: tc.name, 
          language: tc.language, 
          expectedTokens: tc.expectedTokens 
        })),
        iterations: this.config.iterations,
        concurrentRequests: this.config.concurrentRequests,
        timeout: this.config.timeout
      },
      results: this.results
    };

    try {
      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
      console.log(`\n💾 Results exported to: ${filename}`);
    } catch (error) {
      console.error('❌ Failed to export results:', error);
    }
  }
}

/**
 * Default test configuration
 */
function getDefaultTestConfig(): TestConfig {
  // Load from environment variables or use defaults
  const providers: OpenAIProvider[] = [
    {
      name: 'OpenAI',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'],
      apiKey: process.env.OPENAI_KEY || '',
      supportsReasoning: false,
      description: 'Official OpenAI API'
    },
    {
      name: 'OpenAI-Reasoning',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: ['o1-preview', 'o1-mini'],
      apiKey: process.env.OPENAI_KEY || '',
      supportsReasoning: true,
      description: 'OpenAI API with reasoning models'
    }
  ];

  // Add custom providers from environment
  const customProviders = process.env.CUSTOM_OPENAI_PROVIDERS;
  if (customProviders) {
    try {
      const parsed = JSON.parse(customProviders);
      providers.push(...parsed);
    } catch (error) {
      console.warn('⚠️  Failed to parse CUSTOM_OPENAI_PROVIDERS:', error);
    }
  }

  const testCases: TestCase[] = [
    {
      name: 'Simple Feature',
      language: 'en',
      expectedTokens: 200,
      diff: `diff --git a/src/utils/helper.ts b/src/utils/helper.ts
index 1234567..abcdefg 100644
--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1,3 +1,8 @@
+export function formatDate(date: Date): string {
+  return date.toISOString().split('T')[0];
+}
+
 export function capitalize(str: string): string {
   return str.charAt(0).toUpperCase() + str.slice(1);
 }`
    },
    {
      name: 'Bug Fix',
      language: 'en',
      expectedTokens: 150,
      diff: `diff --git a/src/api/user.ts b/src/api/user.ts
index 2345678..bcdefgh 100644
--- a/src/api/user.ts
+++ b/src/api/user.ts
@@ -10,7 +10,7 @@ export async function getUser(id: string): Promise<User> {
   try {
     const response = await fetch(\`/api/users/\${id}\`);
-    return response.json();
+    return await response.json();
   } catch (error) {
     throw new Error('Failed to fetch user');
   }`
    },
    {
      name: 'Chinese Language Test',
      language: 'zh-cn',
      expectedTokens: 180,
      diff: `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 3456789..cdefghi 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -5,6 +5,7 @@ interface ButtonProps {
   onClick: () => void;
   disabled?: boolean;
   variant?: 'primary' | 'secondary';
+  size?: 'small' | 'medium' | 'large';
 }
 
 export const Button: React.FC<ButtonProps> = ({`
    }
  ];

  return {
    providers: providers.filter(p => p.apiKey), // Only include providers with API keys
    testCases,
    iterations: parseInt(process.env.TEST_ITERATIONS || '3'),
    concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '2'),
    timeout: parseInt(process.env.TEST_TIMEOUT || '30000')
  };
}

/**
 * Main test execution
 */
async function main() {
  try {
    const config = getDefaultTestConfig();
    
    if (config.providers.length === 0) {
      console.error('❌ No providers configured with API keys');
      console.log('💡 Set environment variables:');
      console.log('   OPENAI_KEY=your-api-key');
      console.log('   OPENAI_BASE_URL=https://api.openai.com/v1 (optional)');
      console.log('   CUSTOM_OPENAI_PROVIDERS=\'[{"name":"Custom","baseUrl":"https://api.custom.com","models":["model1"],"apiKey":"key"}]\' (optional)');
      process.exit(1);
    }

    const tester = new OpenAIBatchTester(config);
    await tester.runBatchTests();
    
    console.log('\n🎉 Batch testing completed successfully!');
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Execute test only if this file is run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main().catch(console.error);
}
