/**
 * Platform-specific message injectors
 *
 * Each injector types a message into the provider's chat input
 * and clicks send. Returns true if successful.
 */

// ChatGPT injector
const chatgptInjector = (message) => `
(async function() {
  try {
    const textarea = document.querySelector('textarea[id="prompt-textarea"], #prompt-textarea');
    if (!textarea) return { success: false, error: 'Input not found' };

    // Focus and set value
    textarea.focus();
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(textarea, ${JSON.stringify(message)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for send button to become active
    await new Promise(r => setTimeout(r, 300));

    const sendBtn = document.querySelector('button[data-testid="send-button"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return { success: true };
    }

    // Fallback: Enter key
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();
`;

// Claude injector
const claudeInjector = (message) => `
(async function() {
  try {
    const editor = document.querySelector('div[contenteditable="true"].ProseMirror, div[contenteditable="true"]');
    if (!editor) return { success: false, error: 'Editor not found' };

    editor.focus();
    // Clear existing content
    editor.innerHTML = '';

    // Insert text as paragraph
    const p = document.createElement('p');
    p.textContent = ${JSON.stringify(message)};
    editor.appendChild(p);
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise(r => setTimeout(r, 300));

    // Click send button
    const sendBtn = document.querySelector('button[aria-label="Send Message"], button[class*="send"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return { success: true };
    }

    // Fallback: Enter
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();
`;

// Gemini injector
const geminiInjector = (message) => `
(async function() {
  try {
    const editor = document.querySelector('.ql-editor, rich-textarea .ql-editor, [contenteditable="true"]');
    if (!editor) return { success: false, error: 'Editor not found' };

    editor.focus();
    editor.innerHTML = '<p>' + ${JSON.stringify(message)} + '</p>';
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise(r => setTimeout(r, 300));

    const sendBtn = document.querySelector('button[aria-label="Send message"], button.send-button, button[class*="send"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return { success: true };
    }

    // Fallback: Enter
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();
`;

// Perplexity injector
const perplexityInjector = (message) => `
(async function() {
  try {
    const textarea = document.querySelector('textarea, [contenteditable="true"]');
    if (!textarea) return { success: false, error: 'Input not found' };

    textarea.focus();
    if (textarea.tagName === 'TEXTAREA') {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(textarea, ${JSON.stringify(message)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      textarea.innerText = ${JSON.stringify(message)};
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await new Promise(r => setTimeout(r, 300));

    const sendBtn = document.querySelector('button[aria-label="Submit"], button[class*="submit"], button[class*="send"]');
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return { success: true };
    }

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();
`;

// Generic injector (Grok, DeepSeek, Kimi, Qwen, Manus)
const genericInjector = (message) => `
(async function() {
  try {
    // Try textarea first, then contenteditable
    let input = document.querySelector('textarea:not([readonly])');
    if (!input) input = document.querySelector('[contenteditable="true"]');
    if (!input) return { success: false, error: 'No input found' };

    input.focus();

    if (input.tagName === 'TEXTAREA') {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, ${JSON.stringify(message)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.innerText = ${JSON.stringify(message)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await new Promise(r => setTimeout(r, 300));

    // Try to find send button
    const sendSelectors = [
      'button[aria-label*="send" i]', 'button[aria-label*="submit" i]',
      'button[class*="send" i]', 'button[class*="submit" i]',
      'button[data-testid*="send"]', 'button[type="submit"]',
    ];

    for (const sel of sendSelectors) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) {
        btn.click();
        return { success: true };
      }
    }

    // Fallback: Enter key
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();
`;

const injectors = {
  chatgpt: chatgptInjector,
  claude: claudeInjector,
  gemini: geminiInjector,
  perplexity: perplexityInjector,
  grok: genericInjector,
  deepseek: genericInjector,
  kimi: genericInjector,
  qwen: genericInjector,
  manus: genericInjector,
};

module.exports = { injectors };
