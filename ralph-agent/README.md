# AI Gateway v2

A unified interface for multiple AI assistants with dual-mode display (Tabs vs Panels) and message history persistence.

## Features

- **9 AI Provider Support**: ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Perplexity, Manus
- **Dual-Mode Display**: Switch between tabs view and panels view
- **Message History**: Persistent conversation history per platform (localStorage)
- **Real-time Polling**: Automatic response extraction from webviews
- **Error Handling**: Automatic recovery on webview failures
- **Template Injection**: Custom chat UI injected into each webview

## Installation

```bash
npm install
npm start
```

### Development Mode

```bash
npm start -- --dev
```

This enables:
- Web security disabled for local testing
- DevTools automatically opened

## Architecture

### Main Process (`main.js`)
- Creates BrowserWindow with partitioned webviews
- Handles IPC communication between main and renderer processes
- Exposes context bridge APIs to renderer
- Manages webview lifecycle and error recovery

### Renderer Process (`ui/renderer.js`)
- Creates webview elements for each AI provider
- Injects custom chat UI template into each webview
- Manages message history persistence
- Handles polling for response extraction
- Implements dual-mode toggle logic

### UI Template (`ui/index.html`)
- Topbar with mode toggle buttons
- Webviews container (tabs mode)
- Response panels grid (panels mode)
- Platform-specific styling

## API Reference

### `electronAPI` Context Bridge Methods

#### `injectPrompt(platformId, promptData)`
Injects a user prompt into the specified AI provider's webview.

**Parameters:**
- `platformId`: String - Platform identifier (e.g., 'chatgpt', 'claude')
- `promptData`: Object - Message data including:
  - `message`: String - User message content
  - `timestamp`: Number - Unix timestamp
  - `platform`: String - Platform ID

**Returns:** Promise resolving to `{ success: boolean, platform: string }`

**Example:**
```javascript
electronAPI.injectPrompt('chatgpt', {
  message: 'Hello!',
  timestamp: Date.now(),
  platform: 'chatgpt'
});
```

#### `extractResponse(platformId)`
Extracts the last AI response from the specified webview.

**Parameters:**
- `platformId`: String - Platform identifier

**Returns:** Object with response data or null if no response available

**Example:**
```javascript
const response = await electronAPI.extractResponse('chatgpt');
console.log(response);
// { platform: 'chatgpt', timestamp: 1234567890, status: 'extracted' }
```

#### `getCurrentMode()`
Gets the current display mode (tabs or panels).

**Returns:** String - Current mode ('tabs' or 'panels')

#### `setMode(mode)`
Sets the display mode.

**Parameters:**
- `mode`: String - Either 'tabs' or 'panels'

**Example:**
```javascript
await electronAPI.setMode('panels');
```

#### `checkWebViewStatus(platformId)`
Checks the readiness status of a specific webview.

**Returns:** Object with status information

**Example:**
```javascript
const status = await electronAPI.checkWebViewStatus('chatgpt');
console.log(status);
// { platform: 'chatgpt', ready: true, isLoading: false }
```

#### `getAllWebviewsStatus()`
Gets the status of all webviews.

**Returns:** Object containing status for all platforms

**Example:**
```javascript
const allStatus = await electronAPI.getAllWebviewsStatus();
console.log(allStatus);
// { chatgpt: {...}, claude: {...}, ... }
```

#### `clearResponsePanel(platformId)`
Clears the response panel content for a specific platform.

**Parameters:**
- `platformId`: String - Platform identifier

**Returns:** Promise resolving to `{ success: boolean, platform: string }`

#### `getWebViewResponse(platformId)`
Gets direct response data from a webview (bypasses polling).

**Returns:** Object with response data or error information

#### `getConversationHistory(platformId)`
Gets the conversation history for a specific platform.

**Parameters:**
- `platformId`: String - Platform identifier

**Returns:** Array of message objects

**Example:**
```javascript
const history = await electronAPI.getConversationHistory('chatgpt');
console.log(history);
// [
//   { id: 1234567890, type: 'user', content: 'Hello!', timestamp: '...' },
//   { id: 1234567891, type: 'assistant', content: 'Hi there!', timestamp: '...' }
// ]
```

#### `saveMessageToHistory(platformId, message, type)`
Saves a message to the conversation history.

**Parameters:**
- `platformId`: String - Platform identifier
- `message`: String - Message content
- `type`: String - Either 'user' or 'assistant'

**Returns:** Promise resolving to `{ success: boolean, platform: string }`

#### `clearConversationHistory(platformId)`
Clears the conversation history for a specific platform.

