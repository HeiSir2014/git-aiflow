# 测试文件说明

本目录包含针对项目各个组件的专门测试文件，包括 GitService 新增接口测试和 OpenAI 服务性能测试。

## 测试文件说明

### 1. `git-service-new-methods.test.ts`
- **功能**: 测试所有新增的 GitService 方法
- **覆盖范围**: 
  - `getBaseBranch()` - 检测父分支
  - `getMergeBase()` - 获取合并基础
  - `getBranchGraph()` - 生成分支图
  - `getDiffBetweenBranches()` - 获取分支间差异
  - `getChangedFilesBetweenBranches()` - 获取变更文件列表
  - `hasRemoteBranch()` - 检查远程分支存在性
  - 协议检测相关方法
  - 缓存管理方法

### 2. `git-service-branch-operations.test.ts`
- **功能**: 单元测试，测试边界情况和错误处理
- **覆盖范围**:
  - 参数验证
  - 错误处理
  - 边界条件
  - 异步操作
  - 缓存管理

### 3. `git-service-branch-graph.test.ts`
- **功能**: 专门测试分支图功能
- **覆盖范围**:
  - 不同限制参数
  - 性能测试
  - 内容分析
  - 错误处理

### 4. `run-git-tests.ts`
- **功能**: 运行所有 Git 相关测试的脚本
- **用途**: 批量执行所有测试并汇总结果

## OpenAI 服务测试

### 5. `openai-batch-test.ts`
- **功能**: OpenAI 服务批量性能测试
- **覆盖范围**:
  - 多个 OpenAI 提供商性能对比
  - 不同模型的响应时间和成功率测试
  - Reasoning 模式支持测试
  - 并发请求性能测试
  - 详细的性能统计和分析
  - 错误分析和报告

### 6. `openai-json-parse.test.ts`
- **功能**: 测试 OpenAI 响应的 JSON 解析功能
- **覆盖范围**: 不同格式的 AI 响应解析测试

### 7. `test-performance.ts`
- **功能**: Logger 性能测试
- **覆盖范围**: 单例模式、缓存性能、内存使用等

### 8. `openai-sdk-test.ts`
- **功能**: OpenAI SDK集成验证测试
- **覆盖范围**: 
  - 验证官方OpenAI SDK正常工作
  - 测试标准模式和reasoning模式
  - 性能对比分析
  - 基本功能验证

### 9. `openai-reasoning-config-demo.ts`
- **功能**: OpenAI Reasoning配置演示
- **覆盖范围**: 
  - 演示不同的reasoning配置选项
  - OpenAI-style和Anthropic-style配置
  - 配置验证和错误处理
  - 使用示例和最佳实践

### 10. `run-all-tests.ts`
- **功能**: 运行所有项目测试的综合测试脚本
- **覆盖范围**: 
  - 自动检测测试环境和前置条件
  - 按顺序执行所有测试套件
  - 生成详细的性能报告和统计
  - 区分必需测试和可选测试
  - 导出测试结果到JSON文件

## 运行测试

### 运行单个测试文件

#### Git 服务测试
```bash
# 运行主要功能测试
npm run test:git-new-methods

# 运行单元测试
npm run test:git-branch-ops

# 运行分支图测试
npm run test:git-branch-graph

# 运行所有 Git 相关测试
npm run test:git-all
```

#### OpenAI 服务测试
```bash
# 运行 OpenAI 批量性能测试
npm run test:openai-batch

# 运行 OpenAI 批量性能测试（调试模式）
npm run test:openai-batch-debug

# 运行 OpenAI Reasoning配置演示
npm run test:openai-reasoning-config

# 运行 OpenAI JSON 解析测试
npm run test:openai-parse

# 运行 OpenAI SDK 集成测试
npm run test:openai-sdk

# 运行其他测试
npm run test:config
npm run test:conan
npm run test:shell-multiline
npm run test:update-checker

# 运行所有测试
npm run test:all
```

#### 环境变量配置
```bash
# OpenAI 批量测试配置
export OPENAI_KEY=your-openai-api-key
export OPENAI_BASE_URL=https://api.openai.com/v1  # 可选
export TEST_ITERATIONS=5                          # 测试迭代次数，默认3
export CONCURRENT_REQUESTS=3                      # 并发请求数，默认2
export TEST_TIMEOUT=30000                         # 超时时间(ms)，默认30000

# Reasoning模式配置
export OPENAI_REASONING=true                      # 简单布尔值

# 自定义提供商配置（JSON格式）
export CUSTOM_OPENAI_PROVIDERS='[{
  "name": "DeepSeek",
  "baseUrl": "https://api.deepseek.com/v1",
  "models": ["deepseek-chat", "deepseek-coder"],
  "apiKey": "your-deepseek-key",
  "supportsReasoning": false,
  "description": "DeepSeek API"
}]'
```

#### Reasoning配置选项
```yaml
# 配置文件中的reasoning配置示例
openai:
  key: your-api-key
  baseUrl: https://api.openai.com/v1
  model: o1-preview
  
  # 简单布尔值（向后兼容）
  reasoning: true
  
  # 或者使用详细配置
  reasoning:
    enabled: true
    effort: high              # high, medium, low (OpenAI-style)
    max_tokens: 2000         # 最大推理tokens (Anthropic-style)
    exclude: false           # 是否从响应中排除推理tokens
```

#### 代码中使用Reasoning配置
```typescript
// 1. 简单布尔值（向后兼容）
const service1 = new OpenAiService(key, url, model, true);

// 2. 高努力推理
const service2 = new OpenAiService(key, url, model, {
  enabled: true,
  effort: 'high'
});

// 3. 限制推理tokens
const service3 = new OpenAiService(key, url, model, {
  enabled: true,
  max_tokens: 2000
});

// 4. 复合配置
const service4 = new OpenAiService(key, url, model, {
  enabled: true,
  effort: 'medium',
  max_tokens: 1500,
  exclude: false
});
```

## 测试环境要求

1. **Git 仓库**: 需要在 Git 仓库中运行测试
2. **Node.js**: 需要 Node.js 环境
3. **TypeScript**: 需要 tsx 或 ts-node 来运行 TypeScript 文件

## 测试覆盖的新接口

### 分支操作接口
- `getBaseBranch(): string | null` - 获取父分支
- `getMergeBase(otherBranch: string): string | null` - 获取合并基础
- `getBranchGraph(limit?: number): string` - 生成分支图

### 分支差异接口
- `getDiffBetweenBranches(baseBranch: string, targetBranch: string): string` - 获取分支间差异
- `getChangedFilesBetweenBranches(baseBranch: string, targetBranch: string): string[]` - 获取变更文件

### 远程分支接口
- `hasRemoteBranch(branchName: string): boolean` - 检查远程分支存在性

### 协议检测接口
- `extractHostnameFromRemoteUrl(remoteUrl?: string): string` - 提取主机名
- `extractBaseUrlFromRemoteUrl(remoteUrl?: string): Promise<string>` - 提取基础URL
- `parseProjectPathFromUrl(remoteUrl?: string): string | null` - 解析项目路径

### 缓存管理接口
- `getProtocolCache(): Record<string, string>` - 获取协议缓存
- `clearProtocolCache(hostname?: string): void` - 清除协议缓存
- `forceDetectProtocolForHost(hostname: string): Promise<string>` - 强制检测协议

## 注意事项

1. 某些测试需要在 Git 仓库中运行才能获得有意义的结果
2. 网络相关的测试（如协议检测）可能需要网络连接
3. 测试结果可能因仓库状态而异
4. 建议在开发环境中运行测试，避免影响生产代码
