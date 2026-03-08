const express = require('express');
const router = express.Router();
const pool = require('../database');

// GET /api/tags
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.name, COUNT(ct.contact_id) as count
      FROM tags t
      LEFT JOIN contact_tags ct ON t.id = ct.tag_id
      GROUP BY t.id, t.name
      ORDER BY count DESC, t.name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
