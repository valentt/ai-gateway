/**
 * AI Gateway v2 - Renderer Process
 * Handles webview creation, UI state management, and response extraction
 * Includes real API integration for all platforms
 */

// Platform configuration
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

// Model colors and names
const MODEL_COLORS = {
  chatgpt: '#74aa9c',
  claude: '#d4a574',
  gemini: '#4285f4',
  grok: '#000000',
  deepseek: '#6366f1',
  kimi: '#ff6b35',
  qwen: '#10b981',
  perplexity: '#f97316',
  manus: '#a855f7'
};

const MODEL_NAMES = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  qwen: 'Qwen',
  perplexity: 'Perplexity',
  manus: 'Manus'
};

const MODEL_INITIALS = {
  chatgpt: 'C', claude: 'C', gemini: 'Ge', grok: 'G',
  deepseek: 'D', kimi: 'K', qwen: 'Q', perplexity: 'P', manus: 'M'
};

// Polling interval for response extraction (2 seconds)
const RESPONSE_POLL_INTERVAL = 2000;

// State management
const pollingState = {};
let currentMode = 'tabs'; // 'tabs' or 'panels'

/**
 * Load API keys from configuration file
 */
async function loadApiKeys() {
  try {
    const response = await fetch('config/api-keys.json');
    if (response.ok) {
      return await response.json();
    }
    console.warn('[API] Could not load config, using defaults');
    return {};
  } catch (err) {
    console.error('[API] Failed to load keys:', err);
    return {};
  }
}

/**
 * Get API key for platform from localStorage or config file
 */
function getApiKey(platform) {
  const stored = localStorage.getItem(`apiKey_${platform}`);
  if (stored) return stored;
  
  // Try to read from config file
  const config = loadApiKeys();
  return config[platform]?.apiKey || null;
}

/**
 * Save API key to localStorage
 */
function saveApiKey(platform, key) {
  if (!key) {
    localStorage.removeItem(`apiKey_${platform}`);
  } else {
    localStorage.setItem(`apiKey_${platform}`, key);
  }
}

/**
 * Get OpenAI client instance
 */
async function getOpenAIClient() {
  const apiKey = getApiKey('chatgpt');
  
  if (!apiKey) {
    console.warn('[API] No OpenAI API key configured. Using webview injection.');
    return null;
  }

  try {
    const OpenAI = (await import('openai')).default;
    return new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  } catch (err) {
    console.error('[API] Failed to create OpenAI client:', err);
    return null;
  }
}

/**
 * Get Anthropic client instance
 */
async function getAnthropicClient() {
  const apiKey = getApiKey('claude');
  
  if (!apiKey) {
    console.warn('[API] No Anthropic API key configured. Using webview injection.');
    return null;
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    return new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1'
    });
  } catch (err) {
    console.error('[API] Failed to create Anthropic client:', err);
    return null;
  }
}

/**
 * Make API call to OpenAI
 */
