# 免费模型API配置指南

本文档提供了一些经过验证的免费模型API配置，这些模型都支持工具调用（tool calling）功能，可以与Git-AIFlow完美配合使用。

## ⚠️ 重要提醒

**免费模型通常有以下限制：**
- 响应速度较慢（可能需要等待10-30秒）
- 可能有请求频率限制
- 服务可用性可能不如付费版本稳定
- 但效果通常很好，适合学习和测试使用

## 推荐的免费模型配置

### 1. DeepSeek V3.1 (OpenRouter免费版)

DeepSeek V3.1是一个强大的混合推理模型，支持工具调用和结构化输出。

```yaml
openai: 
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: deepseek/deepseek-chat-v3.1:free
```

**特点：**
- 163,840 上下文长度
- 支持工具调用和结构化输出
- 在代码生成和推理任务上表现优秀
- 完全免费使用

**获取API Key：** [OpenRouter注册](https://openrouter.ai/)

### 2. Qwen2.5-Coder (通过SiliconFlow)

阿里巴巴开源的代码专用模型，特别适合代码分析和生成。

```yaml
openai:
  key: <your-siliconflow-key>
  baseUrl: https://api.siliconflow.cn/v1
  model: Qwen/Qwen2.5-Coder-32B-Instruct
```

**特点：**
- 专门为代码任务优化
- 支持多种编程语言
- 131,072 上下文长度
- 支持工具调用

**获取API Key：** [SiliconFlow注册](https://cloud.siliconflow.cn/)

### 3. ChatGLM4 (通过智谱AI)

清华大学开源的中英双语模型，对中文支持特别好。

```yaml
openai:
  key: <your-zhipuai-key>
  baseUrl: https://open.bigmodel.cn/api/paas/v4
  model: glm-4-flash
```

**特点：**
- 中英文双语支持优秀
- 128,000 上下文长度
- 支持工具调用
- 每日免费额度

**获取API Key：** [智谱AI注册](https://open.bigmodel.cn/)

### 4. Llama 3.2 (通过Groq)

Meta开源的高性能模型，通过Groq提供超快推理速度。

```yaml
openai:
  key: <your-groq-key>
  baseUrl: https://api.groq.com/openai/v1
  model: llama-3.2-90b-text-preview
```

**特点：**
- 推理速度极快
- 支持工具调用
- 每日免费请求限制
- 131,072 上下文长度

**获取API Key：** [Groq注册](https://console.groq.com/)

### 5. Together AI 免费模型

Together AI提供多种开源模型的免费API访问。

```yaml
openai:
  key: <your-together-key>
  baseUrl: https://api.together.xyz/v1
  model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
```

**特点：**
- 多种开源模型选择
- 支持工具调用
- 每月免费额度
- 高性能推理

**获取API Key：** [Together AI注册](https://api.together.xyz/)

### 6. Fireworks AI 免费模型

Fireworks AI提供快速的模型推理服务。

```yaml
openai:
  key: <your-fireworks-key>
  baseUrl: https://api.fireworks.ai/inference/v1
  model: accounts/fireworks/models/llama-v3p2-90b-instruct
```

**特点：**
- 超快推理速度
- 支持工具调用
- 免费试用额度
- 企业级稳定性

**获取API Key：** [Fireworks AI注册](https://fireworks.ai/)

### 7. Hugging Face 推理API

Hugging Face提供多种开源模型的免费推理API。

```yaml
openai:
  key: <your-hf-token>
  baseUrl: https://api-inference.huggingface.co/v1
  model: microsoft/DialoGPT-large
```

**特点：**
- 大量开源模型选择
- 社区驱动
- 免费推理额度
- 支持自定义模型

**获取API Key：** [Hugging Face注册](https://huggingface.co/)

### 8. DeepSeek 官方API

DeepSeek官方提供的高性能免费API。

```yaml
openai:
  key: <your-deepseek-key>
  baseUrl: https://api.deepseek.com/v1
  model: deepseek-chat
```

**特点：**
- 500万token免费额度
- 兼容OpenAI API格式
- 高质量代码生成
- 支持工具调用

**获取API Key：** [DeepSeek官网注册](https://platform.deepseek.com/)

## 免费模型对比表

| 模型服务 | 模型名称 | 免费额度 | 上下文长度 | 工具调用 | 响应速度 | 推荐用途 | 推荐度 |
|---------|----------|----------|------------|----------|----------|----------|----------|
| SiliconFlow | **Qwen/Qwen2.5-Coder-32B-Instruct** | 每日限制 | 131,072 | ✅ | 中等 | **代码生成** | **🥇 首选** |
| OpenRouter | deepseek/deepseek-chat-v3.1:free | 无限制 | 163,840 | ✅ | 慢 | 代码分析 | 🥈 备选 |
| 智谱AI | glm-4-flash | 每日限制 | 128,000 | ✅ | 快 | 中文项目 | 🥉 中文优选 |
| Groq | llama-3.2-90b-text-preview | 每日限制 | 131,072 | ✅ | 极快 | 快速响应 | ⚡ 速度优选 |
| Together AI | meta-llama/Llama-3.2-90B | 每月限制 | 128,000 | ✅ | 快 | 通用任务 | 📦 通用 |
| DeepSeek官方 | deepseek-chat | 500万token | 128,000 | ✅ | 中等 | 推理任务 | 🧠 推理优选 |

## 配置文件示例

### 基础配置
创建 `.aiflow/config.yaml` 文件：

```yaml
# 🥇 推荐配置 - Qwen3-Coder (SiliconFlow)
openai:
  key: "your-siliconflow-key-here"
  baseUrl: "https://api.siliconflow.cn/v1"
  model: "Qwen/Qwen2.5-Coder-32B-Instruct"

git:
  generation_lang: "zh"  # 或 "en"
  squashCommits: true
  removeSourceBranch: true

# 可选：企业微信通知
wecom:
  enable: false
  webhook: ""
```

### 多模型备选配置
为了提高可用性，建议配置多个备选模型：

```yaml
# 🥇 主要配置 - Qwen3-Coder (SiliconFlow) - 首选推荐
openai:
  key: "your-siliconflow-key"
  baseUrl: "https://api.siliconflow.cn/v1"
  model: "Qwen/Qwen2.5-Coder-32B-Instruct"

# 🥈 备选配置1 - DeepSeek V3.1 (OpenRouter)
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "deepseek/deepseek-chat-v3.1:free"

# 🥉 备选配置2 - GLM4 (智谱AI) - 中文项目优选
# openai:
#   key: "your-zhipuai-key"
#   baseUrl: "https://open.bigmodel.cn/api/paas/v4"
#   model: "glm-4-flash"
```

### 针对不同项目类型的配置

#### 代码密集型项目
```yaml
openai:
  key: "your-siliconflow-key"
  baseUrl: "https://api.siliconflow.cn/v1"
  model: "Qwen/Qwen2.5-Coder-32B-Instruct"  # 专门的代码模型
git:
  generation_lang: "en"  # 代码项目建议使用英文
```

#### 中文项目
```yaml
openai:
  key: "your-zhipuai-key"
  baseUrl: "https://open.bigmodel.cn/api/paas/v4"
  model: "glm-4-flash"  # 中文支持优秀
git:
  generation_lang: "zh"  # 中文提交信息
```

#### 快速响应需求
```yaml
openai:
  key: "your-groq-key"
  baseUrl: "https://api.groq.com/openai/v1"
  model: "llama-3.2-90b-text-preview"  # Groq提供极快速度
git:
  generation_lang: "en"
```

## 使用建议

### 1. 模型选择建议

**🥇 首选推荐：Qwen3-Coder 系列**
- **最佳选择**：`Qwen/Qwen2.5-Coder-32B-Instruct` (SiliconFlow)
- **原因**：专为代码任务优化，支持多语言编程，工具调用能力强
- **适用场景**：Git提交分析、代码审查、技术文档生成

**其他推荐：**
- **代码分析备选**：DeepSeek V3.1 (OpenRouter免费版)
- **中文项目优选**：ChatGLM4-Flash (智谱AI)
- **极速响应需求**：Llama 3.2 (Groq)
- **长文本处理**：DeepSeek V3.1 (163K上下文)

### 2. 性能优化
```yaml
# 针对免费模型的优化配置
openai:
  # 使用较小的温度值获得更一致的结果
  temperature: 0.1
  # 确保模型支持工具调用
  model: "deepseek/deepseek-chat-v3.1:free"
```

### 3. 错误处理
免费API可能会遇到限流，建议在代码中添加重试机制：

```bash
# 如果遇到限流错误，稍等片刻再试
aiflow --retry-on-error
```

## 注意事项

1. **API Key安全**：不要将API Key提交到代码仓库
2. **使用限制**：遵守各平台的使用条款和限制
3. **备用方案**：建议配置多个模型作为备选
4. **监控使用量**：定期检查API使用情况避免超限

## 获取更多免费资源

- [OpenRouter免费模型列表](https://openrouter.ai/models?pricing=free)
- [HuggingFace免费推理API](https://huggingface.co/inference-api)
- [SiliconFlow免费额度](https://cloud.siliconflow.cn/pricing)

## 故障排除

如果遇到问题：

1. **检查API Key**：确保key有效且有足够额度
2. **检查网络**：某些API可能需要特定网络环境
3. **查看日志**：使用 `--debug` 参数查看详细日志
4. **更换模型**：尝试其他免费模型作为备选

## 快速设置脚本

### 自动配置脚本
创建一个快速配置脚本 `setup-free-model.sh`：

```bash
#!/bin/bash
echo "AIFlow 免费模型配置向导"
echo "========================"

# 创建配置目录
mkdir -p .aiflow

# 选择模型
echo "请选择免费模型:"
echo "1) 🥇 Qwen2.5-Coder (SiliconFlow) - 首选推荐，代码专用"
echo "2) DeepSeek V3.1 (OpenRouter) - 备选，长上下文"
echo "3) GLM4-Flash (智谱AI) - 中文优化"
echo "4) Llama 3.2 (Groq) - 极速响应"

read -p "请输入选择 (1-4): " choice

case $choice in
  1)
    echo "配置 Qwen2.5-Coder (推荐)..."
    read -p "请输入 SiliconFlow API Key: " api_key
    cat > .aiflow/config.yaml << EOF
openai:
  key: "$api_key"
  baseUrl: "https://api.siliconflow.cn/v1"
  model: "Qwen/Qwen2.5-Coder-32B-Instruct"
git:
  generation_lang: "en"
  squashCommits: true
  removeSourceBranch: true
EOF
    ;;
  2)
    echo "配置 DeepSeek V3.1..."
    read -p "请输入 OpenRouter API Key: " api_key
    cat > .aiflow/config.yaml << EOF
openai:
  key: "$api_key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "deepseek/deepseek-chat-v3.1:free"
git:
  generation_lang: "zh"
  squashCommits: true
  removeSourceBranch: true
EOF
    ;;
  *)
    echo "配置已取消"
    exit 1
    ;;
esac

echo "✅ 配置完成！现在可以使用 'aiflow' 命令了"
```

### 测试脚本
创建测试脚本 `test-free-model.sh`：

```bash
#!/bin/bash
echo "测试 AIFlow 免费模型配置..."

# 检查配置文件
if [ ! -f ".aiflow/config.yaml" ]; then
    echo "❌ 配置文件不存在，请先运行配置脚本"
    exit 1
fi

# 创建测试文件
echo "console.log('Hello AIFlow!');" > test.js
git add test.js

# 测试 AIFlow
echo "🧪 测试 AIFlow..."
aiflow --commit-only

# 清理
git reset HEAD test.js
rm test.js

echo "✅ 测试完成！"
```

## 常见问题解答

### Q: 为什么免费模型响应很慢？
A: 免费模型通常有更多用户共享资源，建议：
- 非高峰时段使用
- 配置多个备选模型
- 对于紧急项目考虑付费版本

### Q: 如何判断模型是否支持工具调用？
A: 在配置文件中添加调试模式：
```yaml
openai:
  debug: true  # 启用调试日志
```

### Q: 免费额度用完了怎么办？
A: 可以：
1. 切换到其他免费服务
2. 等待额度重置（通常每日/每月）
3. 升级到付费版本

### Q: 如何监控API使用量？
A: 大多数服务提供控制台查看使用情况：
- [OpenRouter Dashboard](https://openrouter.ai/activity)
- [SiliconFlow Console](https://cloud.siliconflow.cn/account/usage)
- [智谱AI Console](https://open.bigmodel.cn/usercenter/apikeys)

---

**相关链接：**
- [OpenRouter免费模型](https://openrouter.ai/deepseek/deepseek-chat-v3.1:free)
- [AIFlow GitHub仓库](https://github.com/HeiSir2014/git-aiflow)
- [工具调用文档](https://platform.openai.com/docs/guides/function-calling)

*最后更新：2025年1月*  
*如有问题或建议，请在GitHub提交Issue*
