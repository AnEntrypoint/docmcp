# docmcp

Google Docs and Sheets MCP server. 40 tools for docs, sheets, and apps script.

## Setup

```bash
npm install
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
npx docmcp auth login
```

## MCP Config

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

Tokens stored at `~/.config/gcloud/docmcp/token.json`.
