# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

git-aiflow is an AI-powered workflow automation CLI tool for Git-based development. It consists of two main commands:
- `aiflow` - General Git merge/pull request automation with AI-generated commits
- `aiflow-conan` - Specialized tool for Conan C++ package version updates

The project is built with TypeScript using ES modules and targets Node.js >= 22.0.0.

## Key Commands

### Build & Development
```bash
npm run build              # Compile TypeScript to dist/
npm run dev               # Run aiflow in watch mode
npm run dev-conan         # Run aiflow-conan in watch mode
npm run clean             # Remove dist/ directory
```

### Running Tests
Individual test files must be run directly with ts-node:
```bash
npm run test:config                  # Configuration loading tests
npm run test:git-all                 # All Git service tests
npm run test:git-new-methods         # Git service new methods
npm run test:git-base-branch         # Base branch detection
npm run test:git-branch-ops          # Branch operations
npm run test:git-branch-graph        # Branch graph analysis
npm run test:conan                   # Conan service tests
npm run test:openai-parse            # OpenAI JSON parsing
npm run test:shell-multiline         # Shell multiline tests
```

**Note**: There is no unified test runner like `npm test` - use specific test scripts above.

### Debugging
```bash
npm run aiflow:debug           # Run aiflow with Node debugger on port 9229
npm run aiflow:debug-brk       # Run with breakpoint on start
npm run aiflow-conan:debug     # Run aiflow-conan with debugger on port 9230
npm run aiflow-conan:debug-brk # Run with breakpoint on start
```

### Running the Tools
```bash
npm run aiflow             # Run the main aiflow tool
npm run aiflow-conan       # Run the conan package updater
```

## Architecture

### Service Layer Pattern

The codebase follows a service-oriented architecture with clear separation of concerns:

**Git Platform Abstraction** (`src/services/git-platform-service.ts`):
- Abstract base class `GitPlatformService` defines the contract for all Git platforms
- `GitPlatformServiceFactory` automatically detects the Git platform (GitLab/GitHub) by:
  1. Parsing the Git remote URL hostname
  2. Probing API endpoints (`/api/v4/version` for GitLab, `/api/v3` for GitHub)
  3. Creating the appropriate platform-specific service
- Concrete implementations:
  - `GitlabPlatformService` - GitLab API integration
  - `GithubPlatformService` - GitHub API integration

**Core Services**:
- `GitService` (singleton) - Git operations via shell commands, including:
  - Remote URL parsing (SSH/HTTP formats)
  - Base branch detection (main > master > develop priority)
  - Branch operations and status checking
  - Base URL extraction with automatic protocol detection
- `OpenAiService` - AI-powered commit message and branch name generation with:
  - Diff chunking for large changesets (max 16K tokens per chunk)
  - Support for OpenAI reasoning models (o1, o3 series)
  - Structured JSON output parsing
  - Multi-language generation support
- `ConanService` - Conan package registry API client
- `WecomNotifier` - Enterprise WeChat webhook notifications
- `HttpClient` - Centralized HTTP operations with logging

**Configuration System** (`src/config.ts`):
- Multi-layered config priority: CLI args > local file (`.aiflow/config.yaml`) > global file (`~/.config/aiflow/config.yaml` or `%APPDATA%/aiflow/config.yaml`) > environment variables
- `ConfigLoader` class handles merging and validation
- Interactive config initialization via `aiflow init` and `aiflow init --global`
- Git access tokens are stored per-hostname in `git_access_tokens` map

**Application Classes** (`src/aiflow-app.ts`, `src/aiflow-conan-app.ts`):
- `BaseAiflowApp` - Abstract base with common workflow logic
  - Service initialization
  - Interactive file selection UI
  - Configuration validation
- `AiflowApp` - General merge request automation
- `AiflowConanApp` - Conan package update automation

### Key Design Patterns

1. **Singleton Pattern**: `GitService` and `Shell` use singleton pattern to maintain consistent state
2. **Factory Pattern**: `GitPlatformServiceFactory` creates appropriate platform services
3. **Template Method**: `BaseAiflowApp` defines workflow template, subclasses implement specifics
4. **Strategy Pattern**: Platform-specific services implement common interface differently

### File Structure Conventions

