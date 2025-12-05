


# AIFlow

🚀 基于 AI 的智能工作流自动化工具，支持 GitLab 合并请求创建和 Conan 包管理。

📖 **[English](README-EN.md)** | 中文

## 📋 目录

- [功能特性](#功能特性)
- [工具介绍](#工具介绍)
- [环境要求](#环境要求)
- [安装配置](#安装配置)
- [使用方法](#使用方法)
- [配置说明](#配置说明)
- [工作流程](#工作流程)
- [故障排除](#故障排除)
- [开发说明](#开发说明)

## ✨ 功能特性

- 🤖 **AI 智能生成**：使用 OpenAI API 自动生成提交信息和分支名称
- 🔄 **自动化工作流**：从代码变更到合并请求一键完成
- 📦 **Conan 包管理**：专门支持 Conan 包版本更新
- 🌐 **多平台 Git 集成**：支持 GitHub、GitLab、Gitee 等多个 Git 托管平台
- 📱 **企业微信通知**：通过 WeCom Webhook 发送通知
- 🎯 **智能分支检测**：自动识别目标分支
- 🔧 **灵活配置**：支持多种配置选项和环境变量
- 📝 **交互式文件选择**：智能文件暂存，支持批量选择和分类显示
- 🎯 **仅提交模式**：支持仅提交代码变更而不创建合并请求
- 👥 **合并请求管理**：支持指派人和审查者自动配置
- 🌍 **多语言支持**：AI 生成内容支持多种语言（中文、英文、日文等）

## 🛠️ 工具介绍

本项目包含两个主要工具：

### 1. AIFlow (`aiflow`)
通用的 Git 自动合并请求工具，适用于任何代码变更。

**使用场景**：
- 功能开发
- Bug 修复
- 代码重构
- 文档更新

### 2. AIFlow Conan (`aiflow-conan`)
专门用于 Conan 包版本更新的自动化工具。

**使用场景**：
- 依赖包版本更新
- 安全补丁应用
- 包配置优化

## 📋 环境要求

- **Node.js**: >= 22.0.0
- **npm**: >= 11.0.0
- **Git**: 已配置且能访问远程仓库
- **Git 托管平台**: GitHub、GitLab、Gitee 等平台的 Personal Access Token
- **OpenAI**: 有效的 API Key（💡 推荐：查看 [免费模型配置指南](docs/free-models.md) 获取免费API）

## 🔧 安装配置

### 1. 克隆项目

```bash
git clone git@github.com:HeiSir2014/git-aiflow.git
cd git-aiflow
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 配置 AIFlow

交互式初始化配置：

```bash
# 初始化本地配置
aiflow init

# 或初始化全局配置
aiflow init --global
```

您也可以手动创建配置文件或使用环境变量。

**配置优先级**（从高到低）：
1. 命令行参数
2. 本地配置文件（`.aiflow/config.yaml`）
3. 全局配置文件（`~/.config/aiflow/config.yaml` 或 `%APPDATA%/aiflow/config.yaml`）
4. 环境变量（`.env` 文件或系统环境变量）

**配置文件示例**：

```yaml
# AIFlow 配置文件
# 配置优先级: 命令行参数 > 本地配置 > 全局配置 > 环境变量

# OpenAI API 配置 - 用于AI驱动的功能
openai:
  # OpenAI API 密钥 (必需) - 用于生成提交信息和代码分析
  key: sk-your-actual-openai-api-key

  # OpenAI API 基础URL (必需) - API请求的端点地址
  baseUrl: https://api.openai.com/v1

  # OpenAI 模型名称 (必需) - 指定使用的AI模型，如 gpt-3.5-turbo, gpt-4
  # 💡 免费模型推荐：查看 docs/free-models.md 获取免费API配置
  model: gpt-3.5-turbo

  # 模型最大上下文token数 (可选) - 手动指定模型的最大上下文长度，默认为8192
  # 常见模型推荐值：gpt-3.5-turbo: 16384, gpt-4: 8192, gpt-4-turbo/4o: 128000
  max_context_tokens: 16384

# Git 平台配置 - 支持多个Git托管平台及平台级设置 (推荐)
git_platforms:
  # GitHub 平台配置
  github.com:
    access_token: ghp_xxxxxxxxxxxxxxxxxxxxx

  # GitLab 平台配置 - 支持平台级 merge_request 设置
  gitlab.example.com:
    access_token: glpat-xxxxxxxxxxxxxxxxxxxxx
    merge_request:
      assignee: username1          # 单个指派人用户名
      assignees:                   # 多个指派人用户名列表
        - username1
        - username2
      reviewers:                   # 审查者用户名列表
        - reviewer1
        - reviewer2

  # Gitee 平台配置
  gitee.com:
    access_token: gitee_xxxxxxxxxxxxxxxxxxxxx

# 旧格式兼容性支持 (已弃用，建议使用 git_platforms)
# git_access_tokens:
#   github.com: ghp_xxxxxxxxxxxxxxxxxxxxx

# Conan 包管理器配置 - 用于C++包管理和版本更新
conan:
  # Conan 远程仓库基础URL (Conan操作时必需) - Conan包仓库的API地址
  # remoteBaseUrl: https://conan.example.com

  # Conan 远程仓库名称 (可选) - 默认使用的仓库名称，默认为'repo'
  remoteRepo: repo

# 企业微信通知配置 - 用于发送操作结果通知
wecom:
  # 启用企业微信通知 (可选) - 是否开启通知功能，默认为false
  enable: true

  # 企业微信机器人Webhook地址 (可选) - 用于发送通知消息的机器人地址
  webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-webhook-key

# Git 合并请求配置 - 控制MR的默认行为
git:
  # 压缩提交 (可选) - 合并时是否将多个提交压缩为一个，默认为true
  squashCommits: true

  # 删除源分支 (可选) - 合并后是否删除源分支，默认为true
  removeSourceBranch: true

  # AI生成语言 (可选) - AI生成commit message和MR描述的语言，默认为en
  # 支持的语言代码: en, zh-CN, zh-TW, ja, ko, fr, de, es, ru, pt, it
  generation_lang: en

# 旧格式兼容性支持 (已弃用，建议使用 git_platforms.<hostname>.merge_request)
# merge_request:
#   assignee_id: 0
#   assignee_ids: []
#   reviewer_ids: []
```

## 🚀 使用方法

### AIFlow 工具

用于处理已暂存的 Git 变更：

```bash
# 1. 初始化配置（首次使用）
aiflow init                    # 本地配置
aiflow init --global           # 全局配置

# 2. 暂存你的变更（或让工具自动选择）
git add .                      # 手动暂存所有变更
# 或者直接运行 aiflow，工具会提供交互式文件选择

# 3. 运行自动 MR 工具
aiflow                         # 完整工作流：暂存 → 提交 → 创建 MR
aiflow --commit-only           # 仅提交模式：暂存 → 提交（不创建 MR）
aiflow -co                     # 仅提交模式（短参数）

# 4. 使用 CLI 参数覆盖配置
aiflow -ok sk-abc123 -gat github.com=ghp-xyz789

# 5. 查看帮助信息
aiflow --config-help           # 查看配置选项帮助
aiflow --help                  # 查看一般帮助
```

**交互式文件选择功能**：
当没有暂存文件时，工具会自动提供交互式文件选择界面：

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

**工作流程**：
1. ✅ 检查暂存的变更（如无则提供交互式文件选择）
2. 🎯 自动检测目标分支
3. 🤖 AI 生成提交信息和分支名
4. 📤 创建分支并推送
5. 📋 创建合并请求（支持指派人和审查者）
6. 📱 发送企业微信通知
7. 📋 复制 MR 信息到剪贴板

### AIFlow Conan 工具

用于更新 Conan 包版本：

```bash
# 初始化配置（首次使用）
aiflow-conan init                    # 本地配置
aiflow-conan init --global           # 全局配置

# 更新指定包（使用默认仓库）
aiflow-conan <package-name>

# 更新指定包（指定仓库）
aiflow-conan <package-name> <remote-repo>

# 示例
aiflow-conan zterm
aiflow-conan winusb repo

# 使用 CLI 参数覆盖配置
aiflow-conan -ok sk-abc123 -gat gitlab.example.com=glpat-xyz789 zterm

# 查看配置帮助
aiflow-conan --config-help

# 查看帮助信息
aiflow-conan --help
```

**前置要求**：
- 当前目录包含 `conandata.yml`
- 当前目录包含 `conan.win.lock`

**工作流程**：
1. 📦 从远程获取最新包信息
2. 📝 更新本地配置文件
3. 🎯 检测目标分支
4. 🤖 AI 生成提交信息
5. 📤 创建分支并推送
6. 📋 创建 GitLab 合并请求
7. 📱 发送企业微信通知

## ⚙️ 配置说明

### 配置方式

AIFlow 支持多种配置方式，优先级从高到低如下：

1. **命令行参数**（最高优先级）
2. **本地配置文件**（`.aiflow/config.yaml`）
3. **全局配置文件**（`~/.config/aiflow/config.yaml` 或 `%APPDATA%/aiflow/config.yaml`）
4. **环境变量**（最低优先级）

### 交互式配置

```bash
# 初始化本地配置
aiflow init

# 初始化全局配置  
aiflow init --global
```

### CLI 参数

| 短参数 | 长参数 | 描述 | 必需/可选 |
|--------|--------|------|-----------|
| `-ok` | `--openai-key` | OpenAI API 密钥 | 必需 |
| `-obu` | `--openai-base-url` | OpenAI API 基础 URL | 必需 |
| `-om` | `--openai-model` | OpenAI 模型名称 | 必需 |
| `-omct` | `--openai-max-context-tokens` | 模型最大上下文token数 | 可选 |
| `-gat` | `--git-access-token` | Git 访问令牌 (格式: 主机名=令牌) | 必需 |
| `-crbu` | `--conan-remote-base-url` | Conan 仓库 API URL | Conan操作必需 |
| `-crr` | `--conan-remote-repo` | Conan 仓库名称 | 可选 |
| `-ww` | `--wecom-webhook` | 企业微信 webhook URL | 可选 |
| `-we` | `--wecom-enable` | 启用企业微信通知 | 可选 |
| `-sc` | `--squash-commits` | 压缩提交 | 可选 |
| `-rsb` | `--remove-source-branch` | 删除源分支 | 可选 |
| `-ggl` | `--git-generation-lang` | AI 生成语言 | 可选 |
| `-co`  | `--commit-only` | 仅提交模式 | 可选 |
| `-cmo` | `--commit-only` | 仅提交模式 | 可选 |
| `-mrai` | `--merge-request-assignee-id` | 指派人用户ID | 可选 |
| `-mrais` | `--merge-request-assignee-ids` | 指派人用户ID列表 | 可选 |
| `-mrris` | `--merge-request-reviewer-ids` | 审查者用户ID列表 | 可选 |

### 环境变量（兼容性支持）

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `OPENAI_KEY` | OpenAI API 密钥 | - |
| `OPENAI_BASE_URL` | OpenAI API 基础 URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI 模型名称 | `gpt-3.5-turbo` |
| `OPENAI_MAX_CONTEXT_TOKENS` | 模型最大上下文token数 | `8192` |
| `GIT_ACCESS_TOKEN_<HOST>` | Git 访问令牌 (如: GIT_ACCESS_TOKEN_GITHUB_COM) | - |
| `CONAN_REMOTE_BASE_URL` | Conan 远程服务器 URL | - |
| `CONAN_REMOTE_REPO` | Conan 远程仓库名 | `repo` |
| `WECOM_WEBHOOK` | 企业微信 Webhook URL | - |
| `WECOM_ENABLE` | 启用企业微信通知 | `false` |
| `SQUASH_COMMITS` | 是否压缩提交 | `true` |
| `REMOVE_SOURCE_BRANCH` | 合并后删除源分支 | `true` |
| `GIT_GENERATION_LANG` | AI 生成语言 | `en` |
| `MERGE_REQUEST_ASSIGNEE_ID` | 指派人用户ID | - |
| `MERGE_REQUEST_ASSIGNEE_IDS` | 指派人用户ID列表 | - |
| `MERGE_REQUEST_REVIEWER_IDS` | 审查者用户ID列表 | - |

### Git 平台 Token 权限要求

**GitLab Personal Access Token 权限：**
- ✅ `api` - 完整 API 访问
- ✅ `read_user` - 读取用户信息
- ✅ `read_repository` - 读取仓库信息
- ✅ `write_repository` - 写入仓库信息

**GitHub Personal Access Token 权限：**
- ✅ `repo` - 完整仓库访问权限
- ✅ `workflow` - 工作流访问权限（如需要）

**Gitee Personal Access Token 权限：**
- ✅ `projects` - 项目权限
- ✅ `pull_requests` - 拉取请求权限

## 🔄 工作流程

### 自动检测功能

工具会自动检测以下信息：

1. **Git 平台项目信息**
   - 从 `git remote` URL 解析项目信息
   - 支持 HTTP 和 SSH URL 格式
   - 自动检测 GitHub、GitLab、Gitee 等平台
   - 智能 API 端点探测（支持企业自部署实例）

2. **目标分支检测**
   - 优先级：`main` > `master` > `develop`
   - 检查远程分支是否存在
   - 如果当前分支是默认分支之一，则使用当前分支

3. **分支命名规则**
   ```
   {git-user}/{ai-branch-name}-{date}
   ```
   - `git-user`: Git 用户名
   - `ai-branch-name`: AI 生成并清理的分支名
   - `date`: 格式为 YYYYMMDD

### AI 生成规则

工具使用 OpenAI API 分析代码差异，生成：

1. **提交信息**
   - 遵循 Conventional Commits 规范
   - 包含变更摘要和详细描述
   - 自动识别变更类型（feat/fix/chore/docs 等）

2. **分支名称**
   - 简洁明了的英文描述
   - 自动清理特殊字符
   - 符合 Git 分支命名规范

## 📚 使用案例

### 案例 1：日常功能开发

```bash
# 开发新功能
git add src/components/UserProfile.tsx
git add src/api/userService.ts

# 使用 AIFlow 自动化处理
aiflow

# 输出示例：
# ✅ 生成提交信息: feat(user): add user profile component with API integration
# ✅ 生成分支名称: feat/user-profile-component  
# 🎉 合并请求创建: https://gitlab.com/project/-/merge_requests/123
```

### 案例 2：仅提交模式

```bash
# 仅提交代码变更，不创建 MR
aiflow --commit-only

# 输出示例：
# ✅ 生成提交信息: fix(auth): resolve login validation issue
# ✅ 成功提交变更
# 📝 提交信息: fix(auth): resolve login validation issue
```

### 案例 3：交互式文件选择

```bash
# 直接运行，让工具自动选择文件
aiflow

# 工具会显示：
# 📁 Detected file changes:
# 📝 Modified files:
#   1. src/auth.ts
#   2. src/types.ts
# ❓ Untracked files:
#   3. README.md
# 
# 📋 Select files to stage: 1,3
```

### 案例 4：C++ 包更新

```bash
# 更新 Conan 包
aiflow-conan zterm

# 自动流程：
# 📦 检测最新版本: zterm/1.0.0.26
# 📝 更新配置文件
# 🤖 生成提交信息: chore: update zterm package to version 1.0.0.26
# 📋 创建合并请求
# 📱 发送团队通知
```

### 案例 5：团队协作配置

```bash
# 配置合并请求指派和审查者 (使用用户ID，旧格式)
aiflow -mrai 123 -mrris 456,789

# 推荐：在配置文件中使用用户名配置 (新格式)
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

## 🎯 最佳实践

### 1. 配置管理
- **本地项目配置**：项目特定设置放在 `.aiflow/config.yaml`
- **全局配置**：通用设置放在全局配置文件
- **敏感信息**：使用环境变量存储 API 密钥

### 2. 团队协作
- **统一配置**：团队使用相同的 OpenAI 模型配置
- **分支策略**：配置合适的分支保护规则
- **通知设置**：配置企业微信群组通知

### 3. 安全考虑
- **访问令牌**：定期轮换 Git 平台访问令牌
- **权限控制**：使用最小权限原则配置令牌
- **敏感数据**：不要在配置文件中硬编码密钥

### 4. 工作流优化
- **提交频率**：建议小批量、频繁提交
- **分支命名**：让 AI 自动生成语义化分支名
- **代码审查**：配置自动指派审查者

## 🔍 故障排除

### 常见问题

**1. "No staged changes found"**
```bash
# 解决方案：暂存你的变更
git add .
```

**2. "Missing required configuration"**
```bash
# 解决方案：初始化配置或检查配置文件
aiflow init
# 或检查现有配置
aiflow --config-help
```

**3. "Could not determine target branch"**
```bash
# 解决方案：检查远程分支
git branch -r
git remote -v
```

**4. "Git API error"**
```bash
# 解决方案：验证访问令牌权限
# GitLab:
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/user
# GitHub:
curl -H "Authorization: Bearer your-token" https://api.github.com/user
```

**5. Conan 包更新失败**
```bash
# 检查必需文件
ls -la conandata.yml conan.win.lock

# 检查 Conan 服务器连接
curl http://your-conan-server.com/v1/ping
```

**6. 交互式文件选择不工作**
```bash
# 确保在 Git 仓库中运行
git status

# 检查是否有文件变更
git diff --name-only
```

**7. 合并请求指派失败**
```bash
# 检查用户ID是否正确
# GitLab: 在项目设置中查看用户ID
# GitHub: 使用用户名而不是ID

# 验证访问令牌权限
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/projects/PROJECT_ID/members
```

**8. Windows PowerShell 执行策略错误**

**问题描述**：
在 Windows 系统中运行 `aiflow` 命令时可能出现以下错误：

```powershell
aiflow : 无法加载文件 C:\Users\user\AppData\Roaming\npm\aiflow.ps1，因为在此系统上禁止运行脚本。
有关详细信息，请参阅 https://go.microsoft.com/fwlink/?LinkID=135170 中的 about_Execution_Policies。
所在位置 行:1 字符: 1
+ aiflow
+ ~~~~~~
   + CategoryInfo          : SecurityError: (:) []，PSSecurityException
   + FullyQualifiedErrorId : UnauthorizedAccess
```

**原因分析**：
Windows PowerShell 默认的执行策略限制了脚本的运行，这是一个安全机制，防止恶意脚本执行。

**解决方案**：

方法一：**修改当前用户执行策略（推荐）**
```powershell
# 以管理员身份运行 PowerShell，然后执行：
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

方法二：**临时绕过执行策略**
```powershell
# 每次运行时临时绕过（不推荐）
PowerShell -ExecutionPolicy Bypass -Command "aiflow"
```

方法三：**使用 npx 直接运行**
```bash
# 如果上述方法都不行，可以使用 npx
npx aiflow
```

**验证修复**：
```powershell
# 检查当前执行策略
Get-ExecutionPolicy -List

# 应该看到 CurrentUser 的策略为 RemoteSigned
```

**安全说明**：
- `RemoteSigned` 策略要求从互联网下载的脚本必须由受信任的发布者签名
- 本地创建的脚本可以运行而无需签名
- 这是一个相对安全的设置，比完全开放的 `Unrestricted` 策略更安全

### 日志系统

AIFlow 使用基于 Winston 的企业级日志系统：

**日志位置：**
- **Windows**: `%APPDATA%\aiflow\logs\`
- **macOS**: `~/Library/Application Support/aiflow/logs/`
- **Linux**: `~/.config/aiflow/logs/`

**日志文件：**
- `aiflow.log` - 所有级别的日志
- `error.log` - 仅错误级别的日志

**日志功能：**
- 📁 按文件大小自动滚动（10MB/文件，保留5个文件）
- 🕐 包含时间戳、上下文标记和详细元数据
- 📊 结构化 JSON 格式便于分析
- 🏷️ 服务级别的上下文标记（Shell、GitService、HttpClient 等）

### 调试模式

查看实时日志：

```bash
# 查看所有日志
tail -f ~/.config/aiflow/logs/aiflow.log

# 仅查看错误日志
tail -f ~/.config/aiflow/logs/error.log

# Windows 用户
Get-Content -Path "$env:APPDATA\aiflow\logs\aiflow.log" -Wait
```

### 日志分析

工具会输出详细的执行步骤：

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
🎉 Merge Request created: https://github.com/user/project/pull/123
📢 Sending notification...
📢 Notification sent via WeCom webhook.
✅ AIFlow workflow completed successfully!
```

## 👨‍💻 开发说明

### 项目结构

```
src/
├── services/              # 核心服务
│   ├── git-service.ts        # Git 操作
│   ├── git-platform-service.ts # Git 平台抽象接口
│   ├── gitlab-platform-service.ts # GitLab 平台实现
│   ├── github-platform-service.ts # GitHub 平台实现
│   ├── openai-service.ts     # OpenAI API
│   ├── conan-service.ts      # Conan API
│   ├── wecom-notifier.ts     # 企业微信通知
│   ├── conandata-service.ts  # Conan 数据文件操作
│   ├── conanlock-service.ts  # Conan 锁文件操作
│   └── file-updater-service.ts # 文件更新操作
├── utils/                 # 工具函数
│   └── string-util.ts        # 字符串处理
├── http/                  # HTTP 客户端
│   └── http-client.ts
├── test/                  # 测试文件
├── config.ts              # 配置管理
├── logger.ts              # 日志系统
├── aiflow-app.ts          # 通用 MR 工具
├── aiflow-conan-app.ts    # Conan 更新工具
├── shell.ts               # Shell 命令执行
└── index.ts               # 入口文件
```

### 开发命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化代码
npm run format
```

### 添加新功能

1. 在相应的 service 中添加新方法
2. 更新主应用类的逻辑
3. 添加相应的测试
4. 更新文档

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "GitService"

# 覆盖率报告
npm run test:coverage
```

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交变更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📚 扩展资源

- 📖 **[免费模型配置指南](docs/free-models.md)** - 使用免费AI模型，降低使用成本
- 🔧 **[配置文件示例](config.example.yaml)** - 完整配置参考
- 📋 **[更新日志](CHANGELOG.md)** - 版本更新记录

## 📞 支持

如有问题或建议，请：

1. 查看 [故障排除](#故障排除) 部分
2. 搜索已有的 [Issues](../../issues)
3. 创建新的 [Issue](../../issues/new)

---

**注意**：使用前请确保已正确配置所有必需的环境变量，并且具有相应服务的访问权限。
