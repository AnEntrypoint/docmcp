#!/usr/bin/env node

import http from 'http';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { google } from 'googleapis';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from 'google-auth-library';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS } from './tools-docs.js';
import { SHEETS_TOOLS, SCRIPTS_TOOLS } from './tools-sheets.js';
import { GMAIL_TOOLS } from './tools-gmail.js';
import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';
import { enrichToolsForApps } from './apps-metadata.js';
import { listStaticResources, listResourceTemplates, readPublicResource, readResource } from './mcp-resources.js';

// AsyncLocalStorage for session context
const sessionContext = new AsyncLocalStorage();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'gcloud', 'docmcp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const TOKEN_PATH = path.join(CONFIG_DIR, 'token.json');
const ADC_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'gcloud', 'application_default_credentials.json');
const ENABLE_DEBUG_ENDPOINTS = process.env.ENABLE_DEBUG_ENDPOINTS === '1';
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];

function parseBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;
  const m = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Auto-detect redirect URI and CORS origin from Coolify or environment
function getRedirectUri(host, port) {
  // Priority: explicit env var > Coolify URL > constructed URL
  if (process.env.REDIRECT_URI) return process.env.REDIRECT_URI;
  if (process.env.COOLIFY_URL) return `${process.env.COOLIFY_URL}/auth/callback`;
  if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}/auth/callback`;
  return `http://${host}:${port}/auth/callback`;
}

function getCorsOrigin(host, port) {
  // Priority: explicit env var > Coolify URL > constructed URL > wildcard
  if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN;
  if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;
  if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}`;
  if (host === '0.0.0.0' || host === '127.0.0.1') return '*';
  return `http://${host}:${port}`;
}

const SESSION_FILE = process.env.SESSION_FILE || (() => {
  try {
    fs.mkdirSync('/data', { recursive: true });
    return '/data/sessions.json';
  } catch (e) {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), 'sessions.json');
  }
})();

