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
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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
    this.transportMap = new Map();
    this.userAuthMap = new Map();
    this.initializeExpress();
    this.initializeRoutes();
    this.initializeMcpServer();
  }

  initializeExpress() {
    this.app = express();
    this.corsOrigin = getCorsOrigin(this.host, this.port);
    this.app.use(cors({
      origin: this.corsOrigin,
      credentials: true
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
          auth_login: '/auth/login (GET) - Browser-based OAuth flow',
          auth_callback: '/auth/callback (GET) - OAuth callback endpoint',
          auth_token: '/auth/token (POST) - API token authentication for CLI/tools',
          auth_info: '/auth/info (GET) - Learn how to authenticate',
          sse: '/sse/:sessionId (GET) - SSE streaming endpoint',
          message: '/message (POST) - Message transmission endpoint',
          status: '/status (GET) - Server status'
        },
        quick_start: {
          browser_users: 'GET /auth/login then use sessionId with /sse/:sessionId',
          api_clients: 'POST /auth/token with Google OAuth token then use /sse/:sessionId',
          learn_more: 'GET /auth/info for detailed authentication guide'
        },
        activeSessions: this.sessionMap.size,
        activeConnections: this.transportMap.size
      });
    });

    // Server status
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'running',
        activeSessions: this.sessionMap.size,
        activeConnections: this.transportMap.size,
        uptime: process.uptime()
      });
    });

    // Authentication routes
    this.app.get('/auth/login', (req, res) => this.handleLogin(req, res));
    this.app.get('/auth/callback', (req, res) => this.handleCallback(req, res));

    // API token authentication - for CLI/programmatic access
    this.app.post('/auth/token', express.json(), (req, res) => this.handleTokenAuth(req, res));

    // Get authentication info for configured MCP client
    this.app.get('/auth/info', (req, res) => this.handleAuthInfo(req, res));

    // SSE connection with session context
    this.app.get('/sse/:sessionId', sessionContextMiddleware, (req, res) => this.handleSSEConnection(req, res));

    // Message endpoint with session context
    this.app.post('/message', sessionContextMiddleware, (req, res) => this.handleMessage(req, res));

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

      res.json({
        success: true,
        message: 'Authentication started. Please check your browser or visit the provided URL.',
        sessionId: sessionId,
        authUrl: authUrl
      });
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
      return res.status(400).json({
        success: false,
        error: 'Authentication canceled',
        message: error
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Missing code or state parameter'
      });
    }

    const session = this.sessionMap.get(state);
    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session',
        message: 'Session not found or expired'
      });
    }

    try {
      const { tokens } = await this.oAuth2Client.getToken(code);
      
      // Update session with user's tokens
      session.status = 'authenticated';
      session.tokens = tokens;
      session.updatedAt = Date.now();

      console.log(`Session authenticated: ${state}`);

      // Return success response with session information
      res.json({
        success: true,
        message: 'Authentication successful! You can now use the MCP server.',
        sessionId: state,
        user: {
          email: tokens.email || 'unknown',
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type,
          scope: tokens.scope
        }
      });
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
        sse_endpoint: `/sse/${sessionId}`,
        message_endpoint: '/message',
        credentials: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || 'none',
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type
        },
        instructions: [
          `1. Use sessionId in subsequent requests`,
          `2. Connect to SSE: GET /sse/${sessionId}`,
          `3. Send messages to: POST /message with X-Session-Id header or sessionId query param`,
          `4. Reference: https://docmcp.acc.l-inc.co.za/auth/info for full documentation`
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

  async handleAuthInfo(req, res) {
    try {
      // Return information about how to authenticate
      await this.loadCredentials();

      res.json({
        service: 'docmcp-http-server',
        version: '1.0.0',
        authentication_methods: {
          browser_oauth: {
            description: 'OAuth via browser - recommended for interactive users',
            flow: [
              '1. User visits GET /auth/login',
              '2. Redirected to Google OAuth consent screen',
              '3. After approval, redirected to /auth/callback with authorization code',
              '4. Server exchanges code for tokens and returns sessionId'
            ],
            endpoint: '/auth/login',
            result: 'sessionId for SSE connection'
          },
          programmatic_oauth: {
            description: 'OAuth for CLI tools and external MCP clients',
            flow: [
              '1. Tool/client directs user to GET /auth/login to start OAuth',
              '2. User authenticates and approves access',
              '3. Google redirects with authorization code',
              '4. Tool/client sends code to POST /auth/token',
              '5. Server exchanges code for tokens and returns sessionId'
            ],
            endpoint: '/auth/token',
            method: 'POST',
            payload: {
              code: 'authorization_code_from_oauth_flow',
              state: 'optional_state_parameter'
            },
            result: 'sessionId + credentials for subsequent calls'
          }
        },
        sse_connection: {
          description: 'SSE streaming endpoint - connect after getting sessionId',
          endpoint: '/sse/:sessionId',
          message_endpoint: '/message',
          session_id_sources: [
            'URL parameter: /sse/{sessionId}',
            'Query parameter: /sse?sessionId={sessionId}',
            'Header: X-Session-Id: {sessionId}'
          ]
        },
        mcp_configuration: {
          server_name: 'docmcp',
          transport: 'sse',
          tools_count: 52,
          google_workspace_apis: [
            'Google Docs',
            'Google Sheets',
            'Google Drive',
            'Gmail',
            'Apps Script'
          ]
        },
        setup_instructions: {
          'for_claude_code': [
            '1. User authenticates via: GET /auth/login (opens Google OAuth)',
            '2. After approval, user receives sessionId from /auth/callback',
            '3. Configure MCP server with: { "command": "sse", "url": "http://SERVER:PORT/sse/:sessionId", "transport": "sse" }',
            '4. Claude Code uses sessionId to connect to /sse/:sessionId endpoint'
          ],
          'for_cli_and_external_tools': [
            '1. Direct user to: GET http://SERVER:PORT/auth/login',
            '2. User authenticates with Google OAuth',
            '3. Capture authorization code from OAuth response',
            '4. POST /auth/token with { code: "...", state: "..." }',
            '5. Receive sessionId in response',
            '6. Use sessionId to connect to /sse/:sessionId for SSE streaming',
            '7. All tool calls are OAuth-authenticated via user\'s Google credentials'
          ]
        }
      });
    } catch (error) {
      console.error('Auth Info Error:', error);
      res.status(500).json({
        success: false,
        error: 'Could not retrieve auth info',
        message: error.message
      });
    }
  }

  async handleSSEConnection(req, res) {
    const sessionId = req.sessionId;
    const session = this.sessionMap.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'authenticated') {
      return res.status(401).json({ error: 'Session not authenticated' });
    }

    try {
      // Create SSE transport for this connection
      const transport = new SSEServerTransport('/message', res);
      this.transportMap.set(sessionId, transport);

      // Store original server handlers to restore them later
      const originalHandlers = new Map(this.server._requestHandlers || []);

      // Wrap request handlers to inject session context
      const wrappedCallToolHandler = async (request) => {
        // Run the handler in the session context
        return new Promise((resolve, reject) => {
          sessionContext.run(sessionId, async () => {
            try {
              const originalHandler = originalHandlers.get(CallToolRequestSchema);
              const result = await originalHandler.call(this.server, request);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      };

      this.server.setRequestHandler(CallToolRequestSchema, wrappedCallToolHandler);

      // Connect to MCP server
      await this.server.connect(transport);

      console.log(`SSE connection established for session: ${sessionId}`);

      // Handle transport close
      transport.onclose = () => {
        console.log(`SSE connection closed for session: ${sessionId}`);
        this.transportMap.delete(sessionId);
        // Restore original handlers for next session
        originalHandlers.forEach((handler, schema) => {
          this.server.setRequestHandler(schema, handler);
        });
      };

      // Start the transport
      await transport.start();
    } catch (error) {
      console.error('SSE Connection Error:', error);
      res.status(500).json({ error: 'Connection failed', message: error.message });
    }
  }

  async handleMessage(req, res) {
    const sessionId = req.sessionId || req.query.sessionId || req.headers['x-session-id'];
    const transport = this.transportMap.get(sessionId);

    if (!transport) {
      return res.status(404).json({ error: 'Session not found or connection not established' });
    }

    try {
      // Run message handling within the session context
      await sessionContext.run(sessionId, async () => {
        await transport.handlePostMessage(req, res);
      });
    } catch (error) {
      console.error('Message Handling Error:', error);
      res.status(500).json({
        success: false,
        error: 'Message handling failed',
        message: error.message
      });
    }
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(this.app);
      this.httpServer.listen(this.port, this.host, () => {
        console.log(`\n🚀 HTTP Streaming MCP Server running on http://${this.host}:${this.port}`);
        console.log(`\n📍 API Endpoints:`);
        console.log(`  Health check: http://${this.host}:${this.port}/`);
        console.log(`  Auth info: http://${this.host}:${this.port}/auth/info`);
        console.log(`  Browser OAuth: http://${this.host}:${this.port}/auth/login`);
        console.log(`  OAuth callback: http://${this.host}:${this.port}/auth/callback`);
        console.log(`  API token auth: POST http://${this.host}:${this.port}/auth/token`);
        console.log(`  SSE endpoint: http://${this.host}:${this.port}/sse/:sessionId`);
        console.log(`  Message endpoint: POST http://${this.host}:${this.port}/message`);
        console.log(`\n🔐 OAuth Configuration:`);
        console.log(`  Redirect URI: ${getRedirectUri(this.host, this.port)}`);
        console.log(`  CORS Origin: ${this.corsOrigin}`);
        console.log(`\n📊 MCP Configuration:`);
        console.log(`  Server Name: docmcp`);
        console.log(`  Tools: 52 Google Workspace operations`);
        console.log(`  Transport: HTTP SSE (Server-Sent Events)`);
        console.log(`  Authentication: OAuth 2.0 (browser + API token)`);
        console.log(`\n💡 Quick Start:`);
        console.log(`  1. Browser users: Visit http://${this.host}:${this.port}/auth/login`);
        console.log(`  2. CLI/Tools: POST /auth/token with Google OAuth access token`);
        console.log(`  3. Then connect to: /sse/:sessionId for streaming`);
        console.log(`  4. For full guide: GET http://${this.host}:${this.port}/auth/info`);
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