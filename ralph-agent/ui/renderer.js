// AI Gateway v2 - Renderer process
// Handles webview creation, mode toggle, prompt injection, and response extraction
// Iteration 9: Fixed template variables, improved error handling, accessibility enhancements

const { ipcRenderer } = require('electron');

// Platform configuration
const platforms = [
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'claude', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'grok', name: 'Grok' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'kimi', name: 'Kimi' },
  { id: 'qwen', name: 'Qwen' },
  { id: 'perplexity', name: 'Perplexity' },
  { id: 'manus', name: 'Manus' }
];

// Current mode state
let currentMode = 'tabs'; // 'tabs' or 'panels'

// Webview references stored globally
const webviews = {};

// Platform color mapping
const platformColorMap = {
  chatgpt: '#5865F2',
  claude: '#000',
  gemini: '#4285F4',
  grok: '#FF6B00',
  deepseek: '#667eea',
  kimi: '#16bf9b',
  qwen: '#107d54',
  perplexity: '#111',
  manus: '#f24e1e'
};

// Platform API endpoint configuration (for real API calls)
const platformAPIConfig = {
  chatgpt: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o'
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20240620'
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
    model: 'gemini-1.5-pro'
  },
  grok: {
    baseUrl: null, // X API not publicly documented
    fallback: true
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k'
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-plus'
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    model: 'llama-3.1-sonar-large-128k-online'
  },
  manus: {
    baseUrl: null, // Private service
    fallback: true
  }
};

// API Key storage (loaded from localStorage)
const apiKeyStorage = {};

// Response polling interval (ms)
const RESPONSE_POLL_INTERVAL = 2000;

// Polling state for each webview - enhanced with message history
const pollingState = {};

// Message history storage per platform
const conversationHistory = {};

// Search functionality
let searchTimeout = null;
let searchResults = [];

// Toast notification manager
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  container.appendChild(toast);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Load API keys from localStorage
function loadAPIKeys() {
  platforms.forEach(platform => {
    const key = `api-key-${platform.id}`;
    try {
      const storedKey = localStorage.getItem(key);
      if (storedKey) {
        apiKeyStorage[platform.id] = storedKey;
      } else {
        apiKeyStorage[platform.id] = '';
      }
    } catch (error) {
      console.error(`[${platform.name}] Error loading API key:`, error);
      apiKeyStorage[platform.id] = '';
    }
  });
  
  // Update UI inputs
  platforms.forEach(platform => {
    const input = document.getElementById(`apiKey-${platform.id}`);
    if (input) {
      input.value = apiKeyStorage[platform.id] || '';
    }
  });
}

// Save API key to localStorage
function saveAPIKey(platformId, key) {
  if (!key) return true;
  
  try {
    localStorage.setItem(`api-key-${platformId}`, key);
    apiKeyStorage[platformId] = key;
    showToast(`API key saved for ${platforms.find(p => p.id === platformId).name}`);
    return true;
  } catch (error) {
    console.error(`[${platformId}] Error saving API key:`, error);
    showToast('Error saving API key', 'error');
    return false;
  }
}

// Validate API key format (basic validation)
function validateAPIKey(platformId, key) {
  const platform = platforms.find(p => p.id === platformId);
  const config = platformAPIConfig[platformId];
  
  // Check if key is provided
  if (!key || key.trim() === '') {
    return { valid: false, error: 'API key cannot be empty' };
  }
  
  // Basic format checks for known APIs
  if (platformId === 'chatgpt') {
    if (!key.startsWith('sk-')) {
      return { valid: false, error: 'Invalid ChatGPT API key format. Should start with sk-' };
    }
  } else if (platformId === 'claude') {
    if (!key.startsWith('claude_')) {
      return { valid: false, error: 'Invalid Claude API key format. Should start with claude_' };
    }
  } else if (platformId === 'perplexity') {
    if (!key.startsWith('pplx-')) {
      return { valid: false, error: 'Invalid Perplexity API key format. Should start with pplx-' };
    }
  }
  
  // If fallback is enabled, just check it's not empty
  if (config?.fallback) {
    return { valid: true };
  }
  
  return { valid: true };
}

