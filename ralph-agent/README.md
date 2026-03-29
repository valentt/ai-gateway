# AI Gateway v2

A unified Electron-based interface for managing multiple AI provider connections with real API integration.

## Features

- **Multi-Provider Support**: ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Perplexity, Manus
- **Dual Display Modes**: 
  - **Tabs Mode**: Traditional webview tabs layout
  - **Panels Mode**: Offscreen webviews with response panels grid
- **Real API Integration**: Direct API calls with configurable keys
- **Conversation History**: Persistent storage with export/import capabilities
- **Accessibility**: Full ARIA compliance and keyboard navigation support

## Project Structure

```
ai-gateway/
├── main.js              # Main Electron process
├── ui/
│   ├── index.html      # UI template
│   └── renderer.js     # Renderer process logic
├── package.json        # Dependencies
└── README.md          # This file
```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

3. Or build for production:
   ```bash
   npm start
   ```

## Usage

### API Keys Configuration

1. Open Settings (⚙️ button in topbar)
2. Enter API keys for desired providers
3. Click "Save" for each key
4. Enable "Use Real API" to activate direct API calls

### Mode Toggle

- **Tabs**: Show webview tabs normally (default)
- **Panels**: Hide webviews, show response panels grid

### Keyboard Navigation

- **Mode Toggle**: Arrow keys to select, Enter/Space to activate
- **Settings Panel**: Tab to navigate, Enter to confirm
- **Clear History**: Tab to button, Enter to clear

## Architecture

### Renderer Process (renderer.js)

- Creates webview elements dynamically
- Injects iframe content with proper template substitution
- Manages mode toggle state
- Handles prompt injection and response extraction
- Provides toast notifications and accessibility attributes

### Main Process (main.js)

- IPC handlers for cross-process communication
- Webview status monitoring
- Mode management
- API key persistence via contextBridge

### Webview Template

Each webview is loaded via iframe containing:
- Chat interface with message history
- Markdown-like rendering
- Typing indicators
- Scroll-to-bottom functionality
- Message timestamp display

## Accessibility Features

- ARIA roles on interactive elements
- aria-expanded/aria-hidden for toggle states
- Keyboard navigation support
- Focus management
- Screen reader friendly labels

## API Endpoints Supported

| Provider | Endpoint | Model |
|----------|----------|-------|
| ChatGPT | `https://api.openai.com/v1/chat/completions` | gpt-4o |
| Claude | `https://api.anthropic.com/v1/messages` | claude-3-5-sonnet-20240620 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent` | gemini-1.5-pro |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | deepseek-chat |
| Kimi | `https://api.moonshot.cn/v1/chat/completions` | moonshot-v1-8k |
| Qwen | `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` | qwen-plus |
| Perplexity | `https://api.perplexity.ai/chat/completions` | llama-3.1-sonar-large-128k-online |

*Note: Grok and Manus use private/internal APIs.*

## Data Storage

All data is stored in localStorage with keys:
- `api-key-{platformId}` - API keys (encrypted recommended)
- `conversation-history-{platformId}` - Message history
- `webview-response-{platformId}` - Response polling state
- `aiGatewayMode` - Current display mode preference

## Export/Import

Export all conversations to JSON file or import from backup files.
Format includes platform name, message type, content, and ISO timestamp.

## Development

Run with DevTools:
```bash
npm run dev -- --dev
```

## License

MIT
