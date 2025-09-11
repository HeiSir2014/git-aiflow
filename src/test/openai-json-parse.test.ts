#!/usr/bin/env node

/**
 * Test OpenAI JSON parsing functionality
 */
function testJsonParsing(): void {
  console.log('🧪 OpenAI JSON Parsing Test');
  console.log('🎯 Testing different response formats...\n');

  // Test cases for different AI response formats
  const testCases = [
    {
      name: "Clean JSON",
      input: '{"commit":"feat: add new feature","branch":"feat/new-feature"}',
      expected: {commit: "feat: add new feature", branch: "feat/new-feature"}
    },
    {
      name: "JSON with markdown blocks",
      input: '```json\n{"commit":"fix: resolve bug","branch":"fix/resolve-bug"}\n```',
      expected: {commit: "fix: resolve bug", branch: "fix/resolve-bug"}
    },
    {
      name: "JSON with generic markdown blocks",
      input: '```\n{"commit":"docs: update readme","branch":"docs/update-readme"}\n```',
      expected: {commit: "docs: update readme", branch: "docs/update-readme"}
    },
    {
      name: "JSON with extra whitespace",
      input: '  \n```json\n  {"commit":"chore: cleanup code","branch":"chore/cleanup-code"}  \n```  \n',
      expected: {commit: "chore: cleanup code", branch: "chore/cleanup-code"}
    }
  ];

  // Simulate the parsing logic from OpenAI service
  function parseAIResponse(rawContent: string): {commit: string; branch: string} {
    console.debug("Raw AI response:", rawContent);
    
    // Clean up the response - remove markdown code blocks if present
    let cleanContent = rawContent.trim();
    
    // Remove ```json and ``` markers if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    try {
      const content = JSON.parse(cleanContent);
      return {commit: content.commit, branch: content.branch};
    } catch (error) {
      console.error("Failed to parse AI response:", cleanContent);
      throw new Error(`Invalid JSON response from AI: ${error}`);
    }
  }

  // Run tests
  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    try {
      console.log(`🔍 Testing: ${testCase.name}`);
      console.log(`   Input: ${JSON.stringify(testCase.input)}`);
      
      const result = parseAIResponse(testCase.input);
      
      const passed = result.commit === testCase.expected.commit && 
                    result.branch === testCase.expected.branch;
      
      if (passed) {
        console.log(`   ✅ PASS: ${JSON.stringify(result)}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error}`);
    }
    console.log();
  }

  // Summary
  console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log(`🎉 All tests passed! JSON parsing is working correctly.`);
  } else {
    console.log(`❌ Some tests failed. Please check the parsing logic.`);
    process.exit(1);
  }
}

// Execute test only if this file is run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  testJsonParsing();
}
