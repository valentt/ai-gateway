/**
 * AI Gateway - Main Electron Process
 *
 * Franz za AI - Unified AI Chat Gateway with Local API
 *
 * Features:
 * - WebViews for all major AI platforms
 * - Multi-profile support per agent
 * - Local cookie/session storage
 * - SQLite history storage
 * - REST API on localhost:8080
 */

const { app, BrowserWindow, session, ipcMain, Menu, clipboard } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { initDatabase, saveConversation, saveMessage } = require('./db/database');
const { startApiServer, stopApiServer } = require('./api/server');
const { extractors } = require('./extractors');


// Enable media/WebRTC features for voice input (Linux only - crashes on Windows)
if (process.platform !== 'win32') {
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
  app.commandLine.appendSwitch('enable-speech-dispatcher');
}
// These work on all platforms
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('auto-accept-camera-and-microphone-capture');

// Keep a global reference of the window object
let mainWindow = null;
let apiServer = null;

// Profile storage
const store = new Store({
  name: 'profiles',
  defaults: {
    profiles: {}, // { platformId: { profileId: { name: 'Profile Name' }, ... } }
    activeProfiles: {}, // { platformId: profileId }
    lastUrls: {}, // { 'platformId-profileId': 'last-visited-url' } - for session restore
    lastActivePlatform: null // Last active platform when app was closed
  }
});

// Initialize default profiles for each platform
function initializeDefaultProfiles(platforms) {
  const profiles = store.get('profiles', {});
  const activeProfiles = store.get('activeProfiles', {});

  Object.keys(platforms).forEach(platformId => {
    // Create default profile if none exists
    if (!profiles[platformId] || Object.keys(profiles[platformId]).length === 0) {
      profiles[platformId] = {
        'default': { name: 'Default', created: Date.now() }
      };
    }
    // Set active profile if not set
    if (!activeProfiles[platformId]) {
      activeProfiles[platformId] = 'default';
    }
  });

  store.set('profiles', profiles);
  store.set('activeProfiles', activeProfiles);

  return { profiles, activeProfiles };
}

// AI Platform configurations
const AI_PLATFORMS = {
  chatgpt: {
    name: 'ChatGPT',
    url: 'https://chat.openai.com',
    icon: 'chatgpt.png',
    tier: 1
  },
  claude: {
    name: 'Claude',
    url: 'https://claude.ai',
    icon: 'claude.png',
    tier: 1
  },
  gemini: {
    name: 'Gemini',
    url: 'https://gemini.google.com',
    icon: 'gemini.png',
    tier: 1
  },
  perplexity: {
    name: 'Perplexity',
    url: 'https://perplexity.ai',
    icon: 'perplexity.png',
    tier: 1
  },
  grok: {
    name: 'Grok',
    url: 'https://grok.com',
    icon: 'grok.png',
    tier: 1
  },
  deepseek: {
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    icon: 'deepseek.png',
    tier: 2
  },
  kimi: {
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn',
    icon: 'kimi.png',
    tier: 2
  },
  qwen: {
    name: 'Qwen',
    url: 'https://tongyi.aliyun.com',
    icon: 'qwen.png',
    tier: 2
  }
};

// Default port for API server (8088 to avoid Docker conflicts)
const API_PORT = process.env.AI_GATEWAY_PORT || 8088;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload', 'main.js'),
      webviewTag: true,  // Enable <webview> tag
      partition: 'persist:main'
    },
    title: 'AI Gateway'
    // icon: path.join(__dirname, '../assets/icon.png')  // TODO: Add icon
  });

  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle new window requests (open links in default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function initApp() {
  // Initialize database
  console.log('[DB] Initializing SQLite database...');
  initDatabase();

  // Start API server
  console.log(`[API] Starting server on port ${API_PORT}...`);
  apiServer = await startApiServer(API_PORT);
  console.log(`[API] Server running at http://localhost:${API_PORT}`);

  // Create main window
  createWindow();
}

// App lifecycle
app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopApiServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopApiServer();
});

