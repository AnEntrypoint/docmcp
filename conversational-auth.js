import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'gcloud', 'docmcp');
const SESSION_DIR = path.join(CONFIG_DIR, 'sessions');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');

const sessions = new Map();

export class ConversationalAuth {
  constructor(config) {
    this.config = config;
  }

  createSession(clientPort = 0) {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const base = `http://127.0.0.1:${clientPort}`;
    const redirectUri = `${base}/oauth/callback`;

    const session = {
      id: sessionId,
      base,
      redirectUri,
      clientPort,
      createdAt: Date.now(),
      step: 'init',
      authUrl: null,
      code: null,
      tokens: null,
      error: null
    };

    sessions.set(sessionId, session);
    return sessionId;
  }

  getAuthUrl(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const client = new OAuth2Client(
      this.config.oauth_client_id,
      this.config.oauth_client_secret,
      session.redirectUri
    );

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent',
      state: sessionId
    });

    session.authUrl = authUrl;
    session.step = 'auth_url_generated';
    return authUrl;
  }

  handleCallback(sessionId, code, error) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (error) {
      session.error = error;
      session.step = 'error';
      return { error };
    }

    if (!code) {
      session.error = 'No authorization code received';
      session.step = 'error';
      return { error: 'No authorization code received' };
    }

    session.code = code;
    session.step = 'code_received';
    return { code, sessionId };
  }

  async exchangeCode(sessionId, code) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const client = new OAuth2Client(
      this.config.oauth_client_id,
      this.config.oauth_client_secret,
      session.redirectUri
    );

    try {
      const { tokens } = await client.getToken(code);
      session.tokens = tokens;
      session.step = 'tokens_acquired';

      this.storeTokens(tokens);
      return { tokens, sessionId };
    } catch (err) {
      session.error = err.message;
      session.step = 'exchange_error';
      throw err;
    }
  }

  storeTokens(tokens) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    fs.chmodSync(TOKEN_FILE, 0o600);
  }

  getSession(sessionId) {
    return sessions.get(sessionId);
  }

  listSessions() {
    return Array.from(sessions.values()).map(s => ({
      id: s.id,
      step: s.step,
      error: s.error,
      createdAt: s.createdAt,
      hasTokens: !!s.tokens
    }));
  }
}
