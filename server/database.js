require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      due_date DATE NOT NULL,
      message TEXT NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      date DATE NOT NULL,
      notes TEXT,
      source TEXT DEFAULT 'manual',
      external_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE interactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`);
  await pool.query(`ALTER TABLE interactions ADD COLUMN IF NOT EXISTS external_id TEXT`);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS interactions_contact_external_idx
    ON interactions (contact_id, external_id)
    WHERE external_id IS NOT NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_tags (
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, provider)
    )
  `);
}

initDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = pool;
