const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Load API service for real API integration
const apiService = require('./api-service');

// Platform endpoints for each AI provider (fallback URLs)
const platformEndpoints = {
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/chat',
  gemini: 'https://gemini.google.com/chat',
  grok: 'https://grok.x.ai',
  deepseek: 'https://deepseek.com/chat',
  kimi: 'https://kimi.moonshot.cn/chat',
  qwen: 'https://chat.qwen.ai',
  perplexity: 'https://perplexity.ai',
  manus: 'https://manus.im'
};

// Configuration file path
const CONFIG_PATH = path.join(app.getPath('userData'), 'api-keys.json');

/**
 * Load API keys from configuration file with encryption support
 */
function loadApiKeys() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Main] Failed to load API keys:', err.message);
  }
  return {};
}

/**
 * Save API keys to configuration file atomically
 */
function saveApiKeys(keys) {
  try {
    // Create parent directory if needed
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write atomically using temp file
    const tempPath = CONFIG_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(keys, null, 2));
    fs.renameSync(tempPath, CONFIG_PATH);
    return true;
  } catch (err) {
    console.error('[Main] Failed to save API keys:', err.message);
    return false;
  }
}

/**
 * Create the browser window with webviews
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // Load the index.html
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Webview injection/extraction is handled in the renderer process
  // via <webview>.executeJavaScript(). No main-process webview
  // management needed.

  mainWindow.on('closed', () => {
    console.log('[Main] Window closed');
  });
}

/**
 * IPC Handler: Open settings dialog
 */
ipcMain.handle('open-settings', async () => {
  try {
    // Create settings window with preload for IPC access
    const settingsWindow = new BrowserWindow({
      width: 600,
      height: 700,
      parent: BrowserWindow.getFocusedWindow(),
      modal: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));
    return true;
  } catch (err) {
    console.error('[Settings] Error:', err.message);
    return null;
  }
});

/**
 * IPC Handler: Get API keys
 */
ipcMain.handle('get-api-keys', async () => {
  return loadApiKeys();
});

/**
 * IPC Handler: Set API key for platform
 */
ipcMain.handle('set-api-key', async (event, { platform, key }) => {
  try {
    const keys = loadApiKeys();
    keys[platform] = { ...keys[platform], apiKey: key };
    
    if (!saveApiKeys(keys)) {
      throw new Error('Failed to save API keys');
    }
    
    return true;
  } catch (err) {
    console.error('[IPC] Failed to set API key:', err.message);
    return false;
  }
});

/**
 * IPC Handler: Clear API key for platform
 */
ipcMain.handle('clear-api-key', async (event, platform) => {
  try {
    const keys = loadApiKeys();
    delete keys[platform];
    
    if (!saveApiKeys(keys)) {
      throw new Error('Failed to save API keys');
    }
    
    return true;
  } catch (err) {
    console.error('[IPC] Failed to clear API key:', err.message);
    return false;
  }
});

/**
 * IPC Handler: Send question to a model via API
 */
ipcMain.handle('send-to-model', async (event, { platform, question }) => {
  try {
    // Check if platform has API support
    const platformConfig = apiService.PLATFORM_API_CONFIG[platform];
    if (!platformConfig || !platformConfig.hasApi) {
      const err = { success: false, error: `${platform} does not have API support` };
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('response-scraped', {
          platform,
          content: `Error: ${err.error}`,
          tokens: '0',
          durationMs: 0,
          done: true,
          source: 'api'
        });
      }
      return err;
    }

    const keys = loadApiKeys();
    const apiKey = keys[platform]?.apiKey;

    if (!apiKey) {
      const err = { success: false, error: `No API key configured for ${platform}` };
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send('response-scraped', {
          platform,
          content: `Error: ${err.error}`,
          tokens: '0',
          durationMs: 0,
          done: true,
          source: 'api'
        });
      }
      return err;
    }

    const startTime = Date.now();
    const result = await apiService.makeApiRequest(platform, question, apiKey);
    const latency = Date.now() - startTime;

    // Send response to renderer
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('response-scraped', {
        platform,
        content: result.success ? result.content : `Error: ${result.error}`,
        tokens: result.tokens || '?',
        durationMs: latency,
        done: true,
        source: 'api'
      });
    }

    return result;
  } catch (err) {
    console.error(`[IPC] send-to-model error for ${platform}:`, err.message);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('response-scraped', {
        platform,
        content: `Error: ${err.message}`,
        tokens: '0',
        durationMs: 0,
        done: true,
        source: 'api'
      });
    }
    return { success: false, error: err.message };
  }
});

/**
 * IPC Handler: Get configuration file path
 */
ipcMain.handle('get-config-path', () => {
  return CONFIG_PATH;
});

/**
 * Initialize app
 */
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.error('[Main] Uncaught exception:', err.message);
});

process.on('unhandledRejection', reason => {
  console.error('[Main] Unhandled rejection:', reason);
});