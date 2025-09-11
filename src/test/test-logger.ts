#!/usr/bin/env node

import { logger, Logger } from '../logger.js';

/**
 * Test class to demonstrate automatic context detection
 */
class TestService {
  async processData() {
    logger.info('Processing data in TestService');
    logger.debug('Debug information from processData method');

    try {
      // Simulate some work
      await this.validateInput();
    } catch (error) {
      logger.error('Error in processData', error);
    }
  }

  private validateInput() {
    logger.verbose('Validating input data');
    throw new Error('Validation failed');
  }
}

/**
 * Test function to demonstrate context detection
 */
function testFunction() {
  logger.info('This is a test function');
  logger.warn('Warning from test function');
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Testing Logger with automatic context detection\n');

  // Test singleton behavior
  console.log('🔍 Testing singleton behavior:');
  console.log(`- Logger instance exists: ${Logger.hasInstance()}`);
  console.log(`- Cache size: ${Logger.getCacheSize()}`);

  // Test basic logging
  logger.info('Starting logger test');
  logger.debug('Debug message from main function');

  // Test function context
  testFunction();

  // Test class context
  const service = new TestService();
  await service.processData();

  // Test HTTP logging
  logger.httpRequest('GET', '/api/users', 200, 150);

  // Test service logging
  logger.service('createUser', 'UserService', { userId: 123, email: 'test@example.com' });

  // Test shell command logging
  logger.shell('git status', 'On branch main\nYour branch is up to date');

  // Test singleton consistency
  const logger2 = Logger.getInstance();
  console.log(`\n🔍 Singleton test: ${logger === logger2 ? '✅ Same instance' : '❌ Different instances'}`);

  // Test cache performance
  console.log(`📊 Cache size after logging: ${Logger.getCacheSize()}`);

  // Test cache clearing
  Logger.clearCache();
  console.log(`🧹 Cache cleared, new size: ${Logger.getCacheSize()}`);

  console.log('\n✅ Logger test completed! Check the logs directory for output.');
  console.log(`📁 Logs directory: ${process.env.APPDATA ? process.env.APPDATA + '\\aiflow\\logs' : '~/.config/aiflow/logs'}`);
}

// Run the test
main().catch(console.error);
