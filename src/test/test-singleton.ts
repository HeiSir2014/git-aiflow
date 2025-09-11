#!/usr/bin/env node

import { logger, Logger, LogLevel } from '../logger.js';

/**
 * Test singleton pattern thoroughly
 */
class SingletonTest {
  async testBasicSingleton() {
    console.log('🧪 Testing basic singleton behavior...');
    
    // Test 1: Multiple getInstance calls return same instance
    const logger1 = Logger.getInstance();
    const logger2 = Logger.getInstance();
    const logger3 = Logger.getInstance();
    
    console.log(`✅ Same instance: ${logger1 === logger2 && logger2 === logger3}`);
    console.log(`✅ Global logger same: ${logger === logger1}`);
  }
  
  async testConfigurationUpdate() {
    console.log('\n🧪 Testing configuration update...');
    
    // Test 2: Configuration update affects existing instance
    const originalLevel = Logger.getInstance().getWinston().level;
    console.log(`Original level: ${originalLevel}`);
    
    Logger.configure({ level: LogLevel.ERROR });
    const newLevel = Logger.getInstance().getWinston().level;
    console.log(`New level: ${newLevel}`);
    console.log(`✅ Configuration updated: ${newLevel === 'error'}`);
  }
  
  async testResetAndRecreate() {
    console.log('\n🧪 Testing reset and recreate...');
    
    // Test 3: Reset creates new instance
    const originalInstance = Logger.getInstance();
    Logger.reset();
    const newInstance = Logger.getInstance();
    
    console.log(`✅ Reset worked: ${originalInstance !== newInstance}`);
    console.log(`✅ New instance created: ${Logger.hasInstance()}`);
  }
  
  async testContextDetection() {
    console.log('\n🧪 Testing context detection...');
    
    // Test 4: Context detection in different scenarios
    logger.info('Message from testContextDetection method');
    
    // Test in nested function
    const nestedFunction = () => {
      logger.debug('Message from nested function');
    };
    nestedFunction();
    
    // Test in arrow function
    const arrowFunction = () => {
      logger.warn('Message from arrow function');
    };
    arrowFunction();
  }
  
  async testCachePerformance() {
    console.log('\n🧪 Testing cache performance...');
    
    // Test 5: Cache performance
    Logger.clearCache();
    console.log(`Cache size after clear: ${Logger.getCacheSize()}`);
    
    // Generate some logs to populate cache
    for (let i = 0; i < 5; i++) {
      logger.info(`Test message ${i}`);
    }
    
    console.log(`Cache size after logging: ${Logger.getCacheSize()}`);
    
    // Test cache hit
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      logger.debug('Cached message');
    }
    const end = Date.now();
    
    console.log(`✅ 1000 cached logs took: ${end - start}ms`);
  }
  
  async testConcurrentAccess() {
    console.log('\n🧪 Testing concurrent access...');
    
    // Test 6: Concurrent access to singleton
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(new Promise(resolve => {
        setTimeout(() => {
          const instance = Logger.getInstance();
          logger.info(`Concurrent test ${i}`);
          resolve(instance);
        }, Math.random() * 10);
      }));
    }
    
    const instances = await Promise.all(promises);
    const allSame = instances.every(instance => instance === instances[0]);
    
    console.log(`✅ Concurrent access safe: ${allSame}`);
  }
  
  async testMemoryManagement() {
    console.log('\n🧪 Testing memory management...');
    
    // Test 7: Memory management
    const initialCacheSize = Logger.getCacheSize();
    
    // Generate many unique contexts
    for (let i = 0; i < 100; i++) {
      const uniqueFunction = () => {
        logger.info(`Unique message ${i}`);
      };
      uniqueFunction();
    }
    
    const finalCacheSize = Logger.getCacheSize();
    console.log(`Cache growth: ${initialCacheSize} -> ${finalCacheSize}`);
    
    // Clear cache
    Logger.clearCache();
    console.log(`✅ Cache cleared: ${Logger.getCacheSize() === 0}`);
  }
  
  async runAllTests() {
    console.log('🚀 Starting comprehensive singleton tests...\n');
    
    try {
      await this.testBasicSingleton();
      await this.testConfigurationUpdate();
      await this.testResetAndRecreate();
      await this.testContextDetection();
      await this.testCachePerformance();
      await this.testConcurrentAccess();
      await this.testMemoryManagement();
      
      console.log('\n🎉 All singleton tests completed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
}

// Run tests
const test = new SingletonTest();
test.runAllTests().catch(console.error);
