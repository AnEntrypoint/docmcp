#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS } from './tools-docs.js';
import { SHEETS_TOOLS, SCRIPTS_TOOLS } from './tools-sheets.js';
import { handleDocsToolCall, handleSheetsToolCall } from './handlers.js';

const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');
const ADC_FILE = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects'
];

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

async function getAuth() {
  if (process.env.DOCMCP_USE_ADC === '1' || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }
  
  if (fs.existsSync(ADC_FILE) && !process.env.GOOGLE_OAUTH_CLIENT_ID) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }
  
  const tokens = loadTokens();
  if (tokens && tokens.client_id && tokens.client_secret) {
    const client = new OAuth2Client(tokens.client_id, tokens.client_secret);
    client.setCredentials(tokens);
    return client;
  }
  
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('No auth configured. Set GOOGLE_OAUTH_CLIENT_ID/SECRET or use gcloud auth application-default login');
  }

  if (!tokens) {
    throw new Error(`No tokens found at ${TOKEN_FILE}. Run 'docmcp auth login' first.`);
  }

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);
  return client;
}

const TOOLS = [...DOCS_TOOLS, ...SECTION_TOOLS, ...MEDIA_TOOLS, ...DRIVE_TOOLS, ...SHEETS_TOOLS, ...SCRIPTS_TOOLS];

async function handleToolCall(name, args) {
  const auth = await getAuth();

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