class AuthenticatedHTTPServer {
  constructor(options = {}) {
    this.port = options.port || 3333;
    this.host = options.host || '127.0.0.1';
    this.sessionMap = new Map();
    this.oAuth2Client = null;
    this.credentials = null;
    this.userAuthMap = new Map();
    this.staticAuthMap = new Map();
    this.serverAuthClient = null;
    this.staticBearerTokens = new Set(
      String(process.env.DOCMCP_BEARER_TOKENS || process.env.DOCMCP_BEARER_TOKEN || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    );
    this.sseStreams = new Map();
    this.loadSessions();
    this.reconstructAuthClients();
    this.initializeExpress();
    this.initializeRoutes();
    this.initializeMcpServer();
  }

  loadSessions() {
    try {
      if (!fs.existsSync(SESSION_FILE)) return;
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      for (const [id, session] of Object.entries(data)) {
        this.sessionMap.set(id, session);
      }
      console.log(`[sessions] Loaded ${this.sessionMap.size} sessions from ${SESSION_FILE}`);
    } catch (err) {
      console.error('[sessions] Failed to load sessions:', err.message);
    }
  }

  saveSessions() {
    try {
      const dir = path.dirname(SESSION_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {};
      for (const [id, session] of this.sessionMap.entries()) {
        data[id] = session;
      }
      fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[sessions] Failed to save sessions:', err.message);
    }
  }

  setSession(id, session) {
    this.sessionMap.set(id, session);
    this.saveSessions();
  }

  reconstructAuthClients() {
    for (const [id, session] of this.sessionMap.entries()) {
      if (session.status === 'authenticated' && session.tokens && !this.userAuthMap.has(id)) {
        try {
          const client = this.createOAuth2Client();
          client.setCredentials(session.tokens);
          this.userAuthMap.set(id, client);
        } catch (err) {
          console.error(`[sessions] Failed to reconstruct auth client for ${id}:`, err.message);
        }
      }
    }
  }

  initializeExpress() {
    this.app = express();
    this.app.set('trust proxy', true);
    this.corsOrigin = getCorsOrigin(this.host, this.port);
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'mcp-session-id', 'mcp-protocol-version'],
      exposedHeaders: ['mcp-session-id'],
      credentials: false
    }));
    this.app.use(express.json({ limit: '4mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use('/mcp', (req, res, next) => {
      // Keep streamable MCP responses proxy-safe and decode-safe.
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      next();
    });

    this.app.use((req, res, next) => {
      console.log('[REQ]', req.method, req.path);
      next();
    });
  }

  initializeRoutes() {
    // Session context middleware - extract and validate session ID
    const sessionContextMiddleware = (req, res, next) => {
      // Extract session ID from Bearer token, URL params, query params, or headers
      let sessionId = req.params.sessionId || req.query.sessionId || req.query.token || req.headers['x-session-id'] || req.headers['mcp-session-id'];
      const bearerToken = parseBearerToken(req.headers.authorization);
      if (!sessionId && bearerToken) {
        sessionId = bearerToken;
      }

      // Static bearer token mode for non-OAuth client connectivity.
      if (bearerToken && this.staticBearerTokens.has(bearerToken)) {
        sessionId = this.getStaticSessionId(bearerToken);
        req.staticBearerToken = bearerToken;
      }

      // Attach to request for downstream handlers
      req.sessionId = sessionId;
      next();
    };

    // OAuth protected resource discovery (RFC 9728) - ChatGPT probes this
    this.app.get('/.well-known/oauth-protected-resource', (req, res) => {
      const base = this.getBaseUrl(req) || `https://${req.hostname}`;
      res.json({
        resource: base,
        authorization_servers: [`${base}/.well-known/oauth-authorization-server`],
        bearer_methods_supported: ['header'],
        resource_documentation: `${base}/login`
      });
    });

    // OAuth authorization server metadata (RFC 8414) - for clients that follow discovery
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      const base = this.getBaseUrl(req) || `https://${req.hostname}`;
      res.json({
        issuer: base,
        authorization_endpoint: `${base}/login`,
        token_endpoint: `${base}/oauth/token`,
        registration_endpoint: `${base}/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: ['none'],
        scopes_supported: ['drive', 'documents', 'spreadsheets', 'script.projects', 'gmail.modify', 'gmail.settings.basic']
      });
    });

    // Debug: inspect session states (disabled by default)
    this.app.get('/debug/sessions', (req, res) => {
      if (!ENABLE_DEBUG_ENDPOINTS) {
        return res.status(404).json({ error: 'Not found' });
      }
      const sessions = [];
      for (const [id, s] of this.sessionMap.entries()) {
        sessions.push({ id, status: s.status, createdAt: s.createdAt, clientRedirectUri: s.clientRedirectUri, clientState: s.clientState });
      }
      res.json({ count: sessions.length, sessions });
    });

    // Health check
    this.app.get('/', (req, res) => {
      res.json({
        status: 'ok',
        service: 'docmcp-http-server',
        version: '1.0.0',
        description: 'Google Workspace MCP Server with OAuth authentication',
        endpoints: {
          login: '/login (GET) - Start OAuth flow',
          auth_callback: '/auth/callback (GET) - OAuth callback endpoint',
          auth_token: '/auth/token (POST) - API token authentication for CLI/tools',
          mcp: '/mcp (ALL) - Streamable HTTP transport endpoint',
          status: '/status (GET) - Server status'
        },
        quick_start: {
          browser_users: 'GET /login - Authenticate and automatically connect to /mcp',
          api_clients: 'POST /auth/token with Google OAuth code, then connect to /mcp with sessionId',
          chatgpt: '1) Enable Developer Mode in ChatGPT, 2) Add app using /mcp, 3) Complete OAuth when prompted'
        },
        activeSessions: this.sessionMap.size,
        activeConnections: this.sseStreams.size
      });
    });

    // Server status
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'running',
        activeSessions: this.sessionMap.size,
        activeConnections: this.sseStreams.size,
        uptime: process.uptime()
      });
    });

    // Authentication routes
    this.app.get('/login', (req, res) => this.handleLogin(req, res));
    this.app.get('/auth/callback', (req, res) => this.handleCallback(req, res));

    // API token authentication - for CLI/programmatic access
    this.app.post('/auth/token', express.json(), (req, res) => this.handleTokenAuth(req, res));

    // Refresh token injection - create authenticated session from refresh_token
    this.app.post('/auth/refresh', express.json(), (req, res) => this.handleRefreshAuth(req, res));

    // OAuth token endpoint - ChatGPT exchanges code for access_token
    this.app.post('/oauth/token', express.urlencoded({ extended: true }), express.json(), (req, res) => this.handleOAuthToken(req, res));

    // Dynamic Client Registration (RFC 7591) - ChatGPT registers itself before OAuth flow
    this.app.post('/register', express.json(), (req, res) => this.handleDynamicRegistration(req, res));

    // Return current session token - useful for programmatic access after browser login
    this.app.get('/mcp/token', sessionContextMiddleware, (req, res) => {
      const sessionId = req.sessionId;
      if (!sessionId || !this.sessionMap.has(sessionId) || this.sessionMap.get(sessionId)?.status !== 'authenticated') {
        return res.status(401).json({ error: 'Not authenticated. Visit /login first.' });
      }
      const base = this.getBaseUrl(req) || getCorsOrigin(req.get('host'), this.port);
      res.json({ token: sessionId, mcp_url: `${base}/mcp`, mcp_url_with_token: `${base}/mcp?token=${sessionId}` });
    });

    // Streamable HTTP transport endpoint
    this.app.all('/mcp', sessionContextMiddleware, (req, res) => this.handleStreamableHttpConnection(req, res));

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('HTTP Server Error:', err);
      res.status(500).json({ error: 'Internal server error', message: err.message });
    });
  }

  initializeMcpServer() {
    this.server = new Server(
      { name: 'docmcp', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    );

    const TOOLS = enrichToolsForApps([
      ...DOCS_TOOLS,
      ...SECTION_TOOLS,
      ...MEDIA_TOOLS,
      ...DRIVE_TOOLS,
      ...SHEETS_TOOLS,
      ...SCRIPTS_TOOLS,
      ...GMAIL_TOOLS
    ]);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Get session ID from AsyncLocalStorage context
        const sessionId = sessionContext.getStore();
        if (!sessionId) {
          throw new Error('Session not found. Please authenticate first.');
        }

        const auth = await this.getUserAuth(sessionId);
        if (!auth) {
          throw new Error('Session expired or not found. Please re-authenticate at https://docmcp.acc.l-inc.co.za/login');
        }

        const docsResult = await handleDocsToolCall(name, args, auth);
        if (docsResult) return docsResult;

        const sheetsResult = await handleSheetsToolCall(name, args, auth);
        if (sheetsResult) return sheetsResult;

        const gmailResult = await handleGmailToolCall(name, args, auth);
        if (gmailResult) return gmailResult;

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        console.error(`[tool:${name}] Error:`, err.message, err.stack?.split('\n')[1]?.trim());
        return {
          content: [{ type: 'text', text: `Error calling ${name}: ${err.message}` }],
          isError: true
        };
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: listStaticResources()
    }));

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: listResourceTemplates()
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const sessionId = sessionContext.getStore();
        if (!sessionId) throw new Error('Session not found. Please authenticate first.');
        const auth = await this.getUserAuth(sessionId);
        if (!auth) throw new Error('Session expired or not found. Please re-authenticate.');
        return await readResource(auth, request.params.uri);
      } catch (err) {
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/plain',
              text: `Error reading resource: ${err.message}`
            }
          ]
        };
      }
    });

    console.log('MCP server initialized with', TOOLS.length, 'tools');
  }

  async loadCredentials() {
    // Check environment variables first
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (clientId && clientSecret) {
      this.credentials = {
        installed: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uris: [getRedirectUri(this.host, this.port)]
        }
      };
      return;
    }

    // Check config file
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      this.credentials = config.installed || config.web;
      return;
    }

    throw new Error('Google OAuth credentials not found. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.');
  }

  createOAuth2Client() {
    const { client_id, client_secret } = this.credentials.installed || this.credentials.web;
    return new google.auth.OAuth2(
      client_id,
      client_secret,
      getRedirectUri(this.host, this.port)
    );
  }

  async getUserAuth(sessionId) {
    const session = this.sessionMap.get(sessionId);
    if (!session || session.status !== 'authenticated') {
      return null;
    }

    if (!session.tokens) {
      console.warn(`[auth] Session ${sessionId} has no tokens - likely wiped by deploy`);
      return null;
    }

    // Reuse existing auth client
    if (this.userAuthMap.has(sessionId)) {
      return this.userAuthMap.get(sessionId);
    }

    if (!this.credentials) {
      console.warn(`[auth] Cannot reconstruct auth client for ${sessionId} - credentials not loaded yet`);
      return null;
    }

    // Create new auth client with user's tokens
    const oAuth2Client = this.createOAuth2Client();
    oAuth2Client.setCredentials(session.tokens);
    this.userAuthMap.set(sessionId, oAuth2Client);
    return oAuth2Client;
  }

  getStaticSessionId(bearerToken) {
    const digest = crypto.createHash('sha256').update(bearerToken).digest('hex').slice(0, 16);
    return `static_${digest}`;
  }

  isStaticSessionId(sessionId) {
    return typeof sessionId === 'string' && sessionId.startsWith('static_');
  }

  isAuthenticatedSession(sessionId) {
    if (!sessionId) return false;
    if (this.isStaticSessionId(sessionId)) return true;
    return this.sessionMap.get(sessionId)?.status === 'authenticated';
  }

  async getServerAuth() {
    if (this.serverAuthClient) return this.serverAuthClient;

    const useAdc = process.env.DOCMCP_USE_ADC === '1' || process.env.GOOGLE_APPLICATION_CREDENTIALS || fs.existsSync(ADC_PATH);
    if (useAdc) {
      const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
      this.serverAuthClient = await auth.getClient();
      return this.serverAuthClient;
    }

    if (!fs.existsSync(TOKEN_PATH)) {
      throw new Error('No server auth available. Configure ADC or token.json.');
    }

    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    const cfg = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || cfg?.client_id || tokens.client_id;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || cfg?.client_secret || tokens.client_secret;
    if (!clientId || !clientSecret) {
      throw new Error('token.json exists but OAuth client credentials are missing.');
    }

    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials(tokens);
    this.serverAuthClient = client;
    return this.serverAuthClient;
  }

  async handleLogin(req, res) {
    try {
      await this.loadCredentials();
      this.oAuth2Client = this.createOAuth2Client();

      const sessionId = crypto.randomBytes(16).toString('hex');
      const state = sessionId;

      const authUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: state,
        prompt: 'consent'
      });

      // Store OAuth client redirect_uri, state, and PKCE params if provided (ChatGPT OAuth flow)
      const clientRedirectUri = req.query.redirect_uri || null;
      const clientState = req.query.state || null;
      const codeChallenge = req.query.code_challenge || null;
      const codeChallengeMethod = req.query.code_challenge_method || null;

      // Create session
      this.setSession(sessionId, {
        state: state,
        createdAt: Date.now(),
        status: 'authenticating',
        clientRedirectUri,
        clientState,
        codeChallenge,
        codeChallengeMethod
      });

      console.log(`Created session: ${sessionId}`);

      // For remote hosting, don't open browser automatically
      if (this.host === '127.0.0.1' || this.host === 'localhost') {
        await open(authUrl);
      }

      // Return HTML response with proper login page
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>docmcp - Google Workspace Login</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                
                .logo {
                    font-size: 48px;
                    font-weight: bold;
                    color: #667eea;
                    margin-bottom: 20px;
                }
                
                .title {
                    font-size: 28px;
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .subtitle {
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 40px;
                    line-height: 1.5;
                }
                
                .google-login-button {
                    background: #4285F4;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    font-size: 16px;
                    font-weight: bold;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    text-decoration: none;
                }
                
                .google-login-button:hover {
                    background: #3367D6;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(66, 133, 244, 0.4);
                }
                
                .google-login-button:active {
                    transform: translateY(0);
                }
                
                .google-icon {
                    font-size: 20px;
                }
                
                .session-info {
                    margin-top: 30px;
                    padding: 20px;
                    background: #f5f7fa;
                    border-radius: 10px;
                    font-size: 14px;
                    color: #555;
                }
                
                .session-info code {
                    background: #e8e8e8;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #333;
                }
                
                .features {
                    margin-top: 30px;
                    text-align: left;
                }
                
                .features h3 {
                    font-size: 16px;
                    color: #333;
                    margin-bottom: 15px;
                }
                
                .features ul {
                    list-style: none;
                    padding: 0;
                }
                
                .features li {
                    padding: 8px 0;
                    color: #666;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .features li::before {
                    content: "✓";
                    color: #4CAF50;
                    font-weight: bold;
                    font-size: 18px;
                }
                
                @media (max-width: 600px) {
                    .container {
                        padding: 30px 20px;
                    }
                    
                    .title {
                        font-size: 24px;
                    }
                    
                    .subtitle {
                        font-size: 14px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">📄</div>
                <h1 class="title">docmcp</h1>
                <p class="subtitle">Connect Google Workspace, then add this server to ChatGPT as an MCP app.</p>
                
                <a href="${authUrl}" class="google-login-button">
                    <span class="google-icon">🔐</span>
                    Sign in with Google
                </a>
                
                <div class="session-info">
                    <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
                    <p style="margin-top: 10px; font-size: 12px; color: #999;">
                        You will be redirected to Google sign-in. After approval, return here for exact MCP setup steps.
                    </p>
                </div>
                
                <div class="features">
                    <h3>What happens next:</h3>
                    <ul>
                        <li>Sign in with Google and grant access</li>
                        <li>Copy MCP connection details from the success page</li>
                        <li>Add an app in ChatGPT Developer Mode using <code>/mcp</code></li>
                        <li>Use Docs, Sheets, Gmail, and Apps Script tools</li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        message: error.message
      });
    }
  }

  async handleCallback(req, res) {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Authentication Error:', error);
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>docmcp - Authentication Error</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                .error-icon { font-size: 80px; color: #f44336; margin-bottom: 20px; }
                .title { font-size: 28px; color: #333; margin-bottom: 10px; }
                .subtitle { font-size: 16px; color: #666; margin-bottom: 30px; line-height: 1.5; }
                .error-details { background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left; }
                .error-details pre { font-size: 12px; color: #c62828; margin: 0; }
                .back-button { background: #667eea; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-block; transition: background 0.3s; }
                .back-button:hover { background: #5a6fd8; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">❌</div>
                <h1 class="title">Authentication Canceled</h1>
                <p class="subtitle">You canceled the authentication process</p>
                <div class="error-details">
                    <pre>${error}</pre>
                </div>
                <a href="/login" class="back-button">Try Again</a>
            </div>
        </body>
        </html>
      `);
    }

    if (!code || !state) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>docmcp - Invalid Request</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                .error-icon { font-size: 80px; color: #f44336; margin-bottom: 20px; }
                .title { font-size: 28px; color: #333; margin-bottom: 10px; }
                .subtitle { font-size: 16px; color: #666; margin-bottom: 30px; line-height: 1.5; }
                .back-button { background: #667eea; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-block; transition: background 0.3s; }
                .back-button:hover { background: #5a6fd8; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">⚠️</div>
                <h1 class="title">Invalid Request</h1>
                <p class="subtitle">Missing code or state parameter</p>
                <a href="/login" class="back-button">Try Again</a>
            </div>
        </body>
        </html>
      `);
    }

    const session = this.sessionMap.get(state);
    if (!session) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>docmcp - Invalid Session</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                .error-icon { font-size: 80px; color: #f44336; margin-bottom: 20px; }
                .title { font-size: 28px; color: #333; margin-bottom: 10px; }
                .subtitle { font-size: 16px; color: #666; margin-bottom: 30px; line-height: 1.5; }
                .back-button { background: #667eea; color: white; border: none; padding: 15px 30px; font-size: 16px; border-radius: 8px; cursor: pointer; text-decoration: none; display: inline-block; transition: background 0.3s; }
                .back-button:hover { background: #5a6fd8; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">⏰</div>
                <h1 class="title">Session Expired</h1>
                <p class="subtitle">Session not found or has expired</p>
                <a href="/login" class="back-button">Try Again</a>
            </div>
        </body>
        </html>
      `);
    }

    try {
      await this.loadCredentials();
      const callbackClient = this.createOAuth2Client();
      const { tokens } = await callbackClient.getToken(code);

      // Update session with user's tokens
      session.status = 'authenticated';
      session.tokens = tokens;
      session.updatedAt = Date.now();
      this.setSession(state, session);

      console.log(`Session authenticated: ${state}`);

      // If client provided redirect_uri (e.g. ChatGPT OAuth flow), redirect back with code
      if (session.clientRedirectUri) {
        const params = new URLSearchParams({ code: state });
        if (session.clientState) params.set('state', session.clientState);
        return res.redirect(`${session.clientRedirectUri}?${params.toString()}`);
      }

      // Show success page with sessionId so user can copy it for ChatGPT
      const baseUrl = getCorsOrigin(req.get('host'), this.port);
      const mcpUrl = `${baseUrl}/mcp`;
      const mcpTokenUrl = `${baseUrl}/mcp?token=${state}`;
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>docmcp - Authenticated</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }
                .container { background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 600px; width: 100%; text-align: center; }
                .success-icon { font-size: 64px; margin-bottom: 20px; }
                .title { font-size: 28px; color: #333; margin-bottom: 10px; }
                .subtitle { font-size: 16px; color: #666; margin-bottom: 30px; line-height: 1.5; }
                .token-box { background: #f0f4ff; border: 2px solid #667eea; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left; }
                .token-box label { font-size: 12px; font-weight: bold; color: #667eea; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px; }
                .token-val { font-family: 'Courier New', monospace; font-size: 13px; color: #333; background: white; border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; word-break: break-all; cursor: pointer; user-select: all; }
                .copy-btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 10px; width: 100%; transition: background 0.2s; }
                .copy-btn:hover { background: #5a6fd8; }
                .steps { background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left; }
                .steps h3 { font-size: 15px; font-weight: bold; color: #333; margin-bottom: 4px; }
                .steps .hint { font-size: 12px; color: #888; margin-bottom: 12px; }
                .steps ol { padding-left: 18px; }
                .steps li { font-size: 14px; color: #555; padding: 5px 0; line-height: 1.4; }
                .steps code { background: #e8e8e8; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
                .steps strong { color: #333; }
                .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
                .mcp-btn { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold; margin-top: 10px; transition: background 0.2s; }
                .mcp-btn:hover { background: #43a047; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">&#x2705;</div>
                <h1 class="title">Authenticated!</h1>
                <p class="subtitle">Your Google account is connected. Use the options below to connect MCP clients.</p>

                <div class="token-box">
                    <label>API Token (your session key)</label>
                    <div class="token-val" id="sid">${state}</div>
                    <button class="copy-btn" onclick="copy('sid', this, 'Copy API Token')">Copy API Token</button>
                </div>

                <div class="token-box" style="border-color:#4CAF50;background:#f0fff4;">
                    <label style="color:#4CAF50;">MCP URL with token embedded</label>
                    <div class="token-val" id="mcpurl">${mcpTokenUrl}</div>
                    <button class="copy-btn" style="background:#4CAF50;" onclick="copy('mcpurl', this, 'Copy MCP URL')">Copy MCP URL</button>
                </div>

                <div class="steps">
                    <h3>ChatGPT app setup (recommended)</h3>
                    <p class="hint">Best practice: use OAuth with the clean MCP endpoint.</p>
                    <ol>
                        <li>In ChatGPT, enable Developer Mode in <strong>Settings &rarr; Apps &amp; Connectors &rarr; Advanced settings</strong>.</li>
                        <li>Create a new app and set MCP URL to <code>${mcpUrl}</code>.</li>
                        <li>Choose OAuth authentication, then complete sign-in when prompted.</li>
                        <li>After saving, refresh/reopen the app if tools were recently updated.</li>
                    </ol>
                </div>

                <hr class="divider">

                <div class="steps">
                    <h3>Manual token mode (advanced)</h3>
                    <p class="hint">For clients that only support static Bearer tokens.</p>
                    <ol>
                        <li>Use MCP endpoint: <code>${mcpUrl}</code>.</li>
                        <li>Add header: <code>Authorization: Bearer ${state}</code>.</li>
                        <li>Or use embedded token URL: <code>${mcpTokenUrl}</code>.</li>
                    </ol>
                </div>

                <a href="/mcp?token=${state}" class="mcp-btn">Test MCP connection</a>
            </div>
            <script>
                function copy(id, btn, label) {
                    navigator.clipboard.writeText(document.getElementById(id).textContent.trim()).then(() => {
                        btn.textContent = 'Copied!';
                        btn.style.background = '#4CAF50';
                        setTimeout(() => { btn.textContent = label; btn.style.background = btn.dataset.orig || ''; }, 2000);
                    });
                }
            </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Token Exchange Error:', error);
      res.status(500).json({
        success: false,
        error: 'Token exchange failed',
        message: error.message
      });
    }
  }

  async handleTokenAuth(req, res) {
    try {
      const { code, state } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Missing authorization code',
          message: 'OAuth authorization code is required. Redirect user to /login first.',
          instructions: [
            'Step 1: Redirect user to GET /login',
            'Step 2: User authenticates with Google and receives sessionId',
            'Step 3: For programmatic access, exchange code for session using this endpoint'
          ]
        });
      }

      // Exchange authorization code for tokens (same as browser callback)
      await this.loadCredentials();
      this.oAuth2Client = this.createOAuth2Client();

      const { tokens } = await this.oAuth2Client.getToken(code);

      // Create authenticated session
      const sessionId = crypto.randomBytes(16).toString('hex');

      this.setSession(sessionId, {
        status: 'authenticated',
        tokens: tokens,
        createdAt: Date.now(),
        authMethod: 'oauth_code_exchange',
        source: 'external_client'
      });

      // Create auth client with tokens
      const oAuth2Client = this.createOAuth2Client();
      oAuth2Client.setCredentials(tokens);
      this.userAuthMap.set(sessionId, oAuth2Client);

      console.log(`OAuth-authenticated session created for external client: ${sessionId}`);

      res.json({
        success: true,
        message: 'OAuth authentication successful',
        sessionId: sessionId,
        mcp_endpoint: '/mcp',
        credentials: {
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type
        },
        instructions: [
          `1. Use sessionId in subsequent requests`,
          `2. Connect to MCP endpoint: GET /mcp?sessionId=${sessionId}`,
          `3. Transport: Streamable HTTP (supports Claude, ChatGPT, and other MCP clients)`,
          `4. You are ready to use 52+ Google Workspace tools`
        ]
      });
    } catch (error) {
      console.error('OAuth Code Exchange Error:', error);
      res.status(500).json({
        success: false,
        error: 'OAuth code exchange failed',
        message: error.message,
        resolution: 'Ensure authorization code is valid and not expired (codes expire after 10 minutes)'
      });
    }
  }

  async handleOAuthToken(req, res) {
    const { code, grant_type, refresh_token } = req.body;
    console.log(
      '[OAUTH/TOKEN] grant_type=%s has_code=%s has_refresh_token=%s sessionMapSize=%d',
      grant_type,
      Boolean(code),
      Boolean(refresh_token),
      this.sessionMap.size
    );

    if (grant_type === 'refresh_token' && refresh_token) {
      const session = this.sessionMap.get(refresh_token);
      if (!session || session.status !== 'authenticated') {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token not found or session not authenticated' });
      }
      return res.json({ access_token: refresh_token, token_type: 'bearer', expires_in: 86400 * 30, refresh_token });
    }

    if (grant_type !== 'authorization_code' || !code) {
      return res.status(400).json({ error: 'invalid_request', error_description: `Expected grant_type=authorization_code and code, got grant_type=${grant_type}` });
    }
    const session = this.sessionMap.get(code);
    console.log('[OAUTH/TOKEN] session lookup found=%s status=%s', !!session, session?.status);
    if (!session || session.status !== 'authenticated') {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Code not found or session not authenticated' });
    }

    // PKCE verification: if session stored a code_challenge, verify the code_verifier
    const { code_verifier } = req.body;
    if (session.codeChallenge) {
      if (!code_verifier) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required for PKCE' });
      }
      const method = session.codeChallengeMethod || 'S256';
      let computed;
      if (method === 'S256') {
        computed = crypto.createHash('sha256').update(code_verifier).digest('base64url');
      } else {
        computed = code_verifier;
      }
      if (computed !== session.codeChallenge) {
        console.log('[OAUTH/TOKEN] PKCE mismatch');
        return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier does not match code_challenge' });
      }
      console.log('[OAUTH/TOKEN] PKCE verified ok');
    }

    res.json({ access_token: code, token_type: 'bearer', expires_in: 86400 * 30, refresh_token: code });
  }

  handleDynamicRegistration(req, res) {
    const { client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method } = req.body || {};
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris is required' });
    }
    const clientId = crypto.randomBytes(16).toString('hex');
    console.log('[DCR] Registered client_id=%s name=%s redirect_uris=%j', clientId, client_name, redirect_uris);
    res.status(201).json({
      client_id: clientId,
      client_name: client_name || 'mcp-client',
      redirect_uris,
      grant_types: grant_types || ['authorization_code'],
      response_types: response_types || ['code'],
      token_endpoint_auth_method: token_endpoint_auth_method || 'none'
    });
  }

  async handleRefreshAuth(req, res) {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ success: false, error: 'refresh_token required' });
      }
      await this.loadCredentials();
      const oAuth2Client = this.createOAuth2Client();
      oAuth2Client.setCredentials({ refresh_token });
      const { credentials } = await oAuth2Client.refreshAccessToken();
      const sessionId = crypto.randomBytes(16).toString('hex');
      this.setSession(sessionId, { status: 'authenticated', tokens: credentials, createdAt: Date.now(), authMethod: 'refresh_token' });
      const authClient = this.createOAuth2Client();
      authClient.setCredentials(credentials);
      this.userAuthMap.set(sessionId, authClient);
      console.log(`Refresh-token session created: ${sessionId}`);
      res.json({ success: true, sessionId, mcp_endpoint: `/mcp?sessionId=${sessionId}` });
    } catch (error) {
      console.error('Refresh Auth Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  sendMcpError(req, res, status, error, loginUrl) {
    if (res.headersSent) return;
    const data = { error };
    if (loginUrl) data.login_url = loginUrl;

    const accept = String(req?.headers?.accept || '').toLowerCase();
    // Streamable HTTP MCP clients frequently expect JSON responses for request/response
    // calls and can fail hard on SSE-formatted error bodies.
    if (accept.includes('application/json') || req?.method === 'POST') {
      const body = req?.body || {};
      const reqId = Object.prototype.hasOwnProperty.call(body, 'id') ? body.id : null;
      const mcpMethod = typeof body?.method === 'string' ? body.method : null;
      // Use JSON-RPC envelope for MCP POST requests so strict clients can decode.
      if (mcpMethod || body?.jsonrpc === '2.0') {
        const errorCode = status === 401 ? -32001 : -32603;
        res.status(status).set({
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }).json({
          jsonrpc: '2.0',
          id: reqId,
          error: {
            code: errorCode,
            message: error,
            data
          }
        });
        return;
      }
      res.status(status).set({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }).json(data);
      return;
    }

    res.status(status).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: error\ndata: ${JSON.stringify(data)}\n\n`);
    res.end();
  }

  getBaseUrl(req = null) {
    if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
    if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;
    if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}`;
    if (req) {
      const fProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
      const fHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
      if (fProto && fHost) return `${fProto}://${fHost}`;
      const proto = req.protocol || 'http';
      const host = req.get('host');
      if (host) return `${proto}://${host}`;
    }
    return '';
  }

  async handleStreamableHttpConnection(req, res) {
    const sessionId = req.sessionId;

    try {
      if (!this.serverMap) this.serverMap = new Map();
      if (!this.transportMap) this.transportMap = new Map();
      if (!this.isAuthenticatedSession(sessionId)) {
        const base = this.getBaseUrl(req);
        res.set('WWW-Authenticate', `Bearer realm="${base}", resource_metadata="${base}/.well-known/oauth-protected-resource"`);
        return this.sendMcpError(
          req,
          res,
          401,
          'Authentication required. Use OAuth /login or provide Authorization: Bearer <token>.',
          `${base}/login`
        );
      }

      const isReInit = (req.body || {}).method === 'initialize' && this.transportMap.has(sessionId);
      if (isReInit) {
        const old = this.transportMap.get(sessionId);
        this.transportMap.delete(sessionId);
        this.serverMap.delete(sessionId);
        old.close().catch(() => {});
      }

      if (!this.transportMap.has(sessionId)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
          enableJsonResponse: true
        });
        const server = this.isStaticSessionId(sessionId) ? this.buildStaticMcpServer(sessionId) : this.buildMcpServer(sessionId);
        await server.connect(transport);
        transport.onclose = () => {
          server.close().catch(() => {});
          this.transportMap?.delete(sessionId);
          this.serverMap?.delete(sessionId);
        };
        this.transportMap.set(sessionId, transport);
        this.serverMap.set(sessionId, server);
      }

      if (!req.headers['mcp-session-id']) {
        req.headers['mcp-session-id'] = sessionId;
        req.rawHeaders.push('mcp-session-id', sessionId);
      }

      await this.transportMap.get(sessionId).handleRequest(req, res, req.body);
      return;

    } catch (error) {
      console.error('Streamable HTTP Connection Error:', error);
      this.sendMcpError(req, res, 500, `Connection failed: ${error.message}`);
    }
  }

  buildUnauthMcpServer(baseUrl) {
    const TOOLS = enrichToolsForApps([
      ...DOCS_TOOLS,
      ...SECTION_TOOLS,
      ...MEDIA_TOOLS,
      ...DRIVE_TOOLS,
      ...SHEETS_TOOLS,
      ...SCRIPTS_TOOLS,
      ...GMAIL_TOOLS
    ]);
    const server = new Server({ name: 'docmcp', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });
    const loginUrl = `${baseUrl}/login`;

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listStaticResources() }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: listResourceTemplates() }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        return readPublicResource(request.params.uri);
      } catch (err) {
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/plain',
              text: `Authentication required. Please visit ${loginUrl} to sign in. (${err.message})`
            }
          ]
        };
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async () => ({
      content: [{ type: 'text', text: `Authentication required. Please visit ${loginUrl} to sign in.` }],
      isError: true
    }));

    return server;
  }

  buildMcpServer(sessionId) {
    const TOOLS = enrichToolsForApps([
      ...DOCS_TOOLS,
      ...SECTION_TOOLS,
      ...MEDIA_TOOLS,
      ...DRIVE_TOOLS,
      ...SHEETS_TOOLS,
      ...SCRIPTS_TOOLS,
      ...GMAIL_TOOLS
    ]);
    const server = new Server({ name: 'docmcp', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listStaticResources() }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: listResourceTemplates() }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const auth = await this.getUserAuth(sessionId);
        if (!auth) throw new Error('Authentication required. Please login first.');
        return await readResource(auth, request.params.uri);
      } catch (err) {
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/plain',
              text: `Error reading resource: ${err.message}`
            }
          ]
        };
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const auth = await this.getUserAuth(sessionId);
        if (!auth) throw new Error('Authentication required. Please login first.');

        const docsResult = await handleDocsToolCall(name, args, auth);
        if (docsResult) return docsResult;

        const sheetsResult = await handleSheetsToolCall(name, args, auth);
        if (sheetsResult) return sheetsResult;

        const gmailResult = await handleGmailToolCall(name, args, auth);
        if (gmailResult) return gmailResult;

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        console.error(`[tool:${name}] Error:`, err.message, err.stack?.split('\n')[1]?.trim());
        return { content: [{ type: 'text', text: `Error calling ${name}: ${err.message}` }], isError: true };
      }
    });

    return server;
  }

  buildStaticMcpServer(sessionId) {
    const TOOLS = enrichToolsForApps([
      ...DOCS_TOOLS,
      ...SECTION_TOOLS,
      ...MEDIA_TOOLS,
      ...DRIVE_TOOLS,
      ...SHEETS_TOOLS,
      ...SCRIPTS_TOOLS,
      ...GMAIL_TOOLS
    ]);
    const server = new Server({ name: 'docmcp', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listStaticResources() }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: listResourceTemplates() }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const auth = await this.getServerAuth();
        return await readResource(auth, request.params.uri);
      } catch (err) {
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/plain',
              text: `Error reading resource: ${err.message}`
            }
          ]
        };
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const auth = await this.getServerAuth();
        const docsResult = await handleDocsToolCall(name, args, auth);
        if (docsResult) return docsResult;

        const sheetsResult = await handleSheetsToolCall(name, args, auth);
        if (sheetsResult) return sheetsResult;

        const gmailResult = await handleGmailToolCall(name, args, auth);
        if (gmailResult) return gmailResult;

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        return { content: [{ type: 'text', text: `Error calling ${name}: ${err.message}` }], isError: true };
      }
    });

    return server;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(this.app);
      this.httpServer.listen(this.port, this.host, () => {
        console.log(`\n🚀 HTTP Streaming MCP Server running on http://${this.host}:${this.port}`);
        console.log(`\n📍 API Endpoints:`);
        console.log(`  Health check: http://${this.host}:${this.port}/`);
        console.log(`  Browser OAuth: http://${this.host}:${this.port}/login`);
        console.log(`  OAuth callback: http://${this.host}:${this.port}/auth/callback`);
        console.log(`  API token auth: POST http://${this.host}:${this.port}/auth/token`);
        console.log(`  Streamable HTTP: http://${this.host}:${this.port}/mcp`);
        console.log(`\n🔐 OAuth Configuration:`);
        console.log(`  Redirect URI: ${getRedirectUri(this.host, this.port)}`);
        console.log(`  CORS Origin: ${this.corsOrigin}`);
        console.log(`\n📊 MCP Configuration:`);
        console.log(`  Server Name: docmcp`);
        console.log(`  Tools: 52 Google Workspace operations`);
        console.log(`  Transport: Streamable HTTP`);
        console.log(`  Authentication: OAuth 2.0 (browser + API token)`);
        console.log(`\n💡 Quick Start:`);
        console.log(`  1. Browser users: Visit http://${this.host}:${this.port}/login`);
        console.log(`  2. Authenticate with Google to get sessionId`);
        console.log(`  3. Automatically redirected to /mcp with sessionId`);
        console.log(`  4. Start using 52+ Google Workspace tools`);
        console.log('');
        resolve();
      }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${this.port} is already in use. Please try a different port.`);
        } else {
          console.error('Server startup error:', err);
        }
        reject(err);
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('HTTP Streaming Server stopped');
        resolve();
      });
    });
  }
}

// Command-line interface
if (process.argv[1] && process.argv[1].endsWith('http-server.js')) {
  const args = process.argv.slice(2);
  let port = 3333;
  let host = '127.0.0.1';

  // Parse command-line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node http-server.js [options]');
      console.log('');
      console.log('Options:');
      console.log('  --port, -p    Port number (default: 3333)');
      console.log('  --host, -H    Host address (default: 127.0.0.1)');
      console.log('  --help, -h    Show this help message');
      console.log('');
      console.log('Environment Variables:');
      console.log('  GOOGLE_OAUTH_CLIENT_ID     Google OAuth client ID');
      console.log('  GOOGLE_OAUTH_CLIENT_SECRET Google OAuth client secret');
      console.log('  REDIRECT_URI               Redirect URI for OAuth');
      console.log('  CORS_ORIGIN                Allowed CORS origins');
      console.log('  PUBLIC_BASE_URL            External HTTPS base URL behind proxy (recommended)');
      console.log('  DOCMCP_BEARER_TOKENS       Comma-separated static bearer tokens for non-OAuth clients');
      console.log('  DOCMCP_USE_ADC             Use Application Default Credentials for static bearer mode');
      process.exit(0);
    }
  }

  // Start server
  const server = new AuthenticatedHTTPServer({ port, host });
  server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    try {
      await server.stop();
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
}

export default AuthenticatedHTTPServer;
