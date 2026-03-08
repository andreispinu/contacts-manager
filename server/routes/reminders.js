const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/reminders — all upcoming reminders
router.get('/', (req, res) => {
  const reminders = db.prepare(`
    SELECT r.*, c.name as contact_name, c.avatar_color
    FROM reminders r
    JOIN contacts c ON r.contact_id = c.id
    WHERE r.completed = 0
    ORDER BY r.due_date ASC
  `).all();
  res.json(reminders);
});

// POST /api/reminders (create for a contact)
router.post('/', (req, res) => {
  const { contact_id, due_date, message } = req.body;
  if (!contact_id || !due_date || !message) {
    return res.status(400).json({ error: 'contact_id, due_date, and message are required' });
  }
  const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(contact_id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const result = db.prepare(
    'INSERT INTO reminders (contact_id, due_date, message) VALUES (?, ?, ?)'
  ).run(contact_id, due_date, message);

  res.status(201).json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/reminders/:id
router.put('/:id', (req, res) => {
  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

  const { completed, due_date, message } = req.body;
  db.prepare(`
    UPDATE reminders SET completed = ?, due_date = ?, message = ? WHERE id = ?
  `).run(
    completed !== undefined ? (completed ? 1 : 0) : reminder.completed,
    due_date ?? reminder.due_date,
    message ?? reminder.message,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id));
});

// DELETE /api/reminders/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
