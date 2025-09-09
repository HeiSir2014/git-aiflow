# GitHub Actions Workflows 概览

本项目配置了完整的 CI/CD 自动化流程，包含代码质量检查、安全扫描、性能监控和自动发布等功能。

## 📋 快速概览

### 🔄 自动触发的 Workflows

| Workflow | 触发时机 | 主要功能 |
|----------|----------|----------|
| **CI/CD Pipeline** | 每次 Push/PR | 构建、测试、质量检查 |
| **Code Quality** | 每日 + Push/PR | 安全扫描、代码分析 |
| **Performance** | 每日 + Push/PR | 性能监控、回归检查 |
| **Dependency Updates** | 每周一 | 依赖更新、安全补丁 |
| **Documentation** | 文档变更时 | 文档验证、生成 |

### 🚀 手动触发的 Workflows

| Workflow | 使用场景 | 操作方法 |
|----------|----------|----------|
| **Release** | 发布新版本 | Actions → Release → Run workflow |
| **Dependency Updates** | 紧急依赖更新 | Actions → Dependency Updates → 选择更新类型 |
| **Performance** | 性能基准测试 | Actions → Performance → Run workflow |

## 🎯 核心功能

### ✅ 代码质量保证
- **多平台测试**: Ubuntu, Windows, macOS
- **多版本兼容**: Node.js 18, 20, 22
- **TypeScript 严格检查**: 类型安全保证
- **代码规范**: ESLint + Prettier 风格检查

### 🔒 安全保障
- **CodeQL 分析**: GitHub 原生安全扫描
- **依赖扫描**: npm audit + 漏洞检测
- **许可证检查**: 开源许可证合规性
- **敏感数据检测**: 防止密钥泄露

### 📊 性能监控
- **构建性能**: 构建时间和包大小监控
- **CLI 性能**: 启动时间和响应速度
- **回归检测**: 性能退化自动告警
- **基准对比**: PR 性能影响分析

### 📦 自动发布
- **版本管理**: 语义化版本控制
- **多平台构建**: 跨平台兼容性验证
- **NPM 发布**: 自动化包发布流程
- **发布验证**: 发布后功能验证

## 🚨 重要阈值

### 性能限制
```yaml
最大构建时间: 60 秒
最大包大小: 5MB
最大 CLI 启动时间: 2000ms
```

### 安全要求
```yaml
漏洞等级: 禁止 high/critical 漏洞
许可证: 仅允许 MIT, Apache-2.0 等开源许可
代码扫描: 必须通过 CodeQL 检查
```

## 🔧 配置要求

### Repository Secrets
在 GitHub Settings → Secrets 中配置：

```bash
NPM_TOKEN     # NPM 发布密钥
GITHUB_TOKEN  # GitHub API 访问 (自动提供)
```

### 分支保护
建议为主分支配置保护规则：

```yaml
require_status_checks: true
required_status_checks:
  - "Lint and Type Check"
  - "Multi-Platform Testing"
  - "Security Audit"
  - "Performance Regression Check"
```

## 📈 使用指南

### 日常开发流程

1. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/your-feature
   ```

2. **创建 Pull Request**
   - CI 自动运行全部检查
   - 查看性能影响报告
   - 等待代码审查

3. **合并到主分支**
   - 所有检查通过后合并
   - 主分支 CI 再次验证

### 发布新版本

1. **准备发布**
   ```bash
   # 确保主分支是最新的
   git checkout main
   git pull origin main
   ```

2. **创建 Release**
   - 前往 GitHub → Releases → Create new release
   - 或使用 Actions → Release workflow

3. **自动化流程**
   - 版本验证 → 多平台构建 → NPM 发布 → 验证

### 依赖管理

1. **自动更新** (每周一执行)
   - 安全补丁自动应用
   - 创建 PR 供审查

2. **手动更新**
   ```bash
   # 前往 Actions → Dependency Updates
   # 选择更新类型: patch/minor/major
   ```

## 📊 监控面板

### 实时状态
- **Actions 页面**: 所有 workflow 运行状态
- **PR 检查**: Pull request 自动状态检查
- **Release 状态**: 发布流程实时跟踪

### 报告查看
- **构建产物**: Actions → 相应 workflow → Artifacts
- **测试报告**: 下载 test-results 产物
- **安全报告**: 下载 security-scan 产物
- **性能数据**: 下载 performance-metrics 产物

## 🆘 故障排除

### 常见问题

#### CI 失败
```bash
# 检查步骤:
1. 查看失败的 job 日志
2. 本地复现问题: npm ci && npm run build
3. 检查 Node.js/npm 版本兼容性
4. 验证依赖是否有冲突
```

#### 发布失败
```bash
# 检查步骤:
1. 验证 NPM_TOKEN 是否有效
2. 检查版本号是否已存在
3. 确认包名是否可用
4. 查看 npm audit 是否有高危漏洞
```

#### 性能回归
```bash
# 检查步骤:
1. 查看性能对比报告
2. 分析包大小增长原因
3. 检查是否引入大型依赖
4. 优化代码或配置
```

### 调试技巧

1. **本地调试**
   ```bash
   # 模拟 CI 环境
   npm ci
   npm run build
   npm run test:config
   npm pack
   ```

2. **查看详细日志**
   - 点击失败的步骤
   - 展开完整日志输出
   - 查找错误关键信息

3. **重新运行**
   - 使用 "Re-run jobs" 重试
   - 可以只重试失败的 job

## 📚 进一步了解

- **详细文档**: [.github/workflows/README.md](.github/workflows/README.md)
- **配置文件**: [.github/workflows/](.github/workflows/)
- **项目文档**: [README.md](README.md)
