import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');
const ADC_FILE = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects'
];

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

export async function getAuth() {
  if (process.env.DOCMCP_USE_ADC === '1' || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }
  if (fs.existsSync(ADC_FILE) && !process.env.GOOGLE_OAUTH_CLIENT_ID) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }
  const tokens = loadTokens();
  if (tokens && tokens.client_id && tokens.client_secret) {
    const client = new OAuth2Client(tokens.client_id, tokens.client_secret);
    client.setCredentials(tokens);
    return client;
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('No auth configured. Set GOOGLE_OAUTH_CLIENT_ID/SECRET env vars, or run: gdoc.mjs auth');
  }
  if (!tokens) {
    throw new Error(`No tokens at ${TOKEN_FILE}. Run: gdoc.mjs auth`);
  }
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);
  return client;
}

export async function runAuthFlow() {
  const tokens = loadTokens();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || tokens?.client_id;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || tokens?.client_secret;
  if (!clientId || !clientSecret) {
    return { error: 'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars first' };
  }
  const port = 9998;
  const redirectUri = `http://localhost:${port}/callback`;
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const authUrl = client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith('/callback')) { res.writeHead(404); res.end(); return; }
      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(400); res.end(`Error: ${error}`);
        server.close(); resolve({ error }); return;
      }
      if (!code) { res.writeHead(400); res.end('No code'); return; }
      try {
        const { tokens: newTokens } = await client.getToken(code);
        newTokens.client_id = clientId;
        newTokens.client_secret = clientSecret;
        const configDir = path.dirname(TOKEN_FILE);
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokens, null, 2));
        fs.chmodSync(TOKEN_FILE, 0o600);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Success!</h1><p>You can close this window.</p></body></html>');
        server.close();
        resolve({ authenticated: true, scopes: newTokens.scope, tokenFile: TOKEN_FILE });
      } catch (err) {
        res.writeHead(500); res.end(err.message);
        server.close(); resolve({ error: err.message });
      }
    });
    server.listen(port);
    resolve({ authUrl, port, message: 'Open the authUrl in a browser to authenticate' });
  });
}
