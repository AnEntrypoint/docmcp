#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import os from 'os';
import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import * as scripts from './scripts.js';
import * as gmail from './gmail.js';

const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');

function loadConfig() {
  const configFile = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'config.json');
  if (!fs.existsSync(configFile)) return null;
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function getAuth() {
  const tokens = loadTokens();
  const config = loadConfig();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config?.client_id;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || config?.client_secret;
  
  if (!clientId || !clientSecret) {
    console.error('Error: Set GOOGLE_OAUTH_CLIENT_ID/SECRET or create ~/.config/gcloud/docmcp/config.json with client_id and client_secret');
    process.exit(1);
  }
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

function parseJson(val) {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(`docmcp - Google Docs, Sheets, Drive, Gmail CLI

Commands:
  auth login                Authenticate with Google
  auth status               Check authentication status

  docs create <title>       Create a new document
  docs read <id>            Read document content
  docs edit <id>            Edit document (--old, --new, --replace-all)
  docs insert <id>          Insert text (--text, --position/--after/--index)
  docs get-info <id>        Get document metadata
  docs list                 List documents (--max-results, --query)
  docs format <id>          Format text (--search, --bold, --italic, --heading, etc)
  docs insert-table <id>    Insert table (--rows, --cols, --position)
  docs delete <id>          Delete text from document (--text, --delete-all)
  docs get-structure <id>   Get document heading hierarchy
  docs batch <id>           Batch operations (--operations)

  docs get-sections <id>    Parse document sections
  docs section <id>         Section operations (--action, --section, --target, --content)
  docs image <id>           Image operations (--action, --image-url, --image-index, etc)

  sheets create <title>     Create a new spreadsheet
  sheets read <id> [range]  Read sheet range
  sheets edit <id> <range>  Update range (--values)
  sheets insert <id>        Append rows (--values, --range)
  sheets cell get <id> <cell>
  sheets cell set <id> <cell> <value>
  sheets cell edit <id> <cell>  Edit cell text (--old, --new, --replace-all)
  sheets find-replace <id>  Find/replace across sheet (--find, --replace, --sheet)
  sheets get-info <id>      Get spreadsheet metadata
  sheets list               List spreadsheets (--max-results, --query)
  sheets tab <id>           Tab operations (--action, --title, --sheet-name)
  sheets clear <id> <range> Clear range (--clear-formats)
  sheets format <id> <range> Format range (--background-color, --bold, etc)
  sheets merge <id> <range> Merge/unmerge cells (--action)
  sheets freeze <id>        Freeze rows/columns (--sheet-name, --rows, --columns)
  sheets sort <id> <range>  Sort range (--sort-column, --ascending/--descending)
  sheets rows-cols <id>     Insert/delete rows/columns (--action, --dimension, --start-index, --count)
  sheets dimension-size <id> Set column width/row height (--dimension, --start, --end, --size)
  sheets get-formula <id> <cell> Get cell formula
  sheets batch <id>         Batch operations (--operations)

  scripts create <id>       Create script project (--script-name)
  scripts list <id>         List attached scripts
  scripts read <id>         Read script content (--script)
  scripts write <id>        Write/edit script file (--script, --file-name, --content/--mode edit)
  scripts delete <id>       Delete script (--script)
  scripts run <id>          Execute script function (--script, --function-name, --parameters)
  scripts sync <id>         Sync and verify scripts

  drive search <query>      Search Drive (--type, --max-results)

  gmail list                List recent emails (--max-results, --query, --label-ids)
  gmail search <query>      Search emails (--max-results)
  gmail read <message-id>   Read full email (--format)
  gmail get-attachments <message-id> List attachments
  gmail download-attachment <message-id> <attachment-id> Download attachment
  gmail get-labels          List all labels
  gmail list-filters        List all filters
  gmail get-filter <filter-id> Get one filter
  gmail create-filter       Create filter (--criteria, --action)
  gmail delete-filter <filter-id> Delete filter
  gmail replace-filter <filter-id> Replace filter (--criteria, --action)
  gmail send                Send email (--to, --subject, --body, --cc, --bcc)
  gmail delete <message-id> Permanently delete email
  gmail trash <message-id>  Move email to trash
  gmail modify-labels <message-id> Modify labels (--add-labels, --remove-labels)
  gmail bulk-modify-labels  Bulk modify labels (--query, --add-labels, --remove-labels, --max-results)`);
    return;
  }

  if (cmd === 'auth') {
    const sub = args[1];
    if (sub === 'login') {
      const http = await import('http');
      const { OAuth2Client } = await import('google-auth-library');
      
      const config = loadConfig();
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config?.client_id;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || config?.client_secret;
      
      if (!clientId || !clientSecret) {
        console.error('Error: No OAuth credentials. Set GOOGLE_OAUTH_CLIENT_ID/SECRET or create ~/.config/gcloud/docmcp/config.json with client_id and client_secret');
        process.exit(1);
      }
      
      const SCOPES = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/gmail.modify'
      ];
      
      const port = 9998;
      const redirectUri = `http://localhost:${port}/callback`;
      const client = new OAuth2Client(clientId, clientSecret, redirectUri);
      
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });
      
      console.log('\nOpen this URL to authenticate:\n');
      console.log(authUrl);
      console.log('\nWaiting for callback on port', port, '...\n');
      
      const server = http.createServer(async (req, res) => {
        if (!req.url.startsWith('/callback')) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        
        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400);
          res.end(`Error: ${error}`);
          server.close();
          process.exit(1);
        }
        
        if (!code) {
          res.writeHead(400);
          res.end('No code received');
          return;
        }
        
        try {
          const { tokens: newTokens } = await client.getToken(code);
          
          const configDir = path.join(os.homedir(), '.config', 'gcloud', 'docmcp');
          fs.mkdirSync(configDir, { recursive: true });
          fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokens, null, 2));
          fs.chmodSync(TOKEN_FILE, 0o600);
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Success!</h1><p>You can close this window.</p></body></html>');
          
          console.log('Authentication successful! Tokens saved to', TOKEN_FILE);
          console.log('Scopes:', newTokens.scope);
          server.close();
          process.exit(0);
        } catch (err) {
          res.writeHead(500);
          res.end(`Error: ${err.message}`);
          console.error('Token exchange failed:', err.message);
          server.close();
          process.exit(1);
        }
      });
      
      server.listen(port);
      return;
    }
    
    if (sub === 'status') {
      const tokens = loadTokens();
      if (!tokens) {
        console.log('Not authenticated. Run: docmcp auth login');
        process.exit(1);
      }
      console.log('Authenticated');
      console.log('Scopes:', tokens.scope || 'unknown');
      console.log('Token file:', TOKEN_FILE);
      return;
    }
    
    if (sub === 'exchange' && args[2]) {
      const code = args[2];
      const { OAuth2Client } = await import('google-auth-library');
      
      const config = loadConfig();
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config?.client_id;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || config?.client_secret;
      const redirectUri = args[3] || 'http://localhost:9998/callback';
      
      const client = new OAuth2Client(clientId, clientSecret, redirectUri);
      
      try {
        const { tokens: newTokens } = await client.getToken(code);
        
        const configDir = path.join(os.homedir(), '.config', 'gcloud', 'docmcp');
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokens, null, 2));
        fs.chmodSync(TOKEN_FILE, 0o600);
        
        console.log('Tokens saved to', TOKEN_FILE);
        console.log('Scopes:', newTokens.scope);
      } catch (err) {
        console.error('Token exchange failed:', err.message);
        process.exit(1);
      }
      return;
    }
    
    console.error('Unknown auth command. Use: docmcp auth login, docmcp auth status');
    process.exit(1);
  }

  if (cmd === 'docs') {
    const sub = args[1];
    const auth = getAuth();

    if (sub === 'create') {
      const title = args[2];
      if (!title) {
        console.error('Error: title required');
        process.exit(1);
      }
      const result = await docs.createDocument(auth, title);
      console.log(`Created document "${result.title}" with ID: ${result.docId}`);
      return;
    }

    const docId = args[2];
    const opts = parseArgs(args.slice(3));

    if (!docId && sub !== 'list') {
      console.error('Error: doc_id required');
      process.exit(1);
    }

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

    if (sub === 'get-info') {
      const info = await docs.getDocumentInfo(auth, docId);
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    if (sub === 'list') {
      const docsList = await docs.listDocuments(auth, opts['max-results'] || 20, opts.query || null);
      console.log(JSON.stringify(docsList, null, 2));
      return;
    }

    if (sub === 'format') {
      if (!opts.search) {
        console.error('Error: --search required');
        process.exit(1);
      }
      const formatting = {};
      if (opts.bold !== undefined) formatting.bold = opts.bold === 'true' || opts.bold === true;
      if (opts.italic !== undefined) formatting.italic = opts.italic === 'true' || opts.italic === true;
      if (opts.underline !== undefined) formatting.underline = opts.underline === 'true' || opts.underline === true;
      if (opts.strikethrough !== undefined) formatting.strikethrough = opts.strikethrough === 'true' || opts.strikethrough === true;
      if (opts['font-size']) formatting.fontSize = parseInt(opts['font-size'], 10);
      if (opts['font-family']) formatting.fontFamily = opts['font-family'];
      if (opts['foreground-color']) formatting.foregroundColor = opts['foreground-color'];
      if (opts['background-color']) formatting.backgroundColor = opts['background-color'];
      if (opts.heading) formatting.heading = opts.heading;
      if (opts.alignment) formatting.alignment = opts.alignment;
      const result = await docs.formatDocument(auth, docId, opts.search, formatting);
      console.log(`Formatted ${result.formattedOccurrences} occurrence(s)`);
      return;
    }

    if (sub === 'insert-table') {
      if (!opts.rows || !opts.cols) {
        console.error('Error: --rows and --cols required');
        process.exit(1);
      }
      const result = await docs.insertTable(auth, docId, parseInt(opts.rows, 10), parseInt(opts.cols, 10), opts.position || 'end');
      console.log(`Inserted ${result.rows}x${result.cols} table`);
      return;
    }

    if (sub === 'delete') {
      if (!opts.text) {
        console.error('Error: --text required');
        process.exit(1);
      }
      const result = await docs.deleteText(auth, docId, opts.text, !!opts['delete-all']);
      console.log(`Deleted ${result.replacements} occurrence(s)`);
      return;
    }

    if (sub === 'get-structure') {
      const structure = await docs.getDocumentStructure(auth, docId);
      console.log(JSON.stringify(structure, null, 2));
      return;
    }

    if (sub === 'batch') {
      if (!opts.operations) {
        console.error('Error: --operations required (JSON array)');
        process.exit(1);
      }
      const result = await docs.batchUpdate(auth, docId, parseJson(opts.operations));
      console.log(`Applied ${result.operationsApplied} operations`);
      return;
    }

    if (sub === 'get-sections') {
      const result = await sections.getSections(auth, docId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'section') {
      if (!opts.action || !opts.section) {
        console.error('Error: --action and --section required');
        process.exit(1);
      }
      if (opts.action === 'delete') {
        const result = await sections.deleteSection(auth, docId, parseJson(opts.section));
        console.log(`Deleted section "${result.deleted}"`);
      } else if (opts.action === 'move') {
        if (!opts.target) {
          console.error('Error: --target required for move');
          process.exit(1);
        }
        const result = await sections.moveSection(auth, docId, parseJson(opts.section), parseJson(opts.target));
        console.log(`Moved section "${result.moved}"`);
      } else if (opts.action === 'replace') {
        if (!opts.content) {
          console.error('Error: --content required for replace');
          process.exit(1);
        }
        const result = await sections.replaceSection(auth, docId, parseJson(opts.section), opts.content, opts['preserve-heading'] !== 'false');
        console.log(`Replaced section "${result.replaced}"`);
      } else {
        console.error('Error: unknown action. Use: delete, move, replace');
        process.exit(1);
      }
      return;
    }

    if (sub === 'image') {
      if (!opts.action) {
        console.error('Error: --action required (insert, list, delete, replace)');
        process.exit(1);
      }
      if (opts.action === 'insert') {
        if (!opts['image-url']) {
          console.error('Error: --image-url required');
          process.exit(1);
        }
        const result = await media.insertImage(auth, docId, opts['image-url'], opts.position || 'end', opts.width ? parseInt(opts.width, 10) : undefined, opts.height ? parseInt(opts.height, 10) : undefined);
        console.log(`Inserted image at index ${result.index}`);
      } else if (opts.action === 'list') {
        const result = await media.listImages(auth, docId);
        console.log(JSON.stringify(result, null, 2));
      } else if (opts.action === 'delete') {
        if (opts['image-index'] === undefined) {
          console.error('Error: --image-index required');
          process.exit(1);
        }
        const result = await media.deleteImage(auth, docId, parseInt(opts['image-index'], 10));
        console.log(`Deleted image at index ${result.imageIndex}`);
      } else if (opts.action === 'replace') {
        if (opts['image-index'] === undefined || !opts['image-url']) {
          console.error('Error: --image-index and --image-url required');
          process.exit(1);
        }
        const result = await media.replaceImage(auth, docId, parseInt(opts['image-index'], 10), opts['image-url'], opts.width ? parseInt(opts.width, 10) : undefined, opts.height ? parseInt(opts.height, 10) : undefined);
        console.log(`Replaced image at index ${result.imageIndex}`);
      } else {
        console.error('Error: unknown action. Use: insert, list, delete, replace');
        process.exit(1);
      }
      return;
    }

    console.error('Unknown docs command');
    process.exit(1);
  }

  if (cmd === 'sheets') {
    const sub = args[1];
    const auth = getAuth();

    if (sub === 'create') {
      const title = args[2];
      if (!title) {
        console.error('Error: title required');
        process.exit(1);
      }
      const result = await sheets.createSheet(auth, title);
      console.log(`Created spreadsheet "${result.title}" with ID: ${result.sheetId}`);
      return;
    }

    const sheetId = args[2];

    if (!sheetId) {
      console.error('Error: sheet_id required');
      process.exit(1);
    }

    const opts = parseArgs(args.slice(3));

    if (sub === 'read') {
      const range = args[3] || 'Sheet1';
      const values = await sheets.readSheet(auth, sheetId, range);
      console.log(JSON.stringify(values, null, 2));
      return;
    }

    if (sub === 'edit') {
      const range = args[3];
      if (!range || !opts.values) {
        console.error('Error: range and --values required');
        process.exit(1);
      }
      await sheets.editSheet(auth, sheetId, range, parseJson(opts.values));
      console.log(`Updated range ${range}`);
      return;
    }

    if (sub === 'insert') {
      if (!opts.values) {
        console.error('Error: --values required');
        process.exit(1);
      }
      const range = opts.range || 'Sheet1';
      await sheets.insertSheet(auth, sheetId, range, parseJson(opts.values));
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
        const cellOpts = parseArgs(args.slice(5));
        if (!cellOpts.old || !cellOpts.new) {
          console.error('Error: --old and --new required');
          process.exit(1);
        }
        const result = await sheets.editCell(auth, sheetId, cell, cellOpts.old, cellOpts.new, !!cellOpts['replace-all']);
        console.log(`Replaced ${result.replacements} occurrence(s) in cell ${cell}`);
        return;
      }

      console.error('Unknown cell command. Use: get, set, edit');
      process.exit(1);
    }

    if (sub === 'find-replace') {
      if (!opts.find || !opts.replace) {
        console.error('Error: --find and --replace required');
        process.exit(1);
      }
      const result = await sheets.findReplace(auth, sheetId, opts.find, opts.replace, opts.sheet || null);
      console.log(`Replaced ${result.replacements} occurrence(s)`);
      return;
    }

    if (sub === 'get-info') {
      const info = await sheets.getSpreadsheetInfo(auth, sheetId);
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    if (sub === 'list') {
      const sheetsList = await sheets.listSpreadsheets(auth, opts['max-results'] || 20, opts.query || null);
      console.log(JSON.stringify(sheetsList, null, 2));
      return;
    }

    if (sub === 'tab') {
      if (!opts.action) {
        console.error('Error: --action required (add, delete, rename)');
        process.exit(1);
      }
      if (opts.action === 'add') {
        if (!opts.title) {
          console.error('Error: --title required for add');
          process.exit(1);
        }
        const result = await sheets.addSheetTab(auth, sheetId, opts.title);
        console.log(`Added sheet tab "${result.title}" with ID: ${result.sheetId}`);
      } else if (opts.action === 'delete') {
        if (!opts['sheet-name']) {
          console.error('Error: --sheet-name required for delete');
          process.exit(1);
        }
        const result = await sheets.deleteSheetTab(auth, sheetId, opts['sheet-name']);
        console.log(`Deleted sheet tab "${result.deleted}"`);
      } else if (opts.action === 'rename') {
        if (!opts['sheet-name'] || !opts.title) {
          console.error('Error: --sheet-name and --title required for rename');
          process.exit(1);
        }
        const result = await sheets.renameSheetTab(auth, sheetId, opts['sheet-name'], opts.title);
        console.log(`Renamed sheet tab "${result.oldName}" to "${result.newName}"`);
      } else {
        console.error('Error: unknown action. Use: add, delete, rename');
        process.exit(1);
      }
      return;
    }

    if (sub === 'clear') {
      const range = args[3];
      if (!range) {
        console.error('Error: range required');
        process.exit(1);
      }
      const result = await sheets.clearRange(auth, sheetId, range, !!opts['clear-formats']);
      console.log(`Cleared range ${result.cleared}`);
      return;
    }

    if (sub === 'format') {
      const range = args[3];
      if (!range) {
        console.error('Error: range required');
        process.exit(1);
      }
      const formatting = {};
      if (opts['background-color']) formatting.backgroundColor = opts['background-color'];
      if (opts['text-color']) formatting.textColor = opts['text-color'];
      if (opts.bold !== undefined) formatting.bold = opts.bold === 'true' || opts.bold === true;
      if (opts.italic !== undefined) formatting.italic = opts.italic === 'true' || opts.italic === true;
      if (opts['font-size']) formatting.fontSize = parseInt(opts['font-size'], 10);
      if (opts['font-family']) formatting.fontFamily = opts['font-family'];
      if (opts['horizontal-alignment']) formatting.horizontalAlignment = opts['horizontal-alignment'];
      if (opts['vertical-alignment']) formatting.verticalAlignment = opts['vertical-alignment'];
      if (opts['wrap-strategy']) formatting.wrapStrategy = opts['wrap-strategy'];
      if (opts['number-format']) formatting.numberFormat = parseJson(opts['number-format']);
      if (opts.borders) formatting.borders = parseJson(opts.borders);
      const result = await sheets.formatRange(auth, sheetId, range, formatting);
      console.log(`Formatted range ${result.formatted}`);
      return;
    }

    if (sub === 'merge') {
      const range = args[3];
      if (!range) {
        console.error('Error: range required');
        process.exit(1);
      }
      const action = opts.action || 'merge';
      const result = await sheets.mergeCells(auth, sheetId, range, action);
      if (action === 'unmerge') {
        console.log(`Unmerged cells in range ${result.unmerged}`);
      } else {
        console.log(`Merged cells in range ${result.merged}`);
      }
      return;
    }

    if (sub === 'freeze') {
      if (!opts['sheet-name']) {
        console.error('Error: --sheet-name required');
        process.exit(1);
      }
      const result = await sheets.setFrozen(auth, sheetId, opts['sheet-name'], parseInt(opts.rows || '0', 10), parseInt(opts.columns || '0', 10));
      console.log(`Froze ${result.frozenRows} rows and ${result.frozenColumns} columns`);
      return;
    }

    if (sub === 'sort') {
      const range = args[3];
      if (!range || !opts['sort-column']) {
        console.error('Error: range and --sort-column required');
        process.exit(1);
      }
      const sortCol = isNaN(parseInt(opts['sort-column'], 10)) ? opts['sort-column'] : parseInt(opts['sort-column'], 10);
      const result = await sheets.sortRange(auth, sheetId, range, sortCol, opts.ascending !== 'false');
      console.log(`Sorted range ${result.sorted} by column ${result.column} (${result.ascending ? 'ascending' : 'descending'})`);
      return;
    }

    if (sub === 'rows-cols') {
      if (!opts.action || !opts.dimension || opts['start-index'] === undefined || !opts.count) {
        console.error('Error: --action, --dimension, --start-index, and --count required');
        process.exit(1);
      }
      if (!opts['sheet-name']) {
        console.error('Error: --sheet-name required');
        process.exit(1);
      }
      const result = await sheets.modifyRowsColumns(auth, sheetId, opts['sheet-name'], opts.action, opts.dimension, parseInt(opts['start-index'], 10), parseInt(opts.count, 10));
      const actionPast = opts.action === 'delete' ? 'Deleted' : 'Inserted';
      console.log(`${actionPast} ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}`);
      return;
    }

    if (sub === 'dimension-size') {
      if (!opts.dimension || opts.start === undefined || opts.end === undefined || !opts.size) {
        console.error('Error: --dimension, --start, --end, and --size required');
        process.exit(1);
      }
      if (!opts['sheet-name']) {
        console.error('Error: --sheet-name required');
        process.exit(1);
      }
      const start = isNaN(parseInt(opts.start, 10)) ? opts.start : parseInt(opts.start, 10);
      const end = isNaN(parseInt(opts.end, 10)) ? opts.end : parseInt(opts.end, 10);
      const result = await sheets.setDimensionSize(auth, sheetId, opts['sheet-name'], opts.dimension, start, end, parseInt(opts.size, 10));
      console.log(`Set ${result.dimension.toLowerCase()} size to ${result.size}px for ${result.start} to ${result.end}`);
      return;
    }

    if (sub === 'get-formula') {
      const cell = args[3];
      if (!cell) {
        console.error('Error: cell required');
        process.exit(1);
      }
      const result = await sheets.getCellFormula(auth, sheetId, cell);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'batch') {
      if (!opts.operations) {
        console.error('Error: --operations required (JSON array)');
        process.exit(1);
      }
      const result = await sheets.batchUpdate(auth, sheetId, parseJson(opts.operations));
      console.log(`Updated ${result.valuesUpdated} values, applied ${result.formatsApplied} formats`);
      return;
    }

    console.error('Unknown sheets command');
    process.exit(1);
  }

  if (cmd === 'scripts') {
    const sub = args[1];
    const auth = getAuth();
    const sheetId = args[2];

    if (!sheetId) {
      console.error('Error: sheet_id required');
      process.exit(1);
    }

    const opts = parseArgs(args.slice(3));

    if (sub === 'create') {
      if (!opts['script-name']) {
        console.error('Error: --script-name required');
        process.exit(1);
      }
      const result = await scripts.createScript(auth, sheetId, opts['script-name']);
      console.log(`Created script "${result.name}" with ID: ${result.scriptId}`);
      console.log(`URL: ${result.url}`);
      return;
    }

    if (sub === 'list') {
      const result = await scripts.listScripts(auth, sheetId);
      console.log(JSON.stringify(result.scripts, null, 2));
      if (result.healed) {
        console.log(`\n(Auto-healed: removed ${result.removedCount} stale script entries)`);
      }
      return;
    }

    if (sub === 'sync') {
      const result = await scripts.syncScripts(auth, sheetId);
      console.log(`Synced scripts: ${result.valid}/${result.total} valid, ${result.removed} removed`);
      return;
    }

    if (sub === 'read') {
      if (!opts.script) {
        console.error('Error: --script required');
        process.exit(1);
      }
      const result = await scripts.readScript(auth, sheetId, parseJson(opts.script));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'write') {
      if (!opts.script || !opts['file-name']) {
        console.error('Error: --script and --file-name required');
        process.exit(1);
      }
      if (opts.mode === 'edit') {
        if (!opts['old-text'] || !opts['new-text']) {
          console.error('Error: --old-text and --new-text required for edit mode');
          process.exit(1);
        }
        const result = await scripts.editScript(auth, sheetId, parseJson(opts.script), opts['file-name'], opts['old-text'], opts['new-text'], !!opts['replace-all']);
        console.log(`Replaced ${result.replacements} occurrence(s) in ${result.file}`);
      } else {
        if (!opts.content) {
          console.error('Error: --content required for write mode');
          process.exit(1);
        }
        const result = await scripts.writeScript(auth, sheetId, parseJson(opts.script), opts['file-name'], opts.content, opts['file-type'] || 'SERVER_JS');
        console.log(`Wrote file "${result.file}" (${result.isNew ? 'created' : 'updated'})`);
      }
      return;
    }

    if (sub === 'delete') {
      if (!opts.script) {
        console.error('Error: --script required');
        process.exit(1);
      }
      const result = await scripts.deleteScript(auth, sheetId, parseJson(opts.script));
      console.log(`Removed script "${result.name}" from tracking (${result.scriptId})`);
      console.log(`Note: ${result.note}`);
      return;
    }

    if (sub === 'run') {
      if (!opts.script || !opts['function-name']) {
        console.error('Error: --script and --function-name required');
        process.exit(1);
      }
      const params = opts.parameters ? parseJson(opts.parameters) : [];
      const result = await scripts.runScript(auth, sheetId, parseJson(opts.script), opts['function-name'], params);
      console.log(`Executed function "${result.function}"`);
      console.log(`Result: ${JSON.stringify(result.result)}`);
      return;
    }

    console.error('Unknown scripts command');
    process.exit(1);
  }

  if (cmd === 'drive') {
    const sub = args[1];
    const auth = getAuth();

    if (sub === 'search') {
      const query = args[2];
      if (!query) {
        console.error('Error: query required');
        process.exit(1);
      }
      const opts = parseArgs(args.slice(3));
      const results = await docs.searchDrive(auth, query, opts.type || 'all', parseInt(opts['max-results'] || '20', 10));
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    console.error('Unknown drive command');
    process.exit(1);
  }

  if (cmd === 'gmail') {
    const sub = args[1];
    const auth = getAuth();
    const opts = parseArgs(args.slice(2));

    if (sub === 'list') {
      const labelIds = opts['label-ids'] ? parseJson(opts['label-ids']) : null;
      const result = await gmail.listEmails(auth, parseInt(opts['max-results'] || '20', 10), opts.query || null, labelIds);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'search') {
      const query = args[2];
      if (!query) {
        console.error('Error: query required');
        process.exit(1);
      }
      const searchOpts = parseArgs(args.slice(3));
      const result = await gmail.searchEmails(auth, query, parseInt(searchOpts['max-results'] || '20', 10));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'read') {
      const messageId = args[2];
      if (!messageId) {
        console.error('Error: message_id required');
        process.exit(1);
      }
      const result = await gmail.readEmail(auth, messageId, opts.format || 'full');
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'get-attachments') {
      const messageId = args[2];
      if (!messageId) {
        console.error('Error: message_id required');
        process.exit(1);
      }
      const result = await gmail.getEmailAttachments(auth, messageId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'download-attachment') {
      const messageId = args[2];
      const attachmentId = args[3];
      if (!messageId || !attachmentId) {
        console.error('Error: message_id and attachment_id required');
        process.exit(1);
      }
      const result = await gmail.downloadAttachment(auth, messageId, attachmentId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'get-labels') {
      const result = await gmail.getLabels(auth);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'list-filters') {
      const result = await gmail.listFilters(auth);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'get-filter') {
      const filterId = args[2];
      if (!filterId) {
        console.error('Error: filter_id required');
        process.exit(1);
      }
      const result = await gmail.getFilter(auth, filterId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'create-filter') {
      if (!opts.criteria || !opts.action) {
        console.error('Error: --criteria and --action required');
        process.exit(1);
      }
      const result = await gmail.createFilter(auth, parseJson(opts.criteria), parseJson(opts.action));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'delete-filter') {
      const filterId = args[2];
      if (!filterId) {
        console.error('Error: filter_id required');
        process.exit(1);
      }
      const result = await gmail.deleteFilter(auth, filterId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'replace-filter') {
      const filterId = args[2];
      if (!filterId) {
        console.error('Error: filter_id required');
        process.exit(1);
      }
      const criteria = opts.criteria ? parseJson(opts.criteria) : {};
      const action = opts.action ? parseJson(opts.action) : {};
      const result = await gmail.replaceFilter(auth, filterId, criteria, action);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (sub === 'send') {
      if (!opts.to || !opts.subject || !opts.body) {
        console.error('Error: --to, --subject, and --body required');
        process.exit(1);
      }
      const result = await gmail.sendEmail(auth, opts.to, opts.subject, opts.body, opts.cc || null, opts.bcc || null);
      console.log(`Sent email to ${opts.to}`);
      console.log(`Message ID: ${result.id}`);
      return;
    }

    if (sub === 'delete') {
      const messageId = args[2];
      if (!messageId) {
        console.error('Error: message_id required');
        process.exit(1);
      }
      const result = await gmail.deleteEmail(auth, messageId);
      console.log(`Permanently deleted email ${result.deleted}`);
      return;
    }

    if (sub === 'trash') {
      const messageId = args[2];
      if (!messageId) {
        console.error('Error: message_id required');
        process.exit(1);
      }
      const result = await gmail.trashEmail(auth, messageId);
      console.log(`Moved email ${result.id} to trash`);
      return;
    }

    if (sub === 'modify-labels') {
      const messageId = args[2];
      if (!messageId) {
        console.error('Error: message_id required');
        process.exit(1);
      }
      const addLabels = opts['add-labels'] ? parseJson(opts['add-labels']) : [];
      const removeLabels = opts['remove-labels'] ? parseJson(opts['remove-labels']) : [];
      const result = await gmail.modifyLabels(auth, messageId, addLabels, removeLabels);
      console.log(`Modified labels for email ${result.id}`);
      return;
    }

    if (sub === 'bulk-modify-labels') {
      if (!opts.query) {
        console.error('Error: --query required');
        process.exit(1);
      }
      const addLabels = opts['add-labels'] ? parseJson(opts['add-labels']) : [];
      const removeLabels = opts['remove-labels'] ? parseJson(opts['remove-labels']) : [];
      const maxResults = parseInt(opts['max-results'] || '2000', 10);
      const result = await gmail.bulkModifyLabelsByQuery(auth, opts.query, addLabels, removeLabels, maxResults);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.error('Unknown gmail command');
    process.exit(1);
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
