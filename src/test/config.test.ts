#!/usr/bin/env node

import { ConfigLoader, parseCliArgs, getConfigValue, getCliHelp, LoadedConfig } from '../config.js';

/**
 * Comprehensive AIFlow Configuration System Tests
 */
async function testConfigSystem() {
  console.log('🧪 Testing AIFlow Configuration System\n');

  const configLoader = new ConfigLoader();

  // Test 1: Load base configuration
  console.log('📋 Test 1: Loading base configuration...');
  const baseConfig = await configLoader.loadConfig();
  
  console.log('Base config loaded:');
  console.log(JSON.stringify(baseConfig, null, 2));
  
  const warnings = configLoader.getWarnings();
  if (warnings.length > 0) {
    console.log('\n⚠️  Configuration warnings:');
    warnings.forEach(warning => console.log(`  ${warning}`));
  }

  configLoader.printConfigSources(baseConfig);

  // Test 2: CLI argument parsing (long form)
  console.log('\n📋 Test 2: Testing long CLI argument parsing...');
  const longCliArgs = parseCliArgs([
    '--openai-key', 'test-key-from-cli',
    '--gitlab-token', 'test-token-from-cli',
    '--conan-remote-repo', 'test-repo-from-cli'
  ]);
  
  console.log('Parsed long CLI args:');
  console.log(JSON.stringify(longCliArgs, null, 2));

  // Test 3: Short CLI arguments
  console.log('\n📋 Test 3: Testing short CLI arguments...');
  const shortArgs = [
    '-ok', 'sk-short-key',
    '-obu', 'https://api.custom.com/v1',
    '-om', 'gpt-4',
    '-gt', 'glpat-short-token',
    '-gbu', 'https://gitlab.custom.com',
    '-crbu', 'https://conan.short.com',
    '-crr', 'short-repo',
    '-ww', 'https://wecom.short.com/webhook',
    '-we', 'true',
    '-sc', 'true',
    '-rsb', 'false'
  ];

  const shortConfig = parseCliArgs(shortArgs);
  console.log('Short args config:');
  console.log(JSON.stringify(shortConfig, null, 2));

  // Test 4: Mixed short and long arguments
  console.log('\n📋 Test 4: Testing mixed short and long arguments...');
  const mixedArgs = [
    '-ok', 'sk-mixed-key',                   // Short
    '--openai-model', 'gpt-4-turbo',         // Long
    '-gt', 'glpat-mixed-token',              // Short
    '--gitlab-base-url', 'https://gitlab.mixed.com', // Long
    '-crbu', 'https://conan.mixed.com',      // Short
    '--squash-commits', 'false'              // Long
  ];

  const mixedConfig = parseCliArgs(mixedArgs);
  console.log('Mixed args config:');
  console.log(JSON.stringify(mixedConfig, null, 2));

  // Test 5: Verify argument mappings
  console.log('\n📋 Test 5: Verifying short/long argument mappings...');
  const testCases = [
    { short: ['-ok', 'test'], long: ['--openai-key', 'test'], description: 'OpenAI key' },
    { short: ['-gt', 'test'], long: ['--gitlab-token', 'test'], description: 'GitLab token' },
    { short: ['-crbu', 'test'], long: ['--conan-remote-base-url', 'test'], description: 'Conan URL' },
    { short: ['-sc', 'false'], long: ['--squash-commits', 'false'], description: 'Squash commits' },
    { short: ['-ww', 'test'], long: ['--wecom-webhook', 'test'], description: 'WeChat Work webhook' },
    { short: ['-we', 'true'], long: ['--wecom-enable', 'true'], description: 'WeChat Work enable' },
  ];

  for (const testCase of testCases) {
    const shortResult = parseCliArgs(testCase.short);
    const longResult = parseCliArgs(testCase.long);
    
    const isEqual = JSON.stringify(shortResult) === JSON.stringify(longResult);
    console.log(`  ${testCase.description}: ${isEqual ? '✅' : '❌'} ${testCase.short[0]} === ${testCase.long[0]}`);
    
    if (!isEqual) {
      console.log(`    Short: ${JSON.stringify(shortResult)}`);
      console.log(`    Long:  ${JSON.stringify(longResult)}`);
    }
  }

  // Test 6: Configuration integration
  console.log('\n📋 Test 6: Testing configuration integration...');
  const simulatedArgs = [
    '-ok', 'sk-test-key-from-cli',           // Short form for --openai-key
    '--gitlab-token', 'glpat-test-token',    // Long form
    '-crbu', 'https://conan.test.com',       // Short form for --conan-remote-base-url
    '-sc', 'false'                           // Short form for --squash-commits
  ];

  const cliConfig = parseCliArgs(simulatedArgs);
  console.log('🎯 Parsed CLI arguments:');
  console.log(JSON.stringify(cliConfig, null, 2));

  // Load full configuration with priority merging
  console.log('\n📊 Loading configuration with priority merging...');
  configLoader.clearWarnings();
  const config = await configLoader.loadConfig(cliConfig);

  // Show configuration sources
  configLoader.printConfigSources(config);

  // Test helper function for getting configuration values
  console.log('\n📖 Testing configuration value retrieval:');
  
  const openaiKey = getConfigValue(config, 'openai.key', 'default-key');
  console.log(`OpenAI Key: ${openaiKey} (from ${config._sources.get('openai.key')?.source || 'default'})`);
  
  const gitlabToken = getConfigValue(config, 'gitlab.token');
  console.log(`GitLab Token: ${gitlabToken ? '***hidden***' : 'not set'} (from ${config._sources.get('gitlab.token')?.source || 'none'})`);
  
  const conanUrl = getConfigValue(config, 'conan.remoteBaseUrl', 'https://default.conan.com');
  console.log(`Conan URL: ${conanUrl} (from ${config._sources.get('conan.remoteBaseUrl')?.source || 'default'})`);
  
  const squashCommits = getConfigValue(config, 'git.squashCommits', true);
  console.log(`Squash Commits: ${squashCommits} (from ${config._sources.get('git.squashCommits')?.source || 'default'})`);

  // Test missing configuration handling
  console.log('\n⚠️  Testing missing configuration warnings:');
  const configWarnings = configLoader.getWarnings();
  configWarnings.forEach(warning => console.log(`  ${warning}`));

  // Example of how to use configuration in existing applications
  console.log('\n💡 Example application initialization:');
  const appConfig = createApplicationConfig(config);
  console.log(JSON.stringify(appConfig, null, 2));

  // Test 7: Invalid arguments
  console.log('\n📋 Test 7: Testing invalid arguments...');
  const invalidArgs = [
    '-x', 'invalid-value',  // Unknown short arg
    '-invalid', 'value',    // Too long for short arg
    'no-dash', 'value'      // No dash prefix
  ];

  const invalidConfig = parseCliArgs(invalidArgs);
  console.log('Invalid args config (should be empty):');
  console.log(JSON.stringify(invalidConfig, null, 2));

  // Test 8: CLI Help documentation
  console.log('\n📋 Test 8: Testing CLI Help documentation...');
  const helpText = getCliHelp();
  console.log('CLI Help (first 500 chars):');
  console.log(helpText.substring(0, 500) + '...');

  // Test 9: Create example configurations
  console.log('\n📋 Test 9: Creating example configurations...');
  try {
    await configLoader.createExampleConfigs();
    console.log('✅ Example configurations created successfully');
  } catch (error) {
    console.error('❌ Failed to create example configurations:', error);
  }

  console.log('\n✅ Configuration system test completed');
}

/**
 * Example function showing how to convert loaded config to application-specific format
 */
function createApplicationConfig(config: LoadedConfig): any {
  return {
    openai: {
      apiKey: getConfigValue(config, 'openai.key', ''),
      baseUrl: getConfigValue(config, 'openai.baseUrl', 'https://api.openai.com/v1'),
      model: getConfigValue(config, 'openai.model', 'gpt-3.5-turbo'),
    },
    gitlab: {
      token: getConfigValue(config, 'gitlab.token', ''),
      baseUrl: getConfigValue(config, 'gitlab.baseUrl', ''),
    },
    conan: {
      remoteBaseUrl: getConfigValue(config, 'conan.remoteBaseUrl', ''),
      remoteRepo: getConfigValue(config, 'conan.remoteRepo', 'repo'),
    },
    wecom: {
      webhook: getConfigValue(config, 'wecom.webhook', ''),
      enable: getConfigValue(config, 'wecom.enable', false),
    },
    git: {
      squashCommits: getConfigValue(config, 'git.squashCommits', true),
      removeSourceBranch: getConfigValue(config, 'git.removeSourceBranch', true),
    },
  };
}

// Run the test
testConfigSystem().catch(console.error);
