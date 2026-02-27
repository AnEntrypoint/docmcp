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

async function formatDocument() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        const requests = [
            // Format title as H1
            {
                updateTextStyle: {
                    range: {
                        startIndex: 1,
                        endIndex: 27  // "# Promotional Emails Report"
                    },
                    textStyle: {
                        bold: true,
                        fontSize: {
                            magnitude: 24,
                            unit: 'PT'
                        },
                        foregroundColor: {
                            color: {
                                rgbColor: {
                                    red: 0.0,
                                    green: 0.0,
                                    blue: 0.0
                                }
                            }
                        }
                    },
                    fields: 'bold,fontSize,foregroundColor'
                }
            },
            // Format date and prepared by as H2
            {
                updateTextStyle: {
                    range: {
                        startIndex: 28,
                        endIndex: 67  // "## Date: 2026-02-26\n## Prepared by: docmcp Assistant"
                    },
                    textStyle: {
                        bold: true,
                        fontSize: {
                            magnitude: 16,
                            unit: 'PT'
                        },
                        foregroundColor: {
                            color: {
                                rgbColor: {
                                    red: 0.2,
                                    green: 0.2,
                                    blue: 0.2
                                }
                            }
                        }
                    },
                    fields: 'bold,fontSize,foregroundColor'
                }
            },
            // Format section headings
            {
                updateTextStyle: {
                    range: {
                        startIndex: 70,
                        endIndex: 84  // "## Summary"
                    },
                    textStyle: {
                        bold: true,
                        fontSize: {
                            magnitude: 18,
                            unit: 'PT'
                        },
                        foregroundColor: {
                            color: {
                                rgbColor: {
                                    red: 0.0,
                                    green: 0.3,
                                    blue: 0.6
                                }
                            }
                        }
                    },
                    fields: 'bold,fontSize,foregroundColor'
                }
            }
        ];

        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: requests
            }
        });

        console.log('Document formatted successfully!');
        
    } catch (error) {
        console.error('Error formatting document:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

formatDocument();
