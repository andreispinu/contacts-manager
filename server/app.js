require('dotenv').config();
const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', auth, require('./routes/contacts'));
app.use('/api/reminders', auth, require('./routes/reminders'));
app.use('/api/import', auth, require('./routes/import'));
app.use('/api/tags', auth, require('./routes/tags'));

module.exports = app;