async function callOpenAI(messages, model = 'gpt-4o') {
  const client = await getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('[OpenAI API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Anthropic
 */
async function callAnthropic(messages, model = 'claude-3-5-sonnet-20241022') {
  const client = await getAnthropicClient();
  if (!client) return null;

  try {
    const response = await client.messages.create({
      model: model,
      messages: messages,
      max_tokens: 2048,
      temperature: 0.7
    });

    return response.content[0].text;
  } catch (err) {
    console.error('[Anthropic API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Google Gemini
 */
async function callGemini(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `${platformEndpoints.gemini}/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: messages[0].content }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error('[Gemini API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Grok
 */
async function callGrok(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = 'https://api.x.ai/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-2-vision-1212',
        messages: [
          { role: 'user', content: messages[0].content }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Grok API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Grok API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to DeepSeek
 */
async function callDeepSeek(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `${platformEndpoints.deepseek}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: messages[0].content }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[DeepSeek API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[DeepSeek API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Kimi
 */
async function callKimi(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `${platformEndpoints.kimi}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-moonshot-v1-8k-0103',
        messages: [
          { role: 'user', content: messages[0].content }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Kimi API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Kimi API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Qwen
 */
async function callQwen(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `${platformEndpoints.qwen}/qwen-plus`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: messages[0].content }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Qwen API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.output?.choices?.[0]?.content || null;
  } catch (err) {
    console.error('[Qwen API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Perplexity
 */
async function callPerplexity(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `${platformEndpoints.perplexity}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          { role: 'user', content: messages[0].content }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Perplexity API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Perplexity API] Error:', err.message);
    return null;
  }
}

/**
 * Make API call to Manus
 */
async function callManus(messages, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `${platformEndpoints.manus}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'manus-v1',
        messages: [
          { role: 'user', content: messages[0].content }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Manus API] Error:', error);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Manus API] Error:', err.message);
    return null;
  }
}

/**
 * Unified API call dispatcher
 */
async function makeAPICall(platform, prompt) {
  const apiKey = getApiKey(platform);
  
  if (!apiKey) {
    console.warn(`[API] No API key for ${platform}. Using fallback.`);
    return null;
  }

  switch (platform) {
    case 'chatgpt':
      return callOpenAI([{ role: 'user', content: prompt }]);
    case 'claude':
      return callAnthropic([{ role: 'user', content: prompt }]);
    case 'gemini':
      return callGemini([prompt], apiKey);
    case 'grok':
      return callGrok([{ role: 'user', content: prompt }], apiKey);
    case 'deepseek':
      return callDeepSeek([{ role: 'user', content: prompt }], apiKey);
    case 'kimi':
      return callKimi([{ role: 'user', content: prompt }], apiKey);
    case 'qwen':
      return callQwen([{ role: 'user', content: prompt }], apiKey);
    case 'perplexity':
      return callPerplexity([{ role: 'user', content: prompt }], apiKey);
    case 'manus':
      return callManus([{ role: 'user', content: prompt }], apiKey);
    default:
      console.warn(`[API] Unknown platform: ${platform}`);
      return null;
  }
}

/**
 * Get webview template content for each platform
 */
function getWebviewTemplate(platform) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${MODEL_NAMES[platform]}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, 'Inter', sans-serif; background: #f9fafb; color: #1f2937; min-height: 100vh; }
        
        /* ChatGPT-like layout */
        .chat-container { max-width: 800px; margin: 0 auto; padding: 24px; min-height: 100vh; }
        .message { display: flex; gap: 16px; margin-bottom: 24px; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: white; flex-shrink: 0; }
        .message-content { flex: 1; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .message-content p { margin-bottom: 12px; line-height: 1.6; }
        .message-content code { background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
        
        /* Input area */
        .input-area { position: fixed; bottom: 0; left: 0; right: 0; background: white; padding: 16px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); }
        .input-wrap { max-width: 800px; margin: 0 auto; display: flex; gap: 8px; align-items: flex-end; }
        .prompt-textarea { flex: 1; padding: 12px 16px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; color: #1f2937; font-size: 14px; font-family: inherit; resize: none; outline: none; min-height: 48px; max-height: 160px; }
        .prompt-textarea:focus { border-color: var(--accent); }
        
        /* Typing indicator */
        .typing { display: inline-flex; gap: 4px; padding: 8px 0; }
        .typing span { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: bounce 1.4s infinite; }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        
        /* Loading state */
        .loading { display: flex; gap: 8px; padding: 24px; align-items: center; justify-content: center; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="chat-container">
        <!-- Messages will be injected here -->
        <div id="messages"></div>
        
        <!-- Input area -->
        <div class="input-area">
          <div class="input-wrap">
            <textarea id="prompt-textarea" placeholder="Ask anything..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendPrompt()}"></textarea>
            <button id="send-btn" onclick="sendPrompt()" style="width: 48px; height: 48px; background: #6366f1; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <script>
        const messages = [];
        let lastContent = '';
        const platform = '${platform}';
        const color = '${MODEL_COLORS[platform]}';
        const initials = '${MODEL_INITIALS[platform]}';
        
        // Load API key from localStorage
        function getApiKey() {
          return localStorage.getItem('apiKey_' + platform) || null;
        }

        function formatText(text) {
          if (!text) return '';
          let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\`(.*?)\`/g, '<code>$1</code>');
          return html.split('\n\n').map(p => \`<p>\${html}</p>\`).join('');
        }

        async function callAPI(prompt) {
          const apiKey = getApiKey();
          if (!apiKey) {
            console.warn(\`[API] No API key for \${platform}\`);
            return null;
          }

          try {
            // Make API call based on platform
            switch (\${platform}) {
              case 'chatgpt':
                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (openaiResponse.ok) {
                  const data = await openaiResponse.json();
                  return data.choices[0].message.content;
                }
                break;

              case 'claude':
                const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'claude-3-5-sonnet-20241022',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2048,
                    temperature: 0.7
                  })
                });
                
                if (anthropicResponse.ok) {
                  const data = await anthropicResponse.json();
                  return data.content[0].text;
                }
                break;

              case 'gemini':
                const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=\${apiKey}', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                  })
                });
                
                if (geminiResponse.ok) {
                  const data = await geminiResponse.json();
                  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
                }
                break;

              case 'grok':
                const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'grok-2-vision-1212',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (grokResponse.ok) {
                  const data = await grokResponse.json();
                  return data.choices?.[0]?.message?.content || null;
                }
                break;

              case 'deepseek':
                const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (deepseekResponse.ok) {
                  const data = await deepseekResponse.json();
                  return data.choices?.[0]?.message?.content || null;
                }
                break;

              case 'kimi':
                const kimiResponse = await fetch('https://api.moonshot.cn/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'kimi-moonshot-v1-8k-0103',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (kimiResponse.ok) {
                  const data = await kimiResponse.json();
                  return data.choices?.[0]?.message?.content || null;
                }
                break;

              case 'qwen':
                const qwenResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'qwen-plus',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (qwenResponse.ok) {
                  const data = await qwenResponse.json();
                  return data.output?.choices?.[0]?.content || null;
                }
                break;

              case 'perplexity':
                const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'llama-3.1-sonar-small-128k-online',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (perplexityResponse.ok) {
                  const data = await perplexityResponse.json();
                  return data.choices?.[0]?.message?.content || null;
                }
                break;

              case 'manus':
                const manusResponse = await fetch('https://api.manus.im/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': \`Bearer \${apiKey}\`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'manus-v1',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 2048
                  })
                });
                
                if (manusResponse.ok) {
                  const data = await manusResponse.json();
                  return data.choices?.[0]?.message?.content || null;
                }
                break;
            }

            return null;
          } catch (err) {
            console.error('[API] Error:', err.message);
            return null;
          }
        }

        function addMessage(role, text) {
          const msgDiv = document.getElementById('messages');
          const msg = document.createElement('div');
          msg.className = 'message';
          
          const avatarColor = role === 'user' ? '#6b7280' : color;
          
          msg.innerHTML = \`
            <div class="avatar" style="background: \${avatarColor};">\${role === 'user' ? 'U' : initials}</div>
            <div class="message-content">
              <p>\${formatText(text)}</p>
            </div>\`;
          msgDiv.insertBefore(msg, msgDiv.firstChild);
        }

        async function sendPrompt() {
          const textarea = document.getElementById('prompt-textarea');
          const message = textarea.value.trim();
          
          if (!message) return;

          // Add user message
          addMessage('user', message);
          textarea.value = '';
          textarea.style.height = 'auto';

          // Show loading indicator
          const msgDiv = document.getElementById('messages');
          const loadingMsg = document.createElement('div');
          loadingMsg.className = 'message';
          loadingMsg.dataset.platform = platform;
          loadingMsg.innerHTML = \`
            <div class="avatar" style="background: \${color};">\${initials}</div>
            <div class="message-content">
              <div class="typing"><span></span><span></span><span></span></div>
            </div>\`;
          msgDiv.appendChild(loadingMsg);

          // Make API call
          const startTime = Date.now();
          const response = await callAPI(message);

          if (response) {
            loadingMsg.querySelector('.typing').innerHTML = formatText(response);
            lastContent = response;

            // Calculate token count (approximate)
            const tokens = Math.round(response.length / 4);

            // Send polling update to main process
            if (window.aiGateway && window.aiGateway.sendResponseScraped) {
              window.aiGateway.sendResponseScraped({
                platform: platform,
                content: response,
                tokens: tokens,
                durationMs: Date.now() - startTime,
                done: true
              });
            }

            // Update polling state
            if (window.pollingState && window.pollingState[platform]) {
              window.pollingState[platform].lastContent = response;
              window.pollingState[platform].tokens = tokens;
              window.pollingState[platform].durationMs = Date.now() - startTime;
              window.pollingState[platform].done = true;
            }
          } else {
            loadingMsg.querySelector('.typing').innerHTML = \`<p style="color: #ef4444;">Error: No API key configured for \${MODEL_NAMES[platform]}. Please configure your API key in settings.</p>\`;
          }

          // Auto-resize textarea
          document.getElementById('prompt-textarea').addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 160) + 'px';
          });
        }

        // Initialize with placeholder message
        addMessage('assistant', \`Hello! I'm \${MODEL_NAMES[platform]}. To use real API responses, please configure your API key in settings.\`);
      </script>
    </body>
    </html>
  `;
}

/**
 * Create webview element for a platform
 */
function createWebview(platform, src) {
  const container = document.getElementById('webviewContainer');
  
  if (!container) return null;

  // Create webview element
  const webview = document.createElement('webview');
  webview.setAttribute('data-platform', platform);
  webview.setAttribute('src', src);
  webview.style.cssText = 'flex: 1; display: flex; flex-direction: column;';
  
  // Add to container
  container.appendChild(webview);
  
  // Set up event listeners
  webview.addEventListener('dom-ready', () => {
    console.log(`[Renderer] Webview ready for ${platform}`);
    pollingState[platform] = {
      ready: true,
      lastContent: '',
      tokens: 0,
      durationMs: 0,
      done: false
    };
  });

  webview.addEventListener('page-favicon-updated', () => {
    console.log(`[Renderer] Webview loading for ${platform}`);
  });

  webview.addEventListener('did-fail-load', (event) => {
    console.error(`[Renderer] Webview load failed for ${platform}:`, event.errorCode, event.errorText);
    
    // Attempt recovery
    setTimeout(() => {
      try {
        const content = webview.getWebContents();
        if (content) {
          content.loadURL(platformEndpoints[platform] || 'about:blank');
          console.log(`[Renderer] Recovery reload for ${platform}`);
        }
      } catch (err) {
        console.error(`[Renderer] Recovery failed for ${platform}:`, err.message);
      }
    }, 2000);
  });

  return webview;
}

/**
 * Initialize renderer process
 */
function init() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
  } else {
    onDOMReady();
  }
}

function onDOMReady() {
  console.log('[Renderer] Renderer initialized');
  
  // Set up unified response handler
  const cleanup = window.aiGateway?.onUnifiedResponse((data) => {
    handleResponse(data);
  });
  
  if (cleanup) {
    window.aiGateway._cleanup = cleanup;
  }

  // Listen for mode changes
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleModeChange(e.target.dataset.mode || e.target.closest('.mode-toggle').dataset.mode);
    });
  });

  // Initial panel generation for isolated mode
  const selectedModels = getSelectedModels();
  if (selectedModels.length > 0 && currentMode === 'isolated') {
    runIsolated(selectedModels);
  }
}

