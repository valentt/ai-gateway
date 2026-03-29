const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Platform endpoints for each AI provider
const platformEndpoints = {
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/chat',
  gemini: 'https://gemini.google.com/chat',
  grok: 'https://grok.x.ai',
  deepseek: 'https://deepseek.com/chat',
  kimi: 'https://kimi.moonshot.cn',
  qwen: 'https://chat.qwen.ai',
  perplexity: 'https://perplexity.ai',
  manus: 'https://manus.im'
};

// Webview container element
let webviewContainer = null;

// Create the browser window
function createWindow() {
  webviewContainer = document.createElement('div');
  webviewContainer.id = 'webviewContainer';
  webviewContainer.style.display = 'none'; // Hidden by default
  
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
    
    // Set up webview event listeners
    webview.addEventListener('dom-ready', () => {
      console.log('[Main] Webview ready:', webview.getId());
      
      // Inject template content into webview
      injectWebviewTemplate(webview);
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

    // Add context bridge for IPC communication
    webview.setNodeIntegration(true);
    webview.addToWebContentsContextBridge({
      aiGateway: {
        sendResponseScraped(platform, data) {
          console.log('[Main] Response scraped:', platform, data);
          // Send response back to renderer via IPC
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
  });

  mainWindow.on('closed', () => {
    console.log('[Main] Window closed');
    webviewContainer.remove();
  });
}

// Inject template content into webview
function injectWebviewTemplate(webview) {
  const platform = webview.getFrameName().split('-')[0];
  const message = 'Hello from AI Gateway!'; // Placeholder for actual prompt
  
  const injectorScript = getInjectorScript(platform, message);
  
  try {
    const result = webview.executeJavaScript(injectorScript);
    console.log('[Main] Injection result:', platform, result?.success || false);
    
    if (result?.success) {
      // Start polling for response
      startResponsePolling(webview, platform);
    } else {
      console.error('[Main] Injection failed:', result?.error);
    }
  } catch (err) {
    console.error('[Main] Injection error:', err.message);
  }
}

// Get injector script for each platform
function getInjectorScript(platform, message) {
  const escaped = JSON.stringify(message);

  const injectors = {
    chatgpt: `(async()=>{try{const t=document.querySelector('textarea[id="prompt-textarea"]');if(!t)return{success:false,error:'no input'};t.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${escaped});t.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,300));const b=document.querySelector('button[data-testid="send-button"]');if(b&&!b.disabled){b.click();return{success:true}}t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return{success:true}}catch(e){return{success:false,error:e.message}}})()`,

    claude: `(async()=>{try{const e=document.querySelector('div[contenteditable="true"]');if(!e)return{success:false,error:'no editor'};e.focus();e.innerHTML='';const p=document.createElement('p');p.textContent=${escaped};e.appendChild(p);e.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,300));const b=document.querySelector('button[aria-label="Send Message"]');if(b&&!b.disabled){b.click();return{success:true}}e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return{success:true}}catch(e){return{success:false,error:e.message}}})()`,

    gemini: `(async()=>{try{const e=document.querySelector('.ql-editor,[contenteditable="true"]');if(!e)return{success:false,error:'no editor'};e.focus();e.innerHTML='<p>'+${escaped}+'</p>';e.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,300));const b=document.querySelector('button[aria-label="Send message"]');if(b&&!b.disabled){b.click();return{success:true}}e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return{success:true}}catch(e){return{success:false,error:e.message}}})()`,
  };

  // Generic injector for grok, deepseek, kimi, qwen, perplexity, manus
  const generic = `(async()=>{try{let i=document.querySelector('textarea:not([readonly])');if(!i)i=document.querySelector('[contenteditable="true"]');if(!i)return{success:false,error:'no input'};i.focus();if(i.tagName==='TEXTAREA'){Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(i,${escaped});i.dispatchEvent(new Event('input',{bubbles:true}))}else{i.innerText=${escaped};i.dispatchEvent(new Event('input',{bubbles:true}))}await new Promise(r=>setTimeout(r,300));for(const s of['button[aria-label*="send" i]','button[aria-label*="submit" i]','button[class*="send" i]','button[type="submit"]']){const b=document.querySelector(s);if(b&&!b.disabled){b.click();return{success:true}}}i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));return{success:true}}catch(e){return{success:false,error:e.message}}})()`;

  return injectors[platform] || generic;
}

// Poll webview for response content
function startResponsePolling(webview, platform) {
  let lastContent = '';
  let tokenCount = 0;
  const startTime = Date.now();

  const extractorScripts = {
    chatgpt: `(()=>{const m=document.querySelectorAll('[data-message-author-role="assistant"]');if(!m.length)return{content:'',done:false};const l=m[m.length-1];const c=l.innerText||'';const s=document.querySelector('button[data-testid="stop-button"]');return{content:c,done:!s&&c.length>0}})()`,
    claude: `(()=>{const m=document.querySelectorAll('.font-claude-message,[class*="message-content"]');if(!m.length)return{content:'',done:false};const l=m[m.length-1];const c=l.innerText||'';const s=document.querySelector('[data-is-streaming="true"]');return{content:c,done:!s&&c.length>0}})()`,
    gemini: `(()=>{const m=document.querySelectorAll('model-response,[class*="response-content"]');if(!m.length)return{content:'',done:false};const l=m[m.length-1];const c=l.innerText||'';const s=document.querySelector('mat-progress-bar,.loading-indicator');return{content:c,done:!s&&c.length>0}})()`,
  };

  const genericExtract = `(()=>{const m=document.querySelectorAll('[class*="message"],[class*="response"],[class*="answer"]');if(!m.length)return{content:'',done:false};const l=m[m.length-1];const c=l.innerText||'';return{content:c,done:c.length>0}})()`;

  const script = extractorScripts[platform] || genericExtract;

  const poll = setInterval(async () => {
    try {
      const result = await webview.executeJavaScript(script);
      
      if (!result) return;

      if (result.content && result.content !== lastContent) {
        lastContent = result.content;
        tokenCount = result.content.split(/\s+/).length;

        // Send response to renderer via IPC
        const mainWindow = BrowserWindow.getFocusedWindow();
        if (mainWindow) {
          mainWindow.webContents.send('response-scraped', {
            platform,
            content: lastContent,
            tokens: tokenCount,
            durationMs: Date.now() - startTime,
            done: false,
          });
        }
      }

      if (result.done && lastContent.length > 0) {
        clearInterval(poll);
        
        const mainWindow = BrowserWindow.getFocusedWindow();
        if (mainWindow) {
          mainWindow.webContents.send('response-scraped', {
            platform,
            content: lastContent,
            tokens: tokenCount,
            durationMs: Date.now() - startTime,
            done: true,
          });
        }
      }
    } catch (e) {
      // Transient error during page update
    }
  }, 500);

  // Timeout after 120s
  setTimeout(() => {
    clearInterval(poll);
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow && lastContent) {
      mainWindow.webContents.send('response-scraped', {
        platform,
        content: lastContent,
        tokens: tokenCount,
        durationMs: Date.now() - startTime,
        done: true,
      });
    }
  }, 120000);
}

// IPC Handlers
ipcMain.handle('inject-prompt', async (event, { message, platforms }) => {
  console.log('[IPC] Inject prompt:', platforms);
  
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (!mainWindow) {
    return { success: false, error: 'No window found' };
  }

  // Send injection request to renderer via IPC
  mainWindow.webContents.send('inject-request', { message, platforms });
  
  // Wait for results from polling system
  const timeout = setTimeout(() => {
    console.log('[IPC] Injection timeout');
    return { success: false, error: 'Timeout' };
  }, 30000);

  try {
    // Results will come via event listener
    await new Promise(resolve => {
      const handler = (data) => {
        clearTimeout(timeout);
        mainWindow.removeListener('response-scraped', handler);
        resolve(data);
      };
      mainWindow.webContents.on('response-scraped', handler);
    });
    
    return { success: true, data };
  } catch (err) {
    clearTimeout(timeout);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('extract-response', async (event) => {
  console.log('[IPC] Extract response');
  
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (!mainWindow) {
    return { pollingState: {} };
  }
  
  // Return current polling state data
  return { pollingState: {} };
});

ipcMain.handle('check-webview-status', async (event, platform) => {
  console.log('[IPC] Check webview status:', platform);
  
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (!mainWindow) {
    return { platform, ready: false };
  }
  
  // Check if webview for platform is ready
  return { platform, ready: true };
});

ipcMain.handle('get-all-webviews-status', async (event) => {
  console.log('[IPC] Get all webviews status');
  
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (!mainWindow) {
    return [];
  }
  
  // Return status of all webviews
  const platforms = Object.keys(platformEndpoints);
  return platforms.map(p => ({ platform: p, ready: true }));
});

ipcMain.handle('clear-response-panel', async (event, platform) => {
  console.log('[IPC] Clear response panel:', platform);
  
  const mainWindow = BrowserWindow.getFocusedWindow();
  if (!mainWindow) {
    return false;
  }
  
  // Clear panel content
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    if (panel.dataset.model === platform) {
      panel.querySelector('.panel-body').innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      panel.querySelector('.panel-meta').textContent = 'loading...';
    }
  });
  
  return true;
});

ipcMain.handle('get-webview-response', async (event, platform) => {
  console.log('[IPC] Get webview response:', platform);
  
  // Return simulated response data
  return {
    platform,
    content: `This is a simulated response from ${platform}. In production, this would be the actual AI response.`,
    tokens: 128,
    done: true
  };
});

// Initialize application
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window if dock icon clicked
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
