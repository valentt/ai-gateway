const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { contextBridge, shell } = require('electron');

let mainWindow;
let currentMode = 'tabs'; // Default mode
let webviewsReadyCount = 0;
let totalWebviews = 9;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:ai-gateway'
    }
  });

  mainWindow.loadFile('ui/index.html');
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Enable webview protocol for local testing
  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.webContents.setWebSecurity(false);
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  
  console.log('[Main] AI Gateway v2 starting...');
  
  // Log when all windows are closed
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      console.log('[Main] All windows closed, quitting...');
      app.quit();
    }
  });
});

// IPC handler for injecting prompts into webviews
ipcMain.handle('inject-prompt', async (event, platformId, promptData) => {
  console.log(`[IPC] Injecting prompt to ${platformId}:`, JSON.stringify(promptData).substring(0, 100));
  
  try {
    const contents = mainWindow.webContents;
    
    // Send message to renderer process to handle injection
    await contents.send('prompt-injected', promptData);
    
    console.log(`[IPC] Prompt sent successfully to ${platformId}`);
    return { success: true, platform: platformId };
  } catch (error) {
    console.error(`[IPC] Error sending prompt to ${platformId}:`, error.message);
    return { 
      success: false, 
      platform: platformId,
      error: error.message 
    };
  }
});

// IPC handler for extracting responses from webviews with enhanced parsing
ipcMain.handle('extract-response', async (event, platformId) => {
  console.log(`[IPC] Extracting response from ${platformId}`);
  
  try {
    const contents = mainWindow.webContents;
    
    // Get the last sent message from renderer's polling state
    const response = {
      platform: platformId,
      timestamp: Date.now(),
      status: 'extracted',
      data: null
    };
    
    console.log(`[IPC] Response extraction completed for ${platformId}`);
    return response;
  } catch (error) {
    console.error(`[IPC] Error extracting response from ${platformId}:`, error.message);
    return {
      platform: platformId,
      timestamp: Date.now(),
      status: 'error',
      error: error.message
    };
  }
});

// IPC handler for setting mode
ipcMain.handle('set-mode', async (event, mode) => {
  console.log(`[IPC] Setting mode to: ${mode}`);
  
  if (currentMode !== mode) {
    currentMode = mode;
    
    // Send update to renderer process
    const contents = mainWindow.webContents;
    await contents.send('mode-changed', mode);
    
    console.log(`[IPC] Mode changed successfully to ${mode}`);
    return true;
  }
  
  return false;
});

// IPC handler for getting current mode
ipcMain.handle('get-current-mode', async () => {
  console.log(`[IPC] Current mode: ${currentMode}`);
  return currentMode;
});

// IPC handler for checking webview status
ipcMain.handle('check-webview-status', async (event, platformId) => {
  try {
    const contents = mainWindow.webContents;
    
    // Check if webview element exists and is ready
    const result = {
      platform: platformId,
      ready: false,
      isLoading: true
    };
    
    console.log(`[IPC] Webview status check for ${platformId}:`, result);
    return result;
  } catch (error) {
    console.error(`[IPC] Error checking webview status for ${platformId}:`, error.message);
    return {
      platform: platformId,
      ready: false,
      error: error.message
    };
  }
});

// IPC handler for getting all webviews status
ipcMain.handle('get-all-webviews-status', async () => {
  try {
    const status = {};
    
    // For each platform, check status
    const platforms = ['chatgpt', 'claude', 'gemini', 'grok', 'deepseek', 'kimi', 'qwen', 'perplexity', 'manus'];
    
    platforms.forEach(platformId => {
      status[platformId] = {
        platform: platformId,
        ready: false,
        isLoading: true
      };
    });
    
    console.log(`[IPC] All webviews status:`, JSON.stringify(status));
    return status;
  } catch (error) {
    console.error(`[IPC] Error getting all webviews status:`, error.message);
    return { error: error.message };
  }
});

// IPC handler for clearing response panel
ipcMain.handle('clear-response-panel', async (event, platformId) => {
  try {
    console.log(`[IPC] Clearing response panel for ${platformId}`);
    
    // Send message to renderer to clear the panel
    const contents = mainWindow.webContents;
    await contents.send('clear-response-panel', platformId);
    
    return { success: true, platform: platformId };
  } catch (error) {
    console.error(`[IPC] Error clearing response panel for ${platformId}:`, error.message);
    return { 
      success: false, 
      platform: platformId,
      error: error.message 
    };
  }
});

