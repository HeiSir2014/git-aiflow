# 🚀 Git-AIFlow Wiki 首页

欢迎使用 **Git-AIFlow** —— 基于 AI 的智能工作流自动化工具！本工具将彻底改变您的开发效率，让繁琐的 Git 操作变得智能化、自动化。

## 🌟 为什么选择 Git-AIFlow？

在现代软件开发中，开发者每天都要面对重复的 Git 操作：
- ✍️ 编写规范的提交信息
- 🌿 创建有意义的分支名称  
- 📋 创建合并请求
- 📦 更新依赖包版本
- 📱 发送团队通知

**Git-AIFlow 让这一切变得智能化！** 只需一个命令，AI 将为您分析代码变更，自动生成专业的提交信息和分支名称，创建合并请求，并通知团队成员。

## 🎯 核心功能概览

### 🤖 AI 智能生成
- **智能提交信息**：遵循 Conventional Commits 规范，自动分析代码差异生成专业提交信息
- **智能分支命名**：基于代码变更内容生成语义化的分支名称
- **多语言支持**：支持各种编程语言的代码分析

### 🔄 一键自动化工作流
```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'primaryColor': '#4f46e5', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#6366f1', 'lineColor': '#8b5cf6', 'secondaryColor': '#1f2937', 'tertiaryColor': '#374151', 'background': '#111827', 'mainBkg': '#1f2937', 'secondBkg': '#374151'}}}%%
graph LR
    A[📝 暂存代码变更<br/>git add .] --> B[🤖 AI 分析差异<br/>生成提交信息]
    B --> C[🌿 创建分支<br/>智能命名]
    C --> D[📤 推送到远程<br/>自动提交]
    D --> E[📋 创建 MR/PR<br/>多平台支持]
    E --> F[📱 团队通知<br/>企业微信]
    
    style A fill:#059669,color:#ffffff
    style B fill:#7c3aed,color:#ffffff  
    style C fill:#2563eb,color:#ffffff
    style D fill:#dc2626,color:#ffffff
    style E fill:#ea580c,color:#ffffff
    style F fill:#16a34a,color:#ffffff
```

### 🌐 多平台 Git 集成
- **GitHub**：完整支持 Pull Request 创建
- **GitLab**：完整支持 Merge Request 创建  
- **Gitee**：支持国内主流 Git 平台
- **企业私有化**：支持企业内部 Git 服务器

### 📦 专业 Conan 包管理
- **版本更新**：自动检测并更新 C++ 包版本
- **依赖管理**：智能处理 `conandata.yml` 和 `conan.win.lock` 文件
- **安全升级**：确保依赖包的安全性和兼容性

## 🛠️ 双工具体系

### 1. 🎨 AIFlow 通用工具 (`aiflow`)
**适用场景**：所有类型的代码开发
- ✨ 功能开发
- 🐛 Bug 修复  
- 📚 文档更新
- 🔧 代码重构

**使用方式**：
```bash
# 暂存变更
git add .

# 一键创建 MR
aiflow
```

### 2. 📦 AIFlow Conan 工具 (`aiflow-conan`)
**适用场景**：C++ 项目依赖管理
- 📈 依赖包版本升级
- 🔒 安全补丁应用
- ⚙️ 包配置优化

**使用方式**：
```bash
# 更新指定包
aiflow-conan zterm

# 指定仓库更新
aiflow-conan winusb repo
```

## ⚡ 快速开始指南

### 第一步：安装工具

#### **npm 直接安装**
```bash
npm install git-aiflow -g
```
#### **从源码安装**
```bash
# 克隆项目
git clone https://github.com/HeiSir2014/git-aiflow.git
cd git-aiflow

# 安装依赖
npm install

# 构建项目  
npm run build

# link
npm link
```

#### 测试

```bash

aiflow --help

git-aiflow --help

```


### 第二步：配置工具
```bash
# 全局配置
aiflow init --global
aiflow init --g

# 交互式配置初始化,当前工作目录
aiflow init

```

