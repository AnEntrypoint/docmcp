const READ_ONLY_PREFIXES = [
  'docs_read',
  'docs_get_',
  'docs_list',
  'drive_search',
  'sheets_read',
  'sheets_get_',
  'sheets_list',
  'scripts_list',
  'scripts_read',
  'scripts_sync',
  'gmail_list',
  'gmail_search',
  'gmail_read',
  'gmail_get_',
  'gmail_download_attachment'
];

const DESTRUCTIVE_PREFIXES = [
  'docs_delete',
  'gmail_delete',
  'gmail_trash',
  'scripts_delete',
  'sheets_clear'
];

const IDEMPOTENT_PREFIXES = [
  'docs_read',
  'docs_get_',
  'docs_list',
  'drive_search',
  'sheets_read',
  'sheets_get_',
  'sheets_list',
  'scripts_list',
  'scripts_read',
  'scripts_sync',
  'gmail_list',
  'gmail_search',
  'gmail_read',
  'gmail_get_'
];

function hasPrefix(name, prefixes) {
  return prefixes.some((prefix) => name.startsWith(prefix));
}

function toTitle(name) {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toUseThisWhen(description) {
  const clean = String(description || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.length > 72 ? `${clean.slice(0, 72).trimEnd()}...` : clean;
}

function compactSchemaDescriptions(input) {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(compactSchemaDescriptions);

  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'description' && typeof v === 'string') {
      const compact = v.trim().replace(/\s+/g, ' ');
      out[k] = compact.length > 48 ? `${compact.slice(0, 48).trimEnd()}...` : compact;
      continue;
    }
    out[k] = compactSchemaDescriptions(v);
  }
  return out;
}

export function enrichToolsForApps(tools) {
  const compactMode = process.env.DOCMCP_COMPACT_TOOL_METADATA !== '0';
  return tools.map((tool) => {
    const readOnly = hasPrefix(tool.name, READ_ONLY_PREFIXES);
    const destructive = hasPrefix(tool.name, DESTRUCTIVE_PREFIXES);
    const idempotent = hasPrefix(tool.name, IDEMPOTENT_PREFIXES);
    return {
      ...tool,
      title: tool.title || toTitle(tool.name),
      description: compactMode ? toUseThisWhen(tool.description) : tool.description,
      inputSchema: compactMode ? compactSchemaDescriptions(tool.inputSchema) : tool.inputSchema,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: destructive,
        idempotentHint: idempotent,
        openWorldHint: false,
        ...(tool.annotations || {})
      },
      _meta: {
        ...(tool._meta || {}),
        'openai/toolInvocation/invoking': 'Working in Google Workspace...',
        'openai/toolInvocation/invoked': 'Google Workspace operation complete.'
      }
    };
  });
}
