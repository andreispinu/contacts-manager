const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/tags
router.get('/', (req, res) => {
  const tags = db.prepare(`
    SELECT t.name, COUNT(ct.contact_id) as count
    FROM tags t
    LEFT JOIN contact_tags ct ON t.id = ct.tag_id
    GROUP BY t.id
    ORDER BY count DESC, t.name ASC
  `).all();
  res.json(tags);
});

module.exports = router;
