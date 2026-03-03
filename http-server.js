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
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from 'google-auth-library';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS } from './tools-docs.js';
import { SHEETS_TOOLS, SCRIPTS_TOOLS } from './tools-sheets.js';
import { GMAIL_TOOLS } from './tools-gmail.js';
import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';

// AsyncLocalStorage for session context
const sessionContext = new AsyncLocalStorage();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'gcloud', 'docmcp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

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

class AuthenticatedHTTPServer {
  constructor(options = {}) {
    this.port = options.port || 3333;
    this.host = options.host || '127.0.0.1';
    this.sessionMap = new Map();
    this.oAuth2Client = null;
    this.credentials = null;
    this.userAuthMap = new Map();
    this.sseStreams = new Map();
    this.initializeExpress();
    this.initializeRoutes();
    this.initializeMcpServer();
  }

  initializeExpress() {
    this.app = express();
    this.corsOrigin = getCorsOrigin(this.host, this.port);
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'mcp-session-id'],
      exposedHeaders: ['mcp-session-id'],
      credentials: false
    }));
    this.app.use(express.json({ limit: '4mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  initializeRoutes() {
    // Session context middleware - extract and validate session ID
    const sessionContextMiddleware = (req, res, next) => {
      // Extract session ID from URL params, query params, or headers
      const sessionId = req.params.sessionId || req.query.sessionId || req.headers['x-session-id'];

      // Attach to request for downstream handlers
      req.sessionId = sessionId;
      next();
    };

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
          api_clients: 'POST /auth/token with Google OAuth code, then connect to /mcp with sessionId'
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
      { capabilities: { tools: {} } }
    );

    const TOOLS = [...DOCS_TOOLS, ...SECTION_TOOLS, ...MEDIA_TOOLS, ...DRIVE_TOOLS, ...SHEETS_TOOLS, ...SCRIPTS_TOOLS, ...GMAIL_TOOLS];

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
          throw new Error('Authentication required. Please login first.');
        }

        const docsResult = await handleDocsToolCall(name, args, auth);
        if (docsResult) return docsResult;

        const sheetsResult = await handleSheetsToolCall(name, args, auth);
        if (sheetsResult) return sheetsResult;

        const gmailResult = await handleGmailToolCall(name, args, auth);
        if (gmailResult) return gmailResult;

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true
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

    // Reuse existing auth client
    if (this.userAuthMap.has(sessionId)) {
      return this.userAuthMap.get(sessionId);
    }

    // Create new auth client with user's tokens
    const oAuth2Client = this.createOAuth2Client();
    oAuth2Client.setCredentials(session.tokens);
    
    this.userAuthMap.set(sessionId, oAuth2Client);
    return oAuth2Client;
  }

  async handleLogin(req, res) {
    try {
      await this.loadCredentials();
      this.oAuth2Client = this.createOAuth2Client();

      const scopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/gmail.modify'
      ];

      const sessionId = crypto.randomBytes(16).toString('hex');
      const state = sessionId;

      const authUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: state,
        prompt: 'consent'
      });

      // Create session
      this.sessionMap.set(sessionId, {
        state: state,
        createdAt: Date.now(),
        status: 'authenticating'
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
                <p class="subtitle">Connect your Google Workspace account to use powerful document processing tools</p>
                
                <a href="${authUrl}" class="google-login-button">
                    <span class="google-icon">🔐</span>
                    Sign in with Google
                </a>
                
                <div class="session-info">
                    <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
                    <p style="margin-top: 10px; font-size: 12px; color: #999;">
                        You will be redirected to Google's login page
                    </p>
                </div>
                
                <div class="features">
                    <h3>Features:</h3>
                    <ul>
                        <li>📄 Google Docs integration</li>
                        <li>📊 Google Sheets integration</li>
                        <li>📧 Gmail integration</li>
                        <li>🔄 Real-time collaboration</li>
                        <li>⚡ 52+ powerful operations</li>
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
      const { tokens } = await this.oAuth2Client.getToken(code);

      // Update session with user's tokens
      session.status = 'authenticated';
      session.tokens = tokens;
      session.updatedAt = Date.now();

      console.log(`Session authenticated: ${state}`);

      // Redirect to /mcp endpoint to start Streamable HTTP connection
      res.redirect(302, `/mcp?sessionId=${state}`);
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
          message: 'OAuth authorization code is required. Redirect user to /auth/login first.',
          instructions: [
            'Step 1: Redirect user to GET /auth/login',
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

      this.sessionMap.set(sessionId, {
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
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || 'none',
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

async handleStreamableHttpConnection(req, res) {
    const sessionId = req.sessionId;

    try {
      // For authenticated sessions: reuse transport per session
      if (sessionId && this.sessionMap.get(sessionId)?.status === 'authenticated') {
        if (!this.serverMap) this.serverMap = new Map();
        if (!this.transportMap) this.transportMap = new Map();

        if (!this.transportMap.has(sessionId)) {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          const server = this.buildMcpServer(sessionId);
          await server.connect(transport);
          transport.onclose = () => {
            server.close().catch(() => {});
            this.transportMap?.delete(sessionId);
            this.serverMap?.delete(sessionId);
          };
          this.transportMap.set(sessionId, transport);
          this.serverMap.set(sessionId, server);
        }

        const transport = this.transportMap.get(sessionId);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // No valid session - for GET/SSE we still need to respond with SSE so clients
      // can establish the stream (ChatGPT connects GET first, then POSTs initialize)
      if (req.method === 'GET') {
        res.set({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.flushHeaders();
        req.on('close', () => {});
        return;
      }

      // POST without valid session
      const msg = !sessionId
        ? 'No sessionId provided. Visit /login to authenticate first, then use the returned sessionId.'
        : 'Session not authenticated. Visit /login to complete authentication.';
      return res.status(401).set('Content-Type', 'application/json').json({
        error: msg,
        login_url: `${process.env.COOLIFY_URL || (process.env.COOLIFY_FQDN ? 'https://' + process.env.COOLIFY_FQDN : '')}/login`
      });

    } catch (error) {
      console.error('Streamable HTTP Connection Error:', error);
      if (!res.headersSent) {
        res.status(500).set('Content-Type', 'application/json').json({ error: 'Connection failed', message: error.message });
      }
    }
  }

  buildMcpServer(sessionId) {
    const TOOLS = [...DOCS_TOOLS, ...SECTION_TOOLS, ...MEDIA_TOOLS, ...DRIVE_TOOLS, ...SHEETS_TOOLS, ...SCRIPTS_TOOLS, ...GMAIL_TOOLS];
    const server = new Server({ name: 'docmcp', version: '1.0.0' }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

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
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
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