import express from 'express';
import cors from 'cors';
import winston from 'winston';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { createOAuthClient, createAuthMiddleware, handleOAuthCallback, refreshToken } from './oauth.js';
import { ConversationalAuth } from './conversational-auth.js';
import { setupAuthRoutes } from './auth-routes.js';
import { setupMcpRoutes } from './mcp-routes.js';

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
    'https://www.googleapis.com/auth/script.scriptapp',
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
const conversationalAuth = new ConversationalAuth(CONFIG);

app.use(express.json({ limit: '10mb' }));
app.use(cors());

setupAuthRoutes(app, conversationalAuth, CONFIG, logger);

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

setupMcpRoutes(app, oauth2Client, tokenStore, auth, logger);

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
