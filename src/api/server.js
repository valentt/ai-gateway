/**
 * REST API Server for AI Gateway
 *
 * Provides HTTP endpoints for Python/CLI integration.
 * Runs on localhost:8080 by default.
 *
 * Can run STANDALONE (node src/api/server.js) or inside Electron.
 *
 * Endpoints:
 * - GET  /health           - Health check
 * - GET  /api/models       - Available LLM models
 * - POST /api/chat         - Multi-model parallel chat (Faza 1)
 * - GET  /platforms        - List available platforms (Electron)
 * - GET  /history          - Get conversation history (Electron)
 * - GET  /history/:id      - Get specific conversation (Electron)
 * - GET  /search?q=...     - Full-text search (Electron)
 * - POST /chat/:platform   - Send message via webview (Electron)
 * - GET  /stats            - Get statistics (Electron)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { callMultiple, getAvailableModels } = require('./llm-adapters');

// Detect if running inside Electron
const isElectron = !!(process.versions && process.versions.electron);

// Conditionally load Electron-dependent modules
let dbModule = null;
if (isElectron) {
  try {
    dbModule = require('../db/database');
  } catch (e) {
    console.warn('[API] Database module not available (standalone mode)');
  }
}

let server = null;
let app = null;

// Helper to download image from URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Image generation via main process (Electron only)
async function generateImageViaIpc(prompt, saveTo) {
  const { generateImage } = require('../main');
  const result = await generateImage(prompt, saveTo);

  if (result.success && result.images && result.images.length > 0 && saveTo) {
    try {
      if (!fs.existsSync(saveTo)) {
        fs.mkdirSync(saveTo, { recursive: true });
      }

      const savedPaths = [];
      for (let i = 0; i < result.images.length; i++) {
        const img = result.images[i];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `grok-imagine-${timestamp}-${i}.jpg`;
        const filepath = path.join(saveTo, filename);

        if (img.src.startsWith('data:')) {
          const base64Data = img.src.replace(/^data:image\/\w+;base64,/, '');
          fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
          savedPaths.push(filepath);
        } else if (img.src.startsWith('blob:')) {
          savedPaths.push({ error: 'Blob URLs cannot be saved directly', src: img.src });
        } else if (img.src.startsWith('http')) {
          await downloadImage(img.src, filepath);
          savedPaths.push(filepath);
        }
      }
      result.saved_to = savedPaths;
    } catch (saveError) {
      result.save_error = saveError.message;
    }
  }

  return result;
}

// Chat via main process (Electron only)
async function sendChatViaIpc(platform, message, profile) {
  const { sendChatMessage } = require('../main');
  return await sendChatMessage(platform, message, profile);
}

/**
 * Create and configure Express app
 */
