#!/usr/bin/env node

import { Shell } from '../shell.js';

/**
 * Test Shell multiline command support
 */
async function testShellMultiline(): Promise<void> {
  console.log('🧪 Testing Shell Multiline Command Support');
  console.log('='.repeat(50));

  const shell = new Shell();

  try {
    // Test 1: Single line command
    console.log('\n📝 Test 1: Single line command');
    const singleLineResult = shell.run('echo "Hello World"');
    console.log(`Result: "${singleLineResult}"`);

    // Test 2: PowerShell here-string (multiline)
    console.log('\n📝 Test 2: PowerShell here-string (multiline)');
    const multilineCommand = `Write-Output @'
Line 1: Hello
Line 2: World
Line 3: From PowerShell
'@`;
    
    const multilineResult = shell.run(multilineCommand);
    console.log(`Result:\n${multilineResult}`);

    // Test 3: Simulate git commit with multiline message
    console.log('\n📝 Test 3: Simulate git commit with multiline message');
    const commitMessage = `chore: update package

This is a detailed commit message
with multiple lines to test
the PowerShell here-string functionality`;

    const escapedMessage = commitMessage.replace(/'/g, "''");
    const gitCommand = `echo @'
${escapedMessage}
'@`;
    
    const gitResult = shell.run(gitCommand);
    console.log(`Simulated git commit message:\n${gitResult}`);

    console.log('\n✅ All shell multiline tests completed successfully!');

  } catch (error) {
    console.error('❌ Shell multiline test failed:', error);
    process.exit(1);
  }
}

// Run tests
testShellMultiline().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
