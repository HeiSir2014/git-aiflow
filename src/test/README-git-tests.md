# GitService 新接口测试

本目录包含针对 GitService 新增接口的专门测试文件。

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

## 运行测试

### 运行单个测试文件
```bash
# 运行主要功能测试
npx tsx src/test/git-service-new-methods.test.ts

# 运行单元测试
npx tsx src/test/git-service-branch-operations.test.ts

# 运行分支图测试
npx tsx src/test/git-service-branch-graph.test.ts
```

### 运行所有测试
```bash
# 运行所有 Git 相关测试
npx tsx src/test/run-git-tests.ts
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
