import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
fs.ensureDirSync(dataDir);

const dbPath = path.join(dataDir, 'chat.db');
export const db = new Database(dbPath); // Export db for custom queries
db.pragma('journal_mode = WAL'); // Better concurrency

export function initDB() {
  console.log('Initializing SQLite Database...');

  // Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT, -- Hashed
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Channels Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      type TEXT DEFAULT 'text',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add provider columns if they don't exist
  try {
    db.exec('ALTER TABLE users ADD COLUMN provider TEXT');
    db.exec('ALTER TABLE users ADD COLUMN provider_id TEXT');
    console.log('Added provider columns to users table');
  } catch (err) {
    // Columns likely already exist
    // console.log('Provider columns already exist or error:', err.message);
  }

  // Messages Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT,
      user_id TEXT,
      text TEXT,
      attachment JSON,
      reply_to TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(channel_id) REFERENCES channels(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Reactions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      message_id TEXT,
      user_id TEXT,
      emoji TEXT,
      PRIMARY KEY (message_id, user_id, emoji),
      FOREIGN KEY(message_id) REFERENCES messages(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  console.log('Database initialized.');
  seedDefaults();
}

function seedDefaults() {
  // Create default channels if not exist
  const count = db.prepare('SELECT count(*) as count FROM channels').get().count;
  if (count === 0) {
    console.log('Seeding default channels...');
    const insert = db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)');
    insert.run('general', 'general', 'text');
    insert.run('voice-1', 'voice-1', 'voice');
    insert.run('Lounge', 'Lounge', 'voice');
  }
}

// --- Users ---

export function createUser(user) {
  const stmt = db.prepare(
    'INSERT INTO users (id, username, password, avatar) VALUES (?, ?, ?, ?)'
  );
  return stmt.run(user.id, user.username, user.password, user.avatar);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// --- Channels ---

export function getChannels() {
  return db.prepare('SELECT * FROM channels').all();
}

export function createChannel(channel) {
  const stmt = db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)');
  return stmt.run(channel.id, channel.name, channel.type);
}

// --- Messages ---

export function saveMessage(msg) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, channel_id, user_id, text, attachment, reply_to, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    msg.id,
    msg.channelId,
    msg.userId, // We need to ensure we pass userId, not displayName object
    msg.text,
    msg.attachment ? JSON.stringify(msg.attachment) : null,
    msg.replyTo || null,
    msg.timestamp // Expecting ISO string or auto-generated? Better to pass it.
  );
}

export function getMessages(channelId, limit = 50) {
  // Join with users to get display name and avatar
  const stmt = db.prepare(`
    SELECT m.*, u.username as displayName, u.avatar
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.channel_id = ?
    ORDER BY m.timestamp DESC
    LIMIT ?
  `);
  const rows = stmt.all(channelId, limit);
  // Reverse to show oldest first in chat (or handle in frontend)
  // Usually frontend expects oldest first if appending. 
  // But we usually fetch recent.
  return rows.reverse().map(row => ({
    ...row,
    attachment: row.attachment ? JSON.parse(row.attachment) : null
  }));
}

// --- Reactions ---

// --- Messages ---
// ... existing getMessages ...

export function getThreadMessages(parentId) {
  const stmt = db.prepare(`
    SELECT m.*, u.username as displayName, u.avatar
    FROM messages m
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.reply_to = ?
    ORDER BY m.timestamp ASC
  `);
  const rows = stmt.all(parentId);
  return rows.map(row => ({
    ...row,
    attachment: row.attachment ? JSON.parse(row.attachment) : null
  }));
}

// ... existing saveMessage ...

// --- Reactions ---

export function addReaction(messageId, userId, emoji) {
  const stmt = db.prepare('INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)');
  return stmt.run(messageId, userId, emoji);
}

export function removeReaction(messageId, userId, emoji) {
  const stmt = db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?');
  return stmt.run(messageId, userId, emoji);
}

export function getReactionsMap(messageId) {
  const rows = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id = ?').all(messageId);

  const map = {};
  rows.forEach(r => {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, users: [] };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.user_id);
  });
  return map;
}
