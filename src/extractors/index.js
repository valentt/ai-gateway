/**
 * Platform-specific content extractors
 *
 * Each extractor returns an object with conversation data
 * that can be parsed and stored in SQLite.
 */

// Claude.ai extractor
const claudeExtractor = `
(function() {
  try {
    const messages = [];
    const url = window.location.href;

    // Check if we're on a conversation page
    const isConversation = url.includes('/chat/') || url.includes('/new');

    // Find all conversation turns
    const turns = document.querySelectorAll('[data-testid*="message"], [class*="Message"], [class*="message-content"], .font-claude-message, .font-user-message');

    // Also try to find in the main content area
    const mainContent = document.querySelector('main, [role="main"], .conversation-content');

    // Get all text blocks that look like messages
    const textBlocks = document.querySelectorAll('div[class*="prose"], div[class*="markdown"], .whitespace-pre-wrap');

    // Collect unique content
    const seenContent = new Set();

    // Process found elements
    const allEls = [...turns, ...textBlocks];
    allEls.forEach((el, i) => {
      const text = el.innerText?.trim();
      if (text && text.length > 20 && text.length < 50000 && !seenContent.has(text)) {
        seenContent.add(text);
        const classList = el.className || '';
        const isUser = classList.includes('user') || classList.includes('human') ||
                       el.closest('[class*="user"]') || el.closest('[class*="human"]');
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: text.substring(0, 10000),
          timestamp: new Date().toISOString()
        });
      }
    });

    return { platform: 'claude', messages, url, debug: { turnCount: turns.length, blockCount: textBlocks.length } };
  } catch (e) {
    return { platform: 'claude', messages: [], url: window.location.href, error: e.message };
  }
})();
`;

// ChatGPT extractor
const chatgptExtractor = `
(function() {
  try {
    const messages = [];

    // ChatGPT uses data-message-author-role attribute
    const messageEls = document.querySelectorAll('[data-message-author-role]');

    messageEls.forEach(el => {
      try {
        const role = el.getAttribute('data-message-author-role');
        const contentEl = el.querySelector('.markdown, .prose, [class*="markdown"]') || el;
        const text = contentEl.innerText?.trim();

        if (text && text.length > 5) {
          messages.push({
            role: role === 'user' ? 'user' : 'assistant',
            content: text.substring(0, 10000),
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {}
    });

    // Fallback for older UI
    if (messages.length === 0) {
      const turns = document.querySelectorAll('[class*="ConversationItem"], [class*="turn"]');
      turns.forEach((el, i) => {
        try {
          const text = el.innerText?.trim();
          if (text && text.length > 10) {
            messages.push({
              role: i % 2 === 0 ? 'user' : 'assistant',
              content: text.substring(0, 10000),
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {}
      });
    }

    return { platform: 'chatgpt', messages, url: window.location.href, debug: { messageCount: messages.length } };
  } catch (e) {
    return { platform: 'chatgpt', messages: [], url: window.location.href, error: e.message };
  }
})();
`;

// Gemini extractor
const geminiExtractor = `
(function() {
  try {
    const messages = [];
    const url = window.location.href;
    const seenContent = new Set();

    // Gemini uses various selectors for messages
    const selectors = [
      '[class*="query-content"]',
      '[class*="response-content"]',
      '[class*="message-text"]',
      '[class*="model-response"]',
      '[class*="user-query"]',
      'message-content',
      '[data-message-id]',
      '.conversation-turn',
      '.query-text',
      '.response-text'
    ];

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const text = el.innerText?.trim();
          if (text && text.length > 20 && text.length < 50000 && !seenContent.has(text)) {
            seenContent.add(text);
            const classList = (el.className || '') + ' ' + (el.closest('[class]')?.className || '');
            const isUser = classList.includes('query') || classList.includes('user') || classList.includes('human');
            messages.push({
              role: isUser ? 'user' : 'assistant',
              content: text.substring(0, 10000),
              timestamp: new Date().toISOString()
            });
          }
        });
      } catch (e) {}
    });

    return { platform: 'gemini', messages, url, debug: { messageCount: messages.length } };
  } catch (e) {
    return { platform: 'gemini', messages: [], url: window.location.href, error: e.message };
  }
})();
`;

// Perplexity extractor
const perplexityExtractor = `
(function() {
  try {
    const messages = [];
    const url = window.location.href;
    const seenContent = new Set();

    // Perplexity query/answer pairs - try multiple selector strategies
    // Strategy 1: class-based selectors
    const queries = document.querySelectorAll('[class*="query"], [class*="question"], .prose h2');
    const answers = document.querySelectorAll('[class*="answer"], [class*="response"], .prose > div');

    queries.forEach((q, i) => {
      try {
        const qText = q.innerText?.trim();
        if (qText && qText.length > 2 && !seenContent.has(qText)) {
          seenContent.add(qText);
          messages.push({ role: 'user', content: qText.substring(0, 10000), timestamp: new Date().toISOString() });
        }

        const a = answers[i];
        if (a) {
          const aText = a.innerText?.trim();
          if (aText && aText.length > 10 && !seenContent.has(aText)) {
            seenContent.add(aText);
            messages.push({ role: 'assistant', content: aText.substring(0, 10000), timestamp: new Date().toISOString() });
          }
        }
      } catch (e) {}
    });

    // Strategy 2: fallback - look for message-like containers
    if (messages.length === 0) {
      const msgEls = document.querySelectorAll('[class*="message"], [class*="Message"], [class*="chat-turn"], [role="article"]');
      msgEls.forEach((el, i) => {
        try {
          const text = el.innerText?.trim();
          if (text && text.length > 20 && text.length < 50000 && !seenContent.has(text)) {
            seenContent.add(text);
            const isUser = (el.className || '').includes('user') || (el.className || '').includes('query');
            messages.push({
              role: isUser ? 'user' : 'assistant',
              content: text.substring(0, 10000),
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {}
      });
    }

    return { platform: 'perplexity', messages, url, debug: { messageCount: messages.length } };
  } catch (e) {
    return { platform: 'perplexity', messages: [], url: window.location.href, error: e.message };
  }
})();
`;

