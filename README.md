# docmcp

Google Docs and Sheets MCP server. 40 tools for docs, sheets, and apps script.

## Setup

```bash
# Using npm
npm install

# Using bun (recommended)
bun install

# Option 1: Environment variables
export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
npx docmcp auth login

# Option 2: Local config file
# Create ~/.config/gcloud/docmcp/config.json with:
# {
#   "client_id": "your-client-id",
#   "client_secret": "your-client-secret"
# }
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

## Usage with Bun

```bash
# Run the MCP server with bun
bun run stdio-server.js

# Execute CLI commands with bun
bun x docmcp auth login
bun x docmcp docs list
```

Tokens stored at `~/.config/gcloud/docmcp/token.json`.
