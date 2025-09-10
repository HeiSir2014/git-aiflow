import { HttpClient } from '../http/http-client.js';
import { createLogger } from '../logger.js';

/**
 * Result of AI-generated commit information
 */
export interface CommitGenerationResult {
  commit: string;
  branch: string;
  description: string;
}

/**
 * OpenAI API service for generating commit message and branch name
 */
export class OpenAiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly http: HttpClient;
  private readonly logger = createLogger('OpenAiService');

  constructor(apiKey: string, apiUrl: string, model: string, http?: HttpClient) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.model = model;
    this.http = http || new HttpClient();
    // trim /v1 or /
    if (apiUrl.endsWith('/')) {
      this.apiUrl = apiUrl.slice(0, -1);
    }
    if (apiUrl.endsWith('/chat/completions')) { // trim /v1
      this.apiUrl = apiUrl.slice(0, -10);
    }
    this.logger.info(`Initialized OpenAI service`, { apiUrl: this.apiUrl, model: this.model });
  }

  /**
   * Generate commit message, branch name and MR description
   */
  async generateCommitAndBranch(diff: string, language: string = 'en'): Promise<CommitGenerationResult> {
    type OpenAiResp = { choices: { message: { content: string } }[] };

    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You are an expert Git commit analyzer. Analyze the git diff and generate appropriate commit message, branch name, and merge request description.

LANGUAGE: Generate all content in ${this.getLanguageName(language)} (${language}). For English, use standard technical terminology. For Chinese, use professional technical Chinese. For other languages, use appropriate professional terminology.

STRICT RULES:
1. Commit message: Follow conventional commits format (type(scope): description)
   - Types: feat, fix, docs, style, refactor, test, chore
   - Keep under 72 characters
   - Use imperative mood (e.g., "add", "fix", "update")
   - Write in specified language
   
2. Branch name: MUST follow exact pattern "type/short-description" (ALWAYS in English)
   - REQUIRED format: {type}/{kebab-case-description}
   - Type MUST be one of: feat, fix, docs, style, refactor, test, chore
   - Description: 2-4 words maximum, separated by hyphens
   - Examples: feat/user-auth, fix/login-bug, docs/api-guide, refactor/code-cleanup
   - NO exceptions to this format
   - Branch name MUST always be in English regardless of language setting
   
3. MR Description: Generate detailed merge request description in specified language
   - Include "## What Changed" section describing modifications
   - Include "## Why" section explaining the reason for changes
   - Include "## How to Test" section with testing instructions
   - Use appropriate formatting with markdown
   - Be comprehensive but concise
   - Write in specified language
   
4. Analyze the diff to understand:
   - What files are changed
   - What functionality is added/modified/removed
   - The scope/impact of changes
   - Testing considerations

CRITICAL: Return ONLY valid JSON format: {"commit":"<msg>", "branch":"<type/description>", "description":"<detailed-mr-description>"}, don't add any other text / comments or markdown wrapper and just return the JSON object`,
        },
        {
          role: "user",
          content: `Analyze this git diff and generate commit message, branch name, and MR description:\n\n${diff}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent, accurate commit messages
    });
    this.logger.debug(`OpenAI request body: ${body}`);
    const resp = await this.http.requestJson<OpenAiResp>(
      `${this.apiUrl}/chat/completions`,
      "POST",
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body
    );
    const rawContent = resp.choices[0].message.content;
    this.logger.debug(`OpenAI response: ${rawContent}`);

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
      return { 
        commit: content.commit, 
        branch: content.branch, 
        description: content.description || '' 
      } as CommitGenerationResult;
    } catch (error) {
      this.logger.error("Failed to parse AI response:", cleanContent);
      throw new Error(`Invalid JSON response from AI: ${error}`);
    }
  }

  /**
   * Get language display name for prompt
   */
  private getLanguageName(language: string): string {
    if(!language) {
      return 'English';
    }
    language = language.toLowerCase();
    const languageMap: Record<string, string> = {
      'en': 'English',
      'zh-cn': 'Chinese (Simplified)',
      'zh-tw': 'Chinese (Traditional)',
      'zhcn': 'Chinese (Simplified)',
      'zhtw': 'Chinese (Traditional)',
      'ja': 'Japanese',
      'ko': 'Korean',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'ru': 'Russian',
      'pt': 'Portuguese',
      'it': 'Italian'
    };
    
    return languageMap[language] || 'English';
  }
}
