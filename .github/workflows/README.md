# GitHub Actions Workflows 说明文档

本项目包含完整的 CI/CD 自动化 workflow 系统，用于确保代码质量、安全性和可靠性。

## 📋 Workflow 概览

| Workflow | 文件 | 触发条件 | 主要功能 |
|----------|------|----------|----------|
| **CI/CD Pipeline** | `ci.yml` | Push/PR 到主分支 | 构建、测试、质量检查 |
| **Release** | `release.yml` | Release 发布或手动触发 | 版本发布和 NPM 打包 |
| **Code Quality** | `quality.yml` | Push/PR、定时任务 | 代码质量和安全分析 |
| **Dependency Updates** | `dependency-update.yml` | 每周定时或手动 | 依赖更新管理 |
| **Performance** | `performance.yml` | Push/PR、定时任务 | 性能监控和回归检查 |
| **Documentation** | `docs.yml` | 文档相关变更 | 文档验证和生成 |

## 🚀 CI/CD Pipeline (`ci.yml`)

### 触发条件
```yaml
on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]
  workflow_dispatch:
```

### 主要任务

#### 1. **Lint and Type Check**
- TypeScript 类型检查
- 编译错误检测
- 代码规范验证

#### 2. **Multi-Platform Testing**
- **操作系统**: Ubuntu, Windows, macOS
- **Node.js 版本**: 18, 20, 22
- **测试内容**:
  - 项目构建验证
  - 基础功能测试
  - CLI 命令验证
  - 可执行文件权限检查

#### 3. **Build and Package**
- 项目编译构建
- NPM 包创建
- 构建产物验证
- 包内容分析

#### 4. **Security Audit**
- npm audit 安全扫描
- 漏洞等级检查
- 安全报告生成

#### 5. **Integration Testing**
- CLI 全局安装测试
- 命令功能验证
- 配置文件验证

#### 6. **Cross-Platform Compatibility**
- Windows PowerShell 兼容性
- 跨平台执行测试
- 命令行工具验证

## 📦 Release Workflow (`release.yml`)

### 触发条件
```yaml
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version: # 版本号
      prerelease: # 是否预发布
```

### 发布流程

#### 1. **版本验证** (`validate-release`)
- 版本格式验证 (`x.y.z`)
- package.json 版本一致性检查
- 完整测试套件运行
- 构建完整性验证

#### 2. **多平台构建** (`build-release-artifacts`)
- **矩阵构建**: Ubuntu/Windows/macOS × Node.js 18/20/22
- 版本号更新
- 包安装测试
- CLI 功能验证
- 构建产物上传

#### 3. **GitHub Release** (`create-github-release`)
- 自动生成 Release Notes
- Release 创建
- 构建产物附加
- 版本标签管理

#### 4. **NPM 发布** (`publish-npm`)
- NPM 包构建
- 包内容验证
- 干运行测试
- 正式发布到 NPM
- 发布验证

#### 5. **发布后验证** (`post-release-validation`)
- NPM 安装测试
- CLI 功能验证
- 多平台兼容性确认

### 手动发布流程

1. **前往 Actions 页面**
2. **选择 "Release and Publish"**
3. **点击 "Run workflow"**
4. **填写参数**:
   - `version`: 发布版本号 (如: `1.0.12`)
   - `prerelease`: 是否预发布版本

## 🔍 Code Quality Workflow (`quality.yml`)

### 定时执行
- **每日 2:00 AM UTC** 自动运行
- Push/PR 时触发
- 手动触发支持

### 质量检查项目

#### 1. **CodeQL 安全分析**
- JavaScript/TypeScript 代码扫描
- 安全漏洞检测
- 代码质量问题识别
- 自定义规则配置

#### 2. **依赖漏洞扫描**
- npm audit 深度扫描
- 高危漏洞检测
- 漏洞等级分析
- 修复建议生成

#### 3. **许可证合规检查**
- 依赖许可证扫描
- 许可证兼容性验证
- 批准许可证列表验证
- 合规报告生成

#### 4. **静态代码分析**
- 代码复杂度分析
- 代码模式检查
- TypeScript 严格模式验证
- 包大小分析

#### 5. **性能分析**
- 构建性能测试
- CLI 启动性能
- 内存使用分析
- 性能指标记录

#### 6. **文档质量检查**
- README 完整性验证
- 内联文档检查
- 包元数据验证
- 文档覆盖率分析

#### 7. **兼容性检查**
- Node.js 多版本兼容
- ES Module 兼容性
- 跨平台兼容性

#### 8. **安全最佳实践**
- 敏感数据检查
- 文件权限验证
- .gitignore 完整性

## 📈 Performance Monitoring (`performance.yml`)

### 性能监控内容

#### 1. **构建性能基准**
- 构建时间测量
- 输出大小分析
- 性能指标记录

#### 2. **CLI 性能测试**
- 启动时间测量
- 命令响应时间
- 内存使用分析
- 多平台性能对比

#### 3. **包大小分析**
- 分发包大小监控
- 内容分解分析
- 依赖大小评估

#### 4. **负载测试**
- 并发命令测试
- 配置加载性能
- 错误处理性能

#### 5. **性能对比分析** (仅 PR)
- 与基础分支对比
- 性能回归检测
- 影响分析报告

#### 6. **性能回归检查**
- 性能阈值验证
- 回归检测
- 性能警告

### 性能阈值

