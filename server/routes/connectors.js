const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const pool = require('../database');
const auth = require('../middleware/auth');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/connectors/google/callback`
  );
}

// GET /api/connectors/google/auth — start OAuth flow
router.get('/google/auth', auth, (req, res) => {
  const state = jwt.sign({ userId: req.userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    state,
    prompt: 'consent',
  });
  res.json({ url });
});

// GET /api/connectors/google/callback — OAuth redirect
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || process.env.APP_URL || '';

  if (error) return res.redirect(`${clientUrl}/connectors?error=access_denied`);

  let userId;
  try {
    ({ userId } = jwt.verify(state, process.env.JWT_SECRET));
  } catch {
    return res.redirect(`${clientUrl}/connectors?error=invalid_state`);
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await pool.query(`
      INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, expires_at)
      VALUES ($1, 'google', $2, $3, $4)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, tokens.access_token, tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null]);

    res.redirect(`${clientUrl}/connectors?connected=google`);
  } catch (err) {
    res.redirect(`${clientUrl}/connectors?error=token_exchange`);
  }
});

// GET /api/connectors/status
router.get('/status', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT provider, updated_at FROM oauth_tokens WHERE user_id = $1',
      [req.userId]
    );
    const status = {};
    rows.forEach(r => { status[r.provider] = { connected: true, updated_at: r.updated_at }; });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/connectors/google/disconnect
router.delete('/google/disconnect', auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM oauth_tokens WHERE user_id = $1 AND provider = 'google'",
      [req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/connectors/google/calendar/sync
router.post('/google/calendar/sync', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM oauth_tokens WHERE user_id = $1 AND provider = 'google'",
      [req.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'Google Calendar not connected' });

    const tokenRow = rows[0];
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: tokenRow.access_token,
      refresh_token: tokenRow.refresh_token,
      expiry_date: tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : null,
    });

    // Persist refreshed tokens automatically
    oauth2Client.on('tokens', async (tokens) => {
      await pool.query(`
        UPDATE oauth_tokens SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3 AND provider = 'google'
      `, [tokens.access_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null, req.userId]);
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch events: past 12 months → next 3 months
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 1);
    const timeMax = new Date();
    timeMax.setMonth(timeMax.getMonth() + 3);

    let allEvents = [];
    let pageToken = null;
    do {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        pageToken: pageToken || undefined,
      });
      allEvents = allEvents.concat(response.data.items || []);
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    // Only events with 2+ attendees
    const meetingEvents = allEvents.filter(e =>
      e.attendees && e.attendees.length >= 2 && e.status !== 'cancelled'
    );

    let matched = 0, skipped = 0;

    for (const event of meetingEvents) {
      const eventDate = (event.start?.date || event.start?.dateTime || '').split('T')[0];
      if (!eventDate) continue;

      const externalId = `gcal:${event.id}`;
      const title = event.summary || 'Meeting';

      // Attendees excluding the calendar owner (self)
      const others = (event.attendees || []).filter(a => !a.self && !a.resource);

      for (const attendee of others) {
        if (!attendee.email) { skipped++; continue; }

        const { rows: contacts } = await pool.query(
          'SELECT id FROM contacts WHERE LOWER(email) = LOWER($1) AND user_id = $2',
          [attendee.email, req.userId]
        );

        if (!contacts.length) { skipped++; continue; }

        const contactId = contacts[0].id;

        // Skip if already synced
        const { rows: existing } = await pool.query(
          'SELECT id FROM interactions WHERE contact_id = $1 AND external_id = $2',
          [contactId, externalId]
        );
        if (existing.length) continue;

        const otherNames = others
          .filter(a => a.email !== attendee.email)
          .map(a => a.displayName || a.email)
          .join(', ');
        const notes = otherNames ? `${title} · Also with: ${otherNames}` : title;

        await pool.query(
          `INSERT INTO interactions (contact_id, type, date, notes, source, external_id)
           VALUES ($1, 'Meeting', $2, $3, 'google_calendar', $4)`,
          [contactId, eventDate, notes, externalId]
        );

        await pool.query(`
          UPDATE contacts SET last_contacted = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND (last_contacted IS NULL OR last_contacted < $1)
        `, [eventDate, contactId]);

        matched++;
      }
    }

    res.json({
      total_events: meetingEvents.length,
      matched,
      skipped,
    });
  } catch (err) {
    if (err.code === 401 || err.message?.includes('invalid_grant')) {
      return res.status(401).json({ error: 'Google token expired. Please reconnect.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
