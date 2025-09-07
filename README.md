


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
- 🌐 **GitLab 集成**：自动检测项目信息并创建合并请求
- 📱 **企业微信通知**：通过 WeCom Webhook 发送通知
- 🎯 **智能分支检测**：自动识别目标分支（main/master/develop）
- 🔧 **灵活配置**：支持多种配置选项和环境变量

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

- **Node.js**: >= 16.0.0
- **npm**: >= 7.0.0
- **Git**: 已配置且能访问远程仓库
- **GitLab**: 具有 API 访问权限的 Personal Access Token
- **OpenAI**: 有效的 API Key

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
  model: gpt-4o-mini

# GitLab 配置 - 用于仓库操作和合并请求管理
gitlab:
  # GitLab 个人访问令牌 (必需) - 用于API操作，需要api和write_repository权限
  token: glpat-your-gitlab-token
  
  # GitLab 基础URL (可选) - 自定义GitLab实例地址，留空时自动从git remote检测
  # baseUrl: https://gitlab.example.com

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
```

## 🚀 使用方法

### AIFlow 工具

用于处理已暂存的 Git 变更：

```bash
# 1. 初始化配置（首次使用）
aiflow init                    # 本地配置
aiflow init --global           # 全局配置

# 2. 暂存你的变更
git add .

# 3. 运行自动 MR 工具
aiflow

# 或使用 CLI 参数覆盖配置
aiflow -ok sk-abc123 -gt glpat-xyz789

# 查看配置帮助
aiflow --config-help

# 查看一般帮助
aiflow --help
```

**工作流程**：
1. ✅ 检查暂存的变更
2. 🎯 自动检测目标分支
3. 🤖 AI 生成提交信息和分支名
4. 📤 创建分支并推送
5. 📋 创建 GitLab 合并请求
6. 📱 发送企业微信通知

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
aiflow-conan -ok sk-abc123 -gt glpat-xyz789 zterm

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
| `-gt` | `--gitlab-token` | GitLab 访问令牌 | 必需 |
| `-gbu` | `--gitlab-base-url` | GitLab 基础 URL | 可选 |
| `-crbu` | `--conan-remote-base-url` | Conan 仓库 API URL | Conan操作必需 |
| `-crr` | `--conan-remote-repo` | Conan 仓库名称 | 可选 |
| `-ww` | `--wecom-webhook` | 企业微信 webhook URL | 可选 |
| `-we` | `--wecom-enable` | 启用企业微信通知 | 可选 |
| `-sc` | `--squash-commits` | 压缩提交 | 可选 |
| `-rsb` | `--remove-source-branch` | 删除源分支 | 可选 |

### 环境变量（兼容性支持）

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `OPENAI_KEY` | OpenAI API 密钥 | - |
| `OPENAI_BASE_URL` | OpenAI API 基础 URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI 模型名称 | `gpt-3.5-turbo` |
| `GITLAB_TOKEN` | GitLab 个人访问令牌 | - |
| `GITLAB_BASE_URL` | GitLab 基础 URL | 自动检测 |
| `CONAN_REMOTE_BASE_URL` | Conan 远程服务器 URL | - |
| `CONAN_REMOTE_REPO` | Conan 远程仓库名 | `repo` |
| `WECOM_WEBHOOK` | 企业微信 Webhook URL | - |
| `WECOM_ENABLE` | 启用企业微信通知 | `false` |
| `SQUASH_COMMITS` | 是否压缩提交 | `true` |
| `REMOVE_SOURCE_BRANCH` | 合并后删除源分支 | `true` |

### GitLab Token 权限要求

创建 GitLab Personal Access Token 时需要以下权限：
- ✅ `api` - 完整 API 访问
- ✅ `read_user` - 读取用户信息
- ✅ `read_repository` - 读取仓库信息
- ✅ `write_repository` - 写入仓库信息

## 🔄 工作流程

### 自动检测功能

工具会自动检测以下信息：

1. **GitLab 项目信息**
   - 从 `git remote` URL 解析项目 ID
   - 支持 HTTP 和 SSH URL 格式
   - 自动提取 GitLab 服务器地址

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

**4. "GitLab API error"**
```bash
# 解决方案：验证 GitLab Token 权限
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/user
```

**5. Conan 包更新失败**
```bash
# 检查必需文件
ls -la conandata.yml conan.win.lock

# 检查 Conan 服务器连接
curl http://your-conan-server.com/v1/ping
```

### 调试模式

启用详细日志输出：

```bash
# 设置调试环境变量
export DEBUG=aiflow:*

# 运行工具
npm run aiflow
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
🎉 Merge Request created: https://gitlab.com/project/-/merge_requests/123
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
│   ├── gitlab-service.ts     # GitLab API
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

## 📞 支持

如有问题或建议，请：

1. 查看 [故障排除](#故障排除) 部分
2. 搜索已有的 [Issues](../../issues)
3. 创建新的 [Issue](../../issues/new)

---

**注意**：使用前请确保已正确配置所有必需的环境变量，并且具有相应服务的访问权限。