/**
 * Handle response scraped from webview
 */
function handleResponse(data) {
  const { platform, content, tokens, durationMs, done } = data;
  
  if (!content || !platform) return;
  
  // Update UI based on current mode
  if (currentMode === 'isolated') {
    updateIsolatedPanel(platform, content, tokens, durationMs, done);
  } else if (currentMode === 'chatroom') {
    updateChatroomMessage(platform, content, done);
  }
}

/**
 * Update isolated panel with response
 */
function updateIsolatedPanel(platform, content, tokens, durationMs, done) {
  const body = document.querySelector(`.panel-body[data-model="${platform}"]`);
  const meta = document.querySelector(`.panel-meta[data-model="${platform}"]`);
  
  if (!body || !meta) return;

  if (done && content) {
    const secs = ((durationMs || (Date.now() - (pollingState[platform]?.startTime || Date.now()))) / 1000).toFixed(1);
    meta.textContent = `${secs}s · ${tokens || '?'} tokens`;
    body.innerHTML = formatResponse(content);
    body.dataset.rawText = content;
    
    // Update polling state
    if (pollingState[platform]) {
      pollingState[platform].lastContent = content;
      pollingState[platform].tokens = tokens;
      pollingState[platform].done = done;
    }
  } else if (content) {
    if (body.querySelector('.typing')) {
      body.innerHTML = '';
    }
    body.innerHTML = formatResponse(content);
    meta.textContent = 'generating...';
  }
}

