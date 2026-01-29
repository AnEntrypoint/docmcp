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
import * as docs from './docs.js';
import * as sheets from './sheets.js';

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

const TOOLS = [
  {
    name: 'docs_read',
    description: 'Read the full text content of a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_edit',
    description: 'Replace text in a Google Doc (old_text must appear exactly once)',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        old_text: { type: 'string', description: 'Text to find and replace' },
        new_text: { type: 'string', description: 'Replacement text' }
      },
      required: ['doc_id', 'old_text', 'new_text']
    }
  },
  {
    name: 'docs_insert',
    description: 'Insert text into a Google Doc at a position',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        text: { type: 'string', description: 'Text to insert' },
        position: {
          oneOf: [
            { type: 'string', description: '"end" or text to insert after' },
            { type: 'number', description: 'Character index' }
          ],
          description: 'Where to insert (default: "end")'
        }
      },
      required: ['doc_id', 'text']
    }
  },
  {
    name: 'sheets_read',
    description: 'Read values from a Google Sheet range',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation (default: "Sheet1")' }
      },
      required: ['sheet_id']
    }
  },
  {
    name: 'sheets_edit',
    description: 'Update values in a Google Sheet range',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: '2D array of values'
        }
      },
      required: ['sheet_id', 'range', 'values']
    }
  },
  {
    name: 'sheets_insert',
    description: 'Append rows to a Google Sheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation (default: "Sheet1")' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: '2D array of values to append'
        }
      },
      required: ['sheet_id', 'values']
    }
  },
  {
    name: 'sheets_get_cell',
    description: 'Get a single cell value from a Google Sheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'Cell reference (e.g. "A1", "Sheet1!B2")' }
      },
      required: ['sheet_id', 'cell']
    }
  },
  {
    name: 'sheets_set_cell',
    description: 'Set a single cell value in a Google Sheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'Cell reference (e.g. "A1", "Sheet1!B2")' },
        value: { description: 'Value to set' }
      },
      required: ['sheet_id', 'cell', 'value']
    }
  },
  {
    name: 'sheets_find_replace',
    description: 'Find and replace text across a Google Sheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        sheet_name: { type: 'string', description: 'Specific sheet tab name (optional, searches all if omitted)' }
      },
      required: ['sheet_id', 'find', 'replace']
    }
  }
];

async function handleToolCall(name, args) {
  const auth = getAuth();

  switch (name) {
    case 'docs_read': {
      const content = await docs.readDocument(auth, args.doc_id);
      return { content: [{ type: 'text', text: content }] };
    }
    case 'docs_edit': {
      await docs.editDocument(auth, args.doc_id, args.old_text, args.new_text);
      return { content: [{ type: 'text', text: `Replaced text in ${args.doc_id}` }] };
    }
    case 'docs_insert': {
      await docs.insertDocument(auth, args.doc_id, args.text, args.position || 'end');
      return { content: [{ type: 'text', text: `Inserted text into ${args.doc_id}` }] };
    }
    case 'sheets_read': {
      const values = await sheets.readSheet(auth, args.sheet_id, args.range || 'Sheet1');
      return { content: [{ type: 'text', text: JSON.stringify(values, null, 2) }] };
    }
    case 'sheets_edit': {
      await sheets.editSheet(auth, args.sheet_id, args.range, args.values);
      return { content: [{ type: 'text', text: `Updated ${args.range} in ${args.sheet_id}` }] };
    }
    case 'sheets_insert': {
      await sheets.insertSheet(auth, args.sheet_id, args.range || 'Sheet1', args.values);
      return { content: [{ type: 'text', text: `Appended rows to ${args.sheet_id}` }] };
    }
    case 'sheets_get_cell': {
      const value = await sheets.getCell(auth, args.sheet_id, args.cell);
      return { content: [{ type: 'text', text: value !== null ? String(value) : '(empty)' }] };
    }
    case 'sheets_set_cell': {
      await sheets.setCell(auth, args.sheet_id, args.cell, args.value);
      return { content: [{ type: 'text', text: `Set ${args.cell} in ${args.sheet_id}` }] };
    }
    case 'sheets_find_replace': {
      await sheets.findReplace(auth, args.sheet_id, args.find, args.replace, args.sheet_name || null);
      return { content: [{ type: 'text', text: `Replaced "${args.find}" with "${args.replace}" in ${args.sheet_id}` }] };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
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
