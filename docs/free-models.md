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

### 2. OpenRouter 免费模型集合

OpenRouter 提供多个高质量的免费模型，以下是详细对比表格（按上下文长度从高到低排序）：

#### OpenRouter 免费模型详细对比表

| 排名 | 模型名称 | 模型ID | 上下文长度 | 参数规模 | 工具调用 | 特色功能 | 适用场景 |
|------|----------|--------|------------|----------|----------|----------|----------|
| 🥇 | **Grok 4 Fast** | `x-ai/grok-4-fast:free` | 2,000,000 | - | ✅ | 多模态，超长上下文 | 长文档分析，复杂任务 |
| 🥈 | **DeepSeek V3.1** | `deepseek/deepseek-chat-v3.1:free` | 163,840 | 671B (37B激活) | ✅ | 混合架构，FP8优化 | 代码生成，分析任务 |
| 🥉 | **DeepSeek V3 0324** | `deepseek/deepseek-chat-v3-0324:free` | 163,840 | 685B | ✅ | MoE架构 | 通用任务，代码分析 |
| 4 | **Qwen3 Coder 480B** | `qwen/qwen3-coder-480b-a35b-07-25:free` | 262,144 | 480B (35B激活) | ✅ | 代码专用，MoE | 代码生成，函数调用 |
| 5 | **Qwen3 235B** | `qwen/qwen3-235b-a22b-04-28:free` | 131,072 | 235B (22B激活) | ✅ | 多语言，结构化输出 | 多语言任务，通用 |
| 6 | **GLM 4.5 Air** | `z-ai/glm-4.5-air:free` | 131,072 | - | ✅ | 轻量化，智能体优化 | 实时交互，工具使用 |
| 7 | **Gemini 2.0 Flash Exp** | `google/gemini-2.0-flash-exp:free` | 1,048,576 | - | ✅ | 多模态，快速TTFT | 多模态理解，编码 |

#### 详细配置示例

**🥇 推荐：Grok 4 Fast (最大上下文)**
```yaml
openai:
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: x-ai/grok-4-fast:free
```

**🥈 推荐：DeepSeek V3.1 (最佳代码能力)**
```yaml
openai:
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: deepseek/deepseek-chat-v3.1:free
```

**🥉 备选：Qwen3 Coder (代码专用)**
```yaml
openai:
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: qwen/qwen3-coder-480b-a35b-07-25:free
```

#### 支持的参数对比

| 模型 | tools | tool_choice | structured_outputs | response_format | max_tokens | temperature | top_p |
|------|-------|-------------|-------------------|----------------|------------|------------|-------|
| Grok 4 Fast | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DeepSeek V3.1 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| DeepSeek V3 0324 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Qwen3 Coder 480B | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Qwen3 235B | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GLM 4.5 Air | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Gemini 2.0 Flash | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

