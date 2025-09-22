# Free Model API Configuration Guide

This document provides verified free model API configurations that support tool calling functionality and work perfectly with Git-AIFlow.

## ⚠️ Important Notes

**Free models typically have the following limitations:**
- Slower response times (may require 10-30 seconds of waiting)
- Possible request rate limits
- Service availability may be less stable than paid versions
- However, they usually perform well and are suitable for learning and testing

## Recommended Free Model Configurations

### 1. DeepSeek V3.1 (OpenRouter Free)

DeepSeek V3.1 is a powerful hybrid reasoning model that supports tool calling and structured output.

```yaml
openai: 
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: deepseek/deepseek-chat-v3.1:free
```

**Features:**
- 163,840 context length
- Supports tool calling and structured output
- Excellent performance in code generation and reasoning tasks
- Completely free to use

**Get API Key:** [OpenRouter Registration](https://openrouter.ai/)

### 2. OpenRouter Free Model Collection

OpenRouter provides multiple high-quality free models. Here's a detailed comparison table (sorted by context length from high to low):

#### OpenRouter Free Models Detailed Comparison

| Rank | Model Name | Model ID | Context Length | Parameters | Tool Calling | Key Features | Use Cases |
|------|------------|----------|----------------|------------|--------------|--------------|-----------|
| 🥇 | **Grok 4 Fast** | `x-ai/grok-4-fast:free` | 2,000,000 | - | ✅ | Multimodal, ultra-long context | Long document analysis, complex tasks |
| 🥈 | **DeepSeek V3.1** | `deepseek/deepseek-chat-v3.1:free` | 163,840 | 671B (37B active) | ✅ | Hybrid architecture, FP8 optimized | Code generation, analysis tasks |
| 🥉 | **DeepSeek V3 0324** | `deepseek/deepseek-chat-v3-0324:free` | 163,840 | 685B | ✅ | MoE architecture | General tasks, code analysis |
| 4 | **Qwen3 Coder 480B** | `qwen/qwen3-coder-480b-a35b-07-25:free` | 262,144 | 480B (35B active) | ✅ | Code-specialized, MoE | Code generation, function calling |
| 5 | **Qwen3 235B** | `qwen/qwen3-235b-a22b-04-28:free` | 131,072 | 235B (22B active) | ✅ | Multilingual, structured output | Multilingual tasks, general |
| 6 | **GLM 4.5 Air** | `z-ai/glm-4.5-air:free` | 131,072 | - | ✅ | Lightweight, agent-optimized | Real-time interaction, tool usage |
| 7 | **Gemini 2.0 Flash Exp** | `google/gemini-2.0-flash-exp:free` | 1,048,576 | - | ✅ | Multimodal, fast TTFT | Multimodal understanding, coding |

#### Detailed Configuration Examples

**🥇 Recommended: Grok 4 Fast (Maximum Context)**
```yaml
openai:
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: x-ai/grok-4-fast:free
```

**🥈 Recommended: DeepSeek V3.1 (Best Code Capability)**
```yaml
openai:
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: deepseek/deepseek-chat-v3.1:free
```

**🥉 Alternative: Qwen3 Coder (Code-Specialized)**
```yaml
openai:
  key: <your-openrouter-key>
  baseUrl: https://openrouter.ai/api/v1
  model: qwen/qwen3-coder-480b-a35b-07-25:free
```

#### Supported Parameters Comparison

| Model | tools | tool_choice | structured_outputs | response_format | max_tokens | temperature | top_p |
|-------|-------|-------------|-------------------|----------------|------------|------------|-------|
| Grok 4 Fast | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DeepSeek V3.1 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| DeepSeek V3 0324 | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Qwen3 Coder 480B | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Qwen3 235B | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GLM 4.5 Air | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Gemini 2.0 Flash | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

**Get API Key:** [OpenRouter Registration](https://openrouter.ai/)

### 3. Qwen2.5-Coder (via SiliconFlow)

Alibaba's open-source code-specialized model, particularly suitable for code analysis and generation.

```yaml
openai:
  key: <your-siliconflow-key>
  baseUrl: https://api.siliconflow.cn/v1
  model: Qwen/Qwen2.5-Coder-32B-Instruct
```

**Features:**
- Specifically optimized for coding tasks
- Supports multiple programming languages
- 131,072 context length
- Supports tool calling

**Get API Key:** [SiliconFlow Registration](https://cloud.siliconflow.cn/)

### 4. ChatGLM4 (via ZhipuAI)

Tsinghua University's open-source bilingual model with excellent Chinese support.

```yaml
openai:
  key: <your-zhipuai-key>
  baseUrl: https://open.bigmodel.cn/api/paas/v4
  model: glm-4-flash
```

**Features:**
- Excellent Chinese-English bilingual support
- 128,000 context length
- Supports tool calling
- Daily free quota

**Get API Key:** [ZhipuAI Registration](https://open.bigmodel.cn/)

### 5. Llama 3.2 (via Groq)

Meta's open-source high-performance model with ultra-fast inference speed through Groq.

```yaml
openai:
  key: <your-groq-key>
  baseUrl: https://api.groq.com/openai/v1
  model: llama-3.2-90b-text-preview
```

**Features:**
- Extremely fast inference speed
- Supports tool calling
- Daily free request limits
- 131,072 context length

**Get API Key:** [Groq Registration](https://console.groq.com/)

### 6. Together AI Free Models

Together AI provides free API access to various open-source models.

```yaml
openai:
  key: <your-together-key>
  baseUrl: https://api.together.xyz/v1
  model: meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo
```

**Features:**
- Multiple open-source model choices
- Supports tool calling
- Monthly free quota
- High-performance inference

**Get API Key:** [Together AI Registration](https://api.together.xyz/)

### 7. Fireworks AI Free Models

Fireworks AI provides fast model inference services.

```yaml
openai:
  key: <your-fireworks-key>
  baseUrl: https://api.fireworks.ai/inference/v1
  model: accounts/fireworks/models/llama-v3p2-90b-instruct
```

**Features:**
- Ultra-fast inference speed
- Supports tool calling
- Free trial quota
- Enterprise-grade stability

**Get API Key:** [Fireworks AI Registration](https://fireworks.ai/)

### 8. Hugging Face Inference API

Hugging Face provides free inference APIs for various open-source models.

```yaml
openai:
  key: <your-hf-token>
  baseUrl: https://api-inference.huggingface.co/v1
  model: microsoft/DialoGPT-large
```

**Features:**
- Extensive open-source model selection
- Community-driven
- Free inference quota
- Supports custom models

**Get API Key:** [Hugging Face Registration](https://huggingface.co/)

### 9. DeepSeek Official API

High-performance free API provided by DeepSeek officially.

```yaml
openai:
  key: <your-deepseek-key>
  baseUrl: https://api.deepseek.com/v1
  model: deepseek-chat
```

**Features:**
- 5 million token free quota
- Compatible with OpenAI API format
- High-quality code generation
- Supports tool calling

**Get API Key:** [DeepSeek Official Registration](https://platform.deepseek.com/)

## Free Model Comparison Table

### Complete Comparison Sorted by Throughput/Performance

| Rank | Service | Model Name | Free Quota | Context Length | Tool Calling | Response Speed | Recommended Use | Rating |
|------|---------|------------|------------|----------------|--------------|----------------|-----------------|--------|
| 🥇 | **OpenRouter** | **Grok 4 Fast** | Unlimited | 2,000,000 | ✅ | Fast | **Long document analysis** | **🏆 Ultra-long context** |
| 🥈 | **OpenRouter** | **Gemini 2.0 Flash Exp** | Unlimited | 1,048,576 | ✅ | Ultra-fast | **Multimodal understanding** | **⚡ Speed champion** |
| 🥉 | **OpenRouter** | **Qwen3 Coder 480B** | Unlimited | 262,144 | ✅ | Medium | **Code generation** | **💻 Code specialist** |
| 4 | **OpenRouter** | **DeepSeek V3.1** | Unlimited | 163,840 | ✅ | Slow | **High-quality analysis** | **🧠 Quality choice** |
| 5 | **OpenRouter** | **DeepSeek V3 0324** | Unlimited | 163,840 | ✅ | Slow | Code analysis | 🔄 Alternative |
| 6 | **SiliconFlow** | **Qwen2.5-Coder-32B** | Daily limit | 131,072 | ✅ | Medium | Code generation | 🛠️ Practical |
| 7 | **OpenRouter** | **Qwen3 235B** | Unlimited | 131,072 | ✅ | Medium | Multilingual tasks | 🌐 Multilingual |
| 8 | **OpenRouter** | **GLM 4.5 Air** | Unlimited | 131,072 | ✅ | Fast | Real-time interaction | 💬 Interactive choice |
| 9 | Groq | llama-3.2-90b-text-preview | Daily limit | 131,072 | ✅ | Ultra-fast | Quick response | ⚡ Lightning fast |
| 10 | ZhipuAI | glm-4-flash | Daily limit | 128,000 | ✅ | Fast | Chinese projects | 🇨🇳 Chinese preferred |
| 11 | Together AI | meta-llama/Llama-3.2-90B | Monthly limit | 128,000 | ✅ | Fast | General tasks | 📦 General purpose |
| 12 | DeepSeek Official | deepseek-chat | 5M tokens | 128,000 | ✅ | Medium | General tasks | 💰 Official |

## Configuration File Examples

### Basic Configuration
Create `.aiflow/config.yaml` file:

```yaml
# 🥇 Recommended Config - Grok 4 Fast (OpenRouter) - Ultra-long context, completely free
openai:
  key: "sk-or-v1-your-openrouter-key-here"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "x-ai/grok-4-fast:free"

git:
  generation_lang: "en"  # or "zh" 
  squashCommits: true
  removeSourceBranch: true

# Optional: WeChat Work notifications
wecom:
  enable: false
  webhook: ""
```

### Multi-Model Fallback Configuration
To improve availability, it's recommended to configure multiple fallback models:

```yaml
# 🥇 Primary Config - Grok 4 Fast (OpenRouter) - Ultra-long context preferred
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "x-ai/grok-4-fast:free"

# 🥈 Fallback Config 1 - Qwen3 Coder 480B (OpenRouter) - Code-specialized
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "qwen/qwen3-coder-480b-a35b-07-25:free"

# 🥉 Fallback Config 2 - DeepSeek V3.1 (OpenRouter) - High-quality reasoning
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "deepseek/deepseek-chat-v3.1:free"

# 🏃 Fallback Config 3 - Gemini 2.0 Flash (OpenRouter) - Ultra-fast response
# openai:
#   key: "sk-or-v1-your-openrouter-key"
#   baseUrl: "https://openrouter.ai/api/v1"
#   model: "google/gemini-2.0-flash-exp:free"
```

### Project Type-Specific Configurations

#### Code-Intensive Projects
```yaml
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "qwen/qwen3-coder-480b-a35b-07-25:free"  # Specialized code model, 480B parameters
git:
  generation_lang: "en"  # English recommended for code projects
```

#### Chinese Projects
```yaml
openai:
  key: "your-zhipuai-key"
  baseUrl: "https://open.bigmodel.cn/api/paas/v4"
  model: "glm-4-flash"  # Excellent Chinese support
git:
  generation_lang: "zh"  # Chinese commit messages
```

#### Fast Response Requirements
```yaml
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "google/gemini-2.0-flash-exp:free"  # Gemini 2.0 ultra-fast TTFT
git:
  generation_lang: "en"
```

## Usage Recommendations

### 1. Model Selection Recommendations

**🥇 Top Recommendation: OpenRouter Free Model Collection**
- **Ultra-long context preferred**: `x-ai/grok-4-fast:free` (2M token context)
- **Code generation preferred**: `qwen/qwen3-coder-480b-a35b-07-25:free` (480B parameters, code-specialized)
- **Ultra-fast response preferred**: `google/gemini-2.0-flash-exp:free` (fastest TTFT)
- **High-quality analysis preferred**: `deepseek/deepseek-chat-v3.1:free` (hybrid architecture, high-quality output)

**Why Choose OpenRouter Free Models:**
- ✅ **Abundant free quota**: Free models with no usage limits, no payment required
- ✅ **Rich model variety**: 7 high-quality free models to choose from
- ✅ **Ultra-long context**: Up to 2 million tokens supported
- ✅ **Advanced features**: Supports tool calling and structured output

**Other Platform Alternatives:**
- **Chinese project preferred**: ChatGLM4-Flash (ZhipuAI)
- **Official stability**: DeepSeek Official API
- **Ultra-fast response**: Llama 3.2 (Groq)

### 2. Performance Optimization
```yaml
# Optimized configuration for OpenRouter free models
openai:
  key: "sk-or-v1-your-openrouter-key"
  baseUrl: "https://openrouter.ai/api/v1"
  # Use lower temperature for more consistent results
  temperature: 0.1
  # Recommended model: ultra-long context, high-quality output
  model: "x-ai/grok-4-fast:free"
```

### 3. Error Handling
Free APIs may encounter rate limiting. If you encounter errors:

1. **Check network connection**: Ensure network is working properly
2. **Check API Key**: Verify the key is correct and valid
3. **Retry later**: If rate limited, wait a few minutes before retrying
4. **Switch models**: Try other free models as alternatives

## Important Notes

1. **API Key Security**: Do not commit API Keys to code repositories
2. **Usage Limits**: Follow the terms of service and limits of each platform
3. **Backup Plans**: It's recommended to configure multiple models as alternatives
4. **Monitor Usage**: Regularly check API usage to avoid exceeding limits

## Get More Free Resources

### OpenRouter Related Links
- 🔗 [OpenRouter Registration](https://openrouter.ai/) - Get free API Key
- 📊 [Free Models List](https://openrouter.ai/models?pricing=free) - View all free models
- 📈 [Usage Statistics](https://openrouter.ai/activity) - Monitor API usage
- 📚 [API Documentation](https://openrouter.ai/docs) - Detailed usage instructions
- 💬 [Discord Community](https://discord.gg/openrouter) - Get technical support

### Other Free Resources
- [HuggingFace Free Inference API](https://huggingface.co/inference-api)
- [SiliconFlow Free Quota](https://cloud.siliconflow.cn/pricing)
- [ZhipuAI Free Quota](https://open.bigmodel.cn/pricing)

## Troubleshooting

If you encounter issues:

1. **Check API Key**: Ensure the key is valid and has sufficient quota
2. **Check Network**: Some APIs may require specific network environments
3. **View Logs**: Use `--debug` parameter to view detailed logs
4. **Switch Models**: Try other free models as alternatives

## Quick Setup Scripts

### Automatic Configuration Script
Create a quick configuration script `setup-free-model.sh`:

```bash
#!/bin/bash
echo "AIFlow Free Model Configuration Wizard"
echo "======================================"

# Create configuration directory
mkdir -p .aiflow

# Choose model
echo "Please select a free model:"
echo "1) 🥇 Qwen2.5-Coder (SiliconFlow) - Top recommendation, code-specialized"
echo "2) DeepSeek V3.1 (OpenRouter) - Alternative, long context"
echo "3) GLM4-Flash (ZhipuAI) - Chinese optimized"
echo "4) Llama 3.2 (Groq) - Ultra-fast response"

read -p "Please enter your choice (1-4): " choice

case $choice in
  1)
    echo "Configuring Qwen2.5-Coder (Recommended)..."
    read -p "Please enter SiliconFlow API Key: " api_key
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
    echo "Configuring DeepSeek V3.1..."
    read -p "Please enter OpenRouter API Key: " api_key
    cat > .aiflow/config.yaml << EOF
openai:
  key: "$api_key"
  baseUrl: "https://openrouter.ai/api/v1"
  model: "deepseek/deepseek-chat-v3.1:free"
git:
  generation_lang: "en"
  squashCommits: true
  removeSourceBranch: true
EOF
    ;;
  *)
    echo "Configuration cancelled"
    exit 1
    ;;
esac

echo "✅ Configuration complete! You can now use the 'aiflow' command"
```

### Test Script
Create test script `test-free-model.sh`:

```bash
#!/bin/bash
echo "Testing AIFlow free model configuration..."

# Check configuration file
if [ ! -f ".aiflow/config.yaml" ]; then
    echo "❌ Configuration file does not exist, please run the configuration script first"
    exit 1
fi

# Create test file
echo "console.log('Hello AIFlow!');" > test.js
git add test.js

# Test AIFlow
echo "🧪 Testing AIFlow..."
aiflow --commit-only

# Clean up
git reset HEAD test.js
rm test.js

echo "✅ Test completed!"
```

## Frequently Asked Questions

### Q: Why are free models slow to respond?
A: Free models typically have more users sharing resources. Recommendations:
- Use during off-peak hours
- Configure multiple fallback models
- Consider paid versions for urgent projects

### Q: How to determine if a model supports tool calling?
A: You can determine this through:
1. **Check documentation tables**: The comparison tables in this document already indicate tool calling support for each model
2. **Actual testing**: Run aiflow command and check if there's tool calling related information in the log output
3. **API response**: Models that don't support tool calling will return corresponding error messages

### Q: What to do when free quota is exhausted?
A: You can:
1. Switch to other free services
2. Wait for quota reset (usually daily/monthly)
3. Upgrade to paid version

### Q: How to monitor API usage?
A: Most services provide consoles to view usage:
- [OpenRouter Dashboard](https://openrouter.ai/activity)
- [SiliconFlow Console](https://cloud.siliconflow.cn/account/usage)
- [ZhipuAI Console](https://open.bigmodel.cn/usercenter/apikeys)

---

**Related Links:**
- [OpenRouter Free Models](https://openrouter.ai/deepseek/deepseek-chat-v3.1:free)
- [AIFlow GitHub Repository](https://github.com/HeiSir2014/git-aiflow)
- [Tool Calling Documentation](https://platform.openai.com/docs/guides/function-calling)

*Last updated: January 2025*  
*For questions or suggestions, please submit an Issue on GitHub*
