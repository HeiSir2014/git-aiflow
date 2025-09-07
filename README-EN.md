# AIFlow

🚀 AI-powered intelligent workflow automation tool for GitLab merge request creation and Conan package management.

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
- 🌐 **GitLab Integration**: Automatic project detection and merge request creation
- 📱 **WeCom Notifications**: Send notifications via WeCom Webhook
- 🎯 **Smart Branch Detection**: Automatically identify target branches (main/master/develop)
- 🔧 **Flexible Configuration**: Support multiple configuration options and environment variables

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

- **Node.js**: >= 16.0.0
- **npm**: >= 7.0.0
- **Git**: Configured with access to remote repositories
- **GitLab**: Personal Access Token with API permissions
- **OpenAI**: Valid API Key

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone git@github.com:HeiSir2014/aiflow.git
cd aiflow
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Configure Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual configuration:

```bash
# OpenAI Configuration
OPENAI_KEY=sk-your-actual-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# GitLab Configuration
GITLAB_TOKEN=glpat-your-gitlab-token

# WeCom Configuration
WECOM_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-webhook-key

# Conan Configuration (only for Conan tool)
CONAN_REMOTE_BASE_URL=http://your-conan-server.com
CONAN_REMOTE_REPO=your-repo-name
```

## 🚀 Usage

### AIFlow Tool

For handling staged Git changes:

```bash
# 1. Stage your changes
git add .

# 2. Run the auto MR tool
npm run aiflow

# Or view help information
npm run aiflow -- --help
```

**Workflow**:
1. ✅ Check staged changes
2. 🎯 Auto-detect target branch
3. 🤖 AI-generate commit message and branch name
4. 📤 Create branch and push
5. 📋 Create GitLab merge request
6. 📱 Send WeCom notification

### AIFlow Conan Tool

For updating Conan package versions:

```bash
# Update specified package (using default repository)
npm run aiflow-conan <package-name>

# Update specified package (specify repository)
npm run aiflow-conan <package-name> <remote-repo>

# Examples
npm run aiflow-conan zterm
npm run aiflow-conan winusb repo

# View help information
npm run aiflow-conan -- --help
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

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_KEY` | OpenAI API key | `sk-xxx...` |
| `GITLAB_TOKEN` | GitLab Personal Access Token | `glpat-xxx...` |
| `WECOM_WEBHOOK` | WeCom Webhook URL | `https://qyapi.weixin.qq.com/...` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o-mini` |
| `GITLAB_BASE_URL` | GitLab base URL | Auto-detected |
| `CONAN_REMOTE_BASE_URL` | Conan remote server URL | - |
| `CONAN_REMOTE_REPO` | Conan remote repository name | `repo` |
| `SQUASH_COMMITS` | Whether to squash commits | `true` |
| `REMOVE_SOURCE_BRANCH` | Delete source branch after merge | `true` |

### GitLab Token Permissions

When creating a GitLab Personal Access Token, the following scopes are required:
- ✅ `api` - Full API access
- ✅ `read_user` - Read user information
- ✅ `read_repository` - Read repository information
- ✅ `write_repository` - Write repository information

## 🔄 Workflow

### Auto-Detection Features

The tool automatically detects the following information:

1. **GitLab Project Information**
   - Parse project ID from `git remote` URL
   - Support both HTTP and SSH URL formats
   - Auto-extract GitLab server address

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

## 🔍 Troubleshooting

### Common Issues

**1. "No staged changes found"**
```bash
# Solution: Stage your changes
git add .
```

**2. "Missing required environment variables"**
```bash
# Solution: Check .env file configuration
cat .env
```

**3. "Could not determine target branch"**
```bash
# Solution: Check remote branches
git branch -r
git remote -v
```

**4. "GitLab API error"**
```bash
# Solution: Verify GitLab Token permissions
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/user
```

**5. Conan package update failure**
```bash
# Check required files
ls -la conandata.yml conan.win.lock

# Check Conan server connection
curl http://your-conan-server.com/v1/ping
```

### Debug Mode

Enable verbose logging output:

```bash
# Set debug environment variable
export DEBUG=aiflow:*

# Run the tool
npm run aiflow
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
├── services/           # Core services
│   ├── git-service.ts     # Git operations
│   ├── gitlab-service.ts  # GitLab API
│   ├── openai-service.ts  # OpenAI API
│   ├── conan-service.ts   # Conan API
│   └── wecom-notifier.ts  # WeCom notifications
├── utils/              # Utility functions
│   └── string-util.ts     # String processing
├── http/               # HTTP client
│   └── http-client.ts
├── git-auto-mr-app.ts  # General MR tool
├── conan-pkg-update-app.ts # Conan update tool
└── index.ts            # Entry point
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

## 📞 Support

If you have questions or suggestions, please:

1. Check the [Troubleshooting](#troubleshooting) section
2. Search existing [Issues](../../issues)
3. Create a new [Issue](../../issues/new)

---

**Note**: Before using, please ensure all required environment variables are properly configured and you have access to the respective services.
