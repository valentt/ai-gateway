# 🌐 AI Gateway - Multi-LLM Parallel Inference System

A desktop application that enables parallel inference across multiple AI models with direct API integration and webview scraping fallback. Supports 9+ AI platforms including ChatGPT, Claude, Gemini, Qwen, Llama, Mistral, DeepSeek, Grok, and Kimi.

## 🎯 Key Features

### 1️⃣ **Direct API Integration**
- Direct HTTP requests to official APIs for supported platforms
- Automatic retry logic with exponential backoff
- Real-time streaming response support
- Token usage tracking and cost estimation

### 2️⃣ **Webview Scraping Fallback**
- JavaScript injection for web-based AI interfaces
- Cross-platform scraper (Electron + WebView)
- Auto-detection of response completion
- Zero dependency on API keys

### 3️⃣ **Smart Mode Switching**
- Automatic fallback from API to scraping on errors
- Transparent switching without user intervention
- Performance monitoring with auto-recovery

### 4️⃣ **Parallel Inference Engine**
- Simultaneous requests to multiple models
- Load balancing across available APIs
- Response aggregation and comparison

### 5️⃣ **API Key Management**
- Secure local storage (encrypted optional)
- Platform-specific key management
- One-click import/export configuration
- Automatic credential validation

### 6️⃣ **Dual Display Modes**
- **Tabs Mode**: Individual panels for each model
- **Chat Room Mode**: Conversation-style comparison
- **Isolated Mode**: Side-by-side panel comparison

### 7️⃣ **Developer Console Integration**
- Real-time API call logging
- Response metadata (tokens, latency)
- Error tracking and debugging
- Performance analytics

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AI Gateway                            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐                   │
│  │   API Service│    │ Webview Scraper│                  │
│  │ (Direct HTTP)│    │ (Fallback)    │                   │
│  └──────────────┘    └──────────────┘                   │
│           │                    │                         │
│           ▼                    ▼                         │
│  ┌─────────────────────────────────────────┐            │
│  │         Unified Response Handler         │            │
│  └─────────────────────────────────────────┘            │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────┐            │
│  │        User Interface (Tabs/Panels)     │            │
│  └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## 📦 Supported Platforms

| Platform | Direct API | Webview Fallback | Notes |
|----------|-----------|------------------|-------|
| **ChatGPT** | ✅ OpenAI | ✅ webchatgpt.com | GPT-4o, o1 |
| **Claude** | ✅ Anthropic | ✅ claude.ai | Sonnet 3.5 |
| **Gemini** | ✅ Google | ✅ gemini.google | Flash/Pro |
| **Qwen** | ✅ Alibaba Cloud | ✅ chat.qwen.ai | Plus/Turbo |
| **Llama** | ✅ Groq | ✅ llama.com | Llama 3.1 70B |
| **Mistral** | ✅ Mistral AI | ✅ mistral.ai | Large 2405 |
| **DeepSeek** | ✅ DeepSeek API | ✅ deepseek.com | V3/V2.5 |
| **Kimi** | ✅ Moonshot API | ✅ kimi.moonshot.cn | Max version |
| **Grok** | ⚠️ X Premium only | ✅ grok.x.ai | Web-only |
| **Manus** | ❌ No public API | ✅ manus.im | Agent mode |

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js 18+ required
node --version  # Should be v18 or higher

# Install dependencies
npm install electron

# Build application
npm run build
```

### Configuration
1. Run the app: `npm start`
2. Click "API Keys" in top bar
3. Enter API keys for desired platforms
4. Select models from chips
5. Start asking questions!

### Example Usage
```bash
# Start development server
npm start

# Build production app
npm run build

# Run with custom config
npm start -- --config=custom.json
```

## 🔧 API Configuration

### ChatGPT (OpenAI)
```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.openai.com/v1/chat/completions",
  "model": "gpt-4o"
}
```

### Claude (Anthropic)
```json
{
  "apiKey": "claude_api_key",
  "baseUrl": "https://api.anthropic.com/v1/messages",
  "model": "claude-3-5-sonnet-20241022"
}
```

### Gemini (Google)
```json
{
  "apiKey": "google_api_key",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=API_KEY",
  "model": "gemini-2.0-flash"
}
```

### DeepSeek
```json
{
  "apiKey": "deepseek_api_key",
  "baseUrl": "https://api.deepseek.com/v1/chat/completions",
  "model": "deepseek-chat"
}
```

### Qwen (Alibaba Cloud)
```json
{
  "apiKey": "dashscope_api_key",
  "baseUrl": "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
  "model": "qwen-plus"
}
```

### Llama (Groq)
```json
{
  "apiKey": "groq_api_key",
  "baseUrl": "https://api.groq.com/openai/v1/chat/completions",
  "model": "llama-3.1-70b-versatile"
}
```

### Mistral (Mistral AI)
```json
{
  "apiKey": "mistral_api_key",
  "baseUrl": "https://api.mistral.ai/v1/chat/completions",
  "model": "mistral-large-latest"
}
```

### Perplexity
```json
{
  "apiKey": "perplexity_api_key",
  "baseUrl": "https://api.perplexity.ai/chat/completions",
  "model": "llama-3.1-70b-instruct"
}
```

### Kimi (Moonshot)
```json
{
  "apiKey": "moonshot_api_key",
  "baseUrl": "https://api.moonshot.cn/v1/chat/completions",
  "model": "auto"
}
```

## 📊 Performance Metrics

The system tracks and displays:
- **Response time**: Time from request to first token
- **Token usage**: Total tokens consumed per response
- **Cost estimation**: Based on model pricing tiers
- **Success rate**: API vs fallback success ratios

### Example Metrics Output
```json
{
  "platform": "claude",
  "content": "...",
  "tokens": 245,
  "durationMs": 1834,
  "source": "api",
  "costEstimate": "$0.0012"
}
```

## 🔒 Security Features

- **Local-only storage**: API keys never leave your device
- **No telemetry**: No data sent to external servers
- **Encrypted config**: Optional encryption for API key files
- **Sandboxed webviews**: Isolated execution context
- **Context isolation**: Electron security best practices

## 🛠️ Development

### File Structure
```
ai-gateway/
├── main.js              # Main Electron process
├── preload.js           # IPC bridge for renderer
├── api-service.js       # API integration logic
├── ui/
│   └── index.html       # User interface
├── package.json         # Dependencies & scripts
└── README.md            # This file
```

### Running Locally
```bash
# Install dependencies
npm install

# Development mode with hot reload
npm start

# Build production app
npm run build

# Package for distribution
npm run package
```

### Building for Distribution
```bash
# macOS
npm run package:mac

# Windows
npm run package:win

# Linux
npm run package:linux
```

## 📝 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please open issues or pull requests.

### Code Style
- ESLint with Prettier
- TypeScript preferred
- JSDoc comments required

## 📞 Support

- GitHub Issues: [Link to repo]
- Email: support@ai-gateway.dev
- Discord: [Link to server]

## 🌟 Roadmap

- [ ] Multi-user support
- [ ] Response caching
- [ ] Custom model endpoints
- [ ] Plugin system
- [ ] Mobile app version
- [ ] Cloud sync for API keys
- [ ] Response history sync
- [ ] Voice input/output

---

**Built with ❤️ for AI developers and researchers**