**Parameters:**
- `platformId`: String - Platform identifier

**Returns:** Promise resolving to `{ success: boolean, platform: string }`

## Configuration Options

### Mode Persistence
The application stores the current mode in localStorage under the key `aiGatewayMode`. This persists across sessions.

### Polling Interval
Response polling occurs every 2 seconds (2000ms) by default. This can be adjusted in `ui/renderer.js`:
```javascript
const RESPONSE_POLL_INTERVAL = 2000; // ms
```

### Platform Endpoints
Each platform has a configured endpoint URL. These are placeholders for testing and should be replaced with actual API endpoints:
```javascript
const platformEndpoints = {
  chatgpt: 'https://chat.openai.com/api/conversation',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/',
  grok: 'https://x.com/i/grok',
  deepseek: 'https://deepseek.com/chat',
  kimi: 'https://kimi.moonshot.cn/',
  qwen: 'https://tongyi.aliyun.com/',
  perplexity: 'https://perplexity.ai/',
  manus: 'https://manus.im/'
};
```

## Usage Examples

### Switching to Panels Mode
```javascript
// Use the mode toggle buttons in the UI, or programmatically:
await electronAPI.setMode('panels');
```

### Getting Current Mode
```javascript
const currentMode = await electronAPI.getCurrentMode();
console.log(`Current mode: ${currentMode}`); // 'tabs' or 'panels'
```

### Sending a Message
```javascript
const result = await electronAPI.injectPrompt('chatgpt', {
  message: 'What is the capital of France?',
  timestamp: Date.now(),
  platform: 'chatgpt'
});

console.log(result);
// { success: true, platform: 'chatgpt' }
```

### Getting Conversation History
```javascript
const history = await electronAPI.getConversationHistory('chatgpt');
history.forEach(msg => {
  console.log(`${msg.type}: ${msg.content}`);
});
```

## File Structure

```
ai-gateway/
├── main.js                    # Main process with IPC handlers
├── ui/
│   ├── index.html            # UI template
│   └── renderer.js           # Renderer process logic
└── README.md                 # This file
```

## How It Works

### 1. Webview Creation
- Each platform gets a webview element with `data-platform` attribute
- Template is injected via `data:text/html` URL
- Custom chat UI is rendered in each webview

### 2. Message Flow
1. User types message and clicks Send
2. Message is added to UI immediately
3. Prompt is sent to AI provider via `inject-prompt` IPC call
4. Webview simulates AI response (replace with real API calls)
5. Response is displayed in UI
6. Both messages are saved to conversation history

### 3. Panels Mode
- Webviews are hidden offscreen (`position: absolute; left: -9999px`)
- Response panels grid is shown instead
- Each panel displays the last response from that platform
- Messages can be cleared per panel

### 4. Polling System
- Every 2 seconds, each webview is polled for new responses
- Response data is extracted and displayed in panels
- Polling state is tracked per platform

## Error Handling

The application handles various error scenarios:

1. **Webview Load Failure**: Automatic reload attempt on `did-fail-load` event
2. **IPC Communication Errors**: Logged to console with platform info
3. **Template Injection Failures**: Caught and logged, webview remains functional
4. **History Save Errors**: Logged but don't block message sending

## Development

### Running in Dev Mode
```bash
npm start -- --dev
```

This enables:
- Web security disabled (allows local file access)
- DevTools automatically opened
- Hot reloading for development

### Debugging
Open DevTools to inspect:
- Main process console (IPC handlers)
- Renderer process console (webview logic)
- Network traffic (if using actual API calls)

## Roadmap

### Iteration 5 Complete ✅
- Message history persistence
- Enhanced polling mechanism
- Improved panels mode UI
- Better error handling

### Future Improvements
1. **Real API Integration**: Replace simulated responses with actual API calls
2. **Authentication**: Add API key management for each platform
3. **Advanced Settings**: Configure polling interval, message limits, etc.
4. **Export/Import**: Export conversations to JSON, import back
5. **Search**: Search across conversation history
6. **Multi-instance**: Support multiple sessions per platform
7. **Mobile Responsive**: Optimize for mobile devices
8. **Keyboard Shortcuts**: Quick mode switching, message actions

## Browser Compatibility

The application runs in Electron, which uses Chromium. Compatible with:
- Windows 10+
- macOS 10.13+
- Linux (with appropriate dependencies)

## License

MIT License - Feel free to use and modify!

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions, please open an issue on GitHub.

---

**Version**: 2.0 (Iteration 5/10)  
**Last Updated**: 2026-03-29  
**Status**: Beta - Real API integration pending
