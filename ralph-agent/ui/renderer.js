// AI Gateway v2 - Renderer process
// Handles webview creation, mode toggle, prompt injection, and response extraction
// Iteration 5: Enhanced with history persistence and better response parsing

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

// Platform API endpoint placeholders (for testing)
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

// Response polling interval (ms)
const RESPONSE_POLL_INTERVAL = 2000;

// Polling state for each webview - enhanced with message history
const pollingState = {};

// Message history storage per platform
const conversationHistory = {};

// Initialize the application
function init() {
  // Load persisted mode from localStorage
  const storedMode = localStorage.getItem('aiGatewayMode');
  if (storedMode && (storedMode === 'tabs' || storedMode === 'panels')) {
    currentMode = storedMode;
  }
  
  // Load conversation history from localStorage
  loadConversationHistory();
  
  createWebviews();
  setupModeToggle();
  setupResponsePanels();
  
  // Listen for mode changes from main process
  ipcRenderer.on('mode-changed', (event, mode) => {
    currentMode = mode;
    updateModeUI(mode);
  });
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

// Save message to conversation history
function saveMessageToHistory(platformId, message, type, response = null) {
  if (!conversationHistory[platformId]) {
    conversationHistory[platformId] = [];
  }
  
  const msgEntry = {
    id: Date.now(),
    type: type, // 'user' or 'assistant'
    content: message,
    timestamp: new Date().toISOString()
  };
  
  if (response) {
    msgEntry.response = response;
  }
  
  conversationHistory[platformId].push(msgEntry);
  
  try {
    localStorage.setItem(`conversation-history-${platformId}`, JSON.stringify(conversationHistory[platformId]));
    return true;
  } catch (error) {
    console.error(`[${platformId}] Error saving history:`, error);
    return false;
  }
}

// Clear conversation history for a platform
function clearConversationHistory(platformId) {
  conversationHistory[platformId] = [];
  
  try {
    localStorage.removeItem(`conversation-history-${platformId}`);
    return true;
  } catch (error) {
    console.error(`[${platformId}] Error clearing history:`, error);
    return false;
  }
}

// Create webview elements for each AI provider
function createWebviews() {
  platforms.forEach(platform => {
    const container = document.querySelector(`[data-platform="${platform.id}"] .webview-content`);
    
    if (!container) return;

    // Create webview element with data-platform attribute
    const webview = document.createElement('webview');
    webview.setAttribute('data-platform', platform.id);
    
    // Set placeholder src URL - will be overridden by actual API when ready
    webview.setAttribute('src', platformEndpoints[platform.id] || '');
    
    // Add error handling for webview failures
    webview.addEventListener('did-fail-load', (event) => {
      const errorCode = event.errorCode;
      const errorText = event.errorText || 'Unknown error';
      
      console.error(`[${platform.name}] Webview failed to load:`);
      console.error(`  Code: ${errorCode}`);
      console.error(`  Text: ${errorText}`);
      
      // Attempt recovery - reload the webview
      try {
        webview.reload();
        console.log(`[${platform.name}] Attempting recovery reload...`);
      } catch (e) {
        console.error(`[${platform.name}] Recovery failed:`, e);
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

// Template HTML/JS that will be injected into each webview
function getWebviewTemplate(platformId) {
  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${platformId.toUpperCase()}</title>
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
      </style>
    </head>
    <body>
      <div class="container">
        <h2 style="text-align:center; margin-bottom:20px;">${platformId.toUpperCase()}</h2>
        <div class="chat-container">
          <div class="chat-messages" id="messages"></div>
          <div class="input-area">
            <input type="text" id="userInput" placeholder="Type your message..." autocomplete="off">
            <button id="sendBtn">Send</button>
          </div>
        </div>
      </div>
      
      <script>
        // Webview communication setup
        const platformId = '${platformId}';
        
        // Send a ready message to parent process
        window.addEventListener('load', () => {
          console.log('[Webview]', platformId, 'Ready');
          
          // Load existing messages from history if available
          loadHistoryMessages();
          
          // Setup user input handling
          const sendBtn = document.getElementById('sendBtn');
          const userInput = document.getElementById('userInput');
          const messagesDiv = document.getElementById('messages');
          
          function addMessage(text, type) {
            const msg = document.createElement('div');
            msg.className = 'message ' + type;
            
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (type === 'system') {
              msg.innerHTML = `<span>${text}</span>`;
            } else {
              msg.innerHTML = `
                <div class="message-header">
                  <span>${timeString}</span>
                </div>
                ${text}
              `;
            }
            
            messagesDiv.appendChild(msg);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
          }
          
          async function handleUserSubmit() {
            const input = userInput.value.trim();
            if (!input) return;
            
            // Add user message
            addMessage(input, 'user');
            userInput.value = '';
            sendBtn.disabled = true;
            
            // Save to history
            await saveToHistory({
              type: 'user',
              content: input,
              timestamp: Date.now()
            });
            
            // Send prompt to parent process for injection
            if (window.electronAPI?.injectPrompt) {
              window.electronAPI.injectPrompt(platformId, {
                message: input,
                timestamp: Date.now(),
                platform: platformId
              }).then(result => {
                console.log('[Webview]', platformId, 'Prompt injection result:', result);
                
                // Simulate AI response (replace with actual API call)
                setTimeout(() => {
                  const responses = {
                    chatgpt: 'This is a simulated response from ChatGPT. Connect to the actual API for real responses.',
                    claude: 'This is a simulated response from Claude. Connect to the actual API for real responses.',
                    gemini: 'This is a simulated response from Gemini. Connect to the actual API for real responses.',
                    grok: 'This is a simulated response from Grok. Connect to the actual API for real responses.',
                    deepseek: 'This is a simulated response from DeepSeek. Connect to the actual API for real responses.',
                    kimi: 'This is a simulated response from Kimi. Connect to the actual API for real responses.',
                    qwen: 'This is a simulated response from Qwen. Connect to the actual API for real responses.',
                    perplexity: 'This is a simulated response from Perplexity. Connect to the actual API for real responses.',
                    manus: 'This is a simulated response from Manus. Connect to the actual API for real responses.'
                  };
                  
                  const response = responses[platformId] || 'Response received!';
                  addMessage(response, 'assistant');
                  
                  // Save assistant response to history
                  saveToHistory({
                    type: 'assistant',
                    content: response,
                    timestamp: Date.now()
                  });
                  
                  sendBtn.disabled = false;
                }, 1500);
              }).catch(err => {
                console.error('[Webview]', platformId, 'Error sending prompt:', err);
                addMessage('Error: Could not send message to AI provider.', 'assistant');
                sendBtn.disabled = false;
              });
            } else {
              // No electronAPI available - simulate response directly
              setTimeout(() => {
                const responses = {
                  chatgpt: 'This is a simulated response from ChatGPT. Connect to the actual API for real responses.',
                  claude: 'This is a simulated response from Claude. Connect to the actual API for real responses.',
                  gemini: 'This is a simulated response from Gemini. Connect to the actual API for real responses.',
                  grok: 'This is a simulated response from Grok. Connect to the actual API for real responses.',
                  deepseek: 'This is a simulated response from DeepSeek. Connect to the actual API for real responses.',
                  kimi: 'This is a simulated response from Kimi. Connect to the actual API for real responses.',
                  qwen: 'This is a simulated response from Qwen. Connect to the actual API for real responses.',
                  perplexity: 'This is a simulated response from Perplexity. Connect to the actual API for real responses.',
                  manus: 'This is a simulated response from Manus. Connect to the actual API for real responses.'
                };
                
                addMessage(responses[platformId] || 'Response received!', 'assistant');
                sendBtn.disabled = false;
              }, 1500);
            }
          }
          
          userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUserSubmit();
          });
          
          sendBtn.addEventListener('click', handleUserSubmit);
        });
        
        // Load history messages when webview is ready
        function loadHistoryMessages() {
          // In a real implementation, fetch from localStorage or IPC
          // For now, this is placeholder
          console.log('[Webview]', platformId, 'Loading history...');
        }
        
        // Save message to history (placeholder for real implementation)
        async function saveToHistory(message) {
          // In a real implementation, send IPC message to main process
          if (window.electronAPI?.saveMessageToHistory) {
            return window.electronAPI.saveMessageToHistory(platformId, message.content, message.type);
          }
          return Promise.resolve(true);
        }
      </script>
    </body>
    </html>
  `;
}

// Inject HTML template into webview
function injectWebviewContent(platformId) {
  const webview = webviews[platformId];
  
  if (!webview) {
    console.error(`[${platformId}] Webview not found`);
    return false;
  }
  
  try {
    // Inject the template content into the webview's main world context
    // This allows us to send messages back to the parent process
    const template = getWebviewTemplate(platformId);
    
    // Clear and inject new content
    webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(template);
    
    console.log(`[${platformId}] Injected template content`);
    return true;
  } catch (error) {
    console.error(`[${platformId}] Error injecting template:`, error);
    return false;
  }
}

// Create response panels for each platform with enhanced UI
function createResponsePanels() {
  const panelsContainer = document.getElementById('responsePanels');
  
  platforms.forEach(platform => {
    const panel = document.createElement('div');
    panel.className = 'response-panel';
    
    // Use CSS variable for platform color, fallback to default
    panel.innerHTML = `
      <div class="response-panel-header">
        <div class="platform-icon" style="background: ${platformColorMap[platform.id] || '#666'}"></div>
        <h3>${platform.name}</h3>
        <button id="panel-clear-${platform.id}" style="margin-left:auto; background:none; border:none; color:#aaa; cursor:pointer;">Clear</button>
      </div>
      <div class="response-panel-content" data-platform="${platform.id}">
        <div class="loading"></div>
      </div>
    `;

    // Add clear button functionality
    const clearBtn = panel.querySelector(`#panel-clear-${platform.id}`);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const contentDiv = panel.querySelector('.response-panel-content');
        if (contentDiv) {
          contentDiv.innerHTML = '<div class="loading"></div>';
          // Clear history as well
          clearConversationHistory(platform.id);
        }
      });
    }

    panelsContainer.appendChild(panel);
  });
}