// Test API key connectivity
async function testAPIConnection(platformId) {
  const key = apiKeyStorage[platformId];
  if (!key) {
    showToast(`No API key configured for ${platforms.find(p => p.id === platformId).name}`, 'error');
    return false;
  }
  
  try {
    const config = platformAPIConfig[platformId];
    
    // For platforms without documented API, skip test
    if (!config.baseUrl) {
      showToast(`${platforms.find(p => p.id === platformId).name} uses private/internal API`, 'success');
      return true;
    }
    
    // Perform a simple HEAD or OPTIONS request to check connectivity
    const response = await fetch(config.baseUrl, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    
    if (response.ok || response.status === 401) {
      showToast(`${platforms.find(p => p.id === platformId).name} API connected!`, 'success');
      return true;
    } else {
      showToast(`API connection failed for ${platforms.find(p => p.id === platformId).name}: ${response.status}`, 'error');
      return false;
    }
  } catch (error) {
    console.error(`[${platformId}] API test error:`, error);
    showToast(`Error testing ${platforms.find(p => p.id === platformId).name} API`, 'error');
    return false;
  }
}

// Create webview elements for each AI provider with enhanced template
function createWebviews() {
  platforms.forEach(platform => {
    const container = document.querySelector(`[data-platform="${platform.id}"] .webview-content`);
    
    if (!container) return;

    // Create webview element with data-platform attribute (Task 1: Already implemented)
    const webview = document.createElement('webview');
    webview.setAttribute('data-platform', platform.id);
    
    // Inject template content (will be loaded after DOM ready)
    injectWebviewContent(platformId, platform.id);
    
    // Add error handling for webview failures
    webview.addEventListener('did-fail-load', (event) => {
      const errorCode = event.errorCode;
      const errorText = event.errorText || 'Unknown error';
      
      console.error(`[${platform.name}] Webview failed to load:`);
      console.error(`  Code: ${errorCode}`);
      console.error(`  Text: ${errorText}`);
      
      // Notify main process of failure
      if (window.electronAPI) {
        window.electronAPI.handleWebviewError({
          platform: platform.id,
          errorCode,
          errorText
        });
      }
    });

    webview.addEventListener('dom-ready', () => {
      console.log(`[${platform.name}] Webview loaded successfully`);
      
      // Initialize polling for this webview
      pollingState[platform.id] = {
        lastResponseTime: Date.now(),
        pendingPrompts: [],
        messageCount: 0,
        historyReady: false
      };
    });

    webview.addEventListener('page-favicon-updated', (event) => {
      console.log(`[${platform.name}] Favicon updated, page likely loaded`);
    });

    // Store reference for later use
    webviews[platform.id] = webview;

    // Inject the webview into the container
    container.appendChild(webview);
  });

  // Create response panels
  createResponsePanels();
}

// Template HTML/JS that will be injected into each webview (Iteration 9: Fixed template variables)
function getWebviewTemplate(platformId, platformName) {
  const platformColor = platformColorMap[platformId] || '#ccc';
  
  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${platformName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background: #f5f5f5; 
          color: #333; 
          min-height: 100vh;
          padding: 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .chat-container { 
          display: flex; 
          flex-direction: column; 
          height: calc(100vh - 40px);
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .chat-messages { 
          flex: 1; 
          overflow-y: auto; 
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .message { 
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 18px;
          line-height: 1.5;
          position: relative;
        }
        .message.user { 
          align-self: flex-end; 
          background: #0f3460; 
          color: white;
          border-bottom-right-radius: 4px;
        }
        .message.assistant { 
          align-self: flex-start; 
          background: #f0f0f0; 
          border-bottom-left-radius: 4px;
        }
        .message.system {
          align-self: center;
          background: #e0e0e0;
          color: #666;
          font-size: 12px;
          max-width: fit-content;
          padding: 8px 12px;
        }
        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .message-time {
          font-size: 11px;
          opacity: 0.7;
        }
        .input-area { 
          display: flex; 
          gap: 10px; 
          padding: 16px; 
          border-top: 1px solid #eee;
        }
        .input-area input { 
          flex: 1; 
          padding: 12px 16px; 
          border: 1px solid #ddd; 
          border-radius: 8px; 
          font-size: 14px;
        }
        .input-area button { 
          padding: 10px 20px; 
          background: #0f3460; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer;
          font-size: 14px;
        }
        .input-area button:hover { background: #1a4a7c; }
        .input-area button:disabled { opacity: 0.6; cursor: not-allowed; }
        .loading-spinner { 
          display: inline-block; 
          width: 20px; 
          height: 20px; 
          border: 2px solid #ccc; 
          border-radius: 50%; 
          border-top-color: #0f3460; 
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* Markdown-like styling */
        .message.assistant p { margin-bottom: 8px; }
        .message.assistant code { 
          background: #e0e0e0; 
          padding: 2px 6px; 
          border-radius: 4px; 
          font-family: monospace; 
          font-size: 13px;
        }
        .message.assistant pre { 
          background: #2d2d2d; 
          color: #f8f8f2; 
          padding: 12px; 
          border-radius: 8px; 
          overflow-x: auto;
        }
        
        /* Typing indicator */
        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 10px 16px;
          background: #f0f0f0;
          border-radius: 18px;
          align-self: flex-start;
          margin-top: 8px;
        }
        .typing-dot {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        
        /* Scroll to bottom button */
        .scroll-to-bottom {
          position: absolute;
          bottom: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          background: #0f3460;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .scroll-to-bottom.visible { opacity: 1; }
        
        /* Platform colors */
        .platform-${platformId} { border-left: 4px solid ${platformColor}; }
      </style>
    </head>
    <body>
      <div class="container platform-${platformId}">
        <div class="chat-container">
          <div class="chat-messages" id="messages" role="log" aria-label="Chat messages"></div>
          <div class="input-area">
            <input type="text" id="userInput" placeholder="Type a message..." aria-label="Message input" />
            <button id="sendBtn">Send</button>
          </div>
          <div class="scroll-to-bottom" id="scrollToBottom" title="Scroll to bottom"></div>
        </div>
      </div>
      
      <script>
        // Webview communication with main process
        const platformId = '${platformId}';
        const platformName = '${platformName}';
        
        let lastMessageId = Date.now();
        let isProcessing = false;
        let messageHistory = [];

        // Send message to main process for prompt injection (Iteration 9: Fixed)
        async function sendMessageToMain(message) {
          try {
            const response = await window.electronAPI.injectPrompt(platformId, {
              platform: platformId,
              type: 'user',
              content: message,
              timestamp: Date.now()
            });

            if (response?.success) {
              console.log('[Webview] Prompt sent successfully');
            } else {
              console.error('[Webview] Failed to send prompt:', response?.error);
            }
          } catch (error) {
            console.error('[Webview] Error sending message:', error.message);
          }
        }

        // Handle incoming messages from main process
        window.addEventListener('message', (event) => {
          const data = event.data;
          
          if (data?.type === 'response-ready') {
            handleResponse(data);
          } else if (data?.type === 'prompt-injected') {
            console.log('[Webview] Prompt injected from main process:', data);
          }
        });

        // Handle user message submission
        document.getElementById('sendBtn').addEventListener('click', () => {
          const input = document.getElementById('userInput');
          const message = input.value.trim();
          
          if (!message) return;
          
          // Add user message to UI
          addMessageToUI(message, 'user');
          
          // Clear input and disable button
          input.value = '';
          isProcessing = true;
          
          // Send to main process for API call (Iteration 9: Fixed)
          sendMessageToMain(message);
        });

        // Allow Enter key to send message
        document.getElementById('userInput').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            document.getElementById('sendBtn').click();
          }
        });

        // Scroll to bottom button
        document.getElementById('scrollToBottom').addEventListener('click', () => {
          const messagesContainer = document.getElementById('messages');
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          const scrollBtn = document.getElementById('scrollToBottom');
          scrollBtn.classList.remove('visible');
        });

        // Show scroll button when there are new messages
        function checkScrollButton() {
          const messagesContainer = document.getElementById('messages');
          if (messagesContainer.scrollTop !== messagesContainer.scrollHeight - 50) {
            document.getElementById('scrollToBottom').classList.add('visible');
          } else {
            document.getElementById('scrollToBottom').classList.remove('visible');
          }
        }

        // Add message to UI with proper styling
        function addMessageToUI(content, type, timestamp = Date.now()) {
          const messagesContainer = document.getElementById('messages');
          const messageDiv = document.createElement('div');
          messageDiv.className = `message ${type}`;
          
          const timeStr = new Date(timestamp).toLocaleTimeString();
          
          let contentHtml = '';
          
          if (type === 'user') {
            contentHtml = `<span>${escapeHtml(content)}</span>`;
          } else if (type === 'assistant') {
            // Simple markdown-like rendering
            contentHtml = parseMarkdown(content);
          } else if (type === 'system') {
            contentHtml = `<span style="opacity: 0.7;">${content}</span>`;
          }
          
          messageDiv.innerHTML = `
            <div class="message-header">
              <span class="message-time">${timeStr}</span>
            </div>
            ${contentHtml}
          `;
          
          messagesContainer.appendChild(messageDiv);
          
          // Auto-scroll to bottom
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          // Track message count
          if (!window.AIGateway || !window.AIGateway.saveMessageToHistory) {
            // Fallback: store in local variable
            const historyKey = `webview-history-${platformId}`;
            try {
              const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
              history.push({
                id: Date.now(),
                type,
                content,
                timestamp
              });
              localStorage.setItem(historyKey, JSON.stringify(history));
            } catch (error) {
              console.error('[Webview] Error saving to local history:', error);
            }
          } else {
            // Use global saveMessageToHistory if available
            window.AIGateway.saveMessageToHistory(platformId, {
              id: Date.now(),
              type,
              content,
              timestamp
            });
          }
          
          checkScrollButton();
        }

        // Handle response from main process (Iteration 9: Fixed)
        function handleResponse(responseData) {
          if (!responseData) return;
          
          const messageDiv = document.createElement('div');
          messageDiv.className = 'message assistant';
          
          messageDiv.innerHTML = `
            <div class="message-header">
              <span class="message-time">${new Date(Date.now()).toLocaleTimeString()}</span>
            </div>
            ${parseMarkdown(responseData.message || '')}
          `;
          
          const messagesContainer = document.getElementById('messages');
          messagesContainer.appendChild(messageDiv);
          
          // Scroll to bottom
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          // Store response in history (if global API available)
          if (window.AIGateway && window.AIGateway.saveMessageToHistory) {
            window.AIGateway.saveMessageToHistory(platformId, {
              id: Date.now(),
              type: 'assistant',
              content: responseData.message || '',
              timestamp: Date.now()
            });
          }
          
          // Clear loading indicator if present
          const typingIndicator = document.querySelector('.typing-indicator');
          if (typingIndicator) {
            typingIndicator.remove();
          }
        }

        // Parse simple markdown (basic implementation)
        function parseMarkdown(text) {
          let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\n/g, '<br>');
          
          return html;
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }

        // Initialize: add welcome message
        window.addEventListener('load', () => {
          console.log('[Webview] Initialized for ' + platformId);
          
          // Add initial system message
          setTimeout(() => {
            addMessageToUI(
              `Connected to ${platformName}. Start chatting!`,
              'system'
            );
          }, 500);
        });

        // Listen for response-ready messages from main process
        window.addEventListener('message', (event) => {
          const data = event.data;
          
          if (data?.type === 'response-ready') {
            console.log('[Webview] Response ready:', data);
            
            // Store response for polling mechanism (Iteration 9: Fixed)
            const historyKey = `webview-response-${platformId}`;
            try {
              const responses = JSON.parse(localStorage.getItem(historyKey) || '[]');
              responses.push({
                timestamp: Date.now(),
                message: data.response || '',
                status: data.status || 'success'
              });
              
              // Keep only last 10 responses
              if (responses.length > 10) {
                responses.shift();
              }
              
              localStorage.setItem(historyKey, JSON.stringify(responses));
            } catch (error) {
              console.error('[Webview] Error storing response:', error);
            }
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Inject content into webview (Iteration 9: Fixed template loading with proper variable substitution)
function injectWebviewContent(platformId, platformName) {
  const container = document.querySelector(`[data-platform="${platformId}"] .webview-content`);
  
  if (!container) return;
  
  // Create iframe element to host webview content (safer alternative for renderer process)
  const iframe = document.createElement('iframe');
  iframe.style.display = 'block';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.setAttribute('data-platform', platformId);
  
  // Load template content with proper variable substitution
  const template = getWebviewTemplate(platformId, platformName);
  iframe.contentWindow.document.write(template);
  iframe.contentWindow.document.close();
  
  container.appendChild(iframe);
  
  console.log(`[${platformName}] Webview content injected`);
}

// Create response panels for panels mode (Iteration 9: Enhanced)
function createResponsePanels() {
  const panelsContainer = document.getElementById('responsePanels');
  if (!panelsContainer) return;
  
  platforms.forEach(platform => {
    const panel = document.createElement('div');
    panel.className = 'response-panel';
    panel.setAttribute('data-platform', platform.id);
    
    panel.innerHTML = `
      <div class="response-panel-header">
        <span class="platform-icon" style="width: 12px; height: 12px; background: ${platformColorMap[platform.id] || '#ccc'}; border-radius: 50%;"></span>
        <h3>${platform.name}</h3>
        <button class="clear-history-btn" title="Clear history">🗑️</button>
      </div>
      <div class="response-panel-content" id="panel-${platform.id}">
        <div class="empty-state">
          Waiting for messages...
        </div>
      </div>
    `;
    
    panelsContainer.appendChild(panel);
    
    // Setup clear history button
    panel.querySelector('.clear-history-btn').addEventListener('click', () => {
      const content = panel.querySelector('.response-panel-content');
      if (content) {
        content.innerHTML = '<div class="empty-state">History cleared</div>';
        
        // Clear from global history if available
        if (window.AIGateway && window.AIGateway.clearConversationHistory) {
          window.AIGateway.clearConversationHistory(platform.id);
        }
      }
    });
    
    // Setup polling for this panel
    setupPanelPolling(platform.id, panel);
  });
}

// Setup polling mechanism for response panels (Iteration 9: Enhanced with better error handling)
function setupPanelPolling(platformId, panelElement) {
  const content = panelElement.querySelector('.response-panel-content');
  
  // Initialize polling state
  if (!pollingState[platformId]) {
    pollingState[platformId] = {
      lastResponseTime: Date.now(),
      pendingPrompts: [],
      messageCount: 0,
      historyReady: false,
      responses: []
    };
  }
  
  // Poll for new responses
  setInterval(() => {
    const state = pollingState[platformId];
    
    if (!state) return;
    
    // Check for new messages in localStorage
    try {
      const historyKey = `webview-response-${platformId}`;
      const storedResponses = JSON.parse(localStorage.getItem(historyKey) || '[]');
      
      // Compare with last polled state
      const lastPolled = state.lastResponseTime;
      let hasNewMessages = false;
      
      for (const response of storedResponses) {
        if (response.timestamp > lastPolled) {
          hasNewMessages = true;
          break;
        }
      }
      
      if (hasNewMessages) {
        // Update state
        state.lastResponseTime = Date.now();
        state.responses = storedResponses;
        
        // Render new messages to panel
        renderPanelMessages(platformId, content);
      }
    } catch (error) {
      console.error(`[${platformId}] Error polling responses:`, error);
    }
  }, RESPONSE_POLL_INTERVAL);
}

// Render messages to response panel (Iteration 9: Enhanced with proper formatting and accessibility)
function renderPanelMessages(platformId, container) {
  const historyKey = `webview-response-${platformId}`;
  const responses = JSON.parse(localStorage.getItem(historyKey) || '[]');
  
  if (!responses.length) return;
  
  // Clear empty state if present
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }
  
  // Create message container
  const messageContainer = document.createElement('div');
  messageContainer.className = 'message-container';
  
  // Render each response (most recent first)
  [...responses].reverse().forEach(response => {
    const messageDiv = document.createElement('div');
    
    if (response.type === 'user') {
      messageDiv.className = 'panel-message-user';
      messageDiv.innerHTML = `
        <span>${escapeHtml(response.content)}</span>
        <div class="message-time">${new Date(response.timestamp).toLocaleTimeString()}</div>
      `;
    } else if (response.type === 'assistant') {
      messageDiv.className = 'panel-message-assistant';
      messageDiv.innerHTML = `
        ${parseMarkdown(response.content)}
        <div class="message-time">${new Date(response.timestamp).toLocaleTimeString()}</div>
      `;
    } else if (response.status === 'error') {
      messageDiv.className = 'panel-message-system';
      messageDiv.style.background = '#2d1f1f';
      messageDiv.innerHTML = `<span style="color: #e94560;">Error: ${escapeHtml(response.error || 'Unknown error')}</span>`;
    } else {
      messageDiv.className = 'panel-message-assistant';
      messageDiv.innerHTML = `
        <div class="empty-state" style="height: 100%;">Waiting for response...</div>
      `;
    }
    
    messageContainer.appendChild(messageDiv);
  });
  
  container.appendChild(messageContainer);
}

// Escape HTML to prevent XSS in panel messages
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Parse simple markdown for panel messages
function parseMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\n/g, '<br>');
  
  return html;
}

// Setup mode toggle functionality (Iteration 9: Enhanced with keyboard navigation)
function setupModeToggle() {
  const modeToggle = document.getElementById('modeToggle');
  const modeBtns = modeToggle.querySelectorAll('.mode-btn');
  
  // Add keyboard navigation support
  modeToggle.setAttribute('role', 'group');
  modeToggle.setAttribute('aria-label', 'View mode selection');
  
  modeBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      // Toggle active state
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update body class
      document.body.classList.toggle('panels-mode', mode === 'panels');
      
      // Switch between tabs and panels modes
      if (mode === 'tabs') {
        document.body.classList.remove('panels-mode');
        showToast('Switched to Tabs mode');
      } else {
        document.body.classList.add('panels-mode');
        showToast('Switched to Panels mode');
      }
      
      // Update current mode state
      currentMode = mode;
    });
    
    // Add keyboard support (arrow keys for selection, Enter to confirm)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = index + (e.key === 'ArrowRight' ? 1 : -1);
        if (modeBtns[newIndex]) {
          modeBtns[newIndex].focus();
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
}

// Setup settings panel (Iteration 9: Enhanced)
function setupSettingsPanel() {
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsClose = document.getElementById('settingsClose');
  
  // Add ARIA attributes for accessibility
  settingsPanel.setAttribute('aria-hidden', 'true');
  settingsBtn.setAttribute('aria-expanded', 'false');
  
  // Toggle settings panel
  settingsBtn.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.toggle('open');
    settingsBtn.setAttribute('aria-expanded', isOpen.toString());
    settingsPanel.setAttribute('aria-hidden', !isOpen);
  });
  
  settingsClose.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
    settingsBtn.setAttribute('aria-expanded', 'false');
    settingsPanel.setAttribute('aria-hidden', 'true');
  });
  
  // Close settings when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
      settingsPanel.classList.remove('open');
      settingsBtn.setAttribute('aria-expanded', 'false');
      settingsPanel.setAttribute('aria-hidden', 'true');
    }
  });
  
  // Save API key handlers
  platforms.forEach(platform => {
    const saveBtn = document.getElementById(`saveApiKey-${platform.id}`);
    const input = document.getElementById(`apiKey-${platform.id}`);
    
    if (saveBtn && input) {
      saveBtn.addEventListener('click', () => {
        const key = input.value;
        const isValid = validateAPIKey(platform.id, key);
        
        if (isValid.valid) {
          saveAPIKey(platform.id, key);
          
          // Test connection if enabled
          if (document.getElementById('enableRealAPI')?.checked) {
            testAPIConnection(platform.id);
          }
        } else {
          showToast(isValid.error || 'Invalid API key', 'error');
        }
      });
    }
  });
  
  // Enable/Disable real API toggle
  const enableRealAPI = document.getElementById('enableRealAPI');
  if (enableRealAPI) {
    enableRealAPI.addEventListener('change', async () => {
      const enabled = enableRealAPI.checked;
      
      if (enabled) {
        showToast('Real API mode enabled. Please configure API keys above.', 'success');
        
        // Test all configured APIs
        const connectedApis = [];
        platforms.forEach(platform => {
          const key = apiKeyStorage[platform.id];
          if (key) {
            const config = platformAPIConfig[platform.id];
            if (config.baseUrl) {
              try {
                await testAPIConnection(platform.id);
                connectedApis.push(platform.name);
              } catch (error) {
                console.error(`[${platform.id}] API test failed:`, error);
              }
            }
          }
        });
        
        if (connectedApis.length > 0) {
          showToast(`Connected APIs: ${connectedApis.join(', ')}`, 'success');
        } else {
          showToast('No connected APIs. Please configure valid API keys.', 'error');
        }
      }
    });
  }
  
  // Search functionality
  setupSearch();
  
  // Export/Import handlers
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportConversations);
  }
  
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });
    
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        importConversations(file);
        importFile.value = ''; // Reset input
      }
    });
  }
  
  // Clear all history handler
  const clearAllBtn = document.getElementById('clearAllHistoryBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      clearAllHistory();
      settingsPanel.classList.remove('open');
      settingsBtn.setAttribute('aria-expanded', 'false');
      settingsPanel.setAttribute('aria-hidden', 'true');
    });
  }
  
  // Status indicator
  const apiStatus = document.getElementById('apiStatus');
  const apiStatusText = document.getElementById('apiStatusText');
  
  async function updateStatus() {
    let connectedCount = 0;
    
    platforms.forEach(platform => {
      const key = apiKeyStorage[platform.id];
      if (key) {
        const config = platformAPIConfig[platform.id];
        if (config.baseUrl && !config.fallback) {
          try {
            await testAPIConnection(platform.id);
            connectedCount++;
          } catch (error) {
            console.error(`[${platform.id}] Status check failed:`, error);
          }
        } else {
          // Private/internal API
          connectedCount++;
        }
      }
    });
    
    const total = platforms.length;
    const percentage = Math.round((connectedCount / total) * 100);
    
    if (percentage >= 50) {
      apiStatus.classList.add('connected');
      apiStatusText.textContent = `API Status: ${percentage}% Connected`;
    } else {
      apiStatus.classList.remove('connected');
      apiStatusText.textContent = `API Status: Only ${percentage}% Connected`;
    }
  }
  
  // Update status when settings panel is opened
  settingsPanel.addEventListener('click', () => {
    updateStatus();
  });
}

