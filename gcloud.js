import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'gcloud', 'docmcp');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');

export async function getGoogleOAuthConfig() {
  const configPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(configPath)) {
    throw new Error('Create .env.local with GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
  }

  const env = fs.readFileSync(configPath, 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, val] = line.split('=');
      acc[key.trim()] = val.trim();
      return acc;
    }, {});

  return {
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URL || 'http://localhost:9998/oauth/callback'
  };
}

export function getStoredTokens() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function storeTokens(tokens) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  fs.chmodSync(TOKEN_FILE, 0o600);
}

export async function openBrowser(url) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';
    const proc = spawn(cmd, [url], { stdio: 'ignore' });
    proc.on('error', reject);
    setTimeout(resolve, 1000);
  });
}

export function parseAuthCode(callbackUrl) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) throw new Error(`OAuth error: ${error}`);
  if (!code) throw new Error('No authorization code in callback');

  return code;
}
