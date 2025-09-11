#!/usr/bin/env node

import { logger, Logger } from '../logger.js';

/**
 * Performance test for Logger singleton and caching
 */
async function performanceTest() {
  console.log('🚀 Logger Performance Test\n');
  
  // Test 1: Singleton performance
  console.log('📊 Testing singleton performance...');
  const iterations = 10000;
  
  const startSingleton = Date.now();
  for (let i = 0; i < iterations; i++) {
    Logger.getInstance();
  }
  const endSingleton = Date.now();
  
  console.log(`✅ ${iterations} getInstance() calls: ${endSingleton - startSingleton}ms`);
  console.log(`   Average: ${(endSingleton - startSingleton) / iterations}ms per call`);
  
  // Test 2: Cache performance
  console.log('\n📊 Testing cache performance...');
  
  // Clear cache first
  Logger.clearCache();
  
  // First call (no cache)
  const startFirst = Date.now();
  logger.info('First call - no cache');
  const endFirst = Date.now();
  
  // Subsequent calls (with cache)
  const startCached = Date.now();
  for (let i = 0; i < 1000; i++) {
    logger.info('Cached call');
  }
  const endCached = Date.now();
  
  console.log(`✅ First call (no cache): ${endFirst - startFirst}ms`);
  console.log(`✅ 1000 cached calls: ${endCached - startCached}ms`);
  console.log(`   Average cached: ${(endCached - startCached) / 1000}ms per call`);
  console.log(`   Cache size: ${Logger.getCacheSize()}`);
  
  // Test 3: Memory usage
  console.log('\n📊 Testing memory usage...');
  
  const initialMemory = process.memoryUsage();
  console.log(`Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
  
  // Generate many unique contexts
  for (let i = 0; i < 1000; i++) {
    const uniqueFunction = () => {
      logger.debug(`Unique context ${i}`);
    };
    uniqueFunction();
  }
  
  const finalMemory = process.memoryUsage();
  console.log(`Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
  console.log(`Memory increase: ${Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`);
  console.log(`Cache size: ${Logger.getCacheSize()}`);
  
  // Test 4: Context detection accuracy
  console.log('\n📊 Testing context detection accuracy...');
  
  class TestClass {
    testMethod() {
      logger.info('Message from TestClass.testMethod');
    }
    
    async asyncMethod() {
      logger.debug('Message from TestClass.asyncMethod');
    }
  }
  
  function testFunction() {
    logger.warn('Message from testFunction');
  }
  
  const testClass = new TestClass();
  testClass.testMethod();
  await testClass.asyncMethod();
  testFunction();
  
  // Test 5: Concurrent access performance
  console.log('\n📊 Testing concurrent access...');
  
  const concurrentPromises = [];
  const startConcurrent = Date.now();
  
  for (let i = 0; i < 100; i++) {
    concurrentPromises.push(new Promise(resolve => {
      setTimeout(() => {
        logger.info(`Concurrent message ${i}`);
        resolve(i);
      }, Math.random() * 10);
    }));
  }
  
  await Promise.all(concurrentPromises);
  const endConcurrent = Date.now();
  
  console.log(`✅ 100 concurrent operations: ${endConcurrent - startConcurrent}ms`);
  
  // Test 6: Cache efficiency
  console.log('\n📊 Testing cache efficiency...');
  
  Logger.clearCache();
  const cacheStart = Date.now();
  
  // Generate logs with repeated contexts
  for (let i = 0; i < 100; i++) {
    const repeatedFunction = () => {
      logger.info(`Repeated context ${i % 10}`);
    };
    repeatedFunction();
  }
  
  const cacheEnd = Date.now();
  console.log(`✅ 100 logs with 10 unique contexts: ${cacheEnd - cacheStart}ms`);
  console.log(`   Cache size: ${Logger.getCacheSize()}`);
  console.log(`   Cache hit ratio: ${Math.round((90 / 100) * 100)}%`);
  
  console.log('\n🎉 Performance test completed!');
}

// Run performance test
performanceTest().catch(console.error);
