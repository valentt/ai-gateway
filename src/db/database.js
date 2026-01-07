/**
 * SQLite Database Module for AI Gateway
 *
 * Stores conversation history from all AI platforms.
 * Supports full-text search across all conversations.
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

/**
 * Get database path (in user data directory)
 */
function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'ai-gateway.db');
}

/**
 * Initialize database and create tables
 */
function initDatabase() {
  const dbPath = getDbPath();
  console.log(`[DB] Database path: ${dbPath}`);

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      profile TEXT DEFAULT 'default',
      external_id TEXT,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      UNIQUE(platform, profile, external_id)
    )
  `);

  // Create messages table with content_hash for deduplication
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id),
      UNIQUE(conversation_id, content_hash)
    )
  `);

  // Add content_hash column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN content_hash TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create unique index if not exists
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_dedup ON messages(conversation_id, content_hash)`);
  } catch (e) {
    // Index might already exist, ignore
  }

  // Create FTS virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      content='messages',
      content_rowid='id'
    )
  `);

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
    END
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_platform ON conversations(platform)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_profile ON conversations(profile)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_msg_timestamp ON messages(timestamp)`);

  console.log('[DB] Database initialized');
  return db;
}

/**
 * Get database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Save a conversation
 */
function saveConversation(platform, profile, externalId, title, metadata = null) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO conversations (platform, profile, external_id, title, metadata, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(platform, profile, external_id) DO UPDATE SET
      title = excluded.title,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id
  `);

  const result = stmt.get(platform, profile, externalId, title, JSON.stringify(metadata));
  return result.id;
}

/**
 * Generate simple hash of content for deduplication
 */
function hashContent(content, role) {
  // Simple hash: first 100 chars + length + role
  const normalized = content.trim().substring(0, 100);
  const crypto = require('crypto');
  return crypto.createHash('md5').update(`${role}:${normalized}:${content.length}`).digest('hex');
}

/**
 * Save a message (with deduplication)
 */
function saveMessage(conversationId, role, content, metadata = null) {
  const db = getDb();
  const contentHash = hashContent(content, role);

  // Use INSERT OR IGNORE to skip duplicates
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages (conversation_id, role, content, content_hash, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(conversationId, role, content, contentHash, JSON.stringify(metadata));

  // Update conversation timestamp only if we inserted
  if (result.changes > 0) {
    db.prepare(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(conversationId);
    return result.lastInsertRowid;
  }

  return null; // Duplicate, not inserted
}

/**
 * Get conversation history
 */
function getHistory(options = {}) {
  const db = getDb();
  const { platform, profile, limit = 100, offset = 0 } = options;

  let query = `
    SELECT c.*,
           (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    WHERE 1=1
  `;
  const params = [];

  if (platform) {
    query += ' AND c.platform = ?';
    params.push(platform);
  }

  if (profile) {
    query += ' AND c.profile = ?';
    params.push(profile);
  }

  query += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Get messages for a conversation
 */
function getMessages(conversationId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
  `).all(conversationId);
}

/**
 * Full-text search across all messages
 */
function searchMessages(query, options = {}) {
  const db = getDb();
  const { platform, profile, limit = 50 } = options;

  let sql = `
    SELECT
      m.id,
      m.role,
      m.content,
      m.timestamp,
      c.id as conversation_id,
      c.platform,
      c.profile,
      c.title,
      highlight(messages_fts, 0, '<mark>', '</mark>') as highlighted
    FROM messages_fts fts
    JOIN messages m ON fts.rowid = m.id
    JOIN conversations c ON m.conversation_id = c.id
    WHERE messages_fts MATCH ?
  `;
  const params = [query];

  if (platform) {
    sql += ' AND c.platform = ?';
    params.push(platform);
  }

  if (profile) {
    sql += ' AND c.profile = ?';
    params.push(profile);
  }

  sql += ' ORDER BY rank LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

/**
 * Get statistics
 */
function getStats() {
  const db = getDb();
  const stats = {
    totalConversations: db.prepare('SELECT COUNT(*) as count FROM conversations').get().count,
    totalMessages: db.prepare('SELECT COUNT(*) as count FROM messages').get().count,
    byPlatform: db.prepare(`
      SELECT platform, COUNT(*) as conversations,
             (SELECT COUNT(*) FROM messages m
              JOIN conversations c2 ON m.conversation_id = c2.id
              WHERE c2.platform = conversations.platform) as messages
      FROM conversations
      GROUP BY platform
    `).all()
  };
  return stats;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDb,
  saveConversation,
  saveMessage,
  getHistory,
  getMessages,
  searchMessages,
  getStats,
  closeDatabase
};
