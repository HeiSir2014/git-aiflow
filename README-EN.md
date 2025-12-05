# AIFlow

🚀 An AI-powered workflow automation tool for effortless Git-based development, combining smart GitLab/GitHub merge & pull request creation with Conan package management.

📖 English | **[中文](README.md)**

## 📋 Table of Contents

- [Features](#features)
- [Tool Overview](#tool-overview)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Configuration](#configuration)
- [Workflow](#workflow)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## ✨ Features

- 🤖 **AI-Powered Generation**: Automatically generate commit messages and branch names using OpenAI API
- 🔄 **Automated Workflow**: One-click process from code changes to merge request creation
- 📦 **Conan Package Management**: Specialized support for Conan package version updates
- 🌐 **Multi-Platform Git Integration**: Support for GitHub, GitLab, Gitee and other Git hosting platforms
- 📱 **WeCom Notifications**: Send notifications via WeCom Webhook
- 🎯 **Smart Branch Detection**: Automatically identify target branches (main/master/develop)
- 🔧 **Flexible Configuration**: Support multiple configuration options and environment variables
- 📝 **Interactive File Selection**: Smart file staging with batch selection and categorized display
- 🎯 **Commit-Only Mode**: Support for committing code changes without creating merge requests
- 👥 **Merge Request Management**: Support for automatic assignee and reviewer configuration
- 🌍 **Multi-Language Support**: AI-generated content supports multiple languages (Chinese, English, Japanese, etc.)

## 🛠️ Tool Overview

This project includes two main tools:

### 1. AIFlow (`aiflow`)
General-purpose Git automated merge request tool for any code changes.

**Use Cases**:
- Feature development
- Bug fixes
- Code refactoring
- Documentation updates

### 2. AIFlow Conan (`aiflow-conan`)
Specialized automation tool for Conan package version updates.

**Use Cases**:
- Dependency package version updates
- Security patch applications
- Package configuration optimization

## 📋 Requirements

- **Node.js**: >= 22.0.0
- **npm**: >= 11.0.0
- **Git**: Configured with access to remote repositories
- **Git Hosting Platforms**: Personal Access Tokens for GitHub, GitLab, Gitee, etc.
- **OpenAI**: Valid API Key (💡 Recommended: Check [Free Models Guide](docs/free-models-en.md) for free API options)

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone git@github.com:HeiSir2014/git-aiflow.git
cd git-aiflow
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Configure AIFlow

Initialize configuration interactively:

```bash
# Initialize local configuration
aiflow init

# Or initialize global configuration
aiflow init --global
```

You can also manually create configuration files or use environment variables.

**Configuration Priority** (highest to lowest):
1. Command-line arguments
2. Local config (`.aiflow/config.yaml`)
3. Global config (`~/.config/aiflow/config.yaml` or `%APPDATA%/aiflow/config.yaml`)
4. Environment variables (`.env` file or system env)

**Example configuration file**:

```yaml
# AIFlow Configuration File
# Priority: CLI args > local config > global config > environment variables

# OpenAI API Configuration - for AI-driven features
openai:
  # OpenAI API key (required) - for generating commit messages and code analysis
  key: sk-your-actual-openai-api-key

  # OpenAI API base URL (required) - API request endpoint
  baseUrl: https://api.openai.com/v1

  # OpenAI model name (required) - specify AI model like gpt-3.5-turbo, gpt-4
  # 💡 Free Models Available: Check docs/free-models.md for free API configurations
  model: gpt-4o-mini

  # Model maximum context tokens (optional) - manually specify max context length, defaults to 8192
  # Common model values: gpt-3.5-turbo: 16384, gpt-4: 8192, gpt-4-turbo/4o: 128000
  max_context_tokens: 16384

# Git Platform Configuration - support for multiple Git hosting platforms with per-platform settings (recommended)
git_platforms:
  # GitHub platform configuration
  github.com:
    access_token: ghp_xxxxxxxxxxxxxxxxxxxxx

  # GitLab platform configuration - supports per-platform merge_request settings
  gitlab.example.com:
    access_token: glpat-xxxxxxxxxxxxxxxxxxxxx
    merge_request:
      assignee: username1          # Single assignee username
      assignees:                   # Multiple assignee usernames
        - username1
        - username2
      reviewers:                   # Reviewer usernames
        - reviewer1
        - reviewer2

  # Gitee platform configuration
  gitee.com:
    access_token: gitee_xxxxxxxxxxxxxxxxxxxxx

# Legacy format support (deprecated, use git_platforms instead)
# git_access_tokens:
#   github.com: ghp_xxxxxxxxxxxxxxxxxxxxx

# Conan Package Manager Configuration - for C++ package management and version updates
conan:
  # Conan remote repository base URL (required for Conan operations) - Conan package repository API address
  # remoteBaseUrl: https://conan.example.com

  # Conan remote repository name (optional) - default repository name, defaults to 'repo'
  remoteRepo: repo

# WeCom Notification Configuration - for sending operation result notifications
wecom:
  # Enable WeCom notifications (optional) - whether to enable notification feature, defaults to false
  enable: true

  # WeCom bot webhook address (optional) - for sending notification messages
  webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-webhook-key

# Git Merge Request Configuration - controls MR default behavior
git:
  # Squash commits (optional) - whether to squash multiple commits when merging, defaults to true
  squashCommits: true

  # Remove source branch (optional) - whether to delete source branch after merging, defaults to true
  removeSourceBranch: true

  # AI generation language (optional) - language for AI-generated commit messages and MR descriptions, defaults to en
  # Supported language codes: en, zh-CN, zh-TW, ja, ko, fr, de, es, ru, pt, it
  generation_lang: en

# Legacy format support (deprecated, use git_platforms.<hostname>.merge_request instead)
# merge_request:
#   assignee_id: 0
#   assignee_ids: []
#   reviewer_ids: []
```

## 🚀 Usage

### AIFlow Tool

For handling staged Git changes:

```bash
# 1. Initialize configuration (first time)
aiflow init                    # Local configuration
aiflow init --global           # Global configuration

# 2. Stage your changes (or let the tool auto-select)
git add .                      # Manually stage all changes
# Or run aiflow directly, the tool will provide interactive file selection

# 3. Run the auto MR tool
aiflow                         # Full workflow: stage → commit → create MR
aiflow --commit-only           # Commit-only mode: stage → commit (no MR creation)
aiflow -co                     # Commit-only mode (short parameter)

# 4. Use CLI arguments to override config
aiflow -ok sk-abc123 -gat github.com=ghp-xyz789

# 5. View help information
aiflow --config-help           # View configuration options help
aiflow --help                  # View general help
```

**Interactive File Selection Feature**:
When no files are staged, the tool automatically provides an interactive file selection interface:

```bash
📁 Detected file changes:
──────────────────────────────────────────────────

📝 Modified files:
  1. src/components/UserProfile.tsx
  2. src/api/userService.ts

❓ Untracked files:
  3. src/types/user.ts
  4. README.md

🎯 File selection options:
  • Enter file numbers (e.g., 1,3,5 or 1-5)
  • Type "all" to stage all files
  • Type "modified" to stage only modified files
  • Type "untracked" to stage only untracked files
  • Press Enter or type "cancel" to cancel

📋 Select files to stage: 1,3
```

**Workflow**:
1. ✅ Check staged changes (or provide interactive file selection if none)
2. 🎯 Auto-detect target branch
3. 🤖 AI-generate commit message and branch name
4. 📤 Create branch and push
5. 📋 Create merge request (with assignee and reviewer support)
6. 📱 Send WeCom notification
7. 📋 Copy MR info to clipboard

### AIFlow Conan Tool

For updating Conan package versions:

```bash
# Initialize configuration (first time)
aiflow-conan init                    # Local configuration
aiflow-conan init --global           # Global configuration

# Update specified package (using default repository)
aiflow-conan <package-name>

# Update specified package (specify repository)
aiflow-conan <package-name> <remote-repo>

# Examples
aiflow-conan zterm
aiflow-conan winusb repo

# With CLI arguments to override config
aiflow-conan -ok sk-abc123 -gat gitlab.example.com=glpat-xyz789 zterm

# View configuration help
aiflow-conan --config-help

# View help information
aiflow-conan --help
```

**Prerequisites**:
- Current directory contains `conandata.yml`
- Current directory contains `conan.win.lock`

**Workflow**:
1. 📦 Fetch latest package info from remote
2. 📝 Update local configuration files
3. 🎯 Detect target branch
4. 🤖 AI-generate commit message
5. 📤 Create branch and push
6. 📋 Create GitLab merge request
7. 📱 Send WeCom notification

## ⚙️ Configuration

### Configuration Methods

AIFlow supports multiple configuration methods with the following priority order (highest to lowest):

1. **Command-line arguments** (highest priority)
2. **Local configuration file** (`.aiflow/config.yaml`)
3. **Global configuration file** (`~/.config/aiflow/config.yaml` or `%APPDATA%/aiflow/config.yaml`)
4. **Environment variables** (lowest priority)

### Interactive Configuration

```bash
# Initialize local configuration
aiflow init

# Initialize global configuration  
aiflow init --global
```

### CLI Arguments

| Short | Long | Description | Required/Optional |
|-------|------|-------------|-------------------|
| `-ok` | `--openai-key` | OpenAI API key | Required |
| `-obu` | `--openai-base-url` | OpenAI API base URL | Required |
| `-om` | `--openai-model` | OpenAI model name | Required |
| `-omct` | `--openai-max-context-tokens` | Model max context tokens | Optional |
| `-gat` | `--git-access-token` | Git access token (format: hostname=token) | Required |
| `-crbu` | `--conan-remote-base-url` | Conan repository API URL | Required for Conan |
| `-crr` | `--conan-remote-repo` | Conan repository name | Optional |
| `-ww` | `--wecom-webhook` | WeCom webhook URL | Optional |
| `-we` | `--wecom-enable` | Enable WeCom notifications | Optional |
| `-sc` | `--squash-commits` | Squash commits | Optional |
| `-rsb` | `--remove-source-branch` | Remove source branch | Optional |
| `-ggl` | `--git-generation-lang` | AI generation language | Optional |
| `-co` | `--commit-only` | Commit-only mode | Optional |
| `-mrai` | `--merge-request-assignee-id` | Assignee user ID | Optional |
| `-mrais` | `--merge-request-assignee-ids` | Assignee user ID list | Optional |
| `-mrris` | `--merge-request-reviewer-ids` | Reviewer user ID list | Optional |

### Environment Variables (Legacy Support)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_KEY` | OpenAI API key | - |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI model name | `gpt-3.5-turbo` |
| `OPENAI_MAX_CONTEXT_TOKENS` | Model max context tokens | `8192` |
| `GIT_ACCESS_TOKEN_<HOST>` | Git access token (e.g., GIT_ACCESS_TOKEN_GITHUB_COM) | - |
| `CONAN_REMOTE_BASE_URL` | Conan remote server URL | - |
| `CONAN_REMOTE_REPO` | Conan remote repository name | `repo` |
| `WECOM_WEBHOOK` | WeCom Webhook URL | - |
| `WECOM_ENABLE` | Enable WeCom notifications | `false` |
| `SQUASH_COMMITS` | Whether to squash commits | `true` |
| `REMOVE_SOURCE_BRANCH` | Delete source branch after merge | `true` |
| `GIT_GENERATION_LANG` | AI generation language | `en` |
| `MERGE_REQUEST_ASSIGNEE_ID` | Assignee user ID | - |
| `MERGE_REQUEST_ASSIGNEE_IDS` | Assignee user ID list | - |
| `MERGE_REQUEST_REVIEWER_IDS` | Reviewer user ID list | - |

### Git Platform Token Permissions

**GitLab Personal Access Token Scopes:**
- ✅ `api` - Full API access
- ✅ `read_user` - Read user information
- ✅ `read_repository` - Read repository information
- ✅ `write_repository` - Write repository information

**GitHub Personal Access Token Scopes:**
- ✅ `repo` - Full repository access
- ✅ `workflow` - Workflow access (if needed)

**Gitee Personal Access Token Scopes:**
- ✅ `projects` - Project permissions
- ✅ `pull_requests` - Pull request permissions

## 🔄 Workflow

### Auto-Detection Features

The tool automatically detects the following information:

1. **Git Platform Project Information**
   - Parse project information from `git remote` URL
   - Support both HTTP and SSH URL formats
   - Auto-detect GitHub, GitLab, Gitee and other platforms
   - Smart API endpoint detection (supports enterprise self-hosted instances)

2. **Target Branch Detection**
   - Priority: `main` > `master` > `develop`
   - Check if remote branches exist
   - Use current branch if it's one of the default branches

3. **Branch Naming Convention**
   ```
   {git-user}/{ai-branch-name}-{date}
   ```
   - `git-user`: Git username
   - `ai-branch-name`: AI-generated and sanitized branch name
   - `date`: Format YYYYMMDD

### AI Generation Rules

The tool uses OpenAI API to analyze code differences and generate:

1. **Commit Messages**
   - Follow Conventional Commits specification
   - Include change summary and detailed description
   - Auto-identify change types (feat/fix/chore/docs, etc.)

2. **Branch Names**
   - Concise English descriptions
   - Auto-clean special characters
   - Comply with Git branch naming conventions

## 📚 Use Cases

### Case 1: Daily Feature Development

```bash
# Develop new feature
git add src/components/UserProfile.tsx
git add src/api/userService.ts

# Use AIFlow for automated processing
aiflow

# Output example:
# ✅ Generated commit message: feat(user): add user profile component with API integration
# ✅ Generated branch name: feat/user-profile-component  
# 🎉 Merge request created: https://gitlab.com/project/-/merge_requests/123
```

### Case 2: Commit-Only Mode

```bash
# Only commit code changes, don't create MR
aiflow --commit-only

# Output example:
# ✅ Generated commit message: fix(auth): resolve login validation issue
# ✅ Successfully committed changes
# 📝 Commit message: fix(auth): resolve login validation issue
```

### Case 3: Interactive File Selection

```bash
# Run directly, let the tool auto-select files
aiflow

# Tool will display:
# 📁 Detected file changes:
# 📝 Modified files:
#   1. src/auth.ts
#   2. src/types.ts
# ❓ Untracked files:
#   3. README.md
# 
# 📋 Select files to stage: 1,3
```

### Case 4: C++ Package Update

```bash
# Update Conan package
aiflow-conan zterm

# Automatic process:
# 📦 Detected latest version: zterm/1.0.0.26
# 📝 Updated configuration files
# 🤖 Generated commit message: chore: update zterm package to version 1.0.0.26
# 📋 Created merge request
# 📱 Sent team notification
```

### Case 5: Team Collaboration Configuration

```bash
# Configure merge request assignee and reviewers (using user IDs, legacy format)
aiflow -mrai 123 -mrris 456,789

# Recommended: Configure using usernames in config file (new format)
git_platforms:
  gitlab.example.com:
    access_token: glpat-xxxxxxxxxxxxxxxxxxxxx
    merge_request:
      assignee: username1
      assignees:
        - username1
        - username2
      reviewers:
        - reviewer1
        - reviewer2
```

## 🎯 Best Practices

### 1. Configuration Management
- **Local Project Config**: Project-specific settings in `.aiflow/config.yaml`
- **Global Config**: Common settings in global configuration file
- **Sensitive Information**: Use environment variables for API keys

### 2. Team Collaboration
- **Unified Config**: Team uses the same OpenAI model configuration
- **Branch Strategy**: Configure appropriate branch protection rules
- **Notification Settings**: Configure enterprise WeChat group notifications

### 3. Security Considerations
- **Access Tokens**: Regularly rotate Git platform access tokens
- **Permission Control**: Use principle of least privilege for token configuration
- **Sensitive Data**: Don't hardcode keys in configuration files

### 4. Workflow Optimization
- **Commit Frequency**: Recommend small, frequent commits
- **Branch Naming**: Let AI auto-generate semantic branch names
- **Code Review**: Configure automatic reviewer assignment

## 🔍 Troubleshooting

### Common Issues

**1. "No staged changes found"**
```bash
# Solution: Stage your changes
git add .
```

**2. "Missing required configuration"**
```bash
# Solution: Initialize configuration or check config files
aiflow init
# Or check existing configuration
aiflow --config-help
```

**3. "Could not determine target branch"**
```bash
# Solution: Check remote branches
git branch -r
git remote -v
```

**4. "Git API error"**
```bash
# Solution: Verify access token permissions
# GitLab:
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/user
# GitHub:
curl -H "Authorization: Bearer your-token" https://api.github.com/user
```

**5. Conan package update failure**
```bash
# Check required files
ls -la conandata.yml conan.win.lock

# Check Conan server connection
curl http://your-conan-server.com/v1/ping
```

**6. Interactive file selection not working**
```bash
# Ensure running in a Git repository
git status

# Check if there are file changes
git diff --name-only
```

**7. Merge request assignment failure**
```bash
# Check if user IDs are correct
# GitLab: Check user IDs in project settings
# GitHub: Use usernames instead of IDs

# Verify access token permissions
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/projects/PROJECT_ID/members
```

**8. Windows PowerShell Execution Policy Error**

**Problem Description**:
When running the `aiflow` command on Windows systems, you may encounter the following error:

```powershell
aiflow : File C:\Users\user\AppData\Roaming\npm\aiflow.ps1 cannot be loaded because running scripts 
is disabled on this system. For more information, see about_Execution_Policies at 
https://go.microsoft.com/fwlink/?LinkID=135170.
At line:1 char:1
+ aiflow
+ ~~~~~~
   + CategoryInfo          : SecurityError: (:) [], PSSecurityException
   + FullyQualifiedErrorId : UnauthorizedAccess
```

**Root Cause**:
Windows PowerShell's default execution policy restricts script execution as a security mechanism to prevent malicious scripts from running.

**Solutions**:

Method 1: **Modify Current User Execution Policy (Recommended)**
```powershell
# Run PowerShell as Administrator, then execute:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

Method 2: **Temporarily Bypass Execution Policy**
```powershell
# Temporarily bypass for each run (not recommended)
PowerShell -ExecutionPolicy Bypass -Command "aiflow"
```

Method 3: **Use npx to Run Directly**
```bash
# If the above methods don't work, use npx
npx aiflow
```

**Verify Fix**:
```powershell
# Check current execution policy
Get-ExecutionPolicy -List

# You should see CurrentUser policy as RemoteSigned
```

**Security Notes**:
- `RemoteSigned` policy requires scripts downloaded from the internet to be signed by a trusted publisher
- Locally created scripts can run without signatures
- This is a relatively secure setting, safer than the fully open `Unrestricted` policy

### Logging System

AIFlow uses an enterprise-grade logging system based on Winston:

**Log Locations:**
- **Windows**: `%APPDATA%\aiflow\logs\`
- **macOS**: `~/Library/Application Support/aiflow/logs/`
- **Linux**: `~/.config/aiflow/logs/`

**Log Files:**
- `aiflow.log` - All log levels
- `error.log` - Error level only

**Log Features:**
- 📁 Automatic file size rotation (10MB/file, keep 5 files)
- 🕐 Timestamps, context tags and detailed metadata
- 📊 Structured JSON format for analysis
- 🏷️ Service-level context tags (Shell, GitService, HttpClient, etc.)

### Debug Mode

View real-time logs:

```bash
# View all logs
tail -f ~/.config/aiflow/logs/aiflow.log

# View error logs only
tail -f ~/.config/aiflow/logs/error.log

# Windows users
Get-Content -Path "$env:APPDATA\aiflow\logs\aiflow.log" -Wait
```

### Log Analysis

The tool outputs detailed execution steps:

```
🚀 AIFlow Tool
📁 Working directory: /path/to/project
⏰ Started at: 2024-01-01T12:00:00.000Z
──────────────────────────────────────────────────
✅ Environment validation passed
🎯 Target branch: main
🤖 Generating commit message and branch name...
✅ Generated commit message: feat: add new feature
✅ Generated branch name: username/add-new-feature-20240101
📤 Creating branch and pushing changes...
📋 Creating Merge Request...
🎉 Merge Request created: https://gitlab.com/project/-/merge_requests/123
📢 Sending notification...
📢 Notification sent via WeCom webhook.
✅ AIFlow workflow completed successfully!
```

## 👨‍💻 Development

### Project Structure

```
src/
├── services/              # Core services
│   ├── git-service.ts        # Git operations
│   ├── git-platform-service.ts # Git platform abstract interface
│   ├── gitlab-platform-service.ts # GitLab platform implementation
│   ├── github-platform-service.ts # GitHub platform implementation
│   ├── openai-service.ts     # OpenAI API
│   ├── conan-service.ts      # Conan API
│   ├── wecom-notifier.ts     # WeCom notifications
│   ├── conandata-service.ts  # Conan data file operations
│   ├── conanlock-service.ts  # Conan lock file operations
│   └── file-updater-service.ts # File update operations
├── utils/                 # Utility functions
│   └── string-util.ts        # String processing
├── http/                  # HTTP client
│   └── http-client.ts
├── test/                  # Test files
├── config.ts              # Configuration management
├── logger.ts              # Logging system
├── aiflow-app.ts          # General MR tool
├── aiflow-conan-app.ts    # Conan update tool
├── shell.ts               # Shell command execution
└── index.ts               # Entry point
```

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (watch for file changes)
npm run dev

# Build project
npm run build

# Run tests
npm test

# Code linting
npm run lint

# Format code
npm run format
```

### Adding New Features

1. Add new methods to the appropriate service
2. Update main application class logic
3. Add corresponding tests
4. Update documentation

### Testing

```bash
# Run all tests
npm test

# Run specific tests
npm test -- --grep "GitService"

# Coverage report
npm run test:coverage
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 📚 Extended Resources

- 📖 **[Free Models Configuration Guide](docs/free-models.md)** - Use free AI models to reduce costs
- 🔧 **[Configuration Examples](config.example.yaml)** - Complete configuration reference
- 📋 **[Changelog](CHANGELOG.md)** - Version update history

## 📞 Support

If you have questions or suggestions, please:

1. Check the [Troubleshooting](#troubleshooting) section
2. Search existing [Issues](../../issues)
3. Create a new [Issue](../../issues/new)

---

**Note**: Before using, please ensure all required environment variables are properly configured and you have access to the respective services.
