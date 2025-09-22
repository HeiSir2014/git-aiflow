#!/usr/bin/env node

import { logger, shutdownLogger } from '../logger.js';

/**
 * Test logger metadata functionality
 */
async function testLoggerMetadata() {
  console.log('🧪 Testing Logger Metadata Functionality');
  console.log('=' .repeat(50));

  // Test 1: Simple metadata
  console.log('\n📋 Test 1: Simple metadata');
  logger.info('Testing simple metadata', JSON.stringify({ 
    userId: 123, 
    action: 'login' 
  }, null, 2));

  await shutdownLogger();
  return;
  // Test 2: Complex metadata
  console.log('\n📋 Test 2: Complex metadata');
  logger.debug('Testing complex metadata', {
    request: {
      method: 'POST',
      url: '/api/users',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ***'
      }
    },
    response: {
      status: 200,
      data: { id: 456, name: 'Test User' }
    },
    performance: {
      duration: 150,
      memory: '25MB'
    }
  });

  // Test 3: OpenAI service style metadata
  console.log('\n📋 Test 3: OpenAI service style metadata');
  logger.debug('Enabling reasoning mode for model', {
    model: 'gpt-4o-mini',
    config: {
      enabled: true,
      effort: 'high',
      max_tokens: 2000,
      exclude: false
    }
  });

  // Test 4: Different log levels with metadata
  console.log('\n📋 Test 4: Different log levels with metadata');
  
  logger.error('Error with metadata', { 
    errorCode: 'E001', 
    details: 'Connection failed',
    timestamp: new Date().toISOString()
  });
  
  logger.warn('Warning with metadata', { 
    warningType: 'deprecation', 
    feature: 'oldApi',
    replacement: 'newApi'
  });
  
  logger.info('Info with metadata', { 
    event: 'user_action', 
    data: { clicks: 5, duration: 30 }
  });

  // Test 5: Service operation logging
  console.log('\n📋 Test 5: Service operation logging');
  logger.service('generateCommitAndBranch', 'OpenAiService', {
    model: 'gpt-4o-mini',
    reasoning: true,
    diffSize: 1500,
    language: 'en'
  });

  // Test 6: Empty metadata (should not show metadata)
  console.log('\n📋 Test 6: Empty metadata');
  logger.info('Message without metadata');
  logger.info('Message with empty metadata', {});

  // Test 7: Large metadata (should be truncated in console)
  console.log('\n📋 Test 7: Large metadata');
  const largeMetadata = {
    data: 'x'.repeat(200),
    moreData: {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3'
    }
  };
  logger.info('Message with large metadata', largeMetadata);

  console.log('\n✅ Logger metadata test completed!');
  console.log('📄 Check the log file for full metadata details');
  console.log('🖥️  Console output shows truncated metadata for readability');
}

/**
 * Test reasoning configuration logging specifically
 */
async function testReasoningLogging() {
  console.log('\n🧠 Testing Reasoning Configuration Logging');
  console.log('-' .repeat(40));

  // Simulate different reasoning configurations
  const reasoningConfigs = [
    { enabled: true },
    { enabled: true, effort: 'high' },
    { enabled: true, max_tokens: 2000 },
    { enabled: true, effort: 'medium', max_tokens: 1500, exclude: false }
  ];

  for (let i = 0; i < reasoningConfigs.length; i++) {
    const config = reasoningConfigs[i];
    logger.debug(`Enabling reasoning mode for model: gpt-4o-mini, config: ${JSON.stringify(config, null, 0)}`, {
      model: 'gpt-4o-mini',
      reasoning: config,
      testCase: i + 1
    });
  }

  console.log('✅ Reasoning logging test completed!');
}

/**
 * Main execution
 */
async function main() {
  try {
    await testLoggerMetadata();
    await testReasoningLogging();
    
    console.log('\n🎉 All logger tests completed successfully!');
    
    await shutdownLogger();
    // Give time for async logging to complete
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Logger test failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
main().catch(console.error);
