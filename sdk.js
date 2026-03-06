import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import * as scripts from './scripts.js';
import * as gmail from './gmail.js';
import { google } from 'googleapis';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/script.projects'
];

function createClient(auth, userContext = {}) {
  return {
    auth,
    userContext: userContext || {},
    docs: {
      get: (docId) => docs.getDoc(auth, docId, userContext),
      read: (docId) => docs.readDoc(auth, docId, userContext),
      create: (title) => docs.createDoc(auth, title, userContext),
      edit: (docId, oldText, newText) => docs.editDoc(auth, docId, oldText, newText, userContext),
      insert: (docId, text, position) => docs.insertText(auth, docId, text, position, userContext),
      delete: (docId, text, deleteAll) => docs.deleteText(auth, docId, text, deleteAll, userContext),
      format: (docId, searchText, format) => docs.formatText(auth, docId, searchText, format, userContext),
      batch: (docId, operations) => docs.batchUpdate(auth, docId, operations, userContext)
    },
    sheets: {
      create: (title) => sheets.createSheet(auth, title, userContext),
      read: (sheetId, range) => sheets.readSheet(auth, sheetId, range, userContext),
      edit: (sheetId, range, values) => sheets.editSheet(auth, sheetId, range, values, userContext),
      insert: (sheetId, values, range) => sheets.insertRows(auth, sheetId, values, range, userContext),
      getCell: (sheetId, cell) => sheets.getCell(auth, sheetId, cell, userContext),
      setCell: (sheetId, cell, value) => sheets.setCell(auth, sheetId, cell, value, userContext),
      batch: (sheetId, ops) => sheets.batchUpdate(auth, sheetId, ops, userContext)
    },
    sections: {
      get: (docId) => sections.getSections(auth, docId, userContext),
      delete: (docId, section) => sections.deleteSection(auth, docId, section, userContext),
      move: (docId, section, target) => sections.moveSection(auth, docId, section, target, userContext),
      replace: (docId, section, content) => sections.replaceSection(auth, docId, section, content, userContext)
    },
    media: {
      insert: (docId, imageUrl, position, width, height) => media.insertImage(auth, docId, imageUrl, position, width, height, userContext),
      list: (docId) => media.listImages(auth, docId, userContext),
      delete: (docId, imageIndex) => media.deleteImage(auth, docId, imageIndex, userContext),
      replace: (docId, imageIndex, imageUrl, width, height) => media.replaceImage(auth, docId, imageIndex, imageUrl, width, height, userContext)
    },
    scripts: {
      create: (sheetId, scriptName) => scripts.createScript(auth, sheetId, scriptName, userContext),
      list: (sheetId) => scripts.listScripts(auth, sheetId, userContext),
      read: (sheetId, script) => scripts.readScript(auth, sheetId, script, userContext),
      write: (sheetId, script, fileName, content) => scripts.writeScript(auth, sheetId, script, fileName, content, userContext),
      delete: (sheetId, script) => scripts.deleteScript(auth, sheetId, script, userContext),
      run: (sheetId, script, functionName, parameters) => scripts.runScript(auth, sheetId, script, functionName, parameters, userContext)
    },
    gmail: {
      list: (query, maxResults) => gmail.listEmails(auth, query, maxResults, userContext),
      search: (query, maxResults) => gmail.searchEmails(auth, query, maxResults, userContext),
      read: (messageId) => gmail.readEmail(auth, messageId, userContext),
      send: (to, subject, body, cc, bcc) => gmail.sendEmail(auth, to, subject, body, cc, bcc, userContext),
      delete: (messageId) => gmail.deleteEmail(auth, messageId, userContext),
      trash: (messageId) => gmail.trashEmail(auth, messageId, userContext)
    }
  };
}

function createOAuthClient(tokens, clientId, clientSecret) {
  const { OAuth2Client } = require('google-auth-library');
  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

function createADCClient(scopes = DEFAULT_SCOPES) {
  const { GoogleAuth } = require('google-auth-library');
  return new GoogleAuth({ scopes });
}

function createTokenClient(accessToken) {
  const { OAuth2Client } = require('google-auth-library');
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

async function callTool(toolName, parameters, auth, userContext = {}) {
  const client = createClient(auth, userContext);
  const [namespace, operation] = toolName.split('_', 2);
  
  if (client[namespace] && typeof client[namespace][operation] === 'function') {
    return client[namespace][operation](...Object.values(parameters));
  }
  
  throw new Error(`Unknown tool: ${toolName}`);
}

export {
  createClient,
  createOAuthClient,
  createADCClient,
  createTokenClient,
  callTool,
  DEFAULT_SCOPES
};
