import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

export function createOAuthClient(config) {
  return new OAuth2Client(
    config.oauth_client_id,
    config.oauth_client_secret,
    config.oauth_redirect_url
  );
}

export function createAuthMiddleware(jwtSecret) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid Authorization format' });
    }

    try {
      req.user = jwt.verify(parts[1], jwtSecret);
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export async function handleOAuthCallback(client, code, tokenStore, jwtSecret) {
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const userInfo = await oauth2.userinfo.get();
  const userId = userInfo.data.id;

  tokenStore.set(userId, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    email: userInfo.data.email,
    name: userInfo.data.name,
    created_at: Date.now()
  });

  const mcp_token = jwt.sign(
    { userId, email: userInfo.data.email, name: userInfo.data.name },
    jwtSecret,
    { expiresIn: '24h' }
  );

  return { mcp_token, user: userInfo.data };
}

export async function refreshToken(client, userId, tokenStore, jwtSecret) {
  const stored = tokenStore.get(userId);
  client.setCredentials({ refresh_token: stored.refresh_token });

  const { credentials } = await client.refreshAccessToken();
  stored.access_token = credentials.access_token;

  const mcp_token = jwt.sign(
    { userId, email: stored.email, name: stored.name },
    jwtSecret,
    { expiresIn: '24h' }
  );

  return mcp_token;
}