// Setup response panels with enhanced functionality
function setupResponsePanels() {
  const panelsContainer = document.getElementById('responsePanels');
  
  if (!panelsContainer) return;
  
  // Populate panels with history data
  platforms.forEach(platform => {
    const panelContent = panelsContainer.querySelector(`[data-platform="${platform.id}"]`);
    
    if (panelContent && conversationHistory[platform.id].length > 0) {
      renderPanelMessages(panelContent, platform.id);
    }
  });
}

// Render messages in a response panel
function renderPanelMessages(panelElement, platformId) {
  const history = conversationHistory[platformId] || [];
  
  if (history.length === 0) {
    panelElement.innerHTML = '<div style="padding:20px; color:#888; text-align:center;">No messages yet. Start chatting!</div>';
    return;
  }
  
  let html = '';
  
  history.forEach(msg => {
    const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (msg.type === 'user') {
      html += `
        <div style="display:flex; margin-bottom:8px;">
          <div style="flex:1; background:#0f3460; color:white; padding:10px 14px; border-radius:16px 16px 4px 4px; margin-right:8px;">
            ${msg.content}
          </div>
        </div>
      `;
    } else if (msg.type === 'assistant') {
      html += `
        <div style="display:flex; margin-bottom:8px;">
          <div style="flex:1; background:#e0e0e0; color:#333; padding:10px 14px; border-radius:16px 16px 4px 4px; margin-right:8px;">
            ${msg.content}
          </div>
        </div>
      `;
    } else if (msg.type === 'system') {
      html += `<div style="text-align:center; color:#888; font-size:12px; padding:4px 0;">${msg.content}</div>`;
    }
  });
  
  panelElement.innerHTML = html;
}

