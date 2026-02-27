import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { OAuth2Client } from 'google-auth-library';

const TOKEN_PATH = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');
const CONFIG_PATH = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'config.json');

function loadTokens() {
    if (!fs.existsSync(TOKEN_PATH)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

async function getAuth() {
    const tokens = loadTokens();
    const config = loadConfig();
    
    if (tokens && config && config.client_id && config.client_secret) {
        const client = new OAuth2Client(config.client_id, config.client_secret);
        client.setCredentials(tokens);
        return client;
    }
    throw new Error('Authentication configuration not found');
}

async function removeAllMarkdown() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        const replaceRequests = [
            // Replace all # symbols with nothing
            {
                replaceAllText: {
                    containsText: {
                        text: '#',
                        matchCase: true
                    },
                    replaceText: ''
                }
            },
            // Replace all ** symbols with nothing (bold indicators)
            {
                replaceAllText: {
                    containsText: {
                        text: '**',
                        matchCase: true
                    },
                    replaceText: ''
                }
            },
            // Replace all --- horizontal rules with blank line
            {
                replaceAllText: {
                    containsText: {
                        text: '---',
                        matchCase: true
                    },
                    replaceText: '\n'
                }
            },
            // Replace multiple newlines with single newline for cleaner spacing
            {
                replaceAllText: {
                    containsText: {
                        text: '\n\n\n',
                        matchCase: true
                    },
                    replaceText: '\n\n'
                }
            }
        ];

        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: replaceRequests
            }
        });

        console.log('✓ All markdown symbols removed');
        
    } catch (error) {
        console.error('❌ Error removing markdown:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

removeAllMarkdown();
