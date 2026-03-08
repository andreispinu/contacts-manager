require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/import', require('./routes/import'));
app.use('/api/tags', require('./routes/tags'));

module.exports = app;
