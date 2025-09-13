# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 自动版本同步功能：当 release 版本与 package.json 不匹配时自动创建 PR
- CHANGELOG.md 文件维护项目变更历史

### Changed
- 优化 release workflow 以支持版本同步和 CHANGELOG 更新

## [1.0.20] - 2025-09-13

### Added
- feat(docs): enhance documentation with new features and improve logging (#55)
- feat: add AI-powered workflow automation tool

### Changed
- refactor(conanlock-service): 优化 lodash 导入和使用方式 (#59)
- refactor(ui): 优化倒计时显示并减少等待时间 (#57)

### Documentation
- docs(readme): update documentation with new configuration system
- docs(readme): update documentation with new configuration system


## [1.0.20] - 2025-09-12

### Added
- 智能工作流自动化工具，支持 GitLab 合并请求创建
- Conan 包管理工具，支持依赖更新和版本管理
- AI 驱动的代码分析和建议功能
- 多平台 Git 集成支持
- 自动化工作流配置

### Changed
- 优化日志记录和更新检查机制
- 改进倒计时显示并减少等待时间
- 优化 lodash 导入和使用方式
- 增强文档说明和新功能介绍

### Fixed
- 修复多平台兼容性问题
- 改进错误处理和用户反馈

## [1.0.19] - 2025-09-10

### Changed
- 优化 lodash 导入和使用方式
- 改进代码性能和可维护性

## [1.0.2] - 2025-09-07

### Added
- 基础项目结构和核心功能
- 配置文件系统
- 文档更新和配置说明

## [1.0.0] - 2025-09-05

### Added
- 初始版本发布
- AI 工作流自动化工具核心功能
- 支持 GitLab 和 GitHub 平台
- Conan 包管理集成
- OpenAI 集成用于智能分析

---

## 版本说明

- **Major** (X.0.0): 不兼容的 API 更改
- **Minor** (0.X.0): 向后兼容的功能添加
- **Patch** (0.0.X): 向后兼容的错误修复

## 贡献指南

请确保在提交代码时遵循以下约定：

- `feat:` 新功能
- `fix:` 错误修复
- `docs:` 文档更改
- `style:` 代码格式更改（不影响功能）
- `refactor:` 代码重构
- `perf:` 性能改进
- `test:` 添加或修改测试
- `chore:` 构建过程或辅助工具的更改

## 链接

- [项目主页](https://github.com/HeiSir2014/git-aiflow)
- [问题报告](https://github.com/HeiSir2014/git-aiflow/issues)
- [发布页面](https://github.com/HeiSir2014/git-aiflow/releases)