/**
 * Update chatroom message with response
 */
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

/**
 * Format response text to HTML
 */
function formatResponse(text) {
  if (!text) return '';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\`(.*?)\`/g, '<code>$1</code>');
  
  return html.split('\n\n').map(p => `<p>${html}</p>`).join('');
}

/**
 * Get selected models from UI
 */
function getSelectedModels() {
  const chips = document.querySelectorAll('.chip.selected');
  return Array.from(chips).map(c => c.dataset.model);
}

/**
 * Handle mode change
 */
function handleModeChange(newMode) {
  currentMode = newMode;
  
  if (newMode === 'tabs') {
    document.body.classList.add('tabs-mode');
    document.body.classList.remove('panels-mode');
    localStorage.setItem('aiGatewayMode', 'tabs');
    
    const isolatedView = document.getElementById('isolatedView');
    const chatroomView = document.getElementById('chatroomView');
    const webviewContainer = document.getElementById('webviewContainer');
    
    if (isolatedView) isolatedView.style.display = 'grid';
    if (chatroomView) chatroomView.style.display = 'none';
    if (webviewContainer) webviewContainer.style.display = 'none';
  } else {
    document.body.classList.add('panels-mode');
    document.body.classList.remove('tabs-mode');
    localStorage.setItem('aiGatewayMode', 'panels');
    
    const isolatedView = document.getElementById('isolatedView');
    const chatroomView = document.getElementById('chatroomView');
    const webviewContainer = document.getElementById('webviewContainer');
    
    if (isolatedView) isolatedView.style.display = 'none';
    if (chatroomView) chatroomView.style.display = 'none';
    if (webviewContainer) webviewContainer.style.display = 'none';
  }
}

// Initialize when DOM is ready
init();