/**
 * LLM Adapters for AI Gateway
 *
 * Direct API calls to Claude (Anthropic) and GPT (OpenAI).
 * Loads API keys from .tajne file.
 */

const path = require('path');
const fs = require('fs');

// Load API keys from .tajne
function loadKeys() {
  const tajnePath = path.resolve(__dirname, '../../../maja-asistent/.tajne');
  const keys = {};

  if (fs.existsSync(tajnePath)) {
    const lines = fs.readFileSync(tajnePath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match) {
        keys[match[1]] = match[2].trim();
      }
    }
  }

  // Environment variables override .tajne
  if (process.env.ANTHROPIC_API_KEY) keys.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) keys.OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  return keys;
}

const apiKeys = loadKeys();

/**
 * Call Claude API (Anthropic)
 * @param {string} prompt - User message
 * @param {object} options - Optional: system, max_tokens, temperature
 * @returns {Promise<{success: boolean, text: string, model: string, usage: object, latencyMs: number}>}
 */
async function callClaude(prompt, options = {}) {
  const key = apiKeys.ANTHROPIC_API_KEY;
  if (!key) {
    return { success: false, error: 'ANTHROPIC_API_KEY not configured', model: 'claude' };
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key });

  const start = Date.now();
  try {
    const message = await client.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.max_tokens || 1024,
      messages: [{ role: 'user', content: prompt }],
      ...(options.system ? { system: options.system } : {})
    });

    const latencyMs = Date.now() - start;
    const text = message.content.map(b => b.text).join('');

    return {
      success: true,
      text,
      model: message.model,
      usage: message.usage,
      latencyMs,
      stopReason: message.stop_reason
    };
  } catch (err) {
    return { success: false, error: err.message, model: 'claude', latencyMs: Date.now() - start };
  }
}

/**
 * Call GPT API (OpenAI)
 * @param {string} prompt - User message
 * @param {object} options - Optional: system, max_tokens, temperature
 * @returns {Promise<{success: boolean, text: string, model: string, usage: object, latencyMs: number}>}
 */
async function callGPT(prompt, options = {}) {
  const key = apiKeys.OPENAI_API_KEY;
  if (!key) {
    return { success: false, error: 'OPENAI_API_KEY not configured', model: 'gpt' };
  }

  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: key });

  const start = Date.now();
  try {
    const messages = [];
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    const completion = await client.chat.completions.create({
      model: options.model || 'gpt-4o',
      messages,
      max_tokens: options.max_tokens || 1024
    });

    const latencyMs = Date.now() - start;
    const text = completion.choices[0]?.message?.content || '';

    return {
      success: true,
      text,
      model: completion.model,
      usage: completion.usage,
      latencyMs,
      stopReason: completion.choices[0]?.finish_reason
    };
  } catch (err) {
    return { success: false, error: err.message, model: 'gpt', latencyMs: Date.now() - start };
  }
}

/**
 * Call multiple models in parallel
 * @param {string} prompt - User message
 * @param {string[]} models - Array of model names: ['claude', 'gpt']
 * @param {object} options - Shared options
 * @returns {Promise<object>} - { claude: {...}, gpt: {...} }
 */
async function callMultiple(prompt, models, options = {}) {
  const adapters = {
    claude: callClaude,
    gpt: callGPT
  };

  const promises = models
    .filter(m => adapters[m])
    .map(async (m) => {
      const result = await adapters[m](prompt, options);
      return [m, result];
    });

  const results = await Promise.all(promises);
  const output = {};
  for (const [name, result] of results) {
    output[name] = result;
  }

  // Mark unsupported models
  for (const m of models) {
    if (!adapters[m]) {
      output[m] = { success: false, error: `Model "${m}" not yet implemented`, model: m };
    }
  }

  return output;
}

/**
 * Get which models are available (have API keys configured)
 */
function getAvailableModels() {
  return {
    claude: { available: !!apiKeys.ANTHROPIC_API_KEY, model: 'claude-sonnet-4-20250514' },
    gpt: { available: !!apiKeys.OPENAI_API_KEY, model: 'gpt-4o' },
    gemini: { available: false, model: 'gemini-pro', note: 'Not yet implemented' },
    qwen: { available: false, model: 'qwen-max', note: 'Not yet implemented' },
    llama: { available: false, model: 'llama-3', note: 'Not yet implemented' },
    mistral: { available: false, model: 'mistral-large', note: 'Not yet implemented' }
  };
}

module.exports = {
  callClaude,
  callGPT,
  callMultiple,
  getAvailableModels,
  apiKeys
};