// Perform conversation search
async function performSearch(query) {
  if (!query || query.length < 2) return;
  
  // Clear previous timeout
  if (searchTimeout) clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    try {
      // Search all conversations for matching messages
      const results = [];
      
      platforms.forEach(platform => {
        const history = conversationHistory[platform.id] || [];
        
        history.forEach(msg => {
          if (msg.content.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              platform: platform.name,
              type: msg.type,
              content: msg.content,
              timestamp: msg.timestamp,
              match: query
            });
          }
        });
      });
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Limit to top 10 results
      searchResults = results.slice(0, 10);
      
      // Display results in a toast or modal
      if (results.length > 0) {
        const resultText = `Found ${results.length} match(es):\n\n${results.map(r => 
          `[${r.platform}] (${new Date(r.timestamp).toLocaleString()})\n${r.content.substring(0, 100)}...`
        ).join('\n\n')}`;
        
        showToast(resultText, 'success');
      } else {
        showToast('No matching conversations found', 'error');
      }
      
    } catch (error) {
      console.error('[Search] Error:', error);
      showToast('Search error: ' + error.message, 'error');
    }
  }, 300); // 300ms debounce
}

// Export conversation history
function exportConversations() {
  try {
    const exportData = {};
    
    platforms.forEach(platform => {
      const history = conversationHistory[platform.id] || [];
      
      if (history.length > 0) {
        exportData[platform.name] = history.map(msg => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toISOString()
        }));
      }
    });
    
    // Create download link
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-gateway-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Conversations exported successfully!', 'success');
  } catch (error) {
    console.error('[Export] Error:', error);
    showToast('Error exporting conversations', 'error');
  }
}