// Handle ALL new webContents (including popup windows from webviews)
// This ensures context menu works in popup windows opened by Sources, etc.
app.on('web-contents-created', (event, contents) => {
  // Add context menu to all web contents (popups, webviews, etc.)
  contents.on('context-menu', (e, params) => {
    const menuTemplate = [];

    // If right-clicked on a link
    if (params.linkURL) {
      menuTemplate.push({
        label: 'Copy Link URL',
        click: () => {
          clipboard.writeText(params.linkURL);
        }
      });
      menuTemplate.push({
        label: 'Open in Default Browser',
        click: () => {
          require('electron').shell.openExternal(params.linkURL);
        }
      });
      menuTemplate.push({ type: 'separator' });
    }

    // Always show option to copy current page URL
    if (params.pageURL) {
      menuTemplate.push({
        label: 'Copy Page URL',
        click: () => {
          clipboard.writeText(params.pageURL);
        }
      });
    }

    // Standard context menu items
    if (menuTemplate.length > 0) {
      menuTemplate.push({ type: 'separator' });
    }
    menuTemplate.push({ role: 'copy' });
    menuTemplate.push({ role: 'paste' });
    menuTemplate.push({ role: 'selectAll' });
    menuTemplate.push({ type: 'separator' });
    menuTemplate.push({
      label: 'Reload',
      click: () => {
        contents.reload();
      }
    });

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup();
  });

  console.log('[Main] Context menu added to new webContents:', contents.getType());

  // Handle permission requests (microphone, camera, etc.)
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
    
    if (allowedPermissions.includes(permission)) {
      console.log(`[Permission] Allowing ${permission} for ${webContents.getURL().substring(0, 50)}`);
      callback(true);
    } else {
      console.log(`[Permission] Denying ${permission}`);
      callback(false);
    }
  });

  // Handle permission check requests
  contents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
    return allowedPermissions.includes(permission);
  });
});

// IPC handlers for renderer process
// Session restore IPC handlers
ipcMain.handle('save-last-url', (event, platformId, profileId, url) => {
  const key = `${platformId}-${profileId}`;
  const lastUrls = store.get('lastUrls', {});
  lastUrls[key] = url;
  store.set('lastUrls', lastUrls);
  return true;
});

ipcMain.handle('get-last-url', (event, platformId, profileId) => {
  const key = `${platformId}-${profileId}`;
  return store.get(`lastUrls.${key}`, null);
});

ipcMain.handle('save-last-active-platform', (event, platformId) => {
  store.set('lastActivePlatform', platformId);
  return true;
});

ipcMain.handle('get-last-active-platform', () => {
  return store.get('lastActivePlatform', null);
});

ipcMain.handle('get-platforms', () => AI_PLATFORMS);
ipcMain.handle('get-api-port', () => API_PORT);

// Profile management IPC handlers
ipcMain.handle('get-profiles', () => {
  initializeDefaultProfiles(AI_PLATFORMS);
  return {
    profiles: store.get('profiles'),
    activeProfiles: store.get('activeProfiles')
  };
});

ipcMain.handle('get-active-profile', (event, platformId) => {
  return store.get(`activeProfiles.${platformId}`, 'default');
});

ipcMain.handle('set-active-profile', (event, platformId, profileId) => {
  store.set(`activeProfiles.${platformId}`, profileId);
  return true;
});

ipcMain.handle('create-profile', (event, platformId, profileName) => {
  const profileId = `profile_${Date.now()}`;
  const profiles = store.get('profiles', {});

  if (!profiles[platformId]) {
    profiles[platformId] = {};
  }

  profiles[platformId][profileId] = {
    name: profileName,
    created: Date.now()
  };

  store.set('profiles', profiles);
  return { profileId, profile: profiles[platformId][profileId] };
});

ipcMain.handle('rename-profile', (event, platformId, profileId, newName) => {
  const key = `profiles.${platformId}.${profileId}.name`;
  store.set(key, newName);
  return true;
});

ipcMain.handle('delete-profile', (event, platformId, profileId) => {
  // Can't delete the last profile or default profile that's currently active
  const profiles = store.get('profiles', {});
  const activeProfile = store.get(`activeProfiles.${platformId}`);

  if (Object.keys(profiles[platformId]).length <= 1) {
    return { success: false, error: 'Cannot delete the last profile' };
  }

  if (profileId === activeProfile) {
    return { success: false, error: 'Cannot delete active profile. Switch to another profile first.' };
  }

  delete profiles[platformId][profileId];
  store.set('profiles', profiles);

  // Also clear the session data for this profile
  const partition = `persist:${platformId}-${profileId}`;
  session.fromPartition(partition).clearStorageData();

  return { success: true };
});

