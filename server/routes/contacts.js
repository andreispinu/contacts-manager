const express = require('express');
const router = express.Router();
const db = require('../database');

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'
];

// Follow-up intervals in days by relationship strength
const FOLLOWUP_DAYS = { 5: 14, 4: 30, 3: 60, 2: 180, 1: 365 };

function saveTags(contactId, tags) {
  db.prepare('DELETE FROM contact_tags WHERE contact_id = ?').run(contactId);
  for (const tagName of tags) {
    const trimmed = tagName.trim();
    if (!trimmed) continue;
    let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed);
    if (!tag) {
      const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(trimmed);
      tag = { id: r.lastInsertRowid };
    }
    db.prepare('INSERT OR IGNORE INTO contact_tags (contact_id, tag_id) VALUES (?, ?)').run(contactId, tag.id);
  }
}

function getContactWithTags(id) {
  const contact = db.prepare(`
    SELECT c.*,
      GROUP_CONCAT(DISTINCT t.name) as tags_str
    FROM contacts c
    LEFT JOIN contact_tags ct ON c.id = ct.contact_id
    LEFT JOIN tags t ON ct.tag_id = t.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id);
  if (!contact) return null;
  contact.tags = contact.tags_str ? contact.tags_str.split(',') : [];
  delete contact.tags_str;
  return contact;
}

// GET /api/contacts
router.get('/', (req, res) => {
  const { search, strength, tag, sort = 'name', overdue } = req.query;

  let query = `
    SELECT c.*,
      GROUP_CONCAT(DISTINCT t.name) as tags_str,
      COUNT(DISTINCT CASE WHEN r.completed = 0 THEN r.id END) as pending_reminders,
      CASE
        WHEN c.last_contacted IS NULL AND c.relationship_strength >= 3 THEN 1
        WHEN c.relationship_strength = 5 AND julianday('now') - julianday(c.last_contacted) > 14 THEN 1
        WHEN c.relationship_strength = 4 AND julianday('now') - julianday(c.last_contacted) > 30 THEN 1
        WHEN c.relationship_strength = 3 AND julianday('now') - julianday(c.last_contacted) > 60 THEN 1
        WHEN c.relationship_strength = 2 AND julianday('now') - julianday(c.last_contacted) > 180 THEN 1
        WHEN c.relationship_strength = 1 AND julianday('now') - julianday(c.last_contacted) > 365 THEN 1
        ELSE 0
      END as is_overdue
    FROM contacts c
    LEFT JOIN contact_tags ct ON c.id = ct.contact_id
    LEFT JOIN tags t ON ct.tag_id = t.id
    LEFT JOIN reminders r ON c.id = r.contact_id
  `;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`(c.first_name LIKE ? OR c.last_name LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.notes LIKE ? OR c.how_met LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s);
  }
  if (strength) {
    conditions.push(`c.relationship_strength = ?`);
    params.push(parseInt(strength));
  }
  if (tag) {
    conditions.push(`c.id IN (SELECT ct2.contact_id FROM contact_tags ct2 JOIN tags t2 ON ct2.tag_id = t2.id WHERE t2.name = ?)`);
    params.push(tag);
  }
  if (overdue === 'true') {
    conditions.push(`(
      (c.last_contacted IS NULL AND c.relationship_strength >= 3) OR
      (c.relationship_strength = 5 AND julianday('now') - julianday(c.last_contacted) > 14) OR
      (c.relationship_strength = 4 AND julianday('now') - julianday(c.last_contacted) > 30) OR
      (c.relationship_strength = 3 AND julianday('now') - julianday(c.last_contacted) > 60) OR
      (c.relationship_strength = 2 AND julianday('now') - julianday(c.last_contacted) > 180) OR
      (c.relationship_strength = 1 AND julianday('now') - julianday(c.last_contacted) > 365)
    )`);
  }

  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` GROUP BY c.id`;

  const sortMap = {
    name: 'c.last_name ASC, c.first_name ASC',
    recent: 'c.updated_at DESC',
    strength: 'c.relationship_strength DESC, c.last_name ASC, c.first_name ASC',
    last_contacted: "CASE WHEN c.last_contacted IS NULL THEN 0 ELSE 1 END ASC, c.last_contacted ASC",
  };
  query += ` ORDER BY ${sortMap[sort] || 'c.name ASC'}`;

  const contacts = db.prepare(query).all(...params);
  contacts.forEach(c => {
    c.tags = c.tags_str ? c.tags_str.split(',') : [];
    delete c.tags_str;
  });

  res.json(contacts);
});