// Import conversation history
function importConversations(file) {
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate structure
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Invalid export format');
      }
      
      // Merge with existing history
      Object.keys(importedData).forEach(platformName => {
        const platformId = platforms.find(p => p.name === platformName)?.id;
        
        if (platformId && importedData[platformName]) {
          conversationHistory[platformId] = [
            ...conversationHistory[platformId] || [],
            ...importedData[platformName].map(msg => ({
              id: Date.now() + Math.random(), // Generate new IDs to avoid conflicts
              type: msg.type,
              content: msg.content,
              timestamp: new Date(msg.timestamp).getTime()
            }))
          ];
          
          // Save updated history
          saveConversationHistoryToStorage(platformId);
        }
      });
      
      showToast('Conversations imported successfully!', 'success');
    } catch (error) {
      console.error('[Import] Error:', error);
      showToast('Error importing conversations: ' + error.message, 'error');
    }
  };
  
  reader.readAsText(file);
}

// Save conversation history to localStorage
function saveConversationHistoryToStorage(platformId) {
  try {
    localStorage.setItem(`conversation-history-${platformId}`, JSON.stringify(conversationHistory[platformId]));
    return true;
  } catch (error) {
    console.error(`[${platformId}] Error saving history:`, error);
    return false;
  }
}

// Clear conversation history
function clearConversationHistory(platformId) {
  conversationHistory[platformId] = [];
  
  try {
    localStorage.removeItem(`conversation-history-${platformId}`);
    showToast('Conversation history cleared for ' + platforms.find(p => p.id === platformId)?.name, 'success');
    return true;
  } catch (error) {
    console.error(`[${platformId}] Error clearing history:`, error);
    return false;
  }
}

