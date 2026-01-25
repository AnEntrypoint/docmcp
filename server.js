import express from 'express';
import cors from 'cors';
import winston from 'winston';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
};

if (!CONFIG.oauth_client_id || !CONFIG.oauth_client_secret) {
  logger.error('Missing required OAuth configuration. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.');
  process.exit(1);
}

const oauth2Client = new OAuth2Client(
  CONFIG.oauth_client_id,
  CONFIG.oauth_client_secret,
  CONFIG.oauth_redirect_url
);

const tokenStore = new Map();
const metrics = {
  requests: { total: 0, successful: 0, failed: 0 },
  oauth: { logins: 0, failures: 0 },
  uptime: Date.now()
};

app.use(express.json({ limit: '10mb' }));
app.use(cors());

const validateMCPToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid Authorization format' });
  }

  try {
    const decoded = jwt.verify(parts[1], CONFIG.jwt_secret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid token', { error: err.message });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/oauth/authorize', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CONFIG.scopes,
    prompt: 'consent'
  });
  res.json({ auth_url: authUrl });
});

app.post('/oauth/callback', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const userId = userInfo.data.id;

    tokenStore.set(userId, {
      access_token: accessToken,
      refresh_token: refreshToken,
      email: userInfo.data.email,
      name: userInfo.data.name,
      created_at: Date.now()
    });

    const mcp_token = jwt.sign(
      { userId, email: userInfo.data.email, name: userInfo.data.name },
      CONFIG.jwt_secret,
      { expiresIn: '24h' }
    );

    metrics.oauth.logins++;
    logger.info('User authenticated', { email: userInfo.data.email });

    res.json({
      mcp_token,
      user: {
        id: userId,
        email: userInfo.data.email,
        name: userInfo.data.name
      },
      token_expires_in: 86400
    });
  } catch (err) {
    metrics.oauth.failures++;
    logger.error('OAuth callback error', { error: err.message });
    res.status(400).json({ error: 'Failed to exchange authorization code' });
  }
});

app.post('/oauth/refresh', async (req, res) => {
  const { user_id } = req.body;

  if (!user_id || !tokenStore.has(user_id)) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  try {
    const stored = tokenStore.get(user_id);
    oauth2Client.setCredentials({ refresh_token: stored.refresh_token });

    const { credentials } = await oauth2Client.refreshAccessToken();
    stored.access_token = credentials.access_token;

    const mcp_token = jwt.sign(
      { userId: user_id, email: stored.email, name: stored.name },
      CONFIG.jwt_secret,
      { expiresIn: '24h' }
    );

    res.json({ mcp_token, token_expires_in: 86400 });
  } catch (err) {
    logger.error('Token refresh error', { error: err.message });
    res.status(400).json({ error: 'Failed to refresh token' });
  }
});

app.post('/mcp/tools/create-document', validateMCPToken, async (req, res) => {
  const { title, folder_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  try {
    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const docResponse = await docs.documents.create({
      requestBody: { title }
    });

    let resourceId = docResponse.data.documentId;

    if (folder_id) {
      await drive.files.update({
        fileId: resourceId,
        requestBody: { parents: [folder_id] },
        fields: 'parents'
      });
    }

    res.json({
      document_id: resourceId,
      title,
      url: `https://docs.google.com/document/d/${resourceId}/edit`
    });
  } catch (err) {
    logger.error('Document creation failed', { error: err.message, user: req.user.email });
    res.status(500).json({ error: 'Failed to create document' });
  }
});

app.post('/mcp/tools/create-sheet', validateMCPToken, async (req, res) => {
  const { title, folder_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  try {
    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: { properties: { title } }
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;

    if (folder_id) {
      await drive.files.update({
        fileId: spreadsheetId,
        requestBody: { parents: [folder_id] },
        fields: 'parents'
      });
    }

    res.json({
      spreadsheet_id: spreadsheetId,
      title,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    });
  } catch (err) {
    logger.error('Sheet creation failed', { error: err.message, user: req.user.email });
    res.status(500).json({ error: 'Failed to create sheet' });
  }
});

app.post('/mcp/tools/list-files', validateMCPToken, async (req, res) => {
  const { query, page_size = 10 } = req.body;

  try {
    const user = tokenStore.get(req.user.userId);
    oauth2Client.setCredentials({ access_token: user.access_token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const q = query || "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet'";

    const result = await drive.files.list({
      q,
      spaces: 'drive',
      pageSize: Math.min(page_size, 100),
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)'
    });

    res.json({ files: result.data.files || [] });
  } catch (err) {
    logger.error('File listing failed', { error: err.message, user: req.user.email });
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.get('/health', (req, res) => {
  metrics.requests.total++;
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - metrics.uptime) / 1000),
    timestamp: new Date().toISOString(),
    authentication: 'oauth2_required',
    active_users: tokenStore.size,
    metrics: {
      ...metrics,
      oauth_users_authenticated: tokenStore.size
    }
  });
});

app.listen(PORT, () => {
  logger.info(`DocMCP server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully');
  process.exit(0);
});
