#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OAuth2Client } from 'google-auth-library';
import os from 'os';
import * as docs from './docs.js';
import * as sheets from './sheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET required');
    process.exit(1);
  }
  const tokens = loadTokens();
  if (!tokens) {
    console.error(`Error: No tokens found at ${TOKEN_FILE}. Run 'docmcp auth login' first.`);
    process.exit(1);
  }
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);
  return client;
}

function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(arg);
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(`docmcp - Google Docs & Sheets CLI

Commands:
  skill                     Print full usage instructions
  auth login                Authenticate with Google
  docs read <id>            Read document content
  docs edit <id>            Edit document (--old, --new, --replace-all)
  docs insert <id>          Insert text (--text, --position/--after/--index)
  sheets read <id> [range]  Read sheet range
  sheets edit <id> <range>  Update range (--values)
  sheets insert <id>        Append rows (--values)
  sheets cell get <id> <cell>
  sheets cell set <id> <cell> <value>
  sheets cell edit <id> <cell>  Edit cell text (--old, --new, --replace-all)
  sheets find-replace <id>  Find/replace across sheet (--find, --replace, --sheet)

Run 'docmcp skill' for detailed documentation.`);
    return;
  }

  if (cmd === 'skill') {
    const skillPath = path.join(__dirname, 'src', 'skill.md');
    console.log(fs.readFileSync(skillPath, 'utf8'));
    return;
  }

  if (cmd === 'auth') {
    const sub = args[1];
    if (sub === 'login') {
      console.log('Starting authentication flow...');
      const { default: startServer } = await import('./server.js');
      return;
    }
    console.error('Unknown auth command. Use: docmcp auth login');
    process.exit(1);
  }

  if (cmd === 'docs') {
    const sub = args[1];
    const docId = args[2];
    const opts = parseArgs(args.slice(3));

    if (!docId) {
      console.error('Error: doc_id required');
      process.exit(1);
    }

    const auth = getAuth();

    if (sub === 'read') {
      const content = await docs.readDocument(auth, docId);
      console.log(content);
      return;
    }

    if (sub === 'edit') {
      if (!opts.old || !opts.new) {
        console.error('Error: --old and --new required');
        process.exit(1);
      }
      const result = await docs.editDocument(auth, docId, opts.old, opts.new, !!opts['replace-all']);
      console.log(`Replaced ${result.replacements} occurrence(s)`);
      return;
    }

    if (sub === 'insert') {
      if (!opts.text) {
        console.error('Error: --text required');
        process.exit(1);
      }
      let position = 'end';
      if (opts.position) position = opts.position;
      else if (opts.after) position = opts.after;
      else if (opts.index) position = parseInt(opts.index, 10);
      await docs.insertDocument(auth, docId, opts.text, position);
      console.log('Text inserted');
      return;
    }

    console.error('Unknown docs command');
    process.exit(1);
  }

  if (cmd === 'sheets') {
    const sub = args[1];
    const sheetId = args[2];

    if (!sheetId) {
      console.error('Error: sheet_id required');
      process.exit(1);
    }

    const auth = getAuth();

    if (sub === 'read') {
      const range = args[3] || 'Sheet1';
      const values = await sheets.readSheet(auth, sheetId, range);
      console.log(JSON.stringify(values, null, 2));
      return;
    }

    if (sub === 'edit') {
      const range = args[3];
      const opts = parseArgs(args.slice(4));
      if (!range || !opts.values) {
        console.error('Error: range and --values required');
        process.exit(1);
      }
      const values = JSON.parse(opts.values);
      await sheets.editSheet(auth, sheetId, range, values);
      console.log(`Updated range ${range}`);
      return;
    }

    if (sub === 'insert') {
      const opts = parseArgs(args.slice(3));
      if (!opts.values) {
        console.error('Error: --values required');
        process.exit(1);
      }
      const values = JSON.parse(opts.values);
      const range = opts.range || 'Sheet1';
      await sheets.insertSheet(auth, sheetId, range, values);
      console.log('Rows appended');
      return;
    }

    if (sub === 'cell') {
      const cellCmd = args[3];
      const cell = args[4];

      if (!cell) {
        console.error('Error: cell reference required');
        process.exit(1);
      }

      if (cellCmd === 'get') {
        const value = await sheets.getCell(auth, sheetId, cell);
        console.log(value !== null ? String(value) : '(empty)');
        return;
      }

      if (cellCmd === 'set') {
        const value = args[5];
        if (value === undefined) {
          console.error('Error: value required');
          process.exit(1);
        }
        await sheets.setCell(auth, sheetId, cell, value);
        console.log(`Set cell ${cell}`);
        return;
      }

      if (cellCmd === 'edit') {
        const opts = parseArgs(args.slice(5));
        if (!opts.old || !opts.new) {
          console.error('Error: --old and --new required');
          process.exit(1);
        }
        const result = await sheets.editCell(auth, sheetId, cell, opts.old, opts.new, !!opts['replace-all']);
        console.log(`Replaced ${result.replacements} occurrence(s) in cell ${cell}`);
        return;
      }

      console.error('Unknown cell command. Use: get, set, edit');
      process.exit(1);
    }

    if (sub === 'find-replace') {
      const opts = parseArgs(args.slice(3));
      if (!opts.find || !opts.replace) {
        console.error('Error: --find and --replace required');
        process.exit(1);
      }
      const result = await sheets.findReplace(auth, sheetId, opts.find, opts.replace, opts.sheet || null);
      console.log(`Replaced ${result.replacements} occurrence(s)`);
      return;
    }

    console.error('Unknown sheets command');
    process.exit(1);
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
