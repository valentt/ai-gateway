const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('aiGateway', {
  // Unified send - sends prompt to all selected webviews
  unifiedSend: async (message, platforms) => {
    console.log('[Renderer] Unified send:', message, platforms);
    
    return Promise.all(platforms.map(async platform => {
      try {
        const result = await ipcRenderer.invoke('inject-prompt', { 
          message, 
          platforms: [platform] 
        });
        
        if (result.success) {
          console.log('[Renderer] Injected into:', platform);
        } else {
          console.error('[Renderer] Injection failed for:', platform, result?.error);
        }
        
        return { platform, success: result.success, error: result?.error };
      } catch (err) {
        console.error('[Renderer] Error injecting into', platform, err.message);
        return { platform, success: false, error: err.message };
      }
    }));
  },

  // Listen for unified response updates
  onUnifiedResponse: (callback) => {
    ipcRenderer.on('response-scraped', (event, data) => {
      callback(data);
    });
    
    return () => {
      ipcRenderer.removeAllListeners('response-scraped');
    };
  },

  // Send inject result back to main process
  sendInjectResult: (platform, success, error) => {
    console.log('[Renderer] Sending inject result:', platform, success, error);
  },

  // Send response scraped data to renderer UI
  sendResponseScraped: (data) => {
    console.log('[Renderer] Response scraped:', data);
    
    const { platform, content, tokens, durationMs, done } = data;
    
    if (!content || !platform) return;
    
    // Update UI based on current mode
    if (currentMode === 'isolated') {
      updateIsolatedPanel(platform, content, tokens, durationMs, done);
    } else if (currentMode === 'chatroom') {
      updateChatroomMessage(platform, content, done);
    }
  },

  // Copy panel content to clipboard
  copyPanel: (model) => {
    const body = document.querySelector(`.panel-body[data-model="${model}"]`);
    const text = body?.dataset?.rawText || body?.textContent || '';
    
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 1500);
      });
    }
  },

  // Expand panel (toggle full width)
  expandPanel: (model) => {
    const panel = document.querySelector(`.panel[data-model="${model}"]`);
    if (panel.style.gridColumn === '1 / -1') {
      panel.style.gridColumn = '';
      event.target.textContent = 'Expand';
    } else {
      panel.style.gridColumn = '1 / -1';
      event.target.textContent = 'Collapse';
    }
  },

  // Get webview response directly (for testing)
  getWebviewResponse: async (platform) => {
    return ipcRenderer.invoke('get-webview-response', platform);
  }
});

// UI state
let currentMode = 'isolated';
let panelStartTimes = {};
let chatroomIndicators = {};
let chatroomModels = [];

// Escape HTML to prevent XSS
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Convert basic markdown-like text to HTML paragraphs
function formatResponse(text) {
  if (!text) return '';
  return text.split('\n\n').map(p => {
    let html = esc(p).replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<p>${html}</p>`;
  }).join('');
}

// Update isolated panel with response
function updateIsolatedPanel(platform, content, tokens, durationMs, done) {
  const body = document.querySelector(`.panel-body[data-model="${platform}"]`);
  const meta = document.querySelector(`.panel-meta[data-model="${platform}"]`);
  
  if (!body || !meta) return;

  if (done && content) {
    const secs = ((durationMs || (Date.now() - (panelStartTimes[platform] || Date.now()))) / 1000).toFixed(1);
    meta.textContent = `${secs}s · ${tokens || '?'} tokens`;
    body.innerHTML = formatResponse(content);
    body.dataset.rawText = content;
    
    // Scroll to bottom
    const responseArea = document.getElementById('responseArea');
    if (responseArea) {
      responseArea.scrollTop = responseArea.scrollHeight;
    }
  } else if (content) {
    if (body.querySelector('.typing')) {
      body.innerHTML = '';
    }
    body.innerHTML = formatResponse(content);
    meta.textContent = 'generating...';
  }
}

// Update chatroom message with response
function updateChatroomMessage(platform, content, done) {
  const indicator = document.querySelector(`.chat-msg[data-model="${platform}"]`);
  
  if (!indicator || !content) return;
  
  const textEl = indicator.querySelector('.chat-text');

  if (done && content) {
    textEl.innerHTML = formatResponse(content);
  } else if (content) {
    if (textEl.querySelector('.typing')) textEl.innerHTML = '';
    textEl.innerHTML = formatResponse(content);
  }

  const room = document.getElementById('chatroomView');
  if (room) {
    room.scrollTop = room.scrollHeight;
  }
}

// Initialize mode from localStorage
const savedMode = localStorage.getItem('aiGatewayMode');
if (savedMode === 'panels') {
  currentMode = 'panels';
  document.body.classList.add('panels-mode');
  document.body.classList.remove('tabs-mode');
  
  // Update UI to reflect panels mode
  const isolatedView = document.getElementById('isolatedView');
  const chatroomView = document.getElementById('chatroomView');
  
  if (isolatedView) isolatedView.style.display = 'none';
  if (chatroomView) chatroomView.style.display = 'none';
}

// Listen for mode changes
document.addEventListener('DOMContentLoaded', () => {
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const newMode = e.target.dataset.mode || e.target.closest('.mode-toggle').dataset.mode;
      currentMode = newMode;
      
      if (newMode === 'tabs') {
        document.body.classList.add('tabs-mode');
        document.body.classList.remove('panels-mode');
        localStorage.setItem('aiGatewayMode', 'tabs');
        
        isolatedView.style.display = 'grid';
        chatroomView.style.display = 'none';
      } else {
        document.body.classList.add('panels-mode');
        document.body.classList.remove('tabs-mode');
        localStorage.setItem('aiGatewayMode', 'panels');
        
        isolatedView.style.display = 'none';
        chatroomView.style.display = 'none';
      }
    });
  });
});
