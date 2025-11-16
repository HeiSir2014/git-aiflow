import OpenAI from 'openai';
import { logger } from '../logger.js';

/**
 * Reasoning configuration options
 */
export interface ReasoningConfig {
  /** Enable reasoning with default parameters */
  enabled?: boolean;
  /** Reasoning effort level (OpenAI-style) */
  effort?: 'high' | 'medium' | 'low';
  /** Maximum reasoning tokens (Anthropic-style) */
  max_tokens?: number;
  /** Exclude reasoning tokens from response */
  exclude?: boolean;
}

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
 * Throughput statistics for API performance analysis
 */
export interface ThroughputStats {
  /** Request start timestamp in milliseconds */
  startTime: number;
  /** Request end timestamp in milliseconds */
  endTime: number;
  /** Total response time in milliseconds */
  responseTimeMs: number;
  /** Total response time in seconds */
  responseTimeSeconds: number;
  /** Number of prompt tokens */
  promptTokens: number;
  /** Number of completion tokens */
  completionTokens: number;
  /** Total number of tokens */
  totalTokens: number;
  /** Overall throughput in tokens per second */
  tokensPerSecond: number;
  /** Input throughput in prompt tokens per second */
  promptTokensPerSecond: number;
  /** Output throughput in completion tokens per second */
  completionTokensPerSecond: number;
  /** Time per token in milliseconds */
  millisecondsPerToken: number;
  /** Performance level assessment */
  performanceLevel: string;
  /** Time to first token (approximation) */
  ttftMs: number;
  /** Average time between tokens in milliseconds */
  avgTimeBetweenTokensMs: number;
  /** Output to input token ratio */
  outputInputRatio: number;
  /** Model name used for the request */
  model: string;
  /** Timestamp when stats were recorded */
  recordedAt: number;
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



// Using OpenAI SDK types directly, no need for custom interfaces

/**
 * OpenAI API service for generating commit message and branch name
 */
export class OpenAiService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly reasoning: boolean | ReasoningConfig;
  private readonly maxContextTokens: number;

  /** Cache for the latest throughput statistics */
  private lastThroughputStats: ThroughputStats | null = null;

  /** History of throughput statistics (limited to last 10 requests) */
  private throughputHistory: ThroughputStats[] = [];

  constructor(apiKey: string, apiUrl: string, model: string, reasoning: boolean | ReasoningConfig = false, maxContextTokens?: number) {
    this.model = model;
    this.reasoning = reasoning;
    this.maxContextTokens = maxContextTokens ?? 8192; // Default to 8K tokens if not specified
    
    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: apiUrl.endsWith('/chat/completions') 
        ? apiUrl.replace('/chat/completions', '') 
        : apiUrl.endsWith('/') 
          ? apiUrl.slice(0, -1) 
          : apiUrl
      ,
      maxRetries: 3,
      timeout: 300000,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/HeiSir2014/git-aiflow',
        'X-Title': 'Git-AIFlow',
      },
    });
    
    logger.info(`Initialized OpenAI service`, {
      baseURL: this.client.baseURL,
      model: this.model,
      maxContextTokens: this.maxContextTokens,
      reasoning: this.reasoning
    });
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

      // Use configured context limit
      const contextLimit = this.maxContextTokens;
      // Dynamically adjust reserved tokens based on model
      const RESERVED_TOKENS = this.calculateReservedTokens(contextLimit);
      const availableTokens = contextLimit - RESERVED_TOKENS;

      // Estimate token count for the diff
      const diffTokens = this.estimateTokenCount(diff);
      logger.info(`Estimated diff tokens: ${diffTokens}, available tokens: ${availableTokens}, context limit: ${contextLimit}`);

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
    const systemPrompt = this.buildSystemPrompt(language);
    const userPrompt = this.buildUserPrompt();

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      },
      {
        role: "user",
        content: diff
      }
    ];

    const rawContent = await this.sendOpenAiRequest(messages, true);
    const content = this.parseOpenAiResponse(rawContent, 'direct processing');

    return {
      commit: content.commit,
      branch: content.branch,
      description: content.description || '',
      title: content.title || (content.commit && content.commit.replace(/\r|\n/g, '').trim().substring(0, 50)) || ''
    } as CommitGenerationResult;
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

    const systemPrompt = this.buildSystemPrompt(language, filesInfo);
    const userPrompt = this.buildUserPrompt(filesInfo);

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      },
      {
        role: "user",
        content: diffChunk.content
      }
    ];

    logger.debug(`Generating commit info for diff chunk containing ${diffChunk.files.length} files`);

    const rawContent = await this.sendOpenAiRequest(messages, true);
    const content = this.parseOpenAiResponse(rawContent, 'batch processing');

    return {
      commit: content.commit,
      branch: content.branch,
      description: content.description || '',
      title: content.title
    };
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