💡 **免费模型提醒**：配置时可以使用免费AI模型降低成本，详见 [免费模型配置指南](free-models.md)，推荐首选 **Qwen3-Coder**！

### 第三步：开始使用
```bash
# 暂存您的代码变更
git add .

# 运行 AI 工作流
aiflow
```

就这么简单！🎉

## 📊 工作效率对比

| 传统方式 | Git-AIFlow | 效率提升 |
|---------|------------|---------|
| 手动编写提交信息 (5-10分钟) | AI 自动生成 (10秒) | **30-60倍** |
| 手动创建分支名称 (2-5分钟) | AI 智能命名 (5秒) | **24-60倍** |
| 手动创建 MR + 填写描述 (5-15分钟) | 一键自动创建 (30秒) | **10-30倍** |
| 手动通知团队 (2-5分钟) | 自动发送通知 (5秒) | **24-60倍** |

**总体效率提升：10-50倍！** ⚡

## 🎨 智能特性展示

### 🧠 AI 代码分析示例

**代码变更**：
```typescript
// 新增用户认证功能
export class UserAuthService {
  async login(email: string, password: string) {
    // 登录逻辑
  }
}
```

**AI 自动生成**：
- **提交信息**：`feat(auth): add user authentication service with login functionality`
- **分支名称**：`feat/user-auth-service`
- **MR 标题**：`feat(auth): add user authentication service with login functionality`

### 📝 交互式文件选择功能

当您没有预先暂存文件时，AIFlow 会智能地提供交互式文件选择界面：

```bash
📁 Detected file changes:
──────────────────────────────────────────────────

📝 Modified files:
  1. src/components/UserProfile.tsx
  2. src/api/userService.ts

❓ Untracked files:
  3. src/types/user.ts
  4. README.md

➕ Added files:
  5. src/utils/helpers.ts

🗑️  Deleted files:
  6. src/old/legacy.ts

🎯 File selection options:
  • Enter file numbers (e.g., 1,3,5 or 1-5)
  • Type "all" to stage all files
  • Type "modified" to stage only modified files
  • Type "untracked" to stage only untracked files
  • Press Enter or type "cancel" to cancel

📋 Select files to stage: 1,3,5
```

**选择方式**：
- **数字选择**：`1,3,5` 或 `1-5`（范围选择）
- **关键词选择**：`all`、`modified`、`untracked`
- **取消操作**：直接回车或输入 `cancel`

### 🌿 智能分支命名规则

Git-AIFlow 遵循业界最佳实践：

| 变更类型 | 分支前缀 | 示例 |
|---------|---------|------|
| 新功能 | `feat/` | `feat/user-dashboard` |
| Bug修复 | `fix/` | `fix/login-error` |
| 文档更新 | `docs/` | `docs/api-guide` |
| 代码重构 | `refactor/` | `refactor/auth-service` |
| 样式调整 | `style/` | `style/button-layout` |
| 测试代码 | `test/` | `test/user-service` |
| 构建配置 | `chore/` | `chore/webpack-config` |

## 🔧 高级配置指南

### 配置优先级体系
```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'primaryColor': '#4f46e5', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#6366f1', 'lineColor': '#8b5cf6', 'secondaryColor': '#1f2937', 'tertiaryColor': '#374151', 'background': '#111827', 'mainBkg': '#1f2937', 'secondBkg': '#374151'}}}%%
graph TD
    A[🚀 命令行参数<br/>最高优先级] --> B[📁 本地配置<br/>.aiflow/config.yaml]
    B --> C[🌐 全局配置<br/>~/.config/aiflow/config.yaml]  
    C --> D[🔧 环境变量<br/>最低优先级]
    
    style A fill:#dc2626,color:#ffffff
    style B fill:#ea580c,color:#ffffff
    style C fill:#2563eb,color:#ffffff
    style D fill:#059669,color:#ffffff
```

### 多平台访问令牌配置