- **最大构建时间**: 60 秒
- **最大包大小**: 5MB
- **最大 CLI 启动时间**: 2000ms

## 🔄 Dependency Updates (`dependency-update.yml`)

### 自动化依赖管理

#### 1. **定时检查**
- **每周一 9:00 AM UTC** 执行
- 依赖过期检查
- 更新摘要生成

#### 2. **安全更新**
- `npm audit fix` 自动执行
- 安全补丁应用
- 自动 PR 创建

#### 3. **版本更新**
- **Patch 更新**: 补丁版本
- **Minor 更新**: 次要版本
- **Major 更新**: 主要版本 (手动触发)

#### 4. **漏洞评估**
- 全面漏洞扫描
- 依赖树分析
- 安全报告生成

### 手动依赖更新

1. **前往 Actions 页面**
2. **选择 "Dependency Updates"**
3. **点击 "Run workflow"**
4. **选择更新类型**:
   - `patch`: 补丁更新
   - `minor`: 次要更新
   - `major`: 主要更新
   - `all`: 全部更新

## 📚 Documentation Workflow (`docs.yml`)

### 文档自动化

#### 1. **文档验证**
- README 文件检查
- package.json 元数据验证
- 许可证文件检查
- 内联文档验证

#### 2. **API 文档生成**
- TypeDoc 自动生成
- API 参考文档
- 类型定义文档

#### 3. **CLI 文档生成**
- 命令帮助文档
- 配置参数文档
- 使用示例生成

#### 4. **工作流文档**
- Workflow 说明生成
- 自动化流程文档
- 最佳实践指南

#### 5. **链接验证**
- Markdown 链接检查
- 外部链接验证
- 损坏链接检测

#### 6. **拼写检查**
- 英文文档拼写检查
- 技术术语词典
- 拼写错误报告

#### 7. **GitHub Pages 发布**
- 文档自动发布
- 在线文档更新
- 版本化文档管理

## 🔧 Workflow 配置

### 必需的 Secrets

在 GitHub Repository Settings → Secrets and variables → Actions 中配置：

```bash
# NPM 发布 Token
NPM_TOKEN=npm_xxxxxxxxxxxxxxxx

# GitHub Token (自动提供)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### CodeQL 配置

位置: `.github/codeql/codeql-config.yml`

```yaml
name: "AIFlow CodeQL Configuration"
disable-default-queries: false
queries:
  - uses: security-and-quality
paths:
  - src
paths-ignore:
  - src/test
  - "**/*.test.ts"
```

### 权限要求

工作流需要以下权限：

```yaml
permissions:
  contents: read
  security-events: write  # CodeQL
  pages: write           # 文档发布
  id-token: write        # 安全发布
  pull-requests: write   # PR 评论
```

## 📊 监控和报告

### 工作流状态监控

1. **GitHub Actions 页面**: 实时状态查看
2. **PR 状态检查**: 自动状态报告
3. **Release 状态**: 发布流程跟踪
4. **定时任务**: 定期健康检查

### 生成的报告

- **构建报告**: 构建日志和产物
- **测试报告**: 测试结果和覆盖率
- **安全报告**: 漏洞扫描结果
- **性能报告**: 性能指标和趋势
- **依赖报告**: 依赖分析和更新

### 产物保留

- **构建产物**: 7-30 天
- **测试报告**: 30 天
- **安全扫描**: 30 天
- **性能数据**: 30 天
- **文档**: 永久保留

## 🚨 故障排除

### 常见问题

#### 1. **构建失败**
```bash
# 检查 Node.js 版本兼容性
# 验证 TypeScript 配置
# 检查依赖安装
```

#### 2. **测试失败**
```bash
# 查看测试日志
# 检查环境变量
# 验证配置文件
```

#### 3. **发布失败**
```bash
# 检查 NPM_TOKEN
# 验证版本号格式
# 确认包名可用性
```

#### 4. **权限错误**
```bash
# 检查 GITHUB_TOKEN 权限
# 验证分支保护规则
# 确认 Secrets 配置
```

### 调试技巧

1. **查看详细日志**: 点击失败的步骤查看详细输出
2. **重新运行**: 使用 "Re-run jobs" 重试失败的任务
3. **本地调试**: 在本地复现问题
4. **分步调试**: 使用 workflow_dispatch 手动触发

## 📈 最佳实践

### 开发流程

1. **功能开发**:
   - 创建 feature 分支
   - 本地测试通过
   - 提交 PR 触发 CI

2. **代码审查**:
   - 检查 CI 状态
   - 审查性能影响
   - 验证文档更新

3. **合并发布**:
   - 合并到主分支
   - 创建 Release
   - 自动发布到 NPM

### 维护策略

1. **定期更新**: 每周检查依赖更新
2. **安全监控**: 关注安全扫描结果
3. **性能跟踪**: 监控性能趋势
4. **文档同步**: 保持文档最新

### 质量保证

1. **多平台测试**: 确保跨平台兼容
2. **版本兼容**: 支持多个 Node.js 版本
3. **安全扫描**: 定期安全检查
4. **性能基准**: 监控性能回归

---

## 🤝 贡献指南

如需修改 workflow：

1. **测试变更**: 在 fork 中测试 workflow 变更
2. **文档更新**: 同步更新相关文档
3. **向后兼容**: 确保不破坏现有流程
4. **安全考虑**: 注意敏感信息保护

---

**最后更新**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**版本**: 1.0.0
