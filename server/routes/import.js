const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../database');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'
];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function upsertContact(contact) {
  // Try to find existing by phone or email
  let existing = null;
  if (contact.email) {
    existing = db.prepare('SELECT id FROM contacts WHERE email = ?').get(contact.email);
  }
  if (!existing && contact.phone) {
    const normalized = contact.phone.replace(/\D/g, '');
    existing = db.prepare("SELECT id FROM contacts WHERE replace(replace(replace(replace(phone,' ',''),'-',''),'(',''),')','') = ?").get(normalized);
  }

  if (existing) {
    db.prepare(`
      UPDATE contacts SET
        name = COALESCE(NULLIF(?, ''), name),
        email = COALESCE(NULLIF(?, ''), email),
        phone = COALESCE(NULLIF(?, ''), phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(contact.name || '', contact.email || '', contact.phone || '', existing.id);
    return { id: existing.id, merged: true };
  }

  const result = db.prepare(`
    INSERT INTO contacts (name, email, phone, how_met, notes, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    contact.name || 'Unknown',
    contact.email || null,
    contact.phone || null,
    contact.how_met || null,
    contact.notes || null,
    randomColor()
  );
  return { id: result.lastInsertRowid, merged: false };
}

// Parse vCard content
function parseVCF(content) {
  const contacts = [];
  // Split on END:VCARD to get individual cards
  const cards = content.split(/END:VCARD/i);

  for (const card of cards) {
    if (!card.match(/BEGIN:VCARD/i)) continue;

    // Unfold lines (RFC 6350: lines starting with space/tab are continuations)
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

  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const contacts = [];

  // Map common column names
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
router.post('/vcf', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = req.file.buffer.toString('utf-8');
  const parsed = parseVCF(content);

  let imported = 0, merged = 0;
  const importMany = db.transaction(() => {
    for (const contact of parsed) {
      const { merged: wasMerged } = upsertContact(contact);
      if (wasMerged) merged++;
      else imported++;
    }
  });
  importMany();

  res.json({ total: parsed.length, imported, merged });
});

// POST /api/import/csv
router.post('/csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = req.file.buffer.toString('utf-8');
  const parsed = parseCSV(content);

  let imported = 0, merged = 0;
  const importMany = db.transaction(() => {
    for (const contact of parsed) {
      const { merged: wasMerged } = upsertContact(contact);
      if (wasMerged) merged++;
      else imported++;
    }
  });
  importMany();

  res.json({ total: parsed.length, imported, merged });
});

// POST /api/import/imessage — reads macOS Messages database
router.post('/imessage', (req, res) => {
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

  try {
    // Get handles (contacts) with their last message date and message count
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

    const importMany = db.transaction(() => {
      for (const handle of handles) {
        const raw = handle.handle;
        // Determine if phone or email
        const isEmail = raw.includes('@');
        const contact = {
          name: raw,
          email: isEmail ? raw : null,
          phone: isEmail ? null : raw,
          notes: `Imported from iMessage. ${handle.msg_count} messages.`,
        };

        // Skip if looks like a group ID or short-code
        if (!isEmail && raw.replace(/\D/g, '').length < 7) { skipped++; continue; }

        const { merged: wasMerged } = upsertContact(contact);

        // Update last_contacted from iMessage history
        if (handle.last_msg_date) {
          const dateStr = handle.last_msg_date.split(' ')[0];
          db.prepare(`
            UPDATE contacts SET last_contacted = ?
            WHERE id = (SELECT id FROM contacts WHERE ${isEmail ? 'email' : 'phone'} = ?)
            AND (last_contacted IS NULL OR last_contacted < ?)
          `).run(dateStr, raw, dateStr);
        }

        if (wasMerged) merged++; else imported++;
      }
    });
    importMany();

    res.json({ total: handles.length, imported, merged, skipped });
  } finally {
    msgDb.close();
  }
});

module.exports = router;
