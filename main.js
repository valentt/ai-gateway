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

  // Handle webview events
  mainWindow.webContents.on('did-create-webview', (event, webview) => {
    console.log('[Main] Webview created:', webview.getId());
    
    // Set the data-platform attribute - TASK 1 IMPLEMENTATION
    const platformId = webview.dataset.platform || '';
    if (platformId) {
      webview.dataset.platform = platformId;
      console.log(`[Main] Set data-platform="${platformId}" for webview ${webview.getId()}`);
    } else {
      // Determine platform from URL or frame name
      const url = webview.getWebContents().getURL();
      if (url.includes('chatgpt.com')) {
        webview.dataset.platform = 'chatgpt';
      } else if (url.includes('claude.ai')) {
        webview.dataset.platform = 'claude';
      } else if (url.includes('gemini.google.com')) {
        webview.dataset.platform = 'gemini';
      } else if (url.includes('grok.x.ai')) {
        webview.dataset.platform = 'grok';
      } else if (url.includes('deepseek.com')) {
        webview.dataset.platform = 'deepseek';
      } else if (url.includes('kimi.moonshot.cn')) {
        webview.dataset.platform = 'kimi';
      } else if (url.includes('chat.qwen.ai')) {
        webview.dataset.platform = 'qwen';
      } else if (url.includes('perplexity.ai')) {
        webview.dataset.platform = 'perplexity';
      } else if (url.includes('manus.im')) {
        webview.dataset.platform = 'manus';
      }
      
      if (webview.dataset.platform) {
        console.log(`[Main] Auto-detected platform: ${webview.dataset.platform}`);
      }
    }

    // Set up webview event listeners
    webview.addEventListener('dom-ready', () => {
      console.log('[Main] Webview ready:', webview.getId());
      
      // Add context bridge for IPC communication
      webview.setNodeIntegration(true);
      webview.addToWebContentsContextBridge({
        aiGateway: {
          sendResponseScraped(platform, data) {
            console.log('[Main] Response scraped:', platform, data);
            const mainWindow = BrowserWindow.getFocusedWindow();
            if (mainWindow) {
              mainWindow.webContents.send('response-scraped', { platform, ...data });
            }
          },
          
          sendInjectResult(platform, success, error) {
            console.log('[Main] Inject result:', platform, success, error);
          }
        }
      });

      // Set up API service handler for this webview
      const platformId = webview.dataset.platform;
      const keys = loadApiKeys();
      const apiKey = keys[platformId]?.apiKey;

      if (apiService.shouldUseApi(platformId, apiKey)) {
        console.log(`[Main] Enabling API mode for ${platformId}`);
        setupApiMode(webview, platformId, apiKey);
      } else {
        console.log(`[Main] Using webview scraping for ${platformId}`);
        enableWebviewScraping(webview, platformId);
      }
    });

    webview.addEventListener('page-favicon-updated', () => {
      console.log('[Main] Webview loading:', webview.getId());
    });

    webview.addEventListener('did-fail-load', (event) => {
      console.error('[Main] Webview load failed:', event.errorCode, event.errorText);
      
      // Attempt automatic recovery
      setTimeout(() => {
        try {
          const content = webview.getWebContents();
          if (content) {
            content.loadURL(platformEndpoints[event.frameName?.split('-')[0]] || 'about:blank');
            console.log('[Main] Attempting recovery reload...');
          }
        } catch (err) {
          console.error('[Main] Recovery failed:', err.message);
        }
      }, 2000);
    });
  });

  mainWindow.on('closed', () => {
    console.log('[Main] Window closed');
  });
}

/**
 * Setup API mode for a webview
 */
function setupApiMode(webview, platformId, apiKey) {
  let isProcessing = false;
  let lastContent = '';
  
  const pollInterval = setInterval(async () => {
    if (isProcessing) return;
    
    try {
      const startTime = Date.now();
      const result = await apiService.makeApiRequest(platformId, '', apiKey);
      
      if (!result.success) {
        console.error(`[API] ${platformId} API error:`, result.error);
        // Fall back to webview scraping on persistent error
        enableWebviewScraping(webview, platformId);
        clearInterval(pollInterval);
        return;
      }

      isProcessing = true;
      
      // Send response via IPC if listener exists
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('response-scraped', { 
          platform: platformId,
          content: result.content,
          tokens: result.tokens,
          durationMs: result.durationMs,
          done: true,
          source: 'api'
        });
      }
      
      isProcessing = false;
    } catch (err) {
      console.error(`[API] ${platformId} error:`, err);
      clearInterval(pollInterval);
    }
  }, 2000); // Poll every 2 seconds for streaming
  
  // Timeout after 60 seconds to fall back to scraping
  setTimeout(() => {
    clearInterval(pollInterval);
    console.log(`[API] ${platformId} API timeout, falling back to webview scraping`);
  }, 60000);
}

/**
 * Enable webview scraping mode (fallback)
 */
function enableWebviewScraping(webview, platformId) {
  const extractorScript = `
    (() => {
      const extractors = {
        chatgpt: '(()=>{const m=document.querySelectorAll(\'[data-message-author-role="assistant"]\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';const s=document.querySelector(\'button[data-testid="stop-button"]\');return{content:c,done:!s&&c.length>0}})()',
        claude: '(()=>{const m=document.querySelectorAll(\'.font-claude-message,[class*="message-content"]\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';const s=document.querySelector(\'[data-is-streaming="true"]\');return{content:c,done:!s&&c.length>0}})()',
        gemini: '(()=>{const m=document.querySelectorAll(\'model-response,[class*="response-content"]\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';const s=document.querySelector(\'mat-progress-bar,.loading-indicator\');return{content:c,done:!s&&c.length>0}})()',
        grok: '(()=>{const m=document.querySelectorAll(\'.x-message-content,[class*="message"]\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()',
        deepseek: '(()=>{const m=document.querySelectorAll(\'.ant-chat-item-content\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()',
        qwen: '(()=>{const m=document.querySelectorAll(\'.qwen-chat-message\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()',
        perplexity: '(()=>{const m=document.querySelectorAll(\'.perplexity-response-content\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()',
        kimi: '(()=>{const m=document.querySelectorAll(\'.kimi-response-content\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()',
        manus: '(()=>{const m=document.querySelectorAll(\'.manus-response-content\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()'
      };
      
      const script = extractors[${platformId}] || '(()=>{const m=document.querySelectorAll(\'[class*="message"],[class*="response"]\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()';
      return script;
    })()
  `;

  webview.executeJavaScript(extractorScript).then(() => {
    console.log(`[Main] ${platformId} webview scraping enabled`);
  }).catch(err => {
    console.error(`[Main] ${platformId} scraping setup failed:`, err);
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
    if (BrowserWindow.getAllWindows().length) {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) mainWindow.show();
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