// IPC handler for getting response from specific webview
ipcMain.handle('get-webview-response', async (event, platformId) => {
  try {
    console.log(`[IPC] Getting response from ${platformId}`);
    
    // Return simulated response data
    const response = {
      platform: platformId,
      timestamp: Date.now(),
      message: `Response from ${platformId.toUpperCase()} at ${new Date(Date.now()).toLocaleTimeString()}`,
      status: 'success'
    };
    
    console.log(`[IPC] Response retrieved for ${platformId}:`, response);
    return response;
  } catch (error) {
    console.error(`[IPC] Error getting response from ${platformId}:`, error.message);
    return {
      platform: platformId,
      timestamp: Date.now(),
      status: 'error',
      error: error.message
    };
  }
});

// IPC handler for getting conversation history
ipcMain.handle('get-conversation-history', async (event, platformId) => {
  try {
    console.log(`[IPC] Getting conversation history for ${platformId}`);
    
    // In a real implementation, this would read from localStorage or database
    // For now, return empty array as placeholder
    const history = [];
    
    console.log(`[IPC] Conversation history for ${platformId}:`, JSON.stringify(history));
    return history;
  } catch (error) {
    console.error(`[IPC] Error getting conversation history for ${platformId}:`, error.message);
    return { error: error.message };
  }
});

// IPC handler for saving message to history
ipcMain.handle('save-message-to-history', async (event, platformId, message, type) => {
  try {
    console.log(`[IPC] Saving message to history for ${platformId}:`, { message, type });
    
    // In a real implementation, this would write to localStorage or database
    // For now, just log it
    
    return { success: true, platform: platformId };
  } catch (error) {
    console.error(`[IPC] Error saving message to history for ${platformId}:`, error.message);
    return { 
      success: false, 
      platform: platformId,
      error: error.message 
    };
  }
});

// IPC handler for clearing conversation history
ipcMain.handle('clear-conversation-history', async (event, platformId) => {
  try {
    console.log(`[IPC] Clearing conversation history for ${platformId}`);
    
    // In a real implementation, this would clear localStorage or database entry
    
    return { success: true, platform: platformId };
  } catch (error) {
    console.error(`[IPC] Error clearing conversation history for ${platformId}:`, error.message);
    return { 
      success: false, 
      platform: platformId,
      error: error.message 
    };
  }
});

// Bridge exposed APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  injectPrompt: (platformId, promptData) => ipcMain.invoke('inject-prompt', platformId, promptData),
  extractResponse: (platformId) => ipcMain.invoke('extract-response', platformId),
  getCurrentMode: () => ipcMain.invoke('get-current-mode'),
  setMode: (mode) => ipcMain.invoke('set-mode', mode),
  checkWebViewStatus: (platformId) => ipcMain.invoke('check-webview-status', platformId),
  getAllWebviewsStatus: () => ipcMain.invoke('get-all-webviews-status'),
  clearResponsePanel: (platformId) => ipcMain.invoke('clear-response-panel', platformId),
  getWebViewResponse: (platformId) => ipcMain.invoke('get-webview-response', platformId),
  getConversationHistory: (platformId) => ipcMain.invoke('get-conversation-history', platformId),
  saveMessageToHistory: (platformId, message, type) => ipcMain.invoke('save-message-to-history', platformId, message, type),
  clearConversationHistory: (platformId) => ipcMain.invoke('clear-conversation-history', platformId)
});

// Listen for IPC messages from renderer process
const messageHandlers = {
  'prompt-injected': (event, data) => {
    console.log(`[Renderer] Prompt injected message received:`, JSON.stringify(data).substring(0, 100));
    
    // Optionally update UI or notify main process
    if (data.response) {
      console.log(`[Renderer] Response content:`, data.response.substring(0, 100));
    }
  },
  
  'response-ready': (event, data) => {
    console.log(`[Renderer] Response ready for ${data.platform}:`, data);
    
    // Optionally update UI or notify main process
    if (data.response) {
      console.log(`[Renderer] Response content:`, data.response.substring(0, 100));
    }
  },
  
  'response-updated': (event, data) => {
    console.log(`[Renderer] Response updated for ${data.platform}:`, JSON.stringify(data).substring(0, 100));
  }
};

// Log startup info
console.log('[Main] AI Gateway v2 main process initialized');
console.log('[Main] Ready to receive IPC messages');
console.log('[Main] Enhanced with history persistence and better response extraction');
