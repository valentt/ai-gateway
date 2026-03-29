/**
 * Preload script for main window
 *
 * Exposes safe IPC methods to the renderer process.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('aiGateway', {
  // Get list of available platforms
  getPlatforms: () => ipcRenderer.invoke('get-platforms'),

  // Get API server port
  getApiPort: () => ipcRenderer.invoke('get-api-port'),

  // Profile management
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  getActiveProfile: (platformId) => ipcRenderer.invoke('get-active-profile', platformId),
  setActiveProfile: (platformId, profileId) => ipcRenderer.invoke('set-active-profile', platformId, profileId),
  createProfile: (platformId, profileName) => ipcRenderer.invoke('create-profile', platformId, profileName),
  renameProfile: (platformId, profileId, newName) => ipcRenderer.invoke('rename-profile', platformId, profileId, newName),
  deleteProfile: (platformId, profileId) => ipcRenderer.invoke('delete-profile', platformId, profileId),
  getPartition: (platformId, profileId) => ipcRenderer.invoke('get-partition', platformId, profileId),

  // Session restore - remember last visited URLs
  saveLastUrl: (platformId, profileId, url) => ipcRenderer.invoke('save-last-url', platformId, profileId, url),
  getLastUrl: (platformId, profileId) => ipcRenderer.invoke('get-last-url', platformId, profileId),
  saveLastActivePlatform: (platformId) => ipcRenderer.invoke('save-last-active-platform', platformId),
  getLastActivePlatform: () => ipcRenderer.invoke('get-last-active-platform'),

  // Content extraction
  getExtractor: (platformId) => ipcRenderer.invoke('get-extractor', platformId),
  saveExtractedContent: (data) => ipcRenderer.invoke('save-extracted-content', data),

  // Show context menu with Copy URL options
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),

  // Send message to main process
  send: (channel, data) => {
    const validChannels = ['save-conversation', 'save-message', 'webview-ready', 'show-context-menu'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Receive message from main process
  receive: (channel, func) => {
    const validChannels = ['conversation-saved', 'message-saved', 'platform-update', 'reload-webview', 'generate-image'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Send image generation result back to main process
  sendImageResult: (result) => ipcRenderer.send('image-generated', result),

  // Listen for image generation requests
  onGenerateImage: (callback) => {
    ipcRenderer.on('generate-image', (event, data) => callback(data));
  },

  // Chat API - Send message to AI platform
  onSendChat: (callback) => {
    ipcRenderer.on('send-chat', (event, data) => callback(data));
  },

  // Send chat result back to main process
  sendChatResult: (result) => ipcRenderer.send('chat-completed', result),

  // Token extraction for direct API
  onGetToken: (callback) => {
    ipcRenderer.on('get-token', (event, data) => callback(data));
  },

  // Send token back to main process
  sendToken: (platform, token) => ipcRenderer.send('token-result', { platform, token }),

  // ── Unified Send (v2) ──
  // Listen for unified inject command (send prompt to multiple webviews)
  onUnifiedInject: (callback) => {
    ipcRenderer.on('unified-inject', (event, data) => callback(data));
  },

  // Report injection result per platform
  sendInjectResult: (platform, success, error) => {
    ipcRenderer.send('inject-result', { platform, success, error });
  },

  // Report scraped response per platform
  sendResponseScraped: (data) => {
    ipcRenderer.send('response-scraped', data);
  },

  // Listen for unified response updates (for panel display)
  onUnifiedResponse: (callback) => {
    ipcRenderer.on('unified-response', (event, data) => callback(data));
  },

  // Get injector availability for a platform
  getInjector: (platformId) => ipcRenderer.invoke('get-injector', platformId),

  // Trigger unified send
  unifiedSend: (message, platforms) => ipcRenderer.invoke('unified-send', { message, platforms })
});