```yaml
# 支持多个 Git 平台 (新格式，推荐)
git_platforms:
  # GitHub 平台
  github.com:
    access_token: ghp_xxxxxxxxxxxxxxxxxxxxx

  # GitLab 平台 - 支持 merge_request 设置
  gitlab.example.com:
    access_token: glpat-xxxxxxxxxxxxxxxxxxxxx
    merge_request:
      assignee: username1          # 单个指派人用户名
      assignees:                   # 多个指派人用户名
        - username1
        - username2
      reviewers:                   # 审查者用户名
        - reviewer1
        - reviewer2

  # Gitee 平台
  gitee.com:
    access_token: gitee_xxxxxxxxxxxxxxxxxxxxx

  # 企业内部 Git 服务器
  git.company.com:
    access_token: custom_token_xxxxxxxxx
```

### OpenAI 配置选项

```yaml
openai:
  # API 密钥
  key: sk-your-openai-api-key

  # API 地址（支持代理和第三方服务）
  baseUrl: https://api.openai.com/v1

  # 模型选择（推荐配置）
  model: gpt-4o-mini  # 性价比最佳
  # model: gpt-3.5-turbo  # 经济实惠
  # model: gpt-4  # 最高质量

  # 模型最大上下文token数（可选）- 默认8192
  # 常见模型：gpt-3.5-turbo: 16384, gpt-4: 8192, gpt-4-turbo/4o: 128000
  max_context_tokens: 16384

  # 💡 免费模型推荐：查看 docs/free-models.md
  # 🥇 首选：deepseek/deepseek-chat-v3.1:free (OpenRouter)
```

## 🎯 使用场景详解

### 场景一：日常功能开发
```bash
# 开发新功能
git add src/components/UserProfile.tsx
git add src/api/userService.ts

# AI 自动化处理
aiflow

# 输出示例：
# ✅ 生成提交信息: feat(user): add user profile component with API integration
# ✅ 生成分支名称: feat/user-profile-component  
# 🎉 合并请求创建: https://gitlab.com/project/-/merge_requests/123
```

### 场景二：仅提交模式
```bash
# 仅提交代码变更，不创建 MR
aiflow --commit-only
aiflow -cmo
aiflow -co

# 输出示例：
# ✅ 生成提交信息: fix(auth): resolve login validation issue
# ✅ 成功提交变更
# 📝 提交信息: fix(auth): resolve login validation issue
```

### 场景三：交互式文件选择
```bash
# 直接运行，让工具自动选择文件
aiflow

# 工具会显示交互式文件选择界面
# 用户可以选择要暂存的文件
```

### 场景四：C++ 包更新
```bash
# 当前目录包含 conandata.yml 和 conan.win.lock
aiflow-conan zterm

# 自动流程：
# 📦 检测最新版本: zterm/1.0.0.26
# 📝 更新配置文件
# 🤖 生成提交信息: chore: update zterm package to version 1.0.0.26
# 📋 创建合并请求
# 📱 发送团队通知
```

### 场景五：团队协作
```bash
# 配置企业微信通知
wecom:
  enable: true
  webhook: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your-key

# 自动通知内容：
# 🎉 合并请求已创建，请及时进行代码审查！
# 📋 MR链接: https://gitlab.com/project/-/merge_requests/123
# 🌿 分支信息: user/feat-user-auth-20241201 → main
# 📁 变更文件 (3 个): src/auth.ts, src/types.ts, README.md
```

## 🔍 智能检测功能

### 自动平台检测
Git-AIFlow 能够智能识别您的 Git 托管平台：

```bash
# 自动检测流程
🔍 Git remote URL: git@github.com:user/project.git
📋 检测平台: GitHub
🔑 选择访问令牌: github.com
🌐 API 端点: https://api.github.com
✅ 创建 Pull Request
```

### 智能分支检测
自动选择最合适的目标分支：

| 优先级 | 分支名 | 检测逻辑 |
|-------|--------|---------|
| 1 | `main` | 现代项目主分支 |
| 2 | `master` | 传统项目主分支 |  
| 3 | `develop` | 开发分支 |
| 4 | 当前分支 | 如果是主分支之一 |

