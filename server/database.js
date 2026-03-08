const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../contacts.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    email TEXT,
    phone TEXT,
    how_met TEXT,
    relationship_strength INTEGER DEFAULT 3,
    notes TEXT,
    last_contacted DATE,
    avatar_color TEXT DEFAULT '#6366f1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    due_date DATE NOT NULL,
    message TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact_tags (
    contact_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (contact_id, tag_id),
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`);

// Migration: add first_name / last_name if they don't exist yet
const cols = db.prepare('PRAGMA table_info(contacts)').all().map(c => c.name);
if (!cols.includes('first_name')) {
  db.exec(`
    ALTER TABLE contacts ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE contacts ADD COLUMN last_name TEXT DEFAULT '';
  `);
  // Populate from existing name
  const contacts = db.prepare('SELECT id, name FROM contacts').all();
  for (const c of contacts) {
    const parts = (c.name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    db.prepare('UPDATE contacts SET first_name = ?, last_name = ? WHERE id = ?').run(firstName, lastName, c.id);
  }
}

module.exports = db;
