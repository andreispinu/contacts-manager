const express = require('express');
const router = express.Router();
const pool = require('../database');

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'
];

async function saveTags(client, contactId, tags) {
  await client.query('DELETE FROM contact_tags WHERE contact_id = $1', [contactId]);
  for (const tagName of tags) {
    const trimmed = tagName.trim();
    if (!trimmed) continue;
    const { rows } = await client.query(
      'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [trimmed]
    );
    await client.query(
      'INSERT INTO contact_tags (contact_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [contactId, rows[0].id]
    );
  }
}

async function getContactWithTags(client, id, userId) {
  const { rows } = await client.query(`
    SELECT c.*,
      STRING_AGG(DISTINCT t.name, ',') as tags_str
    FROM contacts c
    LEFT JOIN contact_tags ct ON c.id = ct.contact_id
    LEFT JOIN tags t ON ct.tag_id = t.id
    WHERE c.id = $1 AND c.user_id = $2
    GROUP BY c.id
  `, [id, userId]);
  if (!rows.length) return null;
  const contact = rows[0];
  contact.tags = contact.tags_str ? contact.tags_str.split(',') : [];
  delete contact.tags_str;
  return contact;
}

// GET /api/contacts
router.get('/', async (req, res) => {
  const { search, strength, tag, category, sort = 'name', overdue } = req.query;

  let query = `
    SELECT c.*,
      STRING_AGG(DISTINCT t.name, ',') as tags_str,
      COUNT(DISTINCT CASE WHEN r.completed = false THEN r.id END) as pending_reminders,
      CASE
        WHEN c.last_contacted IS NULL AND c.relationship_strength >= 3 THEN 1
        WHEN c.relationship_strength = 5 AND (CURRENT_DATE - c.last_contacted) > 14 THEN 1
        WHEN c.relationship_strength = 4 AND (CURRENT_DATE - c.last_contacted) > 30 THEN 1
        WHEN c.relationship_strength = 3 AND (CURRENT_DATE - c.last_contacted) > 60 THEN 1
        WHEN c.relationship_strength = 2 AND (CURRENT_DATE - c.last_contacted) > 180 THEN 1
        WHEN c.relationship_strength = 1 AND (CURRENT_DATE - c.last_contacted) > 365 THEN 1
        ELSE 0
      END as is_overdue
    FROM contacts c
    LEFT JOIN contact_tags ct ON c.id = ct.contact_id
    LEFT JOIN tags t ON ct.tag_id = t.id
    LEFT JOIN reminders r ON c.id = r.contact_id
  `;

  const conditions = ['c.user_id = $1'];
  const params = [req.userId];
  let paramIdx = 2;

  if (search) {
    conditions.push(`(c.first_name ILIKE $${paramIdx} OR c.last_name ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx} OR c.email ILIKE $${paramIdx} OR c.phone ILIKE $${paramIdx} OR c.notes ILIKE $${paramIdx} OR c.how_met ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (strength) {
    conditions.push(`c.relationship_strength = $${paramIdx}`);
    params.push(parseInt(strength));
    paramIdx++;
  }
  if (tag) {
    conditions.push(`c.id IN (SELECT ct2.contact_id FROM contact_tags ct2 JOIN tags t2 ON ct2.tag_id = t2.id WHERE t2.name = $${paramIdx})`);
    params.push(tag);
    paramIdx++;
  }
  if (category) {
    conditions.push(`$${paramIdx} = ANY(c.categories)`);
    params.push(category);
    paramIdx++;
  }
  if (overdue === 'true') {
    conditions.push(`(
      (c.last_contacted IS NULL AND c.relationship_strength >= 3) OR
      (c.relationship_strength = 5 AND (CURRENT_DATE - c.last_contacted) > 14) OR
      (c.relationship_strength = 4 AND (CURRENT_DATE - c.last_contacted) > 30) OR
      (c.relationship_strength = 3 AND (CURRENT_DATE - c.last_contacted) > 60) OR
      (c.relationship_strength = 2 AND (CURRENT_DATE - c.last_contacted) > 180) OR
      (c.relationship_strength = 1 AND (CURRENT_DATE - c.last_contacted) > 365)
    )`);
  }

  query += ` WHERE ${conditions.join(' AND ')}`;
  query += ` GROUP BY c.id`;

  const sortMap = {
    name: 'c.last_name ASC, c.first_name ASC',
    recent: 'c.updated_at DESC',
    strength: 'c.relationship_strength DESC, c.last_name ASC, c.first_name ASC',
    last_contacted: 'CASE WHEN c.last_contacted IS NULL THEN 0 ELSE 1 END ASC, c.last_contacted ASC',
  };
  query += ` ORDER BY ${sortMap[sort] || 'c.name ASC'}`;

  try {
    const { rows } = await pool.query(query, params);
    rows.forEach(c => {
      c.tags = c.tags_str ? c.tags_str.split(',') : [];
      delete c.tags_str;
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const contact = await getContactWithTags(pool, req.params.id, req.userId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const [{ rows: reminders }, { rows: interactions }] = await Promise.all([
      pool.query('SELECT * FROM reminders WHERE contact_id = $1 ORDER BY due_date ASC', [req.params.id]),
      pool.query('SELECT * FROM interactions WHERE contact_id = $1 ORDER BY date DESC, created_at DESC', [req.params.id]),
    ]);

    contact.reminders = reminders;
    contact.interactions = interactions;
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  const { first_name, last_name = '', email, phone, how_met, relationship_strength, notes, tags = [], categories = [] } = req.body;
  if (!first_name) return res.status(400).json({ error: 'First name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const name = [first_name, last_name].filter(Boolean).join(' ');
    const avatar_color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const { rows } = await client.query(`
      INSERT INTO contacts (user_id, first_name, last_name, name, email, phone, how_met, relationship_strength, notes, avatar_color, categories)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [req.userId, first_name, last_name || null, name, email || null, phone || null, how_met || null, relationship_strength || 3, notes || null, avatar_color, categories]);

    const id = rows[0].id;
    await saveTags(client, id, Array.isArray(tags) ? tags : []);
    await client.query('COMMIT');

    res.status(201).json(await getContactWithTags(pool, id, req.userId));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query(
      'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!existing.length) return res.status(404).json({ error: 'Contact not found' });

    const e = existing[0];
    const { first_name, last_name, email, phone, how_met, relationship_strength, notes, last_contacted, tags, categories } = req.body;

    const newFirstName = first_name !== undefined ? first_name : e.first_name;
    const newLastName = last_name !== undefined ? last_name : (e.last_name || '');
    const newName = [newFirstName, newLastName].filter(Boolean).join(' ');

    await client.query('BEGIN');
    await client.query(`
      UPDATE contacts SET
        first_name = $1, last_name = $2, name = $3,
        email = $4, phone = $5, how_met = $6,
        relationship_strength = $7, notes = $8, last_contacted = $9,
        categories = $10, updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND user_id = $12
    `, [
      newFirstName,
      newLastName || null,
      newName,
      email !== undefined ? (email || null) : e.email,
      phone !== undefined ? (phone || null) : e.phone,
      how_met !== undefined ? (how_met || null) : e.how_met,
      relationship_strength ?? e.relationship_strength,
      notes !== undefined ? (notes || null) : e.notes,
      last_contacted !== undefined ? (last_contacted || null) : e.last_contacted,
      categories !== undefined ? categories : (e.categories || []),
      req.params.id,
      req.userId,
    ]);

    if (tags !== undefined) await saveTags(client, req.params.id, Array.isArray(tags) ? tags : []);
    await client.query('COMMIT');

    res.json(await getContactWithTags(pool, req.params.id, req.userId));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Contact not found' });
    await pool.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/:id/interactions
router.post('/:id/interactions', async (req, res) => {
  const { type, date, notes } = req.body;
  if (!type || !date) return res.status(400).json({ error: 'type and date required' });

  try {
    const { rows: contacts } = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!contacts.length) return res.status(404).json({ error: 'Contact not found' });

    const { rows } = await pool.query(
      'INSERT INTO interactions (contact_id, type, date, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, type, date, notes || null]
    );

    await pool.query(`
      UPDATE contacts SET last_contacted = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND (last_contacted IS NULL OR last_contacted < $1)
    `, [date, req.params.id]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id/interactions/:iid
router.delete('/:id/interactions/:iid', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM interactions WHERE id = $1 AND contact_id = $2',
      [req.params.iid, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