```
src/
├── services/           # Business logic services (Git, OpenAI, Conan, etc.)
├── http/              # HTTP client utilities
├── utils/             # Helper utilities (string, color, update checker, etc.)
├── test/              # Test files (*.test.ts)
├── config.ts          # Configuration management
├── logger.ts          # Winston-based logging system
├── shell.ts           # Shell command execution wrapper
├── aiflow-app.ts      # Main aiflow application
└── aiflow-conan-app.ts # Conan-specific application
```

## Configuration & Environment

**Configuration Files**:
- Local: `.aiflow/config.yaml` (project-specific)
- Global: `~/.config/aiflow/config.yaml` (macOS/Linux) or `%APPDATA%/aiflow/config.yaml` (Windows)
- Example: `config.example.yaml` at project root

**Important Configuration Options**:
- `openai.max_context_tokens` (optional): Manual configuration of model's maximum context window
  - If not specified, defaults to 8192 tokens
  - Users should consult their model's documentation for accurate context limits
  - Common values: gpt-3.5-turbo (4096/16384), gpt-4 (8192), gpt-4-turbo/4o (128000), claude-3.5-sonnet (200000)
  - System prompt and response tokens are automatically reserved (see `calculateReservedTokens` in openai-service.ts:639)

**Environment Variables**:
The tool supports legacy environment variables but config files are preferred:
- `OPENAI_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_MAX_CONTEXT_TOKENS`
- `GIT_ACCESS_TOKEN_<HOST>` (e.g., `GIT_ACCESS_TOKEN_GITHUB_COM`)
- `CONAN_REMOTE_BASE_URL`, `CONAN_REMOTE_REPO`
- `WECOM_WEBHOOK`, `WECOM_ENABLE`
- Git platform tokens require appropriate scopes (see README.md)

**Logging**:
- Winston-based structured logging with file rotation
- Logs stored in platform-specific directories:
  - macOS: `~/Library/Application Support/aiflow/logs/`
  - Linux: `~/.config/aiflow/logs/`
  - Windows: `%APPDATA%\aiflow\logs/`
- Files: `aiflow.log` (all levels), `error.log` (errors only)
- Max 10MB per file, keeps 5 files

## AI Generation Details

The `OpenAiService` generates:
1. **Commit Messages**: Follows Conventional Commits format (feat/fix/chore/docs/refactor)
2. **Branch Names**: Sanitized English descriptions with special chars removed
3. **MR Descriptions**: Structured markdown with summary and test plan

**Language Support**: Configurable via `git.generation_lang` in config (en, zh-CN, zh-TW, ja, ko, fr, de, es, ru, pt, it)

**Context Window Management**:
- Uses user-configured `max_context_tokens` (defaults to 8192 if not specified)
- Automatically reserves tokens for system prompt (~1200) and response (~1500) plus safety buffer (5-15% depending on model size)
- For diffs exceeding available context, automatically splits into batches and merges results
- No automatic model detection - users must configure context limits based on their model documentation

## Common Workflows

### Standard MR Creation
1. User stages files or tool prompts for interactive selection
2. Tool detects target branch (main/master/develop)
3. AI generates commit message and branch name from diff
4. Creates feature branch, commits, pushes to remote
5. Creates merge/pull request with assignees/reviewers
6. Sends WeCom notification (if configured)
7. Copies MR URL to clipboard

### Commit-Only Mode
Same as above but stops after step 4 (no MR creation). Triggered with `--commit-only` or `-co` flag.

### Conan Package Update
1. Fetches latest package version from Conan registry
2. Updates `conandata.yml` and `conan.win.lock`
3. Follows standard MR creation workflow with package-specific commit message

## Platform-Specific Details

**TypeScript/ESM**:
- All imports must include `.js` extension (e.g., `import './foo.js'` even though source is `foo.ts`)
- Uses `"type": "module"` in package.json
- No CommonJS require() - use ES6 imports only

**CLI Entry Points**:
- `dist/aiflow-app.js` and `dist/aiflow-conan-app.js` have shebang and are made executable in postbuild
- Uses `ts-node/esm` loader for development (`npm run node-ts`)

**Dependencies**:
- OpenAI SDK: Used for chat completions and reasoning models
- Anthropic SDK: Available but not currently used in main workflow
- Winston: Structured logging
- js-yaml: YAML config parsing
- chalk: Terminal colors
- clipboardy: Cross-platform clipboard
