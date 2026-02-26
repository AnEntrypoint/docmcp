# docmcp

Google Docs and Sheets MCP server. 52 tools for docs, sheets, Gmail, and apps script.

## HTTP Streaming Server (New!)

docmcp now supports an authenticated HTTP streaming server with Google login. This allows remote connections via SSE (Server-Sent Events) transport.

## Setup

### HTTP Server Dependencies
The HTTP server requires additional dependencies:

```bash
npm install  # Install all dependencies including HTTP server
```

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

## Coolify Deployment (Nixpacks Compatible)

docmcp is now Nixpacks compatible and can be easily deployed on Coolify. The server will automatically start the HTTP authentication server on port 3000.

### Deployment Steps

#### 1. Prepare Configuration
- **Google OAuth Credentials**: Create a Web Application type OAuth 2.0 client in Google Cloud Console
- **Redirect URI**: Use `https://your-domain.com/auth/callback` (replace with your actual domain)
- **CORS Origin**: Use `https://your-domain.com` (replace with your actual domain)

#### 2. Coolify Deployment
1. Connect your GitHub/GitLab repository to Coolify
2. Create a new application
3. Select "Nixpacks" as the build pack
4. Configure environment variables:

```env
# Required
GOOGLE_OAUTH_CLIENT_ID=your-web-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-web-client-secret
REDIRECT_URI=https://your-domain.com/auth/callback
CORS_ORIGIN=https://your-domain.com

# Optional
PORT=3000
HOST=0.0.0.0
```

#### 3. Verify Deployment
- After deployment, access the health check: `https://your-domain.com/`
- Verify the server is running: `https://your-domain.com/status`

### Nixpacks Configuration
The following files are included for Nixpacks support:
- `nixpacks.toml`: Nixpacks configuration file
- `Dockerfile`: Docker configuration for containerized deployments
- `package.json`: Updated with production-ready scripts

### HTTP Streaming Server Usage (Multi-User)

### Starting the HTTP Server for Remote Hosting
```bash
# Start HTTP server on all network interfaces
npm run http -- --port 3333 --host 0.0.0.0

# Using custom CORS configuration (required for remote clients)
CORS_ORIGIN="https://your-domain.com" npm run http -- --port 3333 --host 0.0.0.0

# Using custom OAuth redirect URI
REDIRECT_URI="https://your-domain.com/auth/callback" npm run http -- --port 3333 --host 0.0.0.0

# Using bun
bun run http -- --port 3333 --host 0.0.0.0
```

### Server Endpoints
- **Health Check**: `GET /` - Returns server status, version, and active sessions
- **Login**: `GET /auth/login` - Initiates Google OAuth 2.0 login flow (returns sessionId and authUrl)
- **Callback**: `GET /auth/callback` - Google OAuth callback handler (exchange code for tokens)
- **SSE Connection**: `GET /sse/:sessionId` - Establishes SSE streaming connection per session
- **Message**: `POST /message` - Sends messages to the server (with sessionId query parameter or X-Session-ID header)
- **Status**: `GET /status` - Returns detailed server status and session statistics

### Usage Flow for Remote Users
1. **Server Setup**: Admin starts the server with `--host 0.0.0.0` to allow remote connections
2. **User Authentication**:
   - User sends `GET /auth/login` request
   - Server responds with sessionId and authentication URL
   - User opens authentication URL in browser and completes Google login
3. **Streaming Connection**: User establishes SSE connection to `/sse/:sessionId`
4. **MCP Communication**: User sends MCP messages to `/message` endpoint with sessionId

### Multi-User Authentication Features
- **Per-User Tokens**: Each user's Google tokens are stored in memory during their session
- **Session Management**: Sessions timeout automatically and tokens are cleared
- **Security**: Tokens never leave the server; communication is session-based
- **Audit Logs**: Server logs show session creation, authentication, and connection events

### Remote Hosting Configuration

#### Google Cloud Console Setup
1. Create OAuth 2.0 Credentials (Web Application type)
2. Add authorized redirect URIs:
   - `http://localhost:3333/auth/callback` (for local testing)
   - `https://your-domain.com/auth/callback` (for production)
3. Add authorized JavaScript origins
4. Note your Client ID and Client Secret

#### Environment Variables
```bash
# Required for remote hosting
export GOOGLE_OAUTH_CLIENT_ID="your-web-client-id"
export GOOGLE_OAUTH_CLIENT_SECRET="your-web-client-secret"
export REDIRECT_URI="https://your-domain.com/auth/callback"
export CORS_ORIGIN="https://your-domain.com"

# Optional
export PORT=3333
export HOST=0.0.0.0
```

## MCP Config

### Stdio Transport (Default)
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

### HTTP Transport (New!)
For HTTP streaming connections, use MCP clients that support SSE transport:
```json
{
  "mcpServers": {
    "docmcp": {
      "command": "npx",
      "args": ["docmcp-http"],
      "env": {
        "GOOGLE_OAUTH_CLIENT_ID": "your-client-id",
        "GOOGLE_OAUTH_CLIENT_SECRET": "your-client-secret"
      },
      "transport": "sse",
      "url": "http://localhost:3333"
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