// Clear all conversation history
function clearAllHistory() {
  if (!confirm('Are you sure you want to clear ALL conversation history? This cannot be undone.')) {
    return false;
  }
  
  platforms.forEach(platform => {
    clearConversationHistory(platform.id);
  });
  
  showToast('All conversation history cleared', 'success');
}

// Setup response panels (Iteration 9: Enhanced)
function setupResponsePanels() {
  // Create panels if not already created
  if (!document.getElementById('responsePanels')) {
    createResponsePanels();
  }
}

// Initialize the application
function init() {
  // Load persisted mode from localStorage
  const storedMode = localStorage.getItem('aiGatewayMode');
  if (storedMode && (storedMode === 'tabs' || storedMode === 'panels')) {
    currentMode = storedMode;
  }
  
  // Load conversation history from localStorage
  loadConversationHistory();
  
  // Load API keys
  loadAPIKeys();
  
  createWebviews();
  setupModeToggle();
  setupResponsePanels();
  setupSettingsPanel();
  
  // Listen for mode changes from main process
  ipcRenderer.on('mode-changed', (event, mode) => {
    currentMode = mode;
    updateModeUI(mode);
  });
  
  console.log('[Renderer] AI Gateway v2 initialized with real API integration');
}

// Load conversation history from localStorage
function loadConversationHistory() {
  platforms.forEach(platform => {
    const key = `conversation-history-${platform.id}`;
    try {
      const storedHistory = localStorage.getItem(key);
      if (storedHistory) {
        conversationHistory[platform.id] = JSON.parse(storedHistory);
      } else {
        conversationHistory[platform.id] = [];
      }
    } catch (error) {
      console.error(`[${platform.name}] Error loading history:`, error);
      conversationHistory[platform.id] = [];
    }
  });
}

// Update UI when mode changes
function updateModeUI(mode) {
  const body = document.body;
  
  if (mode === 'panels') {
    body.classList.add('panels-mode');
  } else {
    body.classList.remove('panels-mode');
  }
}

// Export for use in other modules
window.AIGateway = {
  setMode,
  getMode: () => currentMode,
  webviews,
  injectWebviewContent,
  pollingState,
  conversationHistory,
  saveMessageToHistory,
  clearConversationHistory,
  exportConversations,
  importConversations,
  searchResults
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  init();
  
  // Start polling for responses after a short delay
  setTimeout(startResponsePolling, 1000);
});