function createApp() {
  app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Serve static UI files
  const uiPath = path.resolve(__dirname, '../../ui');
  app.use(express.static(uiPath));

  // Request logging
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    const models = getAvailableModels();
    res.json({
      status: 'ok',
      version: '2.0.0-faza1',
      mode: isElectron ? 'electron' : 'standalone',
      models,
      timestamp: new Date().toISOString()
    });
  });

  // ============================================================
  // FAZA 1: Multi-LLM Chat API
  // ============================================================

  // GET /api/models - Available models and their status
  app.get('/api/models', (req, res) => {
    res.json(getAvailableModels());
  });

  // POST /api/chat - Send prompt to multiple models in parallel
  app.post('/api/chat', async (req, res) => {
    try {
      const { prompt, models, system, max_tokens } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
      }

      if (!models || !Array.isArray(models) || models.length === 0) {
        return res.status(400).json({ error: 'models must be a non-empty array, e.g. ["claude", "gpt"]' });
      }

      console.log(`[API] /api/chat prompt="${prompt.substring(0, 60)}..." models=[${models.join(',')}]`);

      const results = await callMultiple(prompt, models, {
        system,
        max_tokens: max_tokens || 1024
      });

      res.json({
        success: true,
        prompt,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[API] /api/chat error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // Electron-dependent endpoints (only work inside Electron)
  // ============================================================

  if (isElectron && dbModule) {
    const { getHistory, getMessages, searchMessages, getStats, saveConversation, saveMessage } = dbModule;

    // Get available platforms
    app.get('/platforms', (req, res) => {
      const { AI_PLATFORMS } = require('../main');
      res.json(AI_PLATFORMS);
    });

    // Get conversation history
    app.get('/history', (req, res) => {
      try {
        const { platform, profile, limit, offset } = req.query;
        const history = getHistory({
          platform,
          profile,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined
        });
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific conversation with messages
    app.get('/history/:id', (req, res) => {
      try {
        const conversationId = parseInt(req.params.id);
        const messages = getMessages(conversationId);
        res.json({ conversation_id: conversationId, messages });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Full-text search
    app.get('/search', (req, res) => {
      try {
        const { q, platform, profile, limit } = req.query;
        if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
        const results = searchMessages(q, { platform, profile, limit: limit ? parseInt(limit) : undefined });
        res.json({ query: q, count: results.length, results });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get statistics
    app.get('/stats', (req, res) => {
      try {
        res.json(getStats());
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Save conversation
    app.post('/conversations', (req, res) => {
      try {
        const { platform, profile, external_id, title, metadata } = req.body;
        if (!platform) return res.status(400).json({ error: 'platform is required' });
        const id = saveConversation(platform, profile || 'default', external_id || `manual-${Date.now()}`, title || 'Untitled', metadata);
        res.json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Save message to conversation
    app.post('/conversations/:id/messages', (req, res) => {
      try {
        const conversationId = parseInt(req.params.id);
        const { role, content, metadata } = req.body;
        if (!role || !content) return res.status(400).json({ error: 'role and content are required' });
        const id = saveMessage(conversationId, role, content, metadata);
        res.json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Chat via webview (Electron IPC)
    app.post('/chat/:platform', async (req, res) => {
      try {
        const { platform } = req.params;
        const { message, profile } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });

        const validPlatforms = ['deepseek', 'kimi', 'qwen', 'chatgpt', 'grok', 'claude', 'gemini', 'manus'];
        if (!validPlatforms.includes(platform.toLowerCase())) {
          return res.status(400).json({ error: `Invalid platform. Valid: ${validPlatforms.join(', ')}` });
        }

        const result = await sendChatViaIpc(platform.toLowerCase(), message, profile || 'default');
        if (result.success) {
          res.json({ success: true, platform, profile: profile || 'default', prompt: message, response: result.response, timestamp: new Date().toISOString() });
        } else {
          res.status(500).json({ success: false, error: result.error, platform });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Image generation
    app.post('/images/generate', async (req, res) => {
      try {
        const { prompt, save_to } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        const result = await generateImageViaIpc(prompt, save_to);
        if (result.success) {
          res.json({ success: true, images: result.images, prompt, saved_to: result.saved_to });
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/images/generate', (req, res) => {
      res.json({
        endpoint: 'POST /images/generate',
        description: 'Generate images using Grok Imagine (web automation)',
        parameters: { prompt: 'required', save_to: 'optional folder path' },
        note: 'Requires Electron mode with Grok tab logged in'
      });
    });
  }

  // Serve index.html for root
  app.get('/', (req, res) => {
    res.sendFile(path.resolve(uiPath, 'index.html'));
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[API] Error:', err);
    res.status(500).json({ error: err.message });
  });

  return app;
}

/**
 * Start API server with port fallback
 */
function startApiServer(port = 8080) {
  return new Promise((resolve, reject) => {
    const app = createApp();

    server = app.listen(port, '127.0.0.1', () => {
      console.log(`[API] Server listening on http://127.0.0.1:${port}`);
      console.log(`[API] Mode: ${isElectron ? 'Electron' : 'Standalone'}`);
      console.log(`[API] UI: http://127.0.0.1:${port}/`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[API] Port ${port} is already in use, trying ${port + 1}...`);
        server = app.listen(port + 1, '127.0.0.1', () => {
          console.log(`[API] Server listening on http://127.0.0.1:${port + 1} (fallback)`);
          resolve(server);
        });
        server.on('error', (err2) => {
          console.error(`[API] Fallback port ${port + 1} also failed:`, err2.message);
          resolve(null);
        });
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Stop API server
 */
function stopApiServer() {
  if (server) {
    server.close();
    server = null;
    console.log('[API] Server stopped');
  }
}

// If run directly (standalone mode), start server immediately
if (require.main === module) {
  const port = parseInt(process.env.PORT || '8080');
  console.log('[API] Starting in standalone mode...');
  startApiServer(port).then((srv) => {
    if (srv) {
      const models = getAvailableModels();
      console.log('[API] Available models:');
      for (const [name, info] of Object.entries(models)) {
        console.log(`  ${name}: ${info.available ? 'OK' : 'NOT CONFIGURED'}${info.note ? ` (${info.note})` : ''}`);
      }
    }
  }).catch(err => {
    console.error('[API] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startApiServer,
  stopApiServer
};
