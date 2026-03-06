export {
  createClient,
  createOAuthClient,
  createADCClient,
  createTokenClient,
  callTool,
  DEFAULT_SCOPES
} from './sdk.js';

export * as docs from './docs.js';
export * as sheets from './sheets.js';
export * as sections from './docs-sections.js';
export * as media from './docs-media.js';
export * as scripts from './scripts.js';
export * as gmail from './gmail.js';

export {
  handleDocsToolCall,
  handleSheetsToolCall,
  handleGmailToolCall
} from './handlers.js';
