import { HttpClient } from '../http/http-client.js';

/**
 * OpenAI API service for generating commit message and branch name
 */
export class OpenAiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly http: HttpClient;

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
  }

  /**
   * Generate commit message and branch name in English
   */
  async generateCommitAndBranch(diff: string): Promise<{ commit: string; branch: string }> {
    type OpenAiResp = { choices: { message: { content: string } }[] };

    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You are an expert Git commit analyzer. Analyze the git diff and generate appropriate commit message and branch name.

STRICT RULES:
1. Commit message: Follow conventional commits format (type(scope): description)
   - Types: feat, fix, docs, style, refactor, test, chore
   - Keep under 72 characters
   - Use imperative mood (e.g., "add", "fix", "update")
   
2. Branch name: MUST follow exact pattern "type/short-description"
   - REQUIRED format: {type}/{kebab-case-description}
   - Type MUST be one of: feat, fix, docs, style, refactor, test, chore
   - Description: 2-4 words maximum, separated by hyphens
   - Examples: feat/user-auth, fix/login-bug, docs/api-guide, refactor/code-cleanup
   - NO exceptions to this format
   - Branch name MUST start with one of the allowed types followed by slash.
   
3. Analyze the diff to understand:
   - What files are changed
   - What functionality is added/modified/removed
   - The scope/impact of changes

CRITICAL: Return ONLY valid JSON format: {"commit":"<msg>", "branch":"<type/description>"}, don't add any other text / comments or markdown and just return the JSON object`,
        },
        {
          role: "user",
          content: `Analyze this git diff and generate commit message and branch name:\n\n${diff}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent, accurate commit messages
    });

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
      return { commit: content.commit, branch: content.branch };
    } catch (error) {
      console.error("Failed to parse AI response:", cleanContent);
      throw new Error(`Invalid JSON response from AI: ${error}`);
    }
  }
}