// Setup mode toggle functionality
function setupModeToggle() {
  const toggle = document.getElementById('modeToggle');
  const tabsBtn = toggle.querySelector('[data-mode="tabs"]');
  const panelsBtn = toggle.querySelector('[data-mode="panels"]');

  if (tabsBtn && panelsBtn) {
    tabsBtn.addEventListener('click', () => setMode('tabs'));
    panelsBtn.addEventListener('click', () => setMode('panels'));
    
    // Sync with current mode from main process
    const current = window.electronAPI?.getCurrentMode?.() || currentMode;
    if (current === 'tabs') {
      tabsBtn.classList.add('active');
      panelsBtn.classList.remove('active');
      document.body.classList.remove('panels-mode');
    } else {
      tabsBtn.classList.remove('active');
      panelsBtn.classList.add('active');
      document.body.classList.add('panels-mode');
    }
  }
}

// Update mode UI elements
function updateModeUI(mode) {
  const tabsBtn = document.querySelector('[data-mode="tabs"]');
  const panelsBtn = document.querySelector('[data-mode="panels"]');
  
  if (mode === 'tabs') {
    tabsBtn.classList.add('active');
    panelsBtn.classList.remove('active');
    document.body.classList.remove('panels-mode');
  } else {
    tabsBtn.classList.remove('active');
    panelsBtn.classList.add('active');
    document.body.classList.add('panels-mode');
  }
}

// Set the current mode (tabs or panels)
function setMode(mode) {
  if (currentMode === mode) return;
  
  currentMode = mode;
  
  // Persist mode to localStorage
  localStorage.setItem('aiGatewayMode', mode);
  
  // Update button states
  updateModeUI(mode);
  
  // If switching to panels mode, hide webviews and show response panels
  if (mode === 'panels') {
    document.body.classList.add('panels-mode');
    
    // Hide all webviews
    const webviewTabs = document.querySelectorAll('.webview-tab');
    webviewTabs.forEach(webview => {
      webview.style.position = 'absolute';
      webview.style.left = '-9999px';
      webview.style.visibility = 'hidden';
    });

    // Show response panels and render messages
    const panels = document.getElementById('responsePanels');
    if (panels) {
      panels.style.display = 'grid';
      
      // Render all panel messages
      platforms.forEach(platform => {
        const panelContent = panels.querySelector(`[data-platform="${platform.id}"]`);
        if (panelContent && conversationHistory[platform.id]) {
          renderPanelMessages(panelContent, platform.id);
        }
      });
    }
  } 
  // If switching to tabs mode, show webviews and hide response panels
  else if (mode === 'tabs') {
    document.body.classList.remove('panels-mode');
    
    // Show all webviews
    const webviewTabs = document.querySelectorAll('.webview-tab');
    webviewTabs.forEach(webview => {
      webview.style.position = 'relative';
      webview.style.left = 'auto';
      webview.style.visibility = 'visible';
    });

    // Hide response panels
    const panels = document.getElementById('responsePanels');
    if (panels) {
      panels.style.display = 'none';
    }
  }
}

