#!/usr/bin/env node

import { ConfigLoader, parseCliArgs, getConfigValue, getCliHelp, LoadedConfig, getGitAccessToken, getAllGitAccessTokens } from '../config.js';

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
    '--git-access-token', 'github.com=ghp_test_token',
    '--git-access-token', 'gitlab.example.com=glpat-test-token',
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
    '-gat', 'github.com=ghp_short_token',
    '-gat', 'gitlab.example.com=glpat-short-token',
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
    '-gat', 'github.com=ghp_mixed_token',    // Short
    '--git-access-token', 'gitlab.example.com=glpat-mixed-token', // Long
    '-crbu', 'https://conan.mixed.com',      // Short
    '--squash-commits', 'false'              // Long
  ];

  const mixedConfig = parseCliArgs(mixedArgs);
  console.log('Mixed args config:');
  console.log(JSON.stringify(mixedConfig, null, 2));

  // Test 5: Verify argument mappings
  console.log('\n📋 Test 5: Verifying short/long argument mappings...');
  const testCases = [
    {short: ['-ok', 'test'], long: ['--openai-key', 'test'], description: 'OpenAI key'},
    {short: ['-gat', 'github.com=ghp_test'], long: ['--git-access-token', 'github.com=ghp_test'], description: 'Git access token'},
    {short: ['-crbu', 'test'], long: ['--conan-remote-base-url', 'test'], description: 'Conan URL'},
    {short: ['-sc', 'false'], long: ['--squash-commits', 'false'], description: 'Squash commits'},
    {short: ['-ww', 'test'], long: ['--wecom-webhook', 'test'], description: 'WeChat Work webhook'},
    {short: ['-we', 'true'], long: ['--wecom-enable', 'true'], description: 'WeChat Work enable'},
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

  // Test 6: Git access token functions
  console.log('\n📋 Test 6: Testing Git access token functions...');
  
  // Create a test config with git access tokens
  const testConfig: LoadedConfig = {
    git_access_tokens: {
      'github.com': 'ghp_test_github_token',
      'gitlab.example.com': 'glpat-test-gitlab-token',
      'gitee.com': 'gitee_test_token'
    },
    _sources: new Map()
  };
  
  // Test getGitAccessToken
  const githubToken = getGitAccessToken(testConfig, 'github.com');
  const gitlabToken = getGitAccessToken(testConfig, 'gitlab.example.com');
  const giteeToken = getGitAccessToken(testConfig, 'gitee.com');
  const unknownToken = getGitAccessToken(testConfig, 'unknown.com');
  
  
  githubToken && console.log(`GitHub token: ${githubToken === 'ghp_test_github_token' ? '✅' : '❌'} ${githubToken}`);
  gitlabToken && console.log(`GitLab token: ${gitlabToken === 'glpat-test-gitlab-token' ? '✅' : '❌'} ${gitlabToken}`);
  giteeToken && console.log(`Gitee token: ${giteeToken === 'gitee_test_token' ? '✅' : '❌'} ${giteeToken}`);
  unknownToken && console.log(`Unknown token: ${unknownToken === undefined ? '✅' : '❌'} ${unknownToken || 'undefined'}`);
  
  // Test getAllGitAccessTokens
  const allTokens = getAllGitAccessTokens(testConfig);
  const expectedTokensCount = 3;
  const actualTokensCount = Object.keys(allTokens).length;
  console.log(`All tokens count: ${actualTokensCount === expectedTokensCount ? '✅' : '❌'} ${actualTokensCount}/${expectedTokensCount}`);
  console.log('All tokens:', JSON.stringify(allTokens, null, 2));

  // Test 7: Environment variable parsing for Git tokens
  console.log('\n📋 Test 7: Testing Git access token environment variables...');
  
  // Simulate environment variables
  const originalEnv = { ...process.env };
  process.env.GIT_ACCESS_TOKEN_GITHUB_COM = 'ghp_env_github_token';
  process.env.GIT_ACCESS_TOKEN_GITLAB_EXAMPLE_COM = 'glpat-env-gitlab-token';
  process.env.GIT_ACCESS_TOKEN_GITEE_COM = 'gitee_env_token';
  
  const envConfig = await configLoader.loadConfig();
  configLoader.clearWarnings();
  
  const envGithubToken = getGitAccessToken(envConfig, 'github.com');
  const envGitlabToken = getGitAccessToken(envConfig, 'gitlab.example.com');
  const envGiteeToken = getGitAccessToken(envConfig, 'gitee.com');
  
  console.log(`Env GitHub token: ${envGithubToken === 'ghp_env_github_token' ? '✅' : '❌'} ${envGithubToken || 'undefined'}`);
  console.log(`Env GitLab token: ${envGitlabToken === 'glpat-env-gitlab-token' ? '✅' : '❌'} ${envGitlabToken || 'undefined'}`);
  console.log(`Env Gitee token: ${envGiteeToken === 'gitee_env_token' ? '✅' : '❌'} ${envGiteeToken || 'undefined'}`);
  
  // Restore original environment
  process.env = originalEnv;

  // Test 8: Configuration integration
  console.log('\n📋 Test 8: Testing configuration integration...');
  const simulatedArgs = [
    '-ok', 'sk-test-key-from-cli',           // Short form for --openai-key
    '--git-access-token', 'github.com=ghp_test_from_cli', // Long form
    '-gat', 'gitlab.example.com=glpat-test-from-cli',     // Short form  
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
  
  const githubToken2 = getGitAccessToken(config, 'github.com');
  console.log(`GitHub Token: ${githubToken2 ? '***hidden***' : 'not set'} (from ${config._sources.get('git_access_tokens.github.com')?.source || 'none'})`);
  
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