// GET /api/contacts/:id
router.get('/:id', (req, res) => {
  const contact = getContactWithTags(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  contact.reminders = db.prepare(
    'SELECT * FROM reminders WHERE contact_id = ? ORDER BY due_date ASC'
  ).all(req.params.id);

  contact.interactions = db.prepare(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC, created_at DESC'
  ).all(req.params.id);

  res.json(contact);
});

// POST /api/contacts
router.post('/', (req, res) => {
  const { first_name, last_name = '', email, phone, how_met, relationship_strength, notes, tags = [] } = req.body;
  if (!first_name) return res.status(400).json({ error: 'First name is required' });

  const name = [first_name, last_name].filter(Boolean).join(' ');
  const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const result = db.prepare(`
    INSERT INTO contacts (first_name, last_name, name, email, phone, how_met, relationship_strength, notes, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name || null, name, email || null, phone || null, how_met || null, relationship_strength || 3, notes || null, avatar_color);

  saveTags(result.lastInsertRowid, Array.isArray(tags) ? tags : []);
  res.status(201).json(getContactWithTags(result.lastInsertRowid));
});

// PUT /api/contacts/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  const { first_name, last_name, email, phone, how_met, relationship_strength, notes, last_contacted, tags } = req.body;

  const newFirstName = first_name !== undefined ? first_name : existing.first_name;
  const newLastName = last_name !== undefined ? last_name : (existing.last_name || '');
  const newName = [newFirstName, newLastName].filter(Boolean).join(' ');

  db.prepare(`
    UPDATE contacts SET
      first_name = ?, last_name = ?, name = ?,
      email = ?, phone = ?, how_met = ?,
      relationship_strength = ?, notes = ?, last_contacted = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    newFirstName,
    newLastName || null,
    newName,
    email !== undefined ? (email || null) : existing.email,
    phone !== undefined ? (phone || null) : existing.phone,
    how_met !== undefined ? (how_met || null) : existing.how_met,
    relationship_strength ?? existing.relationship_strength,
    notes !== undefined ? (notes || null) : existing.notes,
    last_contacted !== undefined ? (last_contacted || null) : existing.last_contacted,
    req.params.id
  );

  if (tags !== undefined) saveTags(req.params.id, Array.isArray(tags) ? tags : []);
  res.json(getContactWithTags(req.params.id));
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/contacts/:id/interactions
router.post('/:id/interactions', (req, res) => {
  const { type, date, notes } = req.body;
  if (!type || !date) return res.status(400).json({ error: 'type and date required' });

  const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const result = db.prepare(`
    INSERT INTO interactions (contact_id, type, date, notes) VALUES (?, ?, ?, ?)
  `).run(req.params.id, type, date, notes || null);

  // Update last_contacted
  db.prepare(`
    UPDATE contacts SET last_contacted = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (last_contacted IS NULL OR last_contacted < ?)
  `).run(date, req.params.id, date);

  res.status(201).json(db.prepare('SELECT * FROM interactions WHERE id = ?').get(result.lastInsertRowid));
});

// DELETE /api/contacts/:id/interactions/:iid
router.delete('/:id/interactions/:iid', (req, res) => {
  db.prepare('DELETE FROM interactions WHERE id = ? AND contact_id = ?').run(req.params.iid, req.params.id);
  res.json({ success: true });
});

module.exports = router;