## 📈 最佳实践建议

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

### 5. 团队协作最佳实践
- **统一配置**：团队使用相同的配置模板
- **分支策略**：配置合适的分支保护规则
- **通知设置**：合理配置企业微信通知群组
- **权限管理**：为不同角色配置不同的访问权限

## 🚨 故障排除指南

### 常见问题解决

#### 问题 1：配置文件找不到
```bash
❌ Missing required configuration: OpenAI API Key

✅ 解决方案：
aiflow init  # 重新初始化配置
```

#### 问题 2：Git 权限错误
```bash  
❌ Git API error: 401 Unauthorized

✅ 解决方案：
# 检查访问令牌权限
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/user
```

#### 问题 3：Conan 文件缺失
```bash
❌ conandata.yml not found

✅ 解决方案：
# 确保在正确的项目目录中
ls -la conandata.yml conan.win.lock
```

#### 问题 4：交互式文件选择不工作
```bash
❌ 交互式文件选择界面没有显示

✅ 解决方案：
# 确保在 Git 仓库中运行
git status

# 检查是否有文件变更
git diff --name-only

# 确保有未暂存的变更
git diff --cached --name-only
```

#### 问题 5：合并请求指派失败
```bash
❌ 合并请求指派失败

✅ 解决方案：
# 检查用户ID是否正确
# GitLab: 在项目设置中查看用户ID
# GitHub: 使用用户名而不是ID

# 验证访问令牌权限
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/projects/PROJECT_ID/members

# 检查用户是否在项目中
curl -H "PRIVATE-TOKEN: your-token" https://gitlab.com/api/v4/projects/PROJECT_ID/members/USER_ID
```

#### 问题 6：多语言生成不工作
```bash
❌ AI 生成的内容不是指定语言

✅ 解决方案：
# 检查语言代码是否正确
aiflow -ggl zh-CN

# 检查配置文件
git:
  generation_lang: zh-CN

# 支持的语言代码列表
# en, zh-CN, zh-TW, ja, ko, fr, de, es, ru, pt, it
```

#### 问题 7：Windows PowerShell 执行策略错误

**问题现象**：
```powershell
❌ aiflow : 无法加载文件 C:\Users\user\AppData\Roaming\npm\aiflow.ps1，
因为在此系统上禁止运行脚本。
   + CategoryInfo          : SecurityError: (:) []，PSSecurityException
   + FullyQualifiedErrorId : UnauthorizedAccess
```

**根本原因**：
Windows PowerShell 默认的执行策略限制了脚本运行，这是系统安全机制。

**解决方案**：

**方法一：修改执行策略（推荐）**
```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

**方法二：临时绕过**
```powershell
# 每次运行时临时绕过
PowerShell -ExecutionPolicy Bypass -Command "aiflow"
```

**方法三：使用 npx**
```bash
# 替代方案
npx aiflow
```

**验证修复**：
```powershell
# 检查当前策略
Get-ExecutionPolicy -List
# 应显示 CurrentUser: RemoteSigned
```

### 日志分析
Git-AIFlow 提供详细的日志系统：

**日志位置**：
- **Windows**: `%APPDATA%\aiflow\logs\`
- **macOS**: `~/Library/Application Support/aiflow/logs/`  
- **Linux**: `~/.config/aiflow/logs/`

**实时查看日志**：
```bash
# 查看所有日志
tail -f ~/.config/aiflow/logs/aiflow.log

# 仅查看错误
tail -f ~/.config/aiflow/logs/error.log
```

## 🔮 高级功能

### CLI 参数覆盖
临时使用不同配置而无需修改配置文件：

```bash
# 使用不同的 OpenAI 模型
aiflow -om gpt-4 

# 使用不同的访问令牌
aiflow -gat github.com=ghp_temp_token

# 完整参数示例
aiflow -ok sk-temp-key -gat gitlab.com=glpat-temp -we true
```

### 仅提交模式
当您只需要提交代码而不创建合并请求时：

```bash
# 仅提交模式
aiflow --commit-only
aiflow -co  # 短参数

