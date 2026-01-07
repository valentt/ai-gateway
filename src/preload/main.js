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
    const validChannels = ['conversation-saved', 'message-saved', 'platform-update', 'reload-webview'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
