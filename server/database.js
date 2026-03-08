require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
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
}

initDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = pool;
