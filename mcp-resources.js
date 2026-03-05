import { google } from 'googleapis';
import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as gmail from './gmail.js';

const STATIC_RESOURCES = [
  {
    uri: 'docmcp://status',
    name: 'docmcp_status',
    title: 'docmcp Status',
    description: 'Server status and capability summary',
    mimeType: 'application/json'
  },
  {
    uri: 'docmcp://gmail/profile',
    name: 'gmail_profile',
    title: 'Gmail Profile',
    description: 'Current Gmail account profile',
    mimeType: 'application/json'
  },
  {
    uri: 'docmcp://gmail/labels',
    name: 'gmail_labels',
    title: 'Gmail Labels',
    description: 'All Gmail labels and counts',
    mimeType: 'application/json'
  },
  {
    uri: 'docmcp://gmail/filters',
    name: 'gmail_filters',
    title: 'Gmail Filters',
    description: 'All Gmail filters',
    mimeType: 'application/json'
  },
  {
    uri: 'docmcp://docs/recent',
    name: 'docs_recent',
    title: 'Recent Docs',
    description: 'Recent Google Docs list',
    mimeType: 'application/json'
  },
  {
    uri: 'docmcp://sheets/recent',
    name: 'sheets_recent',
    title: 'Recent Sheets',
    description: 'Recent Google Sheets list',
    mimeType: 'application/json'
  }
];

const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'docmcp://gmail/message/{messageId}',
    name: 'gmail_message',
    title: 'Gmail Message',
    description: 'Read a Gmail message by message ID',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'docmcp://docs/document/{docId}',
    name: 'docs_document',
    title: 'Google Doc Content',
    description: 'Read a Google Doc by document ID',
    mimeType: 'text/plain'
  },
  {
    uriTemplate: 'docmcp://sheets/spreadsheet/{sheetId}',
    name: 'sheets_sheet_default_range',
    title: 'Sheet Default Range',
    description: 'Read default range (Sheet1) from a spreadsheet',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'docmcp://sheets/spreadsheet/{sheetId}/range/{range}',
    name: 'sheets_sheet_range',
    title: 'Sheet Range',
    description: 'Read a specific range from a spreadsheet',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'docmcp://gmail/search/{query}',
    name: 'gmail_search_preview',
    title: 'Gmail Search Preview',
    description: 'Run Gmail search query and return recent matches',
    mimeType: 'application/json'
  }
];

function jsonResource(uri, value) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function textResource(uri, text) {
  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text
      }
    ]
  };
}

export function listStaticResources() {
  return STATIC_RESOURCES;
}

export function listResourceTemplates() {
  return RESOURCE_TEMPLATES;
}

export function readPublicResource(uri) {
  if (uri === 'docmcp://status') {
    return jsonResource(uri, {
      service: 'docmcp',
      resources: STATIC_RESOURCES.length,
      resourceTemplates: RESOURCE_TEMPLATES.length
    });
  }
  throw new Error(`Authentication required to read resource: ${uri}`);
}

export async function readResource(auth, uri) {
  if (uri === 'docmcp://status') {
    return jsonResource(uri, {
      service: 'docmcp',
      resources: STATIC_RESOURCES.length,
      resourceTemplates: RESOURCE_TEMPLATES.length
    });
  }

  if (uri === 'docmcp://gmail/profile') {
    const gmailApi = google.gmail({ version: 'v1', auth });
    const res = await gmailApi.users.getProfile({ userId: 'me' });
    return jsonResource(uri, res.data);
  }

  if (uri === 'docmcp://gmail/labels') {
    const res = await gmail.getLabels(auth);
    return jsonResource(uri, res);
  }

  if (uri === 'docmcp://gmail/filters') {
    const res = await gmail.listFilters(auth);
    return jsonResource(uri, res);
  }

  if (uri === 'docmcp://docs/recent') {
    const res = await docs.listDocuments(auth, 20, null);
    return jsonResource(uri, res);
  }

  if (uri === 'docmcp://sheets/recent') {
    const res = await sheets.listSpreadsheets(auth, 20, null);
    return jsonResource(uri, res);
  }

  const gmailMessageMatch = uri.match(/^docmcp:\/\/gmail\/message\/(.+)$/);
  if (gmailMessageMatch) {
    const messageId = decodeURIComponent(gmailMessageMatch[1]);
    const res = await gmail.readEmail(auth, messageId, 'full');
    return jsonResource(uri, res);
  }

  const docMatch = uri.match(/^docmcp:\/\/docs\/document\/(.+)$/);
  if (docMatch) {
    const docId = decodeURIComponent(docMatch[1]);
    const content = await docs.readDocument(auth, docId);
    return textResource(uri, content);
  }

  const sheetRangeMatch = uri.match(/^docmcp:\/\/sheets\/spreadsheet\/([^/]+)\/range\/(.+)$/);
  if (sheetRangeMatch) {
    const sheetId = decodeURIComponent(sheetRangeMatch[1]);
    const range = decodeURIComponent(sheetRangeMatch[2]);
    const res = await sheets.readSheet(auth, sheetId, range);
    return jsonResource(uri, res);
  }

  const sheetDefaultMatch = uri.match(/^docmcp:\/\/sheets\/spreadsheet\/([^/]+)$/);
  if (sheetDefaultMatch) {
    const sheetId = decodeURIComponent(sheetDefaultMatch[1]);
    const res = await sheets.readSheet(auth, sheetId, 'Sheet1');
    return jsonResource(uri, res);
  }

  const gmailSearchMatch = uri.match(/^docmcp:\/\/gmail\/search\/(.+)$/);
  if (gmailSearchMatch) {
    const query = decodeURIComponent(gmailSearchMatch[1]);
    const res = await gmail.searchEmails(auth, query, 20);
    return jsonResource(uri, res);
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}
