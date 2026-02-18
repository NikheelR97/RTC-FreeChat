import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data/chat.db');

const db = new Database(dbPath);

console.log('DB Path:', dbPath);

import fs from 'fs';

const channels = db.prepare('SELECT * FROM channels').all();
const usersCount = db.prepare('SELECT count(*) as count FROM users').get().count;

const output = `DB Path: ${dbPath}\nChannels: ${JSON.stringify(channels, null, 2)}\nUsers Count: ${usersCount}`;
fs.writeFileSync('db_debug.txt', output);
console.log('Written to db_debug.txt');