// IPC handler for injecting prompts into webviews
ipcRenderer.on('inject-prompt', (event, platformId, promptData) => {
  const webview = webviews[platformId];
  
  if (!webview) {
    console.error(`[${platformId}] Webview not found`);
    return;
  }
  
  if (currentMode === 'tabs') {
    // Only inject when in tabs mode and webview is visible
    try {
      // Send message to renderer's injected content
      webview.send('prompt-injected', promptData);
      console.log(`[${platformId}] Prompt injected successfully`);
    } catch (error) {
      console.error(`[${platformId}] Error sending prompt:`, error);
    }
  } else if (currentMode === 'panels') {
    // In panels mode, we might need to show the webview temporarily
    const webviewContainer = document.querySelector(`[data-platform="${platformId}"]`);
    if (webviewContainer) {
      webviewContainer.style.position = 'relative';
      webviewContainer.style.left = 'auto';
      webviewContainer.style.visibility = 'visible';
      
      // Find the actual webview element inside
      const webviewElement = webviewContainer.querySelector('webview');
      if (webviewElement) {
        try {
          webviewElement.send('prompt-injected', promptData);
          
          // Hide after a short delay
          setTimeout(() => {
            webviewContainer.style.position = 'absolute';
            webviewContainer.style.left = '-9999px';
            webviewContainer.style.visibility = 'hidden';
          }, 500);
        } catch (error) {
          console.error(`[${platformId}] Error sending prompt in panels mode:`, error);
        }
      }
    }
  }
});

// IPC handler for extracting responses from webviews
ipcRenderer.on('extract-response', (event, platformId) => {
  const webview = webviews[platformId];
  
  if (!webview) {
    console.error(`[${platformId}] Webview not found`);
    return null;
  }
  
  console.log(`[${platformId}] Extracting response...`);
  
  try {
    // Get the last sent message from webview (if any)
    // In a real implementation, this would extract from DOM or IPC
    
    // Return current polling state if available
    const state = pollingState[platformId];
    
    // Simulate extracting response from last known state
    if (state && state.lastResponseTime) {
      const response = {
        platform: platformId,
        timestamp: state.lastResponseTime,
        message: 'Response extracted successfully'
      };
      
      console.log(`[${platformId}] Response data:`, JSON.stringify(response));
      return response;
    }
    
    return null;
  } catch (error) {
    console.error(`[${platformId}] Error extracting response:`, error);
    return null;
  }
});

// Start polling for responses from webviews
function startResponsePolling() {
  platforms.forEach(platform => {
    // Set up periodic polling for each webview
    setInterval(() => {
      const state = pollingState[platform.id];
      
      if (state) {
        // Check if there's a pending prompt response to extract
        console.log(`[${platform.id}] Polling for responses...`);
        
        // Extract and return response data if available
        ipcRenderer.sendToHost('response-ready', {
          platform: platform.id,
          lastResponseTime: state.lastResponseTime,
          timestamp: Date.now()
        });
      }
    }, RESPONSE_POLL_INTERVAL);
  });
}

// Listen for IPC messages from main process
const channelHandlers = {
  'prompt-injected': (event, data) => {
    console.log(`[${data.platform}] Prompt received: ${JSON.stringify(data.message).substring(0, 50)}...`);
    
    // Update polling state with new response time
    const state = pollingState[data.platform] || {};
    state.lastResponseTime = Date.now();
    pollingState[data.platform] = state;
  },
  
  'response-received': (event, data) => {
    console.log(`[${data.platform}] Response received: ${data.response.substring(0, 100)}...`);
    
    // Update polling state with new response time
    const state = pollingState[data.platform] || {};
    state.lastResponseTime = Date.now();
    pollingState[data.platform] = state;
    
    // Send to main process for UI update
    ipcRenderer.sendToHost('response-updated', {
      platform: data.platform,
      response: data.response,
      timestamp: Date.now()
    });
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  init();
  
  // Start polling for responses after a short delay
  setTimeout(startResponsePolling, 1000);
});

// Export for use in other modules
window.AIGateway = {
  setMode,
  getMode: () => currentMode,
  webviews,
  injectWebviewContent,
  pollingState,
  conversationHistory,
  saveMessageToHistory,
  clearConversationHistory
};
