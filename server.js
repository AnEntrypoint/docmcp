import express from 'express';
import cors from 'cors';
import winston from 'winston';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { createOAuthClient, createAuthMiddleware, handleOAuthCallback, refreshToken } from './oauth.js';
import * as docs from './docs.js';
import * as sheets from './sheets.js';

const app = express();
const PORT = process.env.PORT || 9998;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

const CONFIG = {
  oauth_client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
  oauth_client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  oauth_redirect_url: process.env.GOOGLE_OAUTH_REDIRECT_URL || 'http://localhost:9998/oauth/callback',
  jwt_secret: process.env.JWT_SECRET || 'change-me-in-production-12345678',
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
};

if (!CONFIG.oauth_client_id || !CONFIG.oauth_client_secret) {
  logger.error('Missing required OAuth configuration');
  process.exit(1);
}

const oauth2Client = createOAuthClient(CONFIG);
const tokenStore = new Map();
const auth = createAuthMiddleware(CONFIG.jwt_secret);

app.use(express.json({ limit: '10mb' }));
app.use(cors());

app.get('/oauth/authorize', async (req, res) => {
  const redirectUri = req.query.redirect_uri || CONFIG.oauth_redirect_url;
  const { OAuth2Client } = await import('google-auth-library');
  const tempClient = new OAuth2Client(
    CONFIG.oauth_client_id,
    CONFIG.oauth_client_secret,
    redirectUri
  );
  const authUrl = tempClient.generateAuthUrl({
    access_type: 'offline',
    scope: CONFIG.scopes,
    prompt: 'consent'
  });
  res.json({ auth_url: authUrl });
});

app.post('/oauth/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const { mcp_token, user } = await handleOAuthCallback(oauth2Client, code, tokenStore, CONFIG.jwt_secret);
    res.json({ mcp_token, user, token_expires_in: 86400 });
  } catch (err) {
    logger.error('OAuth callback', { error: err.message });
    res.status(400).json({ error: 'OAuth failed' });
  }
});

app.post('/oauth/refresh', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id || !tokenStore.has(user_id)) return res.status(400).json({ error: 'Invalid user_id' });

    const mcp_token = await refreshToken(oauth2Client, user_id, tokenStore, CONFIG.jwt_secret);
    res.json({ mcp_token, token_expires_in: 86400 });
  } catch (err) {
    logger.error('Token refresh', { error: err.message });
    res.status(400).json({ error: 'Refresh failed' });
  }
});

app.post('/mcp/docs/read', auth, async (req, res) => {
  try {
    const { doc_id } = req.body;
    if (!doc_id) return res.status(400).json({ error: 'doc_id required' });

    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    const content = await docs.readDocument(oauth2Client, doc_id);
    res.json({ doc_id, content });
  } catch (err) {
    logger.error('Read doc', { error: err.message });
    res.status(500).json({ error: 'Read failed' });
  }
});

app.post('/mcp/docs/edit', auth, async (req, res) => {
  try {
    const { doc_id, old_text, new_text } = req.body;
    if (!doc_id || !old_text || !new_text === undefined) return res.status(400).json({ error: 'Missing params' });

    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    await docs.editDocument(oauth2Client, doc_id, old_text, new_text);
    res.json({ doc_id, status: 'edited' });
  } catch (err) {
    logger.error('Edit doc', { error: err.message });
    res.status(500).json({ error: 'Edit failed' });
  }
});

app.post('/mcp/docs/insert', auth, async (req, res) => {
  try {
    const { doc_id, text, position } = req.body;
    if (!doc_id || !text) return res.status(400).json({ error: 'Missing params' });

    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    await docs.insertDocument(oauth2Client, doc_id, text, position || 'end');
    res.json({ doc_id, status: 'inserted' });
  } catch (err) {
    logger.error('Insert doc', { error: err.message });
    res.status(500).json({ error: 'Insert failed' });
  }
});

app.post('/mcp/sheets/read', auth, async (req, res) => {
  try {
    const { sheet_id, range = 'Sheet1' } = req.body;
    if (!sheet_id) return res.status(400).json({ error: 'sheet_id required' });

    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    const values = await sheets.readSheet(oauth2Client, sheet_id, range);
    res.json({ sheet_id, range, values });
  } catch (err) {
    logger.error('Read sheet', { error: err.message });
    res.status(500).json({ error: 'Read failed' });
  }
});

app.post('/mcp/sheets/edit', auth, async (req, res) => {
  try {
    const { sheet_id, range, values } = req.body;
    if (!sheet_id || !range || !values) return res.status(400).json({ error: 'Missing params' });

    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    await sheets.editSheet(oauth2Client, sheet_id, range, values);
    res.json({ sheet_id, range, status: 'edited' });
  } catch (err) {
    logger.error('Edit sheet', { error: err.message });
    res.status(500).json({ error: 'Edit failed' });
  }
});

app.post('/mcp/sheets/insert', auth, async (req, res) => {
  try {
    const { sheet_id, range = 'Sheet1', values } = req.body;
    if (!sheet_id || !values) return res.status(400).json({ error: 'Missing params' });

    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    await sheets.insertSheet(oauth2Client, sheet_id, range, values);
    res.json({ sheet_id, range, status: 'inserted' });
  } catch (err) {
    logger.error('Insert sheet', { error: err.message });
    res.status(500).json({ error: 'Insert failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - app.locals.startup) / 1000),
    users: tokenStore.size
  });
});

app.locals.startup = Date.now();
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  process.exit(0);
});
