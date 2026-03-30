const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('aiGateway', {
  // IPC handlers for API key management
  openSettings: () => ipcRenderer.send('open-settings'),
  
  getApiKeys: () => ipcRenderer.invoke('get-api-keys'),
  
  setApiKey: (platform, key) => ipcRenderer.invoke('set-api-key', { platform, key }),
  
  clearApiKey: (platform) => ipcRenderer.invoke('clear-api-key', platform),
  
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),

  // Send question to a model via API
  sendToModel: (platform, question) => ipcRenderer.invoke('send-to-model', { platform, question }),

  // Event listeners for responses
  onUnifiedResponse: (callback) => {
    ipcRenderer.on('response-scraped', (event, data) => {
      if (callback) callback(data);
    });
    return () => {
      ipcRenderer.removeAllListeners('response-scraped');
    };
  },
  
  // Send response back to main process
  sendResponseScraped: (platform, data) => {
    console.log('[Renderer] Sending response:', platform, data);
  },
  
  // Send inject result to main process
  sendInjectResult: (platform, success, error) => {
    console.log('[Renderer] Inject result:', platform, success, error);
  }
});

// Platform information for UI
contextBridge.exposeInMainWorld('platforms', {
  chatgpt: { name: 'ChatGPT', color: '#74aa9c', icon: 'C' },
  claude: { name: 'Claude', color: '#d4a574', icon: 'C' },
  gemini: { name: 'Gemini', color: '#4285f4', icon: 'Ge' },
  grok: { name: 'Grok', color: '#000000', icon: 'G' },
  deepseek: { name: 'DeepSeek', color: '#6366f1', icon: 'D' },
  kimi: { name: 'Kimi', color: '#ff6b35', icon: 'K' },
  qwen: { name: 'Qwen', color: '#10b981', icon: 'Q' },
  perplexity: { name: 'Perplexity', color: '#f97316', icon: 'P' },
  manus: { name: 'Manus', color: '#a855f7', icon: 'M' }
});

// Expose API service info to renderer for UI display
contextBridge.exposeInMainWorld('apiService', {
  // Get list of platforms with direct API support
  getApiPlatforms: () => ({
    chatgpt: { hasApi: true, requiresKey: true },
    claude: { hasApi: true, requiresKey: true },
    gemini: { hasApi: true, requiresKey: true },
    deepseek: { hasApi: true, requiresKey: true },
    qwen: { hasApi: true, requiresKey: true },
    perplexity: { hasApi: true, requiresKey: true },
    kimi: { hasApi: true, requiresKey: true },
    grok: { hasApi: false, requiresKey: false },
    manus: { hasApi: false, requiresKey: false }
  }),
  
  // Check if a platform supports direct API
  hasApiSupport: (platform) => {
    const apiPlatforms = Object.keys(contextBridge.exposedInMainWorld.platforms);
    return apiPlatforms.includes(platform) && 
           ['chatgpt', 'claude', 'gemini', 'deepseek', 'qwen', 'perplexity', 'kimi'].includes(platform);
  }
});
