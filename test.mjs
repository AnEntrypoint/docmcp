import express from 'express';
import http from 'http';
import { getGoogleOAuthConfig, getStoredTokens, storeTokens, openBrowser } from './gcloud.js';

const app = express();
app.use(express.json());

const state = {
  server: null,
  port: parseInt(process.env.PORT || '9998'),
  config: null,
  mcp_token: null,
  user: null,
  step: 'init'
};

let callbackCode = null;
let callbackError = null;
let callbackReceived = false;

app.get('/oauth/authorize', (req, res) => {
  if (!state.config) return res.status(500).json({ error: 'Not initialized' });

  const params = new URLSearchParams({
    client_id: state.config.client_id,
    redirect_uri: state.config.redirect_uri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.json({ auth_url: authUrl });
});

app.get('/oauth/callback', (req, res) => {
  callbackCode = req.query.code;
  callbackError = req.query.error;
  callbackReceived = true;

  if (callbackError) {
    res.html(`<h1>Authorization Failed</h1><p>${callbackError}</p>`);
    return;
  }

  if (!callbackCode) {
    res.html('<h1>Missing authorization code</h1>');
    return;
  }

  res.html(`
    <html>
      <head><title>DocMCP - Authorized</title></head>
      <body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1>✓ Authorization Successful</h1>
        <p>You can close this window. Returning to terminal...</p>
        <script>window.close();</script>
      </body>
    </html>
  `);
});

app.post('/mcp/docs/read', (req, res) => {
  if (!state.mcp_token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'read', doc_id: req.body.doc_id, content: 'Test read successful' });
});

app.post('/mcp/docs/edit', (req, res) => {
  if (!state.mcp_token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'edited', doc_id: req.body.doc_id });
});

app.post('/mcp/docs/insert', (req, res) => {
  if (!state.mcp_token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'inserted', doc_id: req.body.doc_id });
});

app.post('/mcp/sheets/read', (req, res) => {
  if (!state.mcp_token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'read', sheet_id: req.body.sheet_id, values: [] });
});

app.post('/mcp/sheets/edit', (req, res) => {
  if (!state.mcp_token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'edited', sheet_id: req.body.sheet_id });
});

app.post('/mcp/sheets/insert', (req, res) => {
  if (!state.mcp_token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ status: 'inserted', sheet_id: req.body.sheet_id });
});

export async function start(opts = {}) {
  state.step = 'init';
  console.log('\n🚀 DocMCP Local Test Server\n');

  try {
    state.config = await getGoogleOAuthConfig();
    state.step = 'config-loaded';
    console.log('✓ OAuth config loaded');

    const stored = getStoredTokens();
    if (stored) {
      state.mcp_token = stored.mcp_token;
      state.user = stored.user;
      console.log(`✓ Cached token found for ${stored.user.email}`);
    }

    if (opts.skipAuth) {
      state.mcp_token = 'test-token-' + Date.now();
      state.user = { email: 'test@example.com', id: 'test-123', name: 'Test User' };
      console.log(`✓ Skipping auth, using test token for ${state.user.email}`);
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer(app);

      server.on('error', reject);

      server.listen(0, '127.0.0.1', async () => {
        state.port = server.address().port;
        state.server = server;
        state.config.oauth_redirect_url = `http://127.0.0.1:${state.port}/oauth/callback`;
        console.log(`✓ Server listening on http://127.0.0.1:${state.port}`);

        await new Promise(r => setTimeout(r, 100));

        if (state.mcp_token) {
          console.log('\n✓ Already authenticated\n');
          setTimeout(() => resolve(state), 500);
          return;
        }

        state.step = 'auth-start';
        console.log('\nStarting OAuth flow...\n');

        try {
          const redirectUri = encodeURIComponent(`http://127.0.0.1:${state.port}/oauth/callback`);
          const authRes = await fetch(`http://127.0.0.1:${state.port}/oauth/authorize?redirect_uri=${redirectUri}`);
          const { auth_url } = await authRes.json();

          console.log('Opening browser for authorization...\n');
          await openBrowser(auth_url);

          console.log('Waiting for authorization code...\n');

          const waitCode = () => {
            if (callbackReceived) {
              if (callbackError) {
                reject(new Error(callbackError));
                return;
              }
              if (!callbackCode) {
                reject(new Error('No authorization code received'));
                return;
              }

              state.step = 'code-received';
              console.log('✓ Authorization code received');

              const tokens = {
                code: callbackCode,
                mcp_token: 'jwt-token-' + Date.now(),
                user: { email: 'user@example.com', id: 'user-123', name: 'Test User' }
              };

              storeTokens(tokens);
              state.mcp_token = tokens.mcp_token;
              state.user = tokens.user;
              state.step = 'authenticated';

              console.log(`✓ Authenticated as ${tokens.user.email}\n`);
              resolve(state);
            } else {
              setTimeout(waitCode, 100);
            }
          };

          waitCode();
        } catch (err) {
          reject(new Error(`OAuth flow: ${err.message}`));
        }
      });
    });
  } catch (err) {
    throw new Error(`[${state.step}] ${err.message}`);
  }
}

export async function stop() {
  return new Promise((resolve) => {
    if (state.server) {
      state.server.close(resolve);
    } else {
      resolve();
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch(err => {
    console.error('✗', err.message);
    process.exit(1);
  });
}
