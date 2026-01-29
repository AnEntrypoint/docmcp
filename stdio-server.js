#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS } from './tools-docs.js';
import { SHEETS_TOOLS, SCRIPTS_TOOLS } from './tools-sheets.js';
import { handleDocsToolCall, handleSheetsToolCall } from './handlers.js';

const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET required');
  }

  const tokens = loadTokens();
  if (!tokens) {
    throw new Error(`No tokens found at ${TOKEN_FILE}. Run the HTTP server first to authenticate.`);
  }

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);
  return client;
}

const TOOLS = [...DOCS_TOOLS, ...SECTION_TOOLS, ...MEDIA_TOOLS, ...DRIVE_TOOLS, ...SHEETS_TOOLS, ...SCRIPTS_TOOLS];

async function handleToolCall(name, args) {
  const auth = getAuth();

  const docsResult = await handleDocsToolCall(name, args, auth);
  if (docsResult) return docsResult;

  const sheetsResult = await handleSheetsToolCall(name, args, auth);
  if (sheetsResult) return sheetsResult;

  throw new Error(`Unknown tool: ${name}`);
}

const server = new Server(
  { name: 'docmcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, args);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