// Get partition name for a platform and profile
ipcMain.handle('get-partition', (event, platformId, profileId) => {
  // For backward compatibility: default profile uses old partition name
  if (profileId === 'default') {
    return `persist:${platformId}`;
  }
  return `persist:${platformId}-${profileId}`;
});

// Content extraction IPC handlers
ipcMain.handle('get-extractor', (event, platformId) => {
  console.log(`[Extract] Getting extractor for: ${platformId}`);
  return extractors[platformId] || extractors.generic;
});

ipcMain.handle('save-extracted-content', async (event, data) => {
  try {
    const { platform, messages, url } = data;
    console.log(`[Extract] Received from ${platform}: ${messages?.length || 0} messages, url: ${url?.substring(0, 60) || 'none'}`);
    if (data.debug) {
      console.log(`[Extract] Debug for ${platform}:`, JSON.stringify(data.debug));
    }
    if (data.error) {
      console.log(`[Extract] Error from ${platform}:`, data.error);
    }

    if (!messages || messages.length === 0) {
      console.log(`[Extract] No messages to save from ${platform} (url: ${url?.substring(0, 60)})`);
      return { success: false, error: 'No messages to save' };
    }

    // Create external ID from URL or generate one
    const externalId = url ?
      Buffer.from(url).toString('base64').substring(0, 64) :
      `conv_${Date.now()}`;

    // Save conversation - saveConversation(platform, profile, externalId, title, metadata)
    const conversationId = saveConversation(
      platform,
      'default',
      externalId,
      `${platform} conversation`,
      { url, extractedAt: new Date().toISOString() }
    );

    // Save each message - saveMessage(conversationId, role, content, metadata)
    // Returns null for duplicates (not inserted)
    let savedCount = 0;
    let skippedCount = 0;
    messages.forEach((msg, index) => {
      if (msg.content && msg.content.trim().length > 0) {
        const result = saveMessage(
          conversationId,
          msg.role || 'unknown',
          msg.content.trim(),
          { timestamp: msg.timestamp || new Date().toISOString() }
        );
        if (result !== null) {
          savedCount++;
        } else {
          skippedCount++;
        }
      }
    });

    console.log(`[Extract] Saved ${savedCount} NEW messages from ${platform} (${skippedCount} duplicates skipped)`);
    return { success: true, savedCount };
  } catch (error) {
    console.error('[Extract] Error saving content:', error);
    return { success: false, error: error.message };
  }
});

// Export for API server access
module.exports = { AI_PLATFORMS, mainWindow };

// Context menu handler for webviews - Copy URL functionality
ipcMain.on('show-context-menu', (event, params) => {
  console.log('[DEBUG] show-context-menu received:', params);
  const { linkURL, pageURL } = params;

  const menuTemplate = [];

  // If right-clicked on a link
  if (linkURL) {
    menuTemplate.push({
      label: 'Copy Link URL',
      click: () => {
        clipboard.writeText(linkURL);
      }
    });
    menuTemplate.push({
      label: 'Open in Default Browser',
      click: () => {
        require('electron').shell.openExternal(linkURL);
      }
    });
    menuTemplate.push({ type: 'separator' });
  }

  // Always show option to copy current page URL
  if (pageURL) {
    menuTemplate.push({
      label: 'Copy Page URL',
      click: () => {
        clipboard.writeText(pageURL);
      }
    });
  }

  // Standard context menu items
  menuTemplate.push({ type: 'separator' });
  menuTemplate.push({ role: 'copy' });
  menuTemplate.push({ role: 'paste' });
  menuTemplate.push({ role: 'selectAll' });
  menuTemplate.push({ type: 'separator' });
  menuTemplate.push({
    label: 'Reload',
    click: () => {
      event.sender.send('reload-webview');
    }
  });

  const menu = Menu.buildFromTemplate(menuTemplate);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});