// Grok extractor
const grokExtractor = `
(function() {
  try {
    const messages = [];

    const messageEls = document.querySelectorAll('[class*="message"], [class*="chat-turn"], [role="article"]');

    messageEls.forEach((el, i) => {
      try {
        const text = el.innerText?.trim();
        if (text && text.length > 10) {
          const isUser = el.className?.includes('user') ||
                         el.querySelector('[class*="user"]') ||
                         el.getAttribute('data-role') === 'user';
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 10000),
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {}
    });

    return { platform: 'grok', messages, url: window.location.href, debug: { messageCount: messages.length } };
  } catch (e) {
    return { platform: 'grok', messages: [], url: window.location.href, error: e.message };
  }
})();
`;

// DeepSeek extractor
const deepseekExtractor = `
(function() {
  try {
    const messages = [];

    const messageEls = document.querySelectorAll('[class*="message"], [class*="chat-message"]');

    messageEls.forEach((el, i) => {
      try {
        const text = el.innerText?.trim();
        if (text && text.length > 10) {
          const isUser = el.className?.includes('user') || i % 2 === 0;
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text.substring(0, 10000),
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {}
    });

    return { platform: 'deepseek', messages, url: window.location.href, debug: { messageCount: messages.length } };
  } catch (e) {
    return { platform: 'deepseek', messages: [], url: window.location.href, error: e.message };
  }
})();
`;

// Generic extractor (fallback)
const genericExtractor = `
(function() {
  const messages = [];

  // Try common patterns
  const messageEls = document.querySelectorAll(
    '[class*="message"], [class*="Message"], ' +
    '[class*="chat"], [class*="Chat"], ' +
    '[class*="turn"], [class*="Turn"], ' +
    '[role="article"], [role="listitem"]'
  );

  messageEls.forEach((el, i) => {
    const text = el.innerText?.trim();
    if (text && text.length > 20 && text.length < 50000) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: text.substring(0, 10000),
        timestamp: new Date().toISOString()
      });
    }
  });

  return { platform: 'unknown', messages, url: window.location.href };
})();
`;

// Grok Imagine extractor - extracts generated image URLs
const grokImagineExtractor = `
(function() {
  try {
    const images = [];
    const url = window.location.href;

    // Find all potential generated images
    // Look for large images that are likely AI-generated outputs
    const allImages = document.querySelectorAll('img');

    allImages.forEach((img, i) => {
      // Skip small images (icons, avatars, etc.)
      if (img.naturalWidth < 200 || img.naturalHeight < 200) return;
      // Skip images that are clearly UI elements
      if (img.src.includes('logo') || img.src.includes('icon') || img.src.includes('avatar')) return;
      // Skip profile pictures
      if (img.className?.includes('avatar') || img.className?.includes('profile')) return;

      images.push({
        type: 'image',
        src: img.src,
        alt: img.alt || 'Generated image ' + i,
        width: img.naturalWidth,
        height: img.naturalHeight,
        timestamp: new Date().toISOString()
      });
    });

    // Also look for canvas elements (some AI image generators render to canvas)
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas, i) => {
      if (canvas.width > 200 && canvas.height > 200) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          images.push({
            type: 'canvas',
            src: dataUrl,
            width: canvas.width,
            height: canvas.height,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          // Canvas may be tainted (cross-origin)
        }
      }
    });

    // Look for download buttons/links near images
    const downloadLinks = document.querySelectorAll('a[download], button[class*="download"], [aria-label*="download"]');
    downloadLinks.forEach(link => {
      if (link.href && !images.some(img => img.src === link.href)) {
        images.push({
          type: 'download_link',
          src: link.href,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Find the prompt input value
    const promptInput = document.querySelector('textarea, [contenteditable="true"], input[type="text"]');
    const promptText = promptInput?.value || promptInput?.innerText || '';

    return {
      platform: 'grok-imagine',
      images,
      prompt: promptText,
      url,
      debug: { imageCount: images.length, totalImagesOnPage: allImages.length }
    };
  } catch (e) {
    return { platform: 'grok-imagine', images: [], url: window.location.href, error: e.message };
  }
})();
`;

const extractors = {
  claude: claudeExtractor,
  chatgpt: chatgptExtractor,
  gemini: geminiExtractor,
  perplexity: perplexityExtractor,
  grok: grokExtractor,
  deepseek: deepseekExtractor,
  kimi: genericExtractor,
  qwen: genericExtractor,
  manus: genericExtractor,
  'grok-imagine': grokImagineExtractor,
  generic: genericExtractor
};

module.exports = { extractors };
