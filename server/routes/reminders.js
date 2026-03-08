const express = require('express');
const router = express.Router();
const pool = require('../database');

// GET /api/reminders
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, c.name as contact_name, c.avatar_color
      FROM reminders r
      JOIN contacts c ON r.contact_id = c.id
      WHERE r.completed = false AND c.user_id = $1
      ORDER BY r.due_date ASC
    `, [req.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders
router.post('/', async (req, res) => {
  const { contact_id, due_date, message } = req.body;
  if (!contact_id || !due_date || !message) {
    return res.status(400).json({ error: 'contact_id, due_date, and message are required' });
  }
  try {
    const { rows: contacts } = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND user_id = $2',
      [contact_id, req.userId]
    );
    if (!contacts.length) return res.status(404).json({ error: 'Contact not found' });

    const { rows } = await pool.query(
      'INSERT INTO reminders (contact_id, due_date, message) VALUES ($1, $2, $3) RETURNING *',
      [contact_id, due_date, message]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reminders/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existing } = await pool.query(`
      SELECT r.* FROM reminders r
      JOIN contacts c ON r.contact_id = c.id
      WHERE r.id = $1 AND c.user_id = $2
    `, [req.params.id, req.userId]);
    if (!existing.length) return res.status(404).json({ error: 'Reminder not found' });

    const reminder = existing[0];
    const { completed, due_date, message } = req.body;

    const { rows } = await pool.query(
      'UPDATE reminders SET completed = $1, due_date = $2, message = $3 WHERE id = $4 RETURNING *',
      [
        completed !== undefined ? completed : reminder.completed,
        due_date ?? reminder.due_date,
        message ?? reminder.message,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`
      DELETE FROM reminders WHERE id = $1
      AND contact_id IN (SELECT id FROM contacts WHERE user_id = $2)
    `, [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
