import { HttpClient } from '../http/http-client.js';
import { logger } from '../logger.js';

/**
 * Result of AI-generated commit information
 */
export interface CommitGenerationResult {
  commit: string;
  branch: string;
  description: string;
  title: string;
}

/**
 * Represents a chunk of diff content with associated metadata.
 */
interface DiffChunk {
  /** The actual diff content for this chunk */
  content: string;
  /** Array of file paths included in this chunk */
  files: string[];
  /** Estimated token count for this chunk */
  tokenCount: number;
}

/**
 * Result from processing a single batch of diffs.
 */
interface BatchGenerationResult {
  /** Generated commit message */
  commit: string;
  /** Generated branch name */
  branch: string;
  /** Generated merge request description */
  description: string;
  /** Optional merge request title */
  title: string;
}

/**
 * OpenAI API service for generating commit message and branch name
 */
export class OpenAiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly http: HttpClient;

  /** Cache for storing detected context limits by model name */
  private static readonly contextLimitCache = new Map<string, number>();

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
    logger.info(`Initialized OpenAI service`, { apiUrl: this.apiUrl, model: this.model });
  }

  /**
   * Generate commit message, branch name and MR description.
   * Supports batch processing for large diffs that exceed context limits.
   * 
   * @param diff The git diff content to analyze
   * @param language Language code for generated content (default: 'en')
   * @returns Promise resolving to commit generation result
   */
  async generateCommitAndBranch(diff: string, language: string = 'en'): Promise<CommitGenerationResult> {
    try {
      // Input validation
      if (!diff || !diff.trim()) {
        throw new Error('Empty diff provided');
      }

      if (diff.length > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Diff too large (>10MB), please split into smaller changes');
      }

      // Validate diff format
      if (!this.isValidDiff(diff)) {
        logger.warn('Potentially invalid diff format detected, attempting to process anyway');

        // Try to detect if it's at least some kind of code change
        const hasCodePatterns = /^[+\-]/.test(diff) || diff.includes('@@') || diff.includes('diff');
        if (!hasCodePatterns) {
          logger.error('Input does not appear to be a valid diff or code change');
          throw new Error('Invalid input: expected git diff format');
        }
      }

      // Validate language parameter
      const validLanguages = ['en', 'zh-cn', 'zh-tw', 'zhcn', 'zhtw', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt', 'it'];
      if (language && !validLanguages.includes(language.toLowerCase())) {
        logger.warn(`Unsupported language '${language}', falling back to English`);
        language = 'en';
      }

      // Detect model context limit with adaptive strategy
      const contextLimit = await this.detectContextLimit();
      // Dynamically adjust reserved tokens based on model
      const RESERVED_TOKENS = this.calculateReservedTokens(contextLimit);
      const availableTokens = contextLimit - RESERVED_TOKENS;

      // Estimate token count for the diff
      const diffTokens = this.estimateTokenCount(diff);
      logger.info(`Estimated diff tokens: ${diffTokens}, available tokens: ${availableTokens}`);

      // Use direct processing for small diffs
      if (diffTokens <= availableTokens) {
        logger.debug('Using direct processing mode');
        return await this.generateDirectCommitAndBranch(diff, language);
      }

      // Use batch processing for large diffs
      logger.info('Large diff detected, starting batch processing');
      logger.warn(`Diff size (${diffTokens} tokens) exceeds context limit (${availableTokens} tokens), using batch processing`);

      // Split diff by files
      const fileDiffs = this.splitDiffByFiles(diff);

      if (fileDiffs.size === 0) {
        throw new Error('Failed to split diff, possibly invalid format');
      }

      // Group file diffs into appropriate batches
      const diffChunks = this.groupDiffsWithinLimit(fileDiffs, availableTokens);

      if (diffChunks.length === 0) {
        throw new Error('Failed to create appropriate diff batches');
      }

      logger.info(`Processing diff in ${diffChunks.length} batches`);

      // Process each batch
      const batchResults: BatchGenerationResult[] = [];

      for (let i = 0; i < diffChunks.length; i++) {
        const chunk = diffChunks[i];
        try {
          logger.info(`Processing batch ${i + 1}/${diffChunks.length} containing ${chunk.files.length} files`);
          const result = await this.generateBatchCommitAndBranch(chunk, language);
          batchResults.push(result);
        } catch (error) {
          logger.error(`Failed to process batch ${i + 1}:`, error);
          // Continue processing other batches
        }
      }

      if (batchResults.length === 0) {
        throw new Error('All batch processing failed');
      }

      if (batchResults.length < diffChunks.length) {
        logger.warn(`Only ${batchResults.length}/${diffChunks.length} batches processed successfully`);
      }

      // Merge batch results
      return await this.mergeBatchResults(batchResults, language);

    } catch (error) {
      logger.error('Failed to generate commit information:', error);
      throw error;
    }
  }

  /**
   * Process diff directly using original logic for small diffs.
   * 
   * @param diff The git diff content to analyze
   * @param language Language code for generated content
   * @returns Promise resolving to commit generation result
   */
  private async generateDirectCommitAndBranch(diff: string, language: string): Promise<CommitGenerationResult> {
    type OpenAiResp = { choices: { message: { content: string } }[] };

    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You are an expert Git commit analyzer. Your task is to analyze the provided git diff and generate accurate, professional commit information.

LANGUAGE REQUIREMENT: Generate all content in ${this.getLanguageName(language)} (${language}). For English, use standard technical terminology. For Chinese, use professional technical Chinese. For other languages, use appropriate professional terminology.

ANALYSIS INSTRUCTIONS:
1. Carefully examine the git diff to identify:
   - Exact files that were modified, added, or deleted
   - Specific code changes (functions, variables, imports, etc.)
   - The purpose and scope of the changes
   - Whether changes are features, fixes, documentation, styling, refactoring, tests, or maintenance

2. Base your analysis ONLY on what you can see in the diff - do not make assumptions about functionality not visible in the changes.

OUTPUT REQUIREMENTS:

1. COMMIT MESSAGE (${this.getLanguageName(language)}):
   - MUST follow conventional commits: type(scope): description
   - Types: feat, fix, docs, style, refactor, test, chore
   - Scope: optional, use file/module name if clear
   - Description: imperative mood, under 72 characters
   - Examples: "feat(auth): add user login validation", "fix(api): resolve null pointer exception"

2. BRANCH NAME (ALWAYS English):
   - EXACT format: type/short-description
   - Type: feat, fix, docs, style, refactor, test, chore
   - Description: 2-4 words, kebab-case, descriptive
   - Examples: feat/user-auth, fix/login-bug, docs/api-guide
   - NO deviations from this format

3. MR DESCRIPTION (${this.getLanguageName(language)}):
   Structure with these sections:
   ## What Changed
   - List specific changes made (based on diff analysis)
   
   ## Why
   - Explain the reason/purpose for these changes
   
   ## How to Test
   - Provide relevant testing instructions
   
   Use markdown formatting, be specific and factual.

4. MR TITLE (${this.getLanguageName(language)}):
   - Concise, descriptive title summarizing the change
   - Use appropriate prefixes for maintenance changes

CRITICAL OUTPUT FORMAT:
Return ONLY this JSON structure with no additional text, comments, or markdown wrappers:
{"commit":"<message>", "branch":"<type/description>", "description":"<detailed-description>", "title":"<title>"}

ACCURACY REQUIREMENTS:
- Base analysis strictly on visible diff content
- Do not invent or assume functionality not shown
- Use precise technical terminology
- Ensure commit type matches the actual changes
- Keep descriptions factual and specific`,
        },
        {
          role: "user",
          content: `Analyze this git diff and generate commit message, branch name, MR description and MR title:\n\n${diff}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent, accurate commit messages
    });
    logger.debug(`OpenAI direct processing request body size: ${body.length} characters`);
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
    logger.debug(`OpenAI direct processing response: ${rawContent}`);

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
      logger.error("Failed to parse AI response:", cleanContent);
      throw new Error(`Invalid JSON response from AI: ${error}`);
    }
  }

  /**
   * Detect the context length limit for the current model.
   * Supports various AI models including OpenAI, DeepSeek, Qwen, Kimi, Ollama, etc.
   * Also handles model variants with similar context limits.
   * 
   * @returns Promise resolving to the token limit for the model
   */
  private async detectContextLimit(): Promise<number> {
    // Return cached result if available
    if (OpenAiService.contextLimitCache.has(this.model)) {
      return OpenAiService.contextLimitCache.get(this.model)!;
    }

    try {
      const limit = this.getModelContextLimit(this.model);
      logger.debug(`Using context limit for model ${this.model}: ${limit} tokens`);

      // Cache the result
      OpenAiService.contextLimitCache.set(this.model, limit);
      return limit;
    } catch (error) {
      logger.warn(`Failed to detect context limit for model ${this.model}, attempting reverse detection:`, error);

      // Try reverse detection with progressively larger context sizes
      const reverseLimits = [1024 * 1024, 512 * 1024, 256 * 1024, 128 * 1024, 64 * 1024, 32 * 1024, 16 * 1024, 8 * 1024, 4 * 1024];
      for (const testLimit of reverseLimits) {
        try {
          const success = await this.testContextLimit(testLimit);
          if (success) {
            logger.info(`Reverse detection successful: model ${this.model} supports ${testLimit} tokens`);
            OpenAiService.contextLimitCache.set(this.model, testLimit);
            return testLimit;
          }
        } catch (testError) {
          logger.debug(`Context limit test failed for ${testLimit} tokens:`, testError);
          continue;
        }
      }

      // Fallback to a more reasonable default for modern models
      const FALLBACK_LIMIT = 8192; // More reasonable default for modern LLMs
      logger.warn(`Reverse detection failed, using fallback limit: ${FALLBACK_LIMIT}`);
      OpenAiService.contextLimitCache.set(this.model, FALLBACK_LIMIT);
      return FALLBACK_LIMIT;
    }
  }

  /**
   * Test if a model can handle a specific context limit by making a small API call.
   * 
   * @param contextLimit The context limit to test
   * @returns Promise resolving to true if the limit is supported
   */
  private async testContextLimit(contextLimit: number): Promise<boolean> {
    try {
      // Create a test prompt that approaches but doesn't exceed the limit
      const testTokens = Math.floor(contextLimit * 0.8); // Use 80% of limit for safety
      const testContent = 'x'.repeat(testTokens * 4); // Approximate 4 chars per token

      const body = JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Respond with 'OK'."
          },
          {
            role: "user",
            content: `Test message: ${testContent.substring(0, Math.min(testContent.length, 1000))}...` // Truncate for logging
          }
        ],
        max_tokens: 10, // Minimal response
        temperature: 0
      });

      const resp = await this.http.requestJson<{ choices: { message: { content: string } }[] }>(
        `${this.apiUrl}/chat/completions`,
        "POST",
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body
      );

      // If we get a response, the context limit is supported
      return resp.choices && resp.choices.length > 0;
    } catch (error: any) {
      // Check if error is context-related
      const errorMessage = error.message?.toLowerCase() || '';
      const isContextError = errorMessage.includes('context') ||
        errorMessage.includes('token') ||
        errorMessage.includes('length') ||
        errorMessage.includes('too long');

      if (isContextError) {
        logger.debug(`Context limit ${contextLimit} exceeded for model ${this.model}`);
        return false;
      }

      // Other errors might not be context-related, so we can't conclude
      throw error;
    }
  }

  /**
   * Get context limit for a specific model, including variant handling.
   * 
   * @param modelName The model name to check
   * @returns Token limit for the model
   */
  private getModelContextLimit(modelName: string): number {
    const DEFAULT_LIMIT = 4096;
    const modelLower = modelName.toLowerCase();

    // Exact model name matches
    const EXACT_LIMITS: Record<string, number> = {
      // OpenAI GPT models
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-3.5-turbo-0301': 4096,
      'gpt-3.5-turbo-0613': 4096,
      'gpt-3.5-turbo-1106': 16384,
      'gpt-3.5-turbo-0125': 16384,
      'gpt-4': 8192,
      'gpt-4-0314': 8192,
      'gpt-4-0613': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-32k-0314': 32768,
      'gpt-4-32k-0613': 32768,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-4-1106-preview': 128000,
      'gpt-4-0125-preview': 128000,
      'gpt-4o': 128000,
      'gpt-4o-2024-05-13': 128000,
      'gpt-4o-2024-08-06': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4o-mini-2024-07-18': 128000,

      // DeepSeek models
      'deepseek-coder': 16384,
      'deepseek-chat': 32768,
      'deepseek-v2': 128000,
      'deepseek-v2.5': 128000,
      'deepseek-v3': 128000,
      'deepseek-v3.1': 128000,
      'deepseekv3': 128000,
      'deepseekv31': 128000,
      'deepseek-coder-v2': 128000,

      // Qwen models
      'qwen-turbo': 8192,
      'qwen-plus': 32768,
      'qwen-max': 32768,
      'qwen2': 32768,
      'qwen2.5': 32768,
      'qwen3': 128000,
      'qwen3-coder': 128000,
      'qwen-coder-plus': 128000,
      'qwen-coder-turbo': 128000,

      // Kimi (Moonshot) models
      'moonshot-v1-8k': 8192,
      'moonshot-v1-32k': 32768,
      'moonshot-v1-128k': 128000,
      'kimi-chat': 128000,

      // Claude models
      'claude-3-haiku': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-opus': 200000,
      'claude-3-5-sonnet': 200000,
      'claude-3-5-haiku': 200000,

      // Gemini models
      'gemini-pro': 32768,
      'gemini-1.5-pro': 1048576, // 1M tokens
      'gemini-1.5-flash': 1048576,
      'gemini-ultra': 32768,

      // Yi models
      'yi-34b-chat': 4096,
      'yi-6b-chat': 4096,
      'yi-large': 32768,
      'yi-medium': 16384,

      // Baichuan models
      'baichuan2-turbo': 32768,
      'baichuan2-turbo-192k': 192000,

      // ChatGLM models
      'glm-4': 128000,
      'glm-4v': 128000,
      'glm-3-turbo': 128000,
      'chatglm3-6b': 8192,

      // Ollama common models (estimated based on model architecture)
      'llama2': 4096,
      'llama2:70b': 4096,
      'llama3': 8192,
      'llama3:70b': 8192,
      'llama3.1': 128000,
      'llama3.1:70b': 128000,
      'llama3.1:405b': 128000,
      'codellama': 16384,
      'codellama:34b': 16384,
      'mistral': 32768,
      'mixtral': 32768,
      'phi3': 128000,
      'gemma': 8192,
      'gemma2': 8192,
      'qwen2.5:72b': 32768,
    };

    // Check for exact match first
    if (EXACT_LIMITS[modelLower]) {
      return EXACT_LIMITS[modelLower];
    }

    // Pattern-based matching for variants and custom deployments
    const MODEL_PATTERNS: Array<{ pattern: RegExp, limit: number, description: string }> = [
      // DeepSeek variants
      { pattern: /^(x)?deepseek[-_]?v?3\.?1/i, limit: 128000, description: 'DeepSeek V3.1 variants' },
      { pattern: /^(x)?deepseek[-_]?v?3/i, limit: 128000, description: 'DeepSeek V3 variants' },
      { pattern: /^(x)?deepseek[-_]?v?2\.?5?/i, limit: 128000, description: 'DeepSeek V2/V2.5 variants' },
      { pattern: /^(x)?deepseek[-_]?coder/i, limit: 128000, description: 'DeepSeek Coder variants' },
      { pattern: /^(x)?deepseek/i, limit: 32768, description: 'Other DeepSeek variants' },

      // Qwen variants
      { pattern: /^qwen[-_]?3[-_]?coder/i, limit: 128000, description: 'Qwen3 Coder variants' },
      { pattern: /^qwen[-_]?3/i, limit: 128000, description: 'Qwen3 variants' },
      { pattern: /^qwen[-_]?2\.?5/i, limit: 32768, description: 'Qwen2.5 variants' },
      { pattern: /^qwen[-_]?2/i, limit: 32768, description: 'Qwen2 variants' },
      { pattern: /^qwen[-_]?(coder|plus)/i, limit: 128000, description: 'Qwen Coder/Plus variants' },
      { pattern: /^qwen[-_]?max/i, limit: 32768, description: 'Qwen Max variants' },
      { pattern: /^qwen/i, limit: 8192, description: 'Other Qwen variants' },

      // GPT variants and custom deployments
      { pattern: /^gpt[-_]?4o[-_]?mini/i, limit: 128000, description: 'GPT-4o mini variants' },
      { pattern: /^gpt[-_]?4o/i, limit: 128000, description: 'GPT-4o variants' },
      { pattern: /^gpt[-_]?4[-_]?turbo/i, limit: 128000, description: 'GPT-4 turbo variants' },
      { pattern: /^gpt[-_]?4[-_]?32k/i, limit: 32768, description: 'GPT-4 32K variants' },
      { pattern: /^gpt[-_]?4/i, limit: 8192, description: 'GPT-4 variants' },
      { pattern: /^gpt[-_]?3\.?5[-_]?turbo[-_]?16k/i, limit: 16384, description: 'GPT-3.5 turbo 16K variants' },
      { pattern: /^gpt[-_]?3\.?5/i, limit: 4096, description: 'GPT-3.5 variants' },

      // Claude variants
      { pattern: /^claude[-_]?3[-_]?5/i, limit: 200000, description: 'Claude 3.5 variants' },
      { pattern: /^claude[-_]?3/i, limit: 200000, description: 'Claude 3 variants' },

      // Gemini variants
      { pattern: /^gemini[-_]?1\.?5/i, limit: 1048576, description: 'Gemini 1.5 variants' },
      { pattern: /^gemini/i, limit: 32768, description: 'Other Gemini variants' },

      // Kimi/Moonshot variants
      { pattern: /^(kimi|moonshot)[-_]?.*128k/i, limit: 128000, description: 'Kimi/Moonshot 128K variants' },
      { pattern: /^(kimi|moonshot)[-_]?.*32k/i, limit: 32768, description: 'Kimi/Moonshot 32K variants' },
      { pattern: /^(kimi|moonshot)/i, limit: 128000, description: 'Other Kimi/Moonshot variants' },

      // LLaMA variants
      { pattern: /^llama[-_]?3\.?1/i, limit: 128000, description: 'LLaMA 3.1 variants' },
      { pattern: /^llama[-_]?3/i, limit: 8192, description: 'LLaMA 3 variants' },
      { pattern: /^llama[-_]?2/i, limit: 4096, description: 'LLaMA 2 variants' },
      { pattern: /^codellama/i, limit: 16384, description: 'CodeLlama variants' },

      // Other model families
      { pattern: /^mixtral/i, limit: 32768, description: 'Mixtral variants' },
      { pattern: /^mistral/i, limit: 32768, description: 'Mistral variants' },
      { pattern: /^phi[-_]?3/i, limit: 128000, description: 'Phi-3 variants' },
      { pattern: /^yi[-_]?large/i, limit: 32768, description: 'Yi Large variants' },
      { pattern: /^yi/i, limit: 4096, description: 'Other Yi variants' },
      { pattern: /^glm[-_]?4/i, limit: 128000, description: 'GLM-4 variants' },
      { pattern: /^chatglm/i, limit: 8192, description: 'ChatGLM variants' },
    ];

    // Try pattern matching
    for (const { pattern, limit, description } of MODEL_PATTERNS) {
      if (pattern.test(modelName)) {
        logger.debug(`Matched ${modelName} with pattern for ${description}, limit: ${limit}`);
        return limit;
      }
    }

    // Default fallback
    logger.debug(`No specific limit found for model ${modelName}, using default ${DEFAULT_LIMIT}`);
    return DEFAULT_LIMIT;
  }

  /**
   * Estimate token count for text using an improved approach that handles different character types.
   * 
   * @param text The text to estimate tokens for
   * @returns Estimated token count
   */
  private estimateTokenCount(text: string): number {
    if (!text) return 0;

    // More accurate token estimation considering different character types
    let tokenCount = 0;

    // Split text into different character categories for better estimation
    const latinChars = (text.match(/[a-zA-Z0-9\s.,;:!?'"()\[\]{}\-_+=<>\/\\|`~@#$%^&*]/g) || []).length;
    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
    const otherChars = text.length - latinChars - cjkChars;

    // Different token ratios for different character types
    // Latin characters: ~4 chars per token
    // CJK characters: ~1.5-2 chars per token (more token-dense)
    // Other characters: ~3 chars per token
    tokenCount += Math.ceil(latinChars / 4);
    tokenCount += Math.ceil(cjkChars / 1.8);
    tokenCount += Math.ceil(otherChars / 3);

    // Add some buffer for special tokens and formatting
    const bufferTokens = Math.ceil(tokenCount * 0.1);
    const finalTokenCount = tokenCount + bufferTokens;

    logger.debug(`Token estimation - Latin: ${latinChars} chars (${Math.ceil(latinChars / 4)} tokens), CJK: ${cjkChars} chars (${Math.ceil(cjkChars / 1.8)} tokens), Other: ${otherChars} chars (${Math.ceil(otherChars / 3)} tokens), Total: ${finalTokenCount} tokens`);

    return finalTokenCount;
  }

  /**
   * Split diff content by files using git diff headers.
   * 
   * @param diff Complete git diff content
   * @returns Map of file path to diff content
   */
  private splitDiffByFiles(diff: string): Map<string, string> {
    const fileDiffs = new Map<string, string>();

    if (!diff.trim()) {
      return fileDiffs;
    }

    // Regular expression to match git diff file headers
    const FILE_HEADER_PATTERN = /^diff --git a\/(.*?) b\/(.*?)$/gm;
    const matches = [...diff.matchAll(FILE_HEADER_PATTERN)];

    if (matches.length === 0) {
      // If no file headers found, might be single file diff or non-standard format
      fileDiffs.set('unknown', diff);
      logger.debug('No standard git diff file headers found, treating entire diff as single file');
      return fileDiffs;
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const filePath = match[1];
      const startIndex = match.index!;
      const endIndex = i < matches.length - 1 ? matches[i + 1].index! : diff.length;

      const fileDiff = diff.substring(startIndex, endIndex);
      fileDiffs.set(filePath, fileDiff);
    }

    logger.debug(`Successfully split diff into ${fileDiffs.size} files`);
    return fileDiffs;
  }

  /**
   * Split large file diff into smaller chunks by code blocks.
   * 
   * @param fileDiff Single file diff content
   * @param maxTokens Maximum tokens per chunk
   * @returns Array of split diff chunks
   */
  private splitLargeFileDiff(fileDiff: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    const lines = fileDiff.split('\n');
    let currentChunk = '';
    let currentTokens = 0;

    // Preserve file header information (first 4 lines typically contain file metadata)
    const HEADER_LINES = 4;
    const fileHeader = lines.slice(0, HEADER_LINES).join('\n');
    const headerTokens = this.estimateTokenCount(fileHeader);

    for (let i = HEADER_LINES; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = this.estimateTokenCount(line + '\n');

      if (currentTokens + lineTokens > maxTokens && currentChunk) {
        // Current chunk reached limit, start new chunk
        chunks.push(fileHeader + '\n' + currentChunk);
        currentChunk = line + '\n';
        currentTokens = headerTokens + lineTokens;
      } else {
        currentChunk += line + '\n';
        currentTokens += lineTokens;
      }
    }

    if (currentChunk) {
      chunks.push(fileHeader + '\n' + currentChunk);
    }

    logger.debug(`Large file diff split into ${chunks.length} code blocks`);
    return chunks;
  }

  /**
   * Group multiple small diffs into batches that don't exceed the token limit.
   * 
   * @param fileDiffs Map of file paths to diff content
   * @param maxTokens Maximum tokens per batch
   * @returns Array of diff chunks within token limits
   */
  private groupDiffsWithinLimit(fileDiffs: Map<string, string>, maxTokens: number): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    let currentChunk: DiffChunk = this.createEmptyDiffChunk();

    for (const [filePath, diff] of fileDiffs) {
      const diffTokens = this.estimateTokenCount(diff);

      // If single file exceeds limit, split it further
      if (diffTokens > maxTokens) {
        // Save current chunk if it has content
        if (currentChunk.content) {
          chunks.push(currentChunk);
        }

        // Split large file
        const splitChunks = this.splitLargeFileDiff(diff, maxTokens);
        for (const splitChunk of splitChunks) {
          chunks.push({
            content: splitChunk,
            files: [filePath],
            tokenCount: this.estimateTokenCount(splitChunk)
          });
        }

        // Start new current chunk
        currentChunk = this.createEmptyDiffChunk();
        continue;
      }

      // If adding current file would exceed limit, save current chunk first
      if (currentChunk.tokenCount + diffTokens > maxTokens && currentChunk.content) {
        chunks.push(currentChunk);
        currentChunk = this.createEmptyDiffChunk();
      }

      // Add to current chunk
      currentChunk.content += diff + '\n';
      currentChunk.files.push(filePath);
      currentChunk.tokenCount += diffTokens;
    }

    // Add final chunk if it has content
    if (currentChunk.content) {
      chunks.push(currentChunk);
    }

    logger.debug(`Diff grouping completed, ${chunks.length} batches created`);
    return chunks;
  }

  /**
   * Create an empty diff chunk with initialized properties.
   * 
   * @returns Empty diff chunk object
   */
  private createEmptyDiffChunk(): DiffChunk {
    return {
      content: '',
      files: [],
      tokenCount: 0
    };
  }

  /**
   * Generate commit information for a single diff chunk.
   * 
   * @param diffChunk Diff chunk content with metadata
   * @param language Language code for generated content
   * @returns Promise resolving to batch generation result
   */
  private async generateBatchCommitAndBranch(diffChunk: DiffChunk, language: string): Promise<BatchGenerationResult> {
    const MAX_DISPLAYED_FILES = 3;
    const filesInfo = diffChunk.files.length > 1
      ? `involving ${diffChunk.files.length} files: ${diffChunk.files.slice(0, MAX_DISPLAYED_FILES).join(', ')}${diffChunk.files.length > MAX_DISPLAYED_FILES ? ' etc.' : ''}`
      : `file: ${diffChunk.files[0] || 'unknown'}`;

    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You are an expert Git commit analyzer. Your task is to analyze this partial git diff and generate accurate commit information for the specific changes shown.

LANGUAGE REQUIREMENT: Generate all content in ${this.getLanguageName(language)} (${language}). For English, use standard technical terminology. For Chinese, use professional technical Chinese.

CONTEXT: This is a partial diff (${filesInfo}). Analyze ONLY the changes visible in this specific portion.

ANALYSIS INSTRUCTIONS:
1. Examine the provided diff section to identify:
   - Specific files and changes shown in this portion
   - Code modifications (functions, variables, imports, etc.)
   - The type and scope of changes visible
   - Whether changes represent features, fixes, documentation, styling, refactoring, tests, or maintenance

2. Focus ONLY on what is visible in this diff portion - do not make assumptions about the broader codebase.

OUTPUT REQUIREMENTS:

1. COMMIT MESSAGE (${this.getLanguageName(language)}):
   - Follow conventional commits: type(scope): description
   - Types: feat, fix, docs, style, refactor, test, chore
   - Scope: use file/module name from this diff portion
   - Description: imperative mood, under 72 characters, specific to these changes
   - Example: "feat(auth): add login validation logic"

2. BRANCH NAME (ALWAYS English):
   - EXACT format: type/short-description
   - Type: feat, fix, docs, style, refactor, test, chore
   - Description: 2-4 words, kebab-case, specific to these changes
   - Examples: feat/user-auth, fix/validation-bug, refactor/auth-logic

3. MR DESCRIPTION (${this.getLanguageName(language)}):
   Structure with these sections:
   ## What Changed
   - List specific changes visible in this diff portion
   
   ## Why
   - Explain the purpose based on the changes shown
   
   ## How to Test
   - Provide testing instructions relevant to these specific changes
   
   Be factual and specific to the visible changes.

4. MR TITLE (${this.getLanguageName(language)}):
   - Concise title summarizing the changes in this portion
   - Use appropriate technical terminology

CRITICAL OUTPUT FORMAT:
Return ONLY this JSON structure with no additional text:
{"commit":"<message>", "branch":"<type/description>", "description":"<detailed-description>", "title":"<title>"}

ACCURACY REQUIREMENTS:
- Analyze strictly based on visible diff content in this portion
- Do not invent functionality not shown in the diff
- Use precise technical terminology for the specific changes
- Ensure commit type accurately reflects the visible changes
- Keep descriptions factual and specific to this diff portion`,
        },
        {
          role: "user",
          content: `Analyze this git diff (${filesInfo}) and generate commit message, branch name, MR description and MR title:\n\n${diffChunk.content}`,
        },
      ],
      temperature: 0.1,
    });

    logger.debug(`Generating commit info for diff chunk containing ${diffChunk.files.length} files`);

    const resp = await this.http.requestJson<{ choices: { message: { content: string } }[] }>(
      `${this.apiUrl}/chat/completions`,
      "POST",
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body
    );

    const rawContent = resp.choices[0].message.content;
    logger.debug(`Batch AI response: ${rawContent}`);

    // Clean up response content
    let cleanContent = rawContent.trim();
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
        description: content.description || '',
        title: content.title
      };
    } catch (error) {
      logger.error(`Failed to parse batch AI response:`, cleanContent);
      throw new Error(`Invalid JSON response from AI in batch processing: ${error}`);
    }
  }

  /**
   * Merge results from multiple batch processing operations.
   * 
   * @param batchResults Array of batch generation results
   * @param language Language code for generated content
   * @returns Promise resolving to merged final result
   */
  private async mergeBatchResults(batchResults: BatchGenerationResult[], language: string): Promise<CommitGenerationResult> {
    if (batchResults.length === 1) {
      // If only one batch, return directly
      return {
        commit: batchResults[0].commit,
        branch: batchResults[0].branch,
        description: batchResults[0].description,
        title: batchResults[0].title
      };
    }

    // Multiple batches need merging
    logger.info(`Merging results from ${batchResults.length} batches`);

    // Prepare merge request prompt
    const summaryPrompt = `You are a Git commit message expert. I have multiple commit results for different file sections that need to be merged into a unified, global commit message, branch name, MR description and MR title.

Merging Rules:
1. Commit message: Select the most important change type and generate a unified conventional commit format message
2. Branch name: Choose the most significant change type and generate a comprehensive branch name (always in English)
3. MR Description: Merge all partial descriptions into a comprehensive MR description
4. MR Title: Merge all partial titles into a comprehensive MR title

Generate content in ${this.getLanguageName(language)} (${language}) language (except branch name must be in English).

Return format: {"commit":"<msg>", "branch":"<type/description>", "description":"<detailed-mr-description>", "title":"<mr-title>"}`;

    const batchSummaries = batchResults.map((result, index) =>
      `Batch ${index + 1}:
- Commit: ${result.commit}
- Branch: ${result.branch}
- MR Description: ${result.description}
- MR Title: ${result.title}`
    ).join('\n\n');

    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "system",
          content: summaryPrompt
        },
        {
          role: "user",
          content: `Please merge the following ${batchResults.length} partial results into a global commit message, branch name, MR description and MR title:

${batchSummaries}`,
        },
      ],
      temperature: 0.1,
    });

    const resp = await this.http.requestJson<{ choices: { message: { content: string } }[] }>(
      `${this.apiUrl}/chat/completions`,
      "POST",
      {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body
    );

    const rawContent = resp.choices[0].message.content;
    logger.debug(`Merge AI response: ${rawContent}`);

    // Clean up response content
    let cleanContent = rawContent.trim();
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
        description: content.description || '',
        title: content.title || ''
      };
    } catch (error) {
      logger.error(`Failed to parse merge AI response:`, cleanContent);
      // Fallback strategy: use first result as base and manually combine
      logger.warn('Using fallback strategy to merge results');

      const primaryResult = batchResults[0];
      const SEPARATOR = '\n\n---\n\n';
      const allDescriptions = batchResults
        .map(r => r.description)
        .filter(d => d)
        .join(SEPARATOR);

      return {
        commit: primaryResult.commit,
        branch: primaryResult.branch,
        description: allDescriptions || primaryResult.description,
        title: primaryResult.title
      };
    }
  }

  /**
   * Validate if the provided text is a valid git diff format.
   * 
   * @param diff The diff content to validate
   * @returns True if the diff appears to be valid
   */
  private isValidDiff(diff: string): boolean {
    if (!diff || !diff.trim()) {
      return false;
    }

    // Check for common git diff patterns
    const diffPatterns = [
      /^diff --git/m,           // Standard git diff header
      /^index [a-f0-9]+\.\.[a-f0-9]+/m,  // Index line
      /^@@.*@@/m,               // Hunk header
      /^[+\-]/m,                // Added/removed lines
      /^\+\+\+ b\//m,           // New file marker
      /^--- a\//m,              // Old file marker
    ];

    // At least one pattern should match for a valid diff
    return diffPatterns.some(pattern => pattern.test(diff));
  }

  /**
   * Calculate reserved tokens based on model context limit.
   * Reserves space for system prompt, response, and safety buffer.
   * 
   * @param contextLimit Total context limit for the model
   * @returns Number of tokens to reserve
   */
  private calculateReservedTokens(contextLimit: number): number {
    // Base system prompt tokens (estimated)
    const SYSTEM_PROMPT_TOKENS = 800;

    // Expected response tokens (commit + branch + description)
    const RESPONSE_TOKENS = 1000;

    // Safety buffer percentage based on context size
    let bufferPercentage: number;
    if (contextLimit >= 128000) {
      bufferPercentage = 0.05; // 5% for large context models
    } else if (contextLimit >= 32000) {
      bufferPercentage = 0.10; // 10% for medium context models
    } else if (contextLimit >= 8000) {
      bufferPercentage = 0.15; // 15% for smaller context models
    } else {
      bufferPercentage = 0.20; // 20% for very small context models
    }

    const bufferTokens = Math.ceil(contextLimit * bufferPercentage);
    const totalReserved = SYSTEM_PROMPT_TOKENS + RESPONSE_TOKENS + bufferTokens;

    logger.debug(`Reserved tokens calculation: system=${SYSTEM_PROMPT_TOKENS}, response=${RESPONSE_TOKENS}, buffer=${bufferTokens} (${(bufferPercentage * 100).toFixed(1)}%), total=${totalReserved}`);

    return totalReserved;
  }

  /**
   * Get language display name for prompt
   */
  private getLanguageName(language: string): string {
    if (!language) {
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
