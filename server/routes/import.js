const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../database');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'
];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

async function upsertContact(client, contact) {
  let existing = null;

  if (contact.email) {
    const { rows } = await client.query('SELECT id FROM contacts WHERE email = $1', [contact.email]);
    if (rows.length) existing = rows[0];
  }
  if (!existing && contact.phone) {
    const normalized = contact.phone.replace(/\D/g, '');
    const { rows } = await client.query(
      "SELECT id FROM contacts WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1",
      [normalized]
    );
    if (rows.length) existing = rows[0];
  }

  if (existing) {
    await client.query(`
      UPDATE contacts SET
        name = COALESCE(NULLIF($1, ''), name),
        email = COALESCE(NULLIF($2, ''), email),
        phone = COALESCE(NULLIF($3, ''), phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [contact.name || '', contact.email || '', contact.phone || '', existing.id]);
    return { id: existing.id, merged: true };
  }

  const { rows } = await client.query(`
    INSERT INTO contacts (name, email, phone, how_met, notes, avatar_color)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [
    contact.name || 'Unknown',
    contact.email || null,
    contact.phone || null,
    contact.how_met || null,
    contact.notes || null,
    randomColor(),
  ]);
  return { id: rows[0].id, merged: false };
}

// Parse vCard content
function parseVCF(content) {
  const contacts = [];
  const cards = content.split(/END:VCARD/i);

  for (const card of cards) {
    if (!card.match(/BEGIN:VCARD/i)) continue;

    const unfolded = card.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    const contact = {};
    const emails = [];
    const phones = [];

    for (const line of lines) {
      const [prop, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      const propUpper = prop.toUpperCase().split(';')[0];

      if (propUpper === 'FN') contact.name = value;
      else if (propUpper === 'EMAIL') emails.push(value);
      else if (propUpper === 'TEL') phones.push(value);
      else if (propUpper === 'NOTE') contact.notes = value;
      else if (propUpper === 'ORG') contact.org = value;
    }

    contact.email = emails[0] || null;
    contact.phone = phones[0] || null;
    if (contact.org && !contact.notes) contact.notes = `Works at: ${contact.org}`;

    if (contact.name) contacts.push(contact);
  }

  return contacts;
}

// Parse CSV — handles Google Contacts format and simple format
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const contacts = [];

  const col = (names) => {
    for (const n of names) {
      const idx = header.findIndex(h => h.includes(n.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const nameIdx = col(['name', 'full name', 'display name']);
  const givenIdx = col(['given name', 'first name', 'firstname']);
  const familyIdx = col(['family name', 'last name', 'lastname', 'surname']);
  const emailIdx = col(['e-mail 1 - value', 'email 1', 'email', 'e-mail']);
  const phoneIdx = col(['phone 1 - value', 'mobile phone', 'phone', 'telephone', 'tel']);
  const notesIdx = col(['notes', 'note', 'description']);

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.every(c => !c.trim())) continue;

    let name = '';
    if (nameIdx !== -1) name = cols[nameIdx] || '';
    if (!name && givenIdx !== -1) name = [cols[givenIdx], familyIdx !== -1 ? cols[familyIdx] : ''].filter(Boolean).join(' ');
    if (!name) continue;

    contacts.push({
      name: name.trim(),
      email: emailIdx !== -1 ? (cols[emailIdx] || null) : null,
      phone: phoneIdx !== -1 ? (cols[phoneIdx] || null) : null,
      notes: notesIdx !== -1 ? (cols[notesIdx] || null) : null,
    });
  }

  return contacts;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// POST /api/import/vcf
router.post('/vcf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = req.file.buffer.toString('utf-8');
  const parsed = parseVCF(content);

  const client = await pool.connect();
  let imported = 0, merged = 0;
  try {
    await client.query('BEGIN');
    for (const contact of parsed) {
      const { merged: wasMerged } = await upsertContact(client, contact);
      if (wasMerged) merged++; else imported++;
    }
    await client.query('COMMIT');
    res.json({ total: parsed.length, imported, merged });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/import/csv
router.post('/csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = req.file.buffer.toString('utf-8');
  const parsed = parseCSV(content);

  const client = await pool.connect();
  let imported = 0, merged = 0;
  try {
    await client.query('BEGIN');
    for (const contact of parsed) {
      const { merged: wasMerged } = await upsertContact(client, contact);
      if (wasMerged) merged++; else imported++;
    }
    await client.query('COMMIT');
    res.json({ total: parsed.length, imported, merged });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/import/imessage — reads macOS Messages database
router.post('/imessage', async (req, res) => {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  const dbPath = path.join(os.homedir(), 'Library/Messages/chat.db');
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'iMessage database not found at ~/Library/Messages/chat.db' });
  }

  let msgDb;
  try {
    const Database = require('better-sqlite3');
    msgDb = new Database(dbPath, { readonly: true });
  } catch (err) {
    return res.status(403).json({
      error: 'Cannot open iMessage database. Grant Terminal (or the app) Full Disk Access in System Settings > Privacy & Security.'
    });
  }

  const client = await pool.connect();
  try {
    const handles = msgDb.prepare(`
      SELECT
        h.id as handle,
        MAX(datetime(m.date/1000000000 + strftime('%s','2001-01-01'), 'unixepoch', 'localtime')) as last_msg_date,
        COUNT(m.rowid) as msg_count
      FROM handle h
      JOIN chat_handle_join chj ON h.rowid = chj.handle_id
      JOIN chat_message_join cmj ON chj.chat_id = cmj.chat_id
      JOIN message m ON cmj.message_id = m.rowid
      GROUP BY h.id
      ORDER BY last_msg_date DESC
    `).all();

    let imported = 0, merged = 0, skipped = 0;

    await client.query('BEGIN');
    for (const handle of handles) {
      const raw = handle.handle;
      const isEmail = raw.includes('@');
      const contact = {
        name: raw,
        email: isEmail ? raw : null,
        phone: isEmail ? null : raw,
        notes: `Imported from iMessage. ${handle.msg_count} messages.`,
      };

      if (!isEmail && raw.replace(/\D/g, '').length < 7) { skipped++; continue; }

      const { merged: wasMerged } = await upsertContact(client, contact);

      if (handle.last_msg_date) {
        const dateStr = handle.last_msg_date.split(' ')[0];
        const col = isEmail ? 'email' : 'phone';
        await client.query(`
          UPDATE contacts SET last_contacted = $1
          WHERE ${col} = $2 AND (last_contacted IS NULL OR last_contacted < $1)
        `, [dateStr, raw]);
      }

      if (wasMerged) merged++; else imported++;
    }
    await client.query('COMMIT');

    res.json({ total: handles.length, imported, merged, skipped });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    msgDb.close();
    client.release();
  }
});

module.exports = router;
