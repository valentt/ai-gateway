# AI Gateway

**Franz za AI** - Unified AI Chat Gateway with Local API

Electron desktop app that combines all major AI chat platforms in one window with a local REST API for programmatic access.

## Features

- **Multi-Platform Support**: ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek, Kimi, Qwen
- **Persistent Sessions**: Each platform keeps its own cookies/session
- **Local REST API**: Access conversation history via HTTP (localhost:8088)
- **Full-Text Search**: Search across all conversations from all platforms
- **SQLite Storage**: All history stored locally

## Installation

```bash
cd ai-gateway
npm install
npm start
```

## REST API

Default port: `8088` (configurable via `AI_GATEWAY_PORT` env var)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/platforms` | List available platforms |
| GET | `/history` | Get conversation history |
| GET | `/history/:id` | Get specific conversation |
| GET | `/search?q=...` | Full-text search |
| GET | `/stats` | Get statistics |
| POST | `/conversations` | Create conversation |
| POST | `/conversations/:id/messages` | Add message |

### Example Usage

```python
import requests

# Health check
r = requests.get('http://localhost:8088/health')
print(r.json())

# Search all conversations
r = requests.get('http://localhost:8088/search', params={'q': 'machine learning'})
print(r.json())

# Get history from Claude
r = requests.get('http://localhost:8088/history', params={'platform': 'claude'})
print(r.json())
```

### Bash/curl

```bash
# Health check
curl http://localhost:8088/health

# Search
curl "http://localhost:8088/search?q=python"

# Get stats
curl http://localhost:8088/stats
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1-9` | Switch to tab 1-9 |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+R` | Reload current tab |

## Supported Platforms

### Tier 1 (Primary)
- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Perplexity (perplexity.ai)
- Grok (grok.x.ai)

### Tier 2 (Secondary)
- DeepSeek (chat.deepseek.com)
- Kimi (kimi.moonshot.cn)
- Qwen (tongyi.aliyun.com)

## Data Storage

- **Database**: `%APPDATA%/ai-gateway/ai-gateway.db` (SQLite)
- **Sessions**: Stored in Electron's persistent partitions

## Development

```bash
# Run in development mode (with DevTools)
npm run dev

# Build for Windows
npm run build:win
```

## Architecture

```
ai-gateway/
├── src/
│   ├── main.js           # Electron main process
│   ├── api/
│   │   └── server.js     # Express REST API
│   ├── db/
│   │   └── database.js   # SQLite + FTS
│   └── preload/
│       └── main.js       # IPC bridge
├── ui/
│   └── index.html        # Main UI
└── package.json
```

---
*Created: 2026-01-06*
*Author: 3D Tvornica Dev Team*
