/**
 * Real API Integration Service
 * Handles direct API calls to supported platforms
 * Falls back to webview scraping for platforms without public APIs
 */

const https = require('https');

// API endpoints and authentication details
const PLATFORM_API_CONFIG = {
  // OpenAI / ChatGPT - Has official API
  chatgpt: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000
  },
  
  // Anthropic / Claude - Has official API
  claude: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000,
    // Anthropic requires a special header for their API
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': ''
    }
  },
  
  // Google AI / Gemini - Has official API
  gemini: {
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000
  },
  
  // Grok - X API (requires subscription)
  grok: {
    name: 'X (Twitter)',
    baseUrl: null, // No public API, use webview scraping only
    hasApi: false,
    requiresApiKey: false,
    maxRetries: 1,
    timeout: 30000
  },
  
  // DeepSeek - Has API
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000
  },
  
  // Qwen - Has API
  qwen: {
    name: 'Alibaba Cloud',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000
  },
  
  // Perplexity - Has API
  perplexity: {
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000
  },
  
  // Kimi - Has API
  kimi: {
    name: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    hasApi: true,
    requiresApiKey: true,
    maxRetries: 3,
    timeout: 60000
  },
  
  // Manus - Web-only, no public API
  manus: {
    name: 'Manus',
    baseUrl: null,
    hasApi: false,
    requiresApiKey: false,
    maxRetries: 1,
    timeout: 30000
  }
};

/**
 * Make authenticated API request to a platform
 */
async function makeApiRequest(platformId, message, apiKey) {
  const config = PLATFORM_API_CONFIG[platformId];

  if (!config) {
    return { success: false, error: `Platform '${platformId}' is not supported` };
  }

  if (!config.hasApi || !apiKey) {
    return { success: false, error: 'API not available or not configured' };
  }

  let url = config.baseUrl;
  
  // Handle different API formats
  switch (platformId) {
    case 'chatgpt': // OpenAI format
      url = `https://api.openai.com/v1/chat/completions`;
      break;
    case 'claude': // Anthropic format
      url = `https://api.anthropic.com/v1/messages`;
      break;
    case 'gemini': // Google API
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      break;
    default:
      url = config.baseUrl;
  }

  let body;
  if (platformId === 'gemini') {
    // Gemini uses a different request format
    body = JSON.stringify({
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    });
  } else {
    body = JSON.stringify({
      model: getDefaultModel(platformId),
      messages: [{ role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 2048
    });
  }

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...config.headers
      }
    };

    // Anthropic uses x-api-key header instead of Authorization Bearer
    if (platformId === 'claude') {
      options.headers['x-api-key'] = apiKey;
      delete options.headers['Authorization'];
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.error) {
            return resolve({ 
              success: false, 
              error: json.error.message || 'API Error',
              statusCode: res.statusCode 
            });
          }

          // Extract response content based on platform format
          let content;
          if (platformId === 'chatgpt' || platformId === 'deepseek') {
            content = json.choices?.[0]?.message?.content || '';
          } else if (platformId === 'claude') {
            // Anthropic returns { content: [{type: 'text', text: '...'}] }
            content = Array.isArray(json.content)
              ? json.content.map(c => c.text || '').join('')
              : (json.content || '');
          } else if (platformId === 'gemini') {
            content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            content = json.choices?.[0]?.message?.content || json.content || '';
          }

          const tokens = json.usage?.total_tokens || '?';
          const durationMs = (Date.now() - config.lastRequestTime) || 100;

          resolve({ 
            success: true, 
            content, 
            tokens,
            durationMs,
            done: true
          });
        } catch (e) {
          resolve({ 
            success: false, 
            error: `Parse error: ${e.message}` 
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ 
        success: false, 
        error: err.message 
      });
    });

    req.setTimeout(config.timeout, () => {
      req.destroy();
      resolve({ 
        success: false, 
        error: 'Request timeout' 
      });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Get default model for each platform
 */
function getDefaultModel(platformId) {
  const models = {
    chatgpt: 'gpt-4o',
    claude: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-2.0-flash',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-plus',
    perplexity: 'llama-3.1-70b-instruct',
    kimi: 'auto'
  };
  
  return models[platformId] || 'default';
}

/**
 * Check if API call should be used for a platform
 */
function shouldUseApi(platformId, apiKey) {
  const config = PLATFORM_API_CONFIG[platformId];

  // Use API if available and key is configured
  return !!(config && config.hasApi && apiKey);
}

/**
 * Create response handler that tries API first, falls back to webview scraping
 */
async function createUnifiedResponseHandler(platformId, apiKey, webview) {
  const useApi = shouldUseApi(platformId, apiKey);
  
  // Listen for webview ready event
  webview.addEventListener('did-stop-loading', () => {
    console.log(`[API Service] ${platformId} webview loaded`);
    
    if (useApi && apiKey) {
      // Enable API mode for this platform
      console.log(`[API Service] Using direct API for ${platformId}`);
      setupApiPolling(platformId, apiKey, webview);
    } else {
      // Use webview scraping fallback
      console.log(`[API Service] Using webview scraping for ${platformId}`);
      enableWebviewScraping(platformId, webview);
    }
  });

  return () => {
    // Cleanup handler
  };
}

/**
 * Setup polling for API responses
 */
function setupApiPolling(platformId, apiKey, webview) {
  let isProcessing = false;
  
  const pollInterval = setInterval(async () => {
    if (isProcessing) return;
    
    try {
      const startTime = Date.now();
      const result = await makeApiRequest(platformId, '', apiKey);
      
      if (!result.success) {
        console.error(`[API Service] ${platformId} API error:`, result.error);
        // Fall back to webview scraping on error
        enableWebviewScraping(platformId, webview);
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
          done: true
        });
      }
      
      isProcessing = false;
    } catch (err) {
      console.error(`[API Service] ${platformId} error:`, err);
      clearInterval(pollInterval);
    }
  }, 2000);
  
  // Timeout after 60 seconds
  setTimeout(() => {
    clearInterval(pollInterval);
    console.log(`[API Service] ${platformId} API timeout, switching to webview scraping`);
  }, 60000);
}

/**
 * Setup webview scraping fallback
 */
function enableWebviewScraping(platformId, webview) {
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
      
      const script = extractors["${platformId}"] || '(()=>{const m=document.querySelectorAll(\'[class*="message"],[class*="response"]\');if(!m.length)return{content:\'\',done:false};const l=m[m.length-1];const c=l.innerText||\'\';return{content:c,done:c.length>0}})()';
      return script;
    })()
  `;

  webview.executeJavaScript(extractorScript).then(() => {
    console.log(`[API Service] ${platformId} webview scraping enabled`);
  }).catch(err => {
    console.error(`[API Service] ${platformId} scraping setup failed:`, err);
  });
}

module.exports = {
  PLATFORM_API_CONFIG,
  makeApiRequest,
  shouldUseApi,
  createUnifiedResponseHandler,
  setupApiPolling,
  enableWebviewScraping
};