# 使用场景：
# - 修复小问题
# - 文档更新
# - 配置调整
# - 临时提交
```

### 合并请求管理
自动配置指派人和审查者：

```bash
# 使用用户ID配置（旧格式，CLI参数）
aiflow -mrai 123 -mrris 456,789

# 推荐：在配置文件中使用用户名配置（新格式）
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

### 多语言支持
AI 生成内容支持多种语言：

```bash
# 中文生成
aiflow -ggl zh-CN

# 日文生成
aiflow -ggl ja

# 法文生成
aiflow -ggl fr

# 配置文件设置
git:
  generation_lang: zh-CN  # 支持的语言代码
```

**支持的语言**：
- `en` - 英文（默认）
- `zh-CN` - 简体中文
- `zh-TW` - 繁体中文
- `ja` - 日文
- `ko` - 韩文
- `fr` - 法文
- `de` - 德文
- `es` - 西班牙文
- `ru` - 俄文
- `pt` - 葡萄牙文
- `it` - 意大利文

### 批量操作
```bash
# 更新多个 Conan 包
aiflow-conan zterm && aiflow-conan winusb && aiflow-conan boost
```

### 自动化集成
将 Git-AIFlow 集成到 CI/CD 流水线：

```yaml
# GitHub Actions 示例
- name: Auto create PR with AIFlow
  run: |
    git add .
    npx aiflow -ok ${{ secrets.OPENAI_KEY }} -gat github.com=${{ secrets.GITHUB_TOKEN }}
```

## 🎓 学习资源

### 官方文档
- [📖 完整用户指南](README.md)
- [💡 免费模型配置指南](free-models.md) - **推荐首选 Qwen3-Coder、Deepseek-v3.1**
- [🔧 配置参考](config.example.yaml)
- [🌍 English Documentation](README-EN.md)

### 社区支持
- [💬 GitHub Issues](https://github.com/HeiSir2014/git-aiflow/issues)
- [🚀 功能请求](https://github.com/HeiSir2014/git-aiflow/issues/new)
- [🐛 Bug 报告](https://github.com/HeiSir2014/git-aiflow/issues/new)

### 贡献指南
欢迎参与项目贡献！

1. **Fork 项目**：`git fork https://github.com/HeiSir2014/git-aiflow.git`
2. **创建特性分支**：`git checkout -b feat/amazing-feature`  
3. **提交变更**：`git commit -m 'feat: add amazing feature'`
4. **推送分支**：`git push origin feat/amazing-feature`
5. **创建 PR**：在 GitHub 上创建 Pull Request

## 🏆 成功案例

### 案例 1：大型团队协作
> "使用 Git-AIFlow 后，我们团队的代码提交质量显著提升，MR 创建效率提高了 80%，团队成员再也不需要花时间想分支名称和提交信息了。" 
> 
> —— 某科技公司技术总监

### 案例 2：C++ 项目维护  
> "在维护大型 C++ 项目时，依赖包更新是最繁琐的工作。AIFlow Conan 工具让这个过程完全自动化，节省了大量时间。"
>
> —— 高级 C++ 开发工程师

### 案例 3：开源项目管理
> "作为开源项目维护者，Git-AIFlow 帮助我快速处理各种代码变更，AI 生成的提交信息非常专业，符合项目规范。"
>
> —— 开源项目维护者

## 🚀 开始您的高效开发之旅

准备好体验前所未有的开发效率了吗？

1. **⬇️ 立即安装**：`git clone https://github.com/HeiSir2014/git-aiflow.git`
2. **⚙️ 快速配置**：`aiflow init`  
3. **🎯 开始使用**：`git add . && aiflow`

让 AI 成为您的开发助手，专注于创造，而非重复劳动！

---

## 📞 联系我们

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**: [提交问题](https://github.com/HeiSir2014/git-aiflow/issues)
- **Email**: 项目维护者邮箱
- **微信群**: 扫码加入技术交流群

---

*Git-AIFlow - 让每一次提交都充满智慧* ✨
