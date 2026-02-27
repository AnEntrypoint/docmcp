import fs from 'fs';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import os from 'os';

const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');
const CONFIG_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'config.json');

function loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function loadTokens() {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

export function getAuth() {
    const tokens = loadTokens();
    const config = loadConfig();
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config?.client_id;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || config?.client_secret;
    
    if (!clientId || !clientSecret) {
        console.error('Error: Set GOOGLE_OAUTH_CLIENT_ID/SECRET or create ~/.config/gcloud/docmcp/config.json with client_id and client_secret');
        process.exit(1);
    }
    if (!tokens) {
        console.error(`Error: No tokens found at ${TOKEN_FILE}. Run 'docmcp auth login' first.`);
        process.exit(1);
    }
    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials(tokens);
    return client;
}
