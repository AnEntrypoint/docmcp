export const STATIC_RESOURCES = [
  { uri: 'docmcp://status', name: 'docmcp_status', title: 'docmcp Status', description: 'Server status and capability summary', mimeType: 'application/json' },
  { uri: 'docmcp://gmail/profile', name: 'gmail_profile', title: 'Gmail Profile', description: 'Current Gmail account profile', mimeType: 'application/json' },
  { uri: 'docmcp://gmail/labels', name: 'gmail_labels', title: 'Gmail Labels', description: 'All Gmail labels and counts', mimeType: 'application/json' },
  { uri: 'docmcp://gmail/filters', name: 'gmail_filters', title: 'Gmail Filters', description: 'All Gmail filters', mimeType: 'application/json' },
  { uri: 'docmcp://docs/recent', name: 'docs_recent', title: 'Recent Docs', description: 'Recent Google Docs list', mimeType: 'application/json' },
  { uri: 'docmcp://sheets/recent', name: 'sheets_recent', title: 'Recent Sheets', description: 'Recent Google Sheets list', mimeType: 'application/json' }
];

export const RESOURCE_TEMPLATES = [
  { uriTemplate: 'docmcp://gmail/message/{messageId}', name: 'gmail_message', title: 'Gmail Message', description: 'Read a Gmail message by message ID', mimeType: 'application/json' },
  { uriTemplate: 'docmcp://docs/document/{docId}', name: 'docs_document', title: 'Google Doc Content', description: 'Read a Google Doc by document ID', mimeType: 'text/plain' },
  { uriTemplate: 'docmcp://sheets/spreadsheet/{sheetId}', name: 'sheets_sheet_default_range', title: 'Sheet Default Range', description: 'Read default range (Sheet1) from a spreadsheet', mimeType: 'application/json' },
  { uriTemplate: 'docmcp://sheets/spreadsheet/{sheetId}/range/{range}', name: 'sheets_sheet_range', title: 'Sheet Range', description: 'Read a specific range from a spreadsheet', mimeType: 'application/json' },
  { uriTemplate: 'docmcp://gmail/search/{query}', name: 'gmail_search_preview', title: 'Gmail Search Preview', description: 'Run Gmail search query and return recent matches', mimeType: 'application/json' }
];

export function jsonResource(uri, value) {
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }] };
}

export function textResource(uri, text) {
  return { contents: [{ uri, mimeType: 'text/plain', text }] };
}
