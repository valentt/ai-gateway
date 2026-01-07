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
  const messages = [];

  // ChatGPT uses data-message-author-role attribute
  const messageEls = document.querySelectorAll('[data-message-author-role]');

  messageEls.forEach(el => {
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
  });

  // Fallback for older UI
  if (messages.length === 0) {
    const turns = document.querySelectorAll('[class*="ConversationItem"], [class*="turn"]');
    turns.forEach((el, i) => {
      const text = el.innerText?.trim();
      if (text && text.length > 10) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: text.substring(0, 10000),
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  return { platform: 'chatgpt', messages, url: window.location.href };
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
  const messages = [];

  // Perplexity query/answer pairs
  const queries = document.querySelectorAll('[class*="query"], [class*="question"], .prose h2');
  const answers = document.querySelectorAll('[class*="answer"], [class*="response"], .prose > div');

  queries.forEach((q, i) => {
    const qText = q.innerText?.trim();
    if (qText) {
      messages.push({ role: 'user', content: qText.substring(0, 10000), timestamp: new Date().toISOString() });
    }

    const a = answers[i];
    if (a) {
      const aText = a.innerText?.trim();
      if (aText) {
        messages.push({ role: 'assistant', content: aText.substring(0, 10000), timestamp: new Date().toISOString() });
      }
    }
  });

  return { platform: 'perplexity', messages, url: window.location.href };
})();
`;

// Grok extractor
const grokExtractor = `
(function() {
  const messages = [];

  const messageEls = document.querySelectorAll('[class*="message"], [class*="chat-turn"], [role="article"]');

  messageEls.forEach((el, i) => {
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
  });

  return { platform: 'grok', messages, url: window.location.href };
})();
`;

// DeepSeek extractor
const deepseekExtractor = `
(function() {
  const messages = [];

  const messageEls = document.querySelectorAll('[class*="message"], [class*="chat-message"]');

  messageEls.forEach((el, i) => {
    const text = el.innerText?.trim();
    if (text && text.length > 10) {
      const isUser = el.className?.includes('user') || i % 2 === 0;
      messages.push({
        role: isUser ? 'user' : 'assistant',
        content: text.substring(0, 10000),
        timestamp: new Date().toISOString()
      });
    }
  });

  return { platform: 'deepseek', messages, url: window.location.href };
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

const extractors = {
  claude: claudeExtractor,
  chatgpt: chatgptExtractor,
  gemini: geminiExtractor,
  perplexity: perplexityExtractor,
  grok: grokExtractor,
  deepseek: deepseekExtractor,
  kimi: genericExtractor,
  qwen: genericExtractor,
  generic: genericExtractor
};

module.exports = { extractors };
