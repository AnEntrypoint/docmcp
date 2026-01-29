# docmcp

Google Docs and Sheets MCP server with OAuth authentication. 40 tools for reading, editing, formatting, and managing documents and spreadsheets.

## Installation

```bash
npm install -g docmcp
```

Or use directly with npx:

```bash
npx docmcp auth login
```

## Requirements

- Node.js 20.0.0 or higher
- Google OAuth credentials (client ID and secret)

## Environment Variables

```bash
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
```

## Authentication

```bash
npx docmcp auth login
```

Opens browser for Google OAuth. Tokens stored at `~/.config/gcloud/docmcp/token.json`.

### Re-Authentication

To re-authenticate or refresh credentials:

```bash
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
npx docmcp auth login
```

This will start a new OAuth flow and replace the old tokens with fresh ones.

### Token Status

Check current authentication status:

```bash
npx docmcp auth status
```

Shows expiry date and scopes of current token.

### Automatic Token Refresh

The library automatically refreshes expired tokens using the refresh token. No manual action needed when tokens expire, as long as the refresh token is valid.

## MCP Server Usage

Add to Claude Desktop or other MCP clients:

```json
{
  "mcpServers": {
    "docmcp": {
      "command": "npx",
      "args": ["docmcp-mcp"],
      "env": {
        "GOOGLE_OAUTH_CLIENT_ID": "your-client-id",
        "GOOGLE_OAUTH_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

## Tools

### Google Docs (14 tools)

| Tool | Description |
|------|-------------|
| docs_create | create new doc returns id and title |
| docs_read | read doc text content |
| docs_edit | replace text in doc old_text must be unique unless replace_all true |
| docs_insert | insert text at position end index or after text |
| docs_delete | delete text from doc |
| docs_get_info | get doc metadata title dates owners |
| docs_get_structure | get doc structure headings hierarchy |
| docs_list | list docs optionally filtered by name |
| docs_format | format text bold italic colors fonts alignment headings |
| docs_insert_table | insert table with rows and cols |
| docs_batch | execute multiple doc operations in one batch |
| docs_get_sections | parse doc return sections with name level start end indices |
| docs_section | delete move or replace section by name or index |
| docs_image | insert list delete or replace image in doc |

### Google Sheets (20 tools)

| Tool | Description |
|------|-------------|
| sheets_create | create new spreadsheet returns id and title |
| sheets_read | read values from range returns 2D array |
| sheets_edit | update values in range overwrites with new values |
| sheets_insert | append rows after existing data |
| sheets_get_cell | get single cell value |
| sheets_set_cell | set single cell value replaces content |
| sheets_edit_cell | replace text in cell old_text must be unique unless replace_all true |
| sheets_find_replace | find and replace text across all cells in sheet |
| sheets_get_info | get spreadsheet metadata title tabs dimensions owners |
| sheets_list | list spreadsheets optionally filtered by name |
| sheets_tab | add delete or rename sheet tab |
| sheets_clear | clear values from range optionally clear formatting |
| sheets_format | format range colors fonts alignment borders number formats |
| sheets_merge | merge or unmerge cells in range |
| sheets_freeze | freeze rows and columns in tab 0 to unfreeze |
| sheets_sort | sort range by column |
| sheets_rows_cols | insert or delete rows or columns |
| sheets_dimension_size | set column width or row height in pixels |
| sheets_get_formula | get cell formula and value |
| sheets_batch | execute multiple operations in one batch |

### Apps Script (6 tools)

| Tool | Description |
|------|-------------|
| scripts_create | create apps script project attached to spreadsheet |
| scripts_list | list scripts attached to spreadsheet |
| scripts_read | read script content including all files |
| scripts_write | write or edit script file content mode edit for old_text new_text replacement mode write for full overwrite |
| scripts_delete | delete script from spreadsheet |
| scripts_run | execute function in script must be deployed as API executable |

## CLI Usage

```bash
# Read document
npx docmcp docs read <doc_id>

# Edit document with exact text replacement
npx docmcp docs edit <doc_id> --old "find this" --new "replace with"

# Insert text
npx docmcp docs insert <doc_id> --text "content" --position end

# Read spreadsheet
npx docmcp sheets read <sheet_id> "Sheet1!A1:D10"

# Get cell
npx docmcp sheets cell get <sheet_id> A1

# Set cell
npx docmcp sheets cell set <sheet_id> A1 "value"

# Edit cell text
npx docmcp sheets cell edit <sheet_id> A1 --old "2024" --new "2025"

# Find and replace across sheet
npx docmcp sheets find-replace <sheet_id> --find "old" --replace "new"
```

## Edit Semantics

Edit tools match Claude Edit tool behavior:

1. old_text must appear exactly once unless replace_all is true
2. Exact matching including whitespace and punctuation
3. Clear errors when text not found or multiple matches
4. Replacement count in success response

## Re-Authentication Reference

### Architecture

OAuth 2.0 with Google. Tokens stored at `~/.config/gcloud/docmcp/token.json` with 0o600 permissions.

Token file contains: access_token, refresh_token, scope, token_type, expiry_date, client_id, client_secret.

### How to Re-Authenticate

```bash
export GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
npx docmcp auth login
```

Launches browser OAuth flow. Opens on localhost:9998. Replaces old tokens with new ones.

### Alternative: Direct Code Exchange

```bash
npx docmcp auth exchange CODE_HERE http://localhost:9998/callback
```

### Validation

Check status:
```bash
npx docmcp auth status
```

Test API access:
```bash
npx docmcp docs create "Test Document"
```

### Token Refresh

Automatic. Library uses refresh_token to obtain new access_token when expired. No manual action needed.

If refresh fails, run auth login again.

### Troubleshooting

- "No tokens found" → Run auth login first
- "Invalid token" → Token expired and refresh failed. Re-authenticate.
- Port 9998 in use → Kill process: `lsof -ti :9998 | xargs kill -9`
- Browser doesn't open → Copy auth URL from console manually
- Missing credentials → Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars

### Implementation Details

CLI: `/config/docmcp/cli.js` lines 88-176 (login flow)
OAuth: `/config/docmcp/oauth.js` (OAuth2Client, token refresh)
Auth Routes: `/config/docmcp/auth-routes.js` (HTTP endpoints)
Server: `/config/docmcp/server.js` (Express endpoints)
Conversational: `/config/docmcp/conversational-auth.js` (Interactive auth)

### Verified Working

Tested with real Google APIs. Token auto-refresh works. Document creation succeeds after refresh.

## License

MIT
