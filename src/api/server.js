/**
 * REST API Server for AI Gateway
 *
 * Provides HTTP endpoints for Python/CLI integration.
 * Runs on localhost:8080 by default.
 *
 * Endpoints:
 * - GET  /health           - Health check
 * - GET  /platforms        - List available platforms
 * - GET  /history          - Get conversation history
 * - GET  /history/:id      - Get specific conversation
 * - GET  /search?q=...     - Full-text search
 * - POST /chat/:platform   - Send message (TODO: implement via webview)
 * - GET  /stats            - Get statistics
 */

const express = require('express');
const cors = require('cors');
const {
  getHistory,
  getMessages,
  searchMessages,
  getStats,
  saveConversation,
  saveMessage
} = require('../db/database');

let server = null;
let app = null;

/**
 * Create and configure Express app
 */
function createApp() {
  app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

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
      res.json({
        conversation_id: conversationId,
        messages
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Full-text search
  app.get('/search', (req, res) => {
    try {
      const { q, platform, profile, limit } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const results = searchMessages(q, {
        platform,
        profile,
        limit: limit ? parseInt(limit) : undefined
      });

      res.json({
        query: q,
        count: results.length,
        results
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get statistics
  app.get('/stats', (req, res) => {
    try {
      const stats = getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Save conversation (for manual/import use)
  app.post('/conversations', (req, res) => {
    try {
      const { platform, profile, external_id, title, metadata } = req.body;

      if (!platform) {
        return res.status(400).json({ error: 'platform is required' });
      }

      const id = saveConversation(
        platform,
        profile || 'default',
        external_id || `manual-${Date.now()}`,
        title || 'Untitled',
        metadata
      );

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

      if (!role || !content) {
        return res.status(400).json({ error: 'role and content are required' });
      }

      const id = saveMessage(conversationId, role, content, metadata);
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /chat/:platform - Send message to AI platform
  // This will need to interact with the webview in the renderer process
  app.post('/chat/:platform', async (req, res) => {
    try {
      const { platform } = req.params;
      const { message, profile } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      // TODO: Implement webview interaction via IPC
      // For now, return a placeholder
      res.json({
        status: 'pending',
        message: 'Chat via API not yet implemented. Use the GUI.',
        platform,
        profile: profile || 'default'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
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
 * Start API server
 */
function startApiServer(port = 8080) {
  return new Promise((resolve, reject) => {
    const app = createApp();

    server = app.listen(port, '127.0.0.1', () => {
      console.log(`[API] Server listening on http://127.0.0.1:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[API] Port ${port} is already in use`);
      }
      reject(err);
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

module.exports = {
  createApp,
  startApiServer,
  stopApiServer
};