**获取API Key：** [OpenRouter注册](https://openrouter.ai/)

### 3. Qwen2.5-Coder (通过SiliconFlow)

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

### 4. ChatGLM4 (通过智谱AI)

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

### 5. Llama 3.2 (通过Groq)

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

### 6. Together AI 免费模型

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

### 7. Fireworks AI 免费模型

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

### 8. Hugging Face 推理API

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

### 9. DeepSeek 官方API

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

### 按吞吐量/性能排序的完整对比

| 排名 | 模型服务 | 模型名称 | 免费额度 | 上下文长度 | 工具调用 | 响应速度 | 推荐用途 | 推荐度 |
|------|---------|----------|----------|------------|----------|----------|----------|----------|
| 🥇 | **OpenRouter** | **Grok 4 Fast** | 无限制 | 2,000,000 | ✅ | 快 | **长文档分析** | **🏆 超长上下文** |
| 🥈 | **OpenRouter** | **Gemini 2.0 Flash Exp** | 无限制 | 1,048,576 | ✅ | 极快 | **多模态理解** | **⚡ 速度优选** |
| 🥉 | **OpenRouter** | **Qwen3 Coder 480B** | 无限制 | 262,144 | ✅ | 中等 | **代码生成** | **💻 代码专用** |
| 4 | **OpenRouter** | **DeepSeek V3.1** | 无限制 | 163,840 | ✅ | 慢 | **高质量分析** | **🧠 质量优选** |
| 5 | **OpenRouter** | **DeepSeek V3 0324** | 无限制 | 163,840 | ✅ | 慢 | 代码分析 | 🔄 备选 |
| 6 | **SiliconFlow** | **Qwen2.5-Coder-32B** | 每日限制 | 131,072 | ✅ | 中等 | 代码生成 | 🛠️ 实用 |
| 7 | **OpenRouter** | **Qwen3 235B** | 无限制 | 131,072 | ✅ | 中等 | 多语言任务 | 🌐 多语言 |
| 8 | **OpenRouter** | **GLM 4.5 Air** | 无限制 | 131,072 | ✅ | 快 | 实时交互 | 💬 交互优选 |
| 9 | Groq | llama-3.2-90b-text-preview | 每日限制 | 131,072 | ✅ | 极快 | 快速响应 | ⚡ 极速 |
| 10 | 智谱AI | glm-4-flash | 每日限制 | 128,000 | ✅ | 快 | 中文项目 | 🇨🇳 中文优选 |
| 11 | Together AI | meta-llama/Llama-3.2-90B | 每月限制 | 128,000 | ✅ | 快 | 通用任务 | 📦 通用 |
| 12 | DeepSeek官方 | deepseek-chat | 500万token | 128,000 | ✅ | 中等 | 通用任务 | 💰 官方

## 配置文件示例

### 基础配置
创建 `.aiflow/config.yaml` 文件：

```yaml
# 🥇 推荐配置 - Grok 4 Fast (OpenRouter) - 超长上下文，完全免费
openai:
  key: "sk-or-v1-your-openrouter-key-here"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "x-ai/grok-4-fast:free"

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
# 🥇 主要配置 - Grok 4 Fast (OpenRouter) - 超长上下文首选
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "x-ai/grok-4-fast:free"

# 🥈 备选配置1 - Qwen3 Coder 480B (OpenRouter) - 代码专用
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "qwen/qwen3-coder-480b-a35b-07-25:free"

# 🥉 备选配置2 - DeepSeek V3.1 (OpenRouter) - 高质量推理
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "deepseek/deepseek-chat-v3.1:free"

# 🏃 备选配置3 - Gemini 2.0 Flash (OpenRouter) - 极速响应
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "google/gemini-2.0-flash-exp:free"
```

### 针对不同项目类型的配置

#### 代码密集型项目
```yaml
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "qwen/qwen3-coder-480b-a35b-07-25:free"  # 专门的代码模型，480B参数
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
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "google/gemini-2.0-flash-exp:free"  # Gemini 2.0 极快TTFT
git:
  generation_lang: "en"
```

## 使用建议

### 1. 模型选择建议

**🥇 首选推荐：OpenRouter 免费模型集合**
- **超长上下文首选**：`x-ai/grok-4-fast:free` (200万token上下文)
- **代码生成首选**：`qwen/qwen3-coder-480b-a35b-07-25:free` (480B参数，代码专用)
- **极速响应首选**：`google/gemini-2.0-flash-exp:free` (最快TTFT)
- **高质量分析首选**：`deepseek/deepseek-chat-v3.1:free` (混合架构，高质量输出)

**为什么选择 OpenRouter 免费模型：**
- ✅ **免费额度充足**：免费模型无使用限制，无需付费
- ✅ **模型丰富**：7个高质量免费模型可选
- ✅ **上下文超长**：最高支持200万token
- ✅ **功能先进**：支持工具调用、结构化输出

**其他平台备选：**
- **中文项目优选**：ChatGLM4-Flash (智谱AI)
- **官方稳定性**：DeepSeek官方API
- **极速响应**：Llama 3.2 (Groq)

### 2. 性能优化
```yaml
# 针对 OpenRouter 免费模型的优化配置
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  # 使用较小的温度值获得更一致的结果
  temperature: 0.1
  # 推荐模型：超长上下文，高质量输出
  model: "x-ai/grok-4-fast:free"
```

### 3. 错误处理
免费API可能会遇到限流，如果遇到错误：

1. **检查网络连接**：确保网络正常
2. **检查API Key**：验证密钥是否正确且有效
3. **稍后重试**：如遇限流，等待几分钟后重新执行
4. **更换模型**：尝试其他免费模型作为备选

## 注意事项

1. **API Key安全**：不要将API Key提交到代码仓库
2. **使用限制**：遵守各平台的使用条款和限制
3. **备用方案**：建议配置多个模型作为备选
4. **监控使用量**：定期检查API使用情况避免超限

## 获取更多免费资源

### OpenRouter 相关链接
- 🔗 [OpenRouter 注册](https://openrouter.ai/) - 获取免费API Key
- 📊 [免费模型列表](https://openrouter.ai/models?pricing=free) - 查看所有免费模型
- 📈 [使用统计](https://openrouter.ai/activity) - 监控API使用情况
- 📚 [API文档](https://openrouter.ai/docs) - 详细使用说明
- 💬 [Discord社区](https://discord.gg/openrouter) - 获取技术支持

### 其他免费资源
- [HuggingFace免费推理API](https://huggingface.co/inference-api)
- [SiliconFlow免费额度](https://cloud.siliconflow.cn/pricing)
- [智谱AI免费额度](https://open.bigmodel.cn/pricing)

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
A: 可以通过以下方式判断：
1. **查看文档表格**：本文档的对比表格已标注各模型的工具调用支持情况
2. **实际测试**：运行 aiflow 命令，查看日志输出中是否有工具调用相关信息
3. **API响应**：不支持工具调用的模型会返回相应错误信息

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