Generate content in ${this.getLanguageName(language)} language (except branch name must be in English).

IMPORTANT: You MUST use the 'output_with_json' function tool to provide your merged results. Call the function with the four required parameters:
- commit: Your merged commit message
- branch: Your merged branch name (in English)
- description: Your merged MR description
- title: Your merged MR title

Do NOT provide JSON in text format - use the function tool only.`;

    const batchSummaries = batchResults.map((result, index) =>
      `# Batch ${index + 1}:
- Commit: \`${result.commit}\`
- Branch: \`${result.branch}\`
- MR Description: \`\`\`markdown\n${result.description}\n\`\`\`
- MR Title: \`${result.title}\``
    ).join('\n\n');

    const messages = [
      {
        role: "system",
        content: summaryPrompt
      },
      {
        role: "user",
        content: `Please merge the following ${batchResults.length} partial results into a global commit message, branch name, MR description and MR title using the 'output_with_json' function:

${batchSummaries}`,
      },
    ];

    const rawContent = await this.sendOpenAiRequest(messages, true);
    logger.debug(`Merge AI response: ${rawContent}`);

    try {
      const content = this.parseOpenAiResponse(rawContent, 'batch merge');
      return {
        commit: content.commit,
        branch: content.branch,
        description: content.description || '',
        title: content.title || ''
      };
    } catch (error) {
      logger.error(`Failed to parse merge AI response:`, rawContent);
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
    // System prompt tokens (increased for more complex prompts)
    const SYSTEM_PROMPT_TOKENS = 1200;

    // Expected response tokens (commit + branch + description + title)
    const RESPONSE_TOKENS = 1500;

    // Safety buffer percentage based on context size
    let bufferPercentage: number;
    if (contextLimit >= 128000) {
      bufferPercentage = 0.05; // 5% for large context models
    } else if (contextLimit >= 32000) {
      bufferPercentage = 0.08; // 8% for medium context models
    } else if (contextLimit >= 8000) {
      bufferPercentage = 0.12; // 12% for smaller context models
    } else {
      bufferPercentage = 0.15; // 15% for very small context models
    }

    const bufferTokens = Math.ceil(contextLimit * bufferPercentage);
    const totalReserved = SYSTEM_PROMPT_TOKENS + RESPONSE_TOKENS + bufferTokens;

    logger.debug(
      `Reserved tokens: system=${SYSTEM_PROMPT_TOKENS}, ` +
      `response=${RESPONSE_TOKENS}, ` +
      `buffer=${bufferTokens} (${(bufferPercentage * 100).toFixed(1)}%), ` +
      `total=${totalReserved} / ${contextLimit} (${((totalReserved / contextLimit) * 100).toFixed(1)}%)`
    );

    return totalReserved;
  }

  /**
   * Send request to OpenAI API with tool support
   * 
   * @param messages Array of messages for the API request
   * @param useTools Whether to include output_with_json tool (default: true)
   * @returns Promise resolving to the raw response content or parsed tool call result
   */
  private async sendOpenAiRequest(messages: Array<{ role: string, content: string }>, useTools: boolean = true): Promise<string> {
    const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.1
    };

    (requestParams as any).extra_body = {
      usage: {
        include: true,
      },
    };

    // Add reasoning support for compatible models (if supported by the API)
    if (this.reasoning) {
      const reasoningConfig = this.buildReasoningConfig();
      if (reasoningConfig) {
        (requestParams as any).reasoning = reasoningConfig;
        logger.debug(`Enabling reasoning mode for model: ${this.model}`, { config: reasoningConfig });
      }
    }

    // Add tools and tool_choice if requested
    if (useTools) {
      requestParams.tools = [{
        type: "function",
        function: {
          name: "output_with_json",
          description: "Output the analyzed Git commit information in structured JSON format",
          parameters: {
            type: "object",
            properties: {
              commit: {
                type: "string",
                description: "The generated commit message"
              },
              branch: {
                type: "string",
                description: "The generated branch name"
              },
              description: {
                type: "string",
                description: "The generated merge request description"
              },
              title: {
                type: "string",
                description: "The generated merge request title"
              }
            },
            required: ["commit", "branch", "description", "title"],
            additionalProperties: false
          }
        }
      }];
      requestParams.tool_choice = {
        type: "function",
        function: {
          name: "output_with_json"
        }
      };
    }

    logger.debug(`OpenAI request params:`, requestParams);

    // Record start time for throughput calculation
    const requestStartTime = Date.now();
    const response = await this.client.chat.completions.create(requestParams);
    const requestEndTime = Date.now();

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No valid response received from OpenAI API, response.choices is empty");
    }

    const message = response.choices[0].message;
    if (!message) {
      throw new Error("No valid response received from OpenAI API, message is empty");
    }

    const finishReason = response.choices[0].finish_reason;
    logger.debug(`OpenAI response finish reason: ${finishReason && finishReason.toUpperCase() || '<none>'}`);
    logger.info(`OpenAI response usage:`, response.usage);
    logger.debug(`OpenAI response message:`, message);

    // Calculate and log throughput statistics
    this.logThroughputStats(response.usage, requestStartTime, requestEndTime);
    
    // Check if response contains tool calls (preferred method)
    if (message.tool_calls && message.tool_calls.length > 0) {
      if (message.content && message.content.trim() !== '') {
        logger.warn(`OpenAI tool call response: content is not empty, content: ${message.content}`);
      }
      const toolCall = message.tool_calls[0];
      if (toolCall.type === 'function' && toolCall.function) {
        if (toolCall.function.name === "output_with_json") {
          logger.debug(`OpenAI tool call response: ${toolCall.function.arguments}`);
          return toolCall.function.arguments;
        }
        else {
          logger.warn(`OpenAI tool call response: function: ${toolCall.function.name} is not supported, arguments: ${toolCall.function.arguments}`);
        }
      }
    }

    // Fallback to content for models that don't support tool_choice
    const rawContent = message.content;
    if (rawContent) {
      logger.debug(`OpenAI content response: ${rawContent}`);
      return rawContent;
    }

    throw new Error("No valid response received from OpenAI API");
  }

  /**
   * Clean and parse OpenAI response content
   * 
   * @param rawContent Raw response content from OpenAI (could be tool call arguments or regular content)
   * @param errorContext Context string for error logging
   * @returns Parsed JSON object
   */
  private parseOpenAiResponse(rawContent: string, errorContext: string): any {
    // First, try to parse as-is (for tool call arguments which are already JSON)
    try {
      const parsed = JSON.parse(rawContent);
      // Validate that it has the expected structure
      if (parsed && typeof parsed === 'object' &&
        'commit' in parsed && 'branch' in parsed &&
        'description' in parsed && 'title' in parsed) {
        logger.debug(`commit = ${parsed.commit}\n\nbranch = ${parsed.branch}\n\ndescription = ${parsed.description}\n\ntitle = ${parsed.title}`);
        if (parsed.description) {
          parsed.description = parsed.description.replace(/\\n/g, '\n').trim();
        }
        if (parsed.title) {
          parsed.title = parsed.title.replace(/\\n/g, '\n').trim();
        }
        logger.debug(`Successfully parsed tool call response in ${errorContext}`);
        return parsed;
      }
    } catch (error) {
      // If direct parsing fails, continue to traditional cleaning approach
      logger.debug(`Direct JSON parsing failed in ${errorContext}, trying traditional approach`);
    }

    // Traditional approach: clean up the response - remove markdown code blocks if present
    let cleanContent = rawContent.trim();

    // Remove all <think> and </think> markers (handles multiple patterns and nested content)
    cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // Remove ```json and ``` markers if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleanContent);
      if (parsed.description) {
        parsed.description = parsed.description.replace(/\\n/g, '\n').trim();
      }
      if (parsed.title) {
        parsed.title = parsed.title.replace(/\\n/g, '\n').trim();
      }
      logger.debug(`Successfully parsed traditional JSON response in ${errorContext}`);
      return parsed;
    } catch (error) {
      logger.error(`Failed to parse ${errorContext} AI response:`, rawContent);
      throw new Error(`Invalid JSON response from AI in ${errorContext}: ${error}`);
    }
  }

  /**
   * Build system prompt for commit analysis
   * 
   * @param language Target language for generated content
   * @param contextInfo Optional context information for partial diffs
   * @returns System prompt string
   */
  private buildSystemPrompt(language: string, contextInfo?: string): string {
    const languageName = this.getLanguageName(language);
    const contextSection = contextInfo
      ? `CONTEXT: This is a partial diff (${contextInfo}). Analyze ONLY the changes visible in this specific portion.\n\n`
      : '';

    return `You are an expert Git commit analyzer. Your task is to analyze the provided git diff and generate accurate, professional commit information.

LANGUAGE REQUIREMENT: Generate all content in \`${languageName}\`. For English, use standard technical terminology. For Chinese, use professional technical Chinese. For other languages, use appropriate professional terminology.

${contextSection}
ANALYSIS INSTRUCTIONS:
1. Carefully examine the git diff to identify:
   - Exact files that were modified, added, or deleted
   - Specific code changes (functions, variables, imports, etc.)
   - The purpose and scope of the changes
   - Whether changes are features, fixes, documentation, styling, refactoring, tests, or maintenance

2. Base your analysis ONLY on what you can see in the diff:
   - Do not invent or assume functionality not shown
   - Use precise technical terminology
   - Ensure commit type matches the actual changes
   - Keep descriptions factual and specific

OUTPUT REQUIREMENTS:

1. COMMIT MESSAGE (generate in ${languageName}):
   - MUST follow conventional commits: type(scope): description
   - Types: feat, fix, docs, style, refactor, test, chore
   - Scope: optional, use file/module name if clear
   - Description: imperative mood, under 72 characters
   - Examples: "feat(auth): add user login validation", "fix(api): resolve null pointer exception"

2. BRANCH NAME (ALWAYS English, generate in English):
   - EXACT format: type/short-description
   - Type: feat, fix, docs, style, refactor, test, chore
   - Description: 2-4 words, kebab-case, descriptive
   - Examples: feat/user-auth, fix/login-bug, docs/api-guide
   - NO deviations from this format

3. MR DESCRIPTION (generate in ${languageName}):
   Structure with these sections:
   ## What Changed
   - List specific changes made (based on diff analysis)

   ## Why
   - Explain the reason/purpose for these changes

   ## How to Test
   - Provide relevant testing instructions

  Use markdown formatting, be specific and factual.
   **IMPORTANT:** 
   - The section headings (e.g., 'What Changed', 'Why', 'How to Test') MUST also be translated and output in ${languageName}, not just the content under them.
   - Output MR DESCRIPTION in proper Markdown format, using natural line breaks and paragraphs. Do not escape any characters like newlines (\\n).​
   **EXAMPLE FOR CHINESE (Simplified):** 
   - Use '## 变更内容' instead of '## What Changed'
   - Use '## 变更原因' instead of '## Why'
   - Use '## 测试方法' instead of '## How to Test'

4. MR TITLE (generate in ${languageName}):
   - Concise, descriptive title summarizing the change
   - Use appropriate prefixes for maintenance changes

CRITICAL OUTPUT FORMAT - READ CAREFULLY:
You MUST use the 'output_with_json' function tool to provide your response. This tool is specifically designed for structured output.

FUNCTION TOOL USAGE:
Call the 'output_with_json' function with these exact parameters:
- commit: Your generated commit message (string)
- branch: Your generated branch name (string)
- description: Your generated MR description (string)  
- title: Your generated MR title (string)

IMPORTANT NOTES:
- Always use the function tool \`output_with_json\` when system tool_call is available
- Do NOT provide JSON in text format - use the function tool only
- Do NOT include any other text or explanations
- The function tool \`output_with_json\` ensures proper structured output

FALLBACK FOR MODELS WITHOUT TOOL SUPPORT:
If function tools are not supported, return ONLY a valid JSON object with EXACTLY these 4 fields:
{
  "commit": "<COMMIT MESSAGE>",
  "branch": "<BRANCH NAME>", 
  "description": "<MR DESCRIPTION>",
  "title": "<MR TITLE>"
}

NO other text, explanations, or formatting allowed in fallback mode.`;
  }

  /**
   * Build user prompt for commit analysis
   * 
   * @param contextInfo Optional context information for partial diffs
   * @returns User prompt string
   */
  private buildUserPrompt(contextInfo?: string): string {
    const contextDescription = contextInfo
      ? `This is a partial diff (${contextInfo}). Focus your analysis on the changes visible in this specific portion.`
      : 'This is the complete git diff for analysis.';

    return `${contextDescription}

TASK: Analyze the git diff provided in the next message and generate comprehensive commit information.

ANALYSIS REQUIREMENTS:
- Examine all file changes, additions, and deletions
- Identify the primary purpose and scope of changes
- Determine the appropriate conventional commit type
- Consider the impact and context of modifications

OUTPUT REQUIREMENTS:
- Use the 'output_with_json' function to provide structured results
- Ensure all generated content follows the language requirements specified in the system prompt
- Generate professional, accurate, and concise information

The raw git diff output will be provided in the next user message.`;
  }

  /**
   * Build reasoning configuration based on the reasoning parameter
   * @returns Reasoning configuration object or null
   */
  private buildReasoningConfig(): any {
    if (!this.reasoning) {
      return null;
    }

    // If reasoning is just a boolean (legacy mode)
    if (typeof this.reasoning === 'boolean') {
      return { enabled: true };
    }

    // Build configuration object
    const config: any = {};

    // Handle enabled flag
    if (this.reasoning.enabled !== undefined) {
      config.enabled = this.reasoning.enabled;
    }

    // Handle effort level (OpenAI-style)
    if (this.reasoning.effort) {
      config.effort = this.reasoning.effort;
    }

    // Handle max_tokens (Anthropic-style)
    if (this.reasoning.max_tokens) {
      config.max_tokens = this.reasoning.max_tokens;
    }

    // Handle exclude flag
    if (this.reasoning.exclude !== undefined) {
      config.exclude = this.reasoning.exclude;
    }

    // If no specific configuration is provided, enable with defaults
    if (Object.keys(config).length === 0) {
      config.enabled = true;
    }

    return config;
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

  /**
   * Calculate and log throughput statistics, also cache the data
   * @param usage OpenAI API usage statistics
   * @param startTime Request start time in milliseconds
   * @param endTime Request end time in milliseconds
   */
  private logThroughputStats(
    usage: any, 
    startTime: number, 
    endTime: number
  ): void {
    if (!usage) {
      logger.warn('No usage statistics available for throughput calculation');
      return;
    }

    const totalTime = endTime - startTime; // Total time in milliseconds
    const totalTimeSeconds = totalTime / 1000; // Total time in seconds

    // Extract token counts
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    // Calculate throughput rates
    const tokensPerSecond = totalTimeSeconds > 0 ? (totalTokens / totalTimeSeconds) : 0;
    const promptTokensPerSecond = totalTimeSeconds > 0 ? (promptTokens / totalTimeSeconds) : 0;
    const completionTokensPerSecond = totalTimeSeconds > 0 ? (completionTokens / totalTimeSeconds) : 0;

    // Calculate time per token
    const millisecondsPerToken = totalTokens > 0 ? (totalTime / totalTokens) : 0;

    // Performance assessment
    let performanceLevel = '';
    if (tokensPerSecond >= 50) {
      performanceLevel = '🏆 Excellent (≥50 tokens/sec)';
    } else if (tokensPerSecond >= 20) {
      performanceLevel = '✅ Good (20-49 tokens/sec)';
    } else if (tokensPerSecond >= 10) {
      performanceLevel = '⚠️  Average (10-19 tokens/sec)';
    } else if (tokensPerSecond >= 5) {
      performanceLevel = '🐌 Slow (5-9 tokens/sec)';
    } else {
      performanceLevel = '🚨 Very Slow (<5 tokens/sec)';
    }

    // Calculate additional metrics
    const ttftMs = totalTime; // Time to First Token approximation
    const avgTimeBetweenTokensMs = completionTokens > 1 ? (totalTime / completionTokens) : 0;
    const outputInputRatio = promptTokens > 0 ? (completionTokens / promptTokens) : 0;

    // Create throughput stats object
    const stats: ThroughputStats = {
      startTime,
      endTime,
      responseTimeMs: totalTime,
      responseTimeSeconds: totalTimeSeconds,
      promptTokens,
      completionTokens,
      totalTokens,
      tokensPerSecond,
      promptTokensPerSecond,
      completionTokensPerSecond,
      millisecondsPerToken,
      performanceLevel,
      ttftMs,
      avgTimeBetweenTokensMs,
      outputInputRatio,
      model: this.model,
      recordedAt: Date.now()
    };

    // Cache the stats
    this.lastThroughputStats = stats;
    
    // Add to history (keep only last 10 entries)
    this.throughputHistory.push(stats);
    if (this.throughputHistory.length > 10) {
      this.throughputHistory.shift();
    }

    // Log comprehensive throughput statistics
    logger.info('📊 API Throughput Statistics:');
    logger.info(`   ⏱️  Response Time: ${totalTime}ms (${totalTimeSeconds.toFixed(2)}s)`);
    logger.info(`   📝 Token Usage: ${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} total`);
    logger.info(`   🚀 Overall Throughput: ${tokensPerSecond.toFixed(2)} tokens/sec`);
    logger.info(`   📥 Input Throughput: ${promptTokensPerSecond.toFixed(2)} prompt tokens/sec`);
    logger.info(`   📤 Output Throughput: ${completionTokensPerSecond.toFixed(2)} completion tokens/sec`);
    logger.info(`   ⚡ Time per Token: ${millisecondsPerToken.toFixed(2)}ms/token`);
    logger.info(`   📈 Performance Level: ${performanceLevel}`);

    // Additional metrics for analysis
    if (completionTokens > 0) {
      logger.info(`   🎯 TTFT (approx): ${ttftMs}ms`);
      
      if (completionTokens > 1) {
        logger.info(`   🔄 TBT (avg): ${avgTimeBetweenTokensMs.toFixed(2)}ms/token`);
      }
    }

    // Log efficiency ratios
    if (promptTokens > 0 && completionTokens > 0) {
      logger.info(`   📊 Output/Input Ratio: ${outputInputRatio.toFixed(2)} (${completionTokens}/${promptTokens})`);
    }
  }

  /**
   * Get the latest throughput statistics from the most recent API call
   * @returns The latest throughput stats or null if no calls have been made
   */
  public getLastThroughputStats(): ThroughputStats | null {
    return this.lastThroughputStats;
  }

  /**
   * Get throughput statistics history (up to last 10 requests)
   * @returns Array of throughput statistics, ordered from oldest to newest
   */
  public getThroughputHistory(): ThroughputStats[] {
    return [...this.throughputHistory]; // Return a copy to prevent external modification
  }

  /**
   * Get aggregated throughput statistics from history
   * @returns Aggregated statistics or null if no history exists
   */
  public getAggregatedThroughputStats(): {
    totalRequests: number;
    averageResponseTime: number;
    averageThroughput: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    bestPerformance: ThroughputStats | null;
    worstPerformance: ThroughputStats | null;
    performanceTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  } | null {
    if (this.throughputHistory.length === 0) {
      return null;
    }

    const history = this.throughputHistory;
    const totalRequests = history.length;
    
    // Calculate averages
    const averageResponseTime = history.reduce((sum, stats) => sum + stats.responseTimeMs, 0) / totalRequests;
    const averageThroughput = history.reduce((sum, stats) => sum + stats.tokensPerSecond, 0) / totalRequests;
    const totalTokens = history.reduce((sum, stats) => sum + stats.totalTokens, 0);
    const totalPromptTokens = history.reduce((sum, stats) => sum + stats.promptTokens, 0);
    const totalCompletionTokens = history.reduce((sum, stats) => sum + stats.completionTokens, 0);

    // Find best and worst performance
    const bestPerformance = history.reduce((best, current) => 
      current.tokensPerSecond > best.tokensPerSecond ? current : best
    );
    const worstPerformance = history.reduce((worst, current) => 
      current.tokensPerSecond < worst.tokensPerSecond ? current : worst
    );

    // Determine performance trend (compare first half with second half)
    let performanceTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data' = 'insufficient_data';
    if (totalRequests >= 4) {
      const midpoint = Math.floor(totalRequests / 2);
      const firstHalfAvg = history.slice(0, midpoint)
        .reduce((sum, stats) => sum + stats.tokensPerSecond, 0) / midpoint;
      const secondHalfAvg = history.slice(midpoint)
        .reduce((sum, stats) => sum + stats.tokensPerSecond, 0) / (totalRequests - midpoint);
      
      const improvementThreshold = 0.05; // 5% threshold
      const relativeChange = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      
      if (relativeChange > improvementThreshold) {
        performanceTrend = 'improving';
      } else if (relativeChange < -improvementThreshold) {
        performanceTrend = 'declining';
      } else {
        performanceTrend = 'stable';
      }
    }

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      averageThroughput: Math.round(averageThroughput * 100) / 100,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      bestPerformance,
      worstPerformance,
      performanceTrend
    };
  }

  /**
   * Clear throughput statistics history and cache
   */
  public clearThroughputStats(): void {
    this.lastThroughputStats = null;
    this.throughputHistory = [];
  }
}
