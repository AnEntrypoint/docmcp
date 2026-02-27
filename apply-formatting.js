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

async function applyBasicFormatting() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        // Get current document content
        const doc = await docs.documents.get({
            documentId: docId
        });
        
        const content = doc.data.body.content[0].paragraph.elements[0].textRun.content;
        
        const formatRequests = [];
        const index = 1;
        
        // Title
        const titlePos = content.indexOf('Promotional Emails Report');
        if (titlePos >= 0) {
            formatRequests.push({
                updateTextStyle: {
                    range: {
                        startIndex: index + titlePos,
                        endIndex: index + titlePos + 'Promotional Emails Report'.length
                    },
                    textStyle: {
                        bold: true,
                        fontSize: { magnitude: 24, unit: 'PT' },
                        foregroundColor: {
                            color: {
                                rgbColor: { red: 0, green: 0, blue: 0 }
                            }
                        }
                    },
                    fields: 'bold,fontSize,foregroundColor'
                }
            });
        }
        
        // Date and Prepared by
        const datePos = content.indexOf('Date: 2026-02-26');
        if (datePos >= 0) {
            formatRequests.push({
                updateTextStyle: {
                    range: {
                        startIndex: index + datePos,
                        endIndex: index + datePos + 'Date: 2026-02-26'.length
                    },
                    textStyle: {
                        bold: true,
                        fontSize: { magnitude: 14, unit: 'PT' },
                        foregroundColor: {
                            color: {
                                rgbColor: { red: 0.2, green: 0.2, blue: 0.2 }
                            }
                        }
                    },
                    fields: 'bold,fontSize,foregroundColor'
                }
            });
        }
        
        const preparedPos = content.indexOf('Prepared by: docmcp Assistant');
        if (preparedPos >= 0) {
            formatRequests.push({
                updateTextStyle: {
                    range: {
                        startIndex: index + preparedPos,
                        endIndex: index + preparedPos + 'Prepared by: docmcp Assistant'.length
                    },
                    textStyle: {
                        bold: true,
                        fontSize: { magnitude: 14, unit: 'PT' },
                        foregroundColor: {
                            color: {
                                rgbColor: { red: 0.2, green: 0.2, blue: 0.2 }
                            }
                        }
                    },
                    fields: 'bold,fontSize,foregroundColor'
                }
            });
        }
        
        // Section headings
        const headings = ['Summary', 'Promotional Emails Details', 'Analysis', 'Recommendations', 'Next Steps'];
        headings.forEach(heading => {
            let pos = content.indexOf(heading);
            while (pos !== -1) {
                formatRequests.push({
                    updateTextStyle: {
                        range: {
                            startIndex: index + pos,
                            endIndex: index + pos + heading.length
                        },
                        textStyle: {
                            bold: true,
                            fontSize: { magnitude: 18, unit: 'PT' },
                            foregroundColor: {
                                color: {
                                    rgbColor: { red: 0, green: 0.3, blue: 0.6 }
                                }
                            }
                        },
                        fields: 'bold,fontSize,foregroundColor'
                    }
                });
                pos = content.indexOf(heading, pos + 1);
            }
        });
        
        // Email numbers
        const emailNumbers = ['1. Pinnacle Promotion', '2. AutoTrader Newsletter', '3. Procompare Lead Generation'];
        emailNumbers.forEach(email => {
            let pos = content.indexOf(email);
            while (pos !== -1) {
                formatRequests.push({
                    updateTextStyle: {
                        range: {
                            startIndex: index + pos,
                            endIndex: index + pos + email.length
                        },
                        textStyle: {
                            bold: true,
                            fontSize: { magnitude: 14, unit: 'PT' },
                            foregroundColor: {
                                color: {
                                    rgbColor: { red: 0, green: 0.4, blue: 0.8 }
                                }
                            }
                        },
                        fields: 'bold,fontSize,foregroundColor'
                    }
                });
                pos = content.indexOf(email, pos + 1);
            }
        });
        
        // Apply formatting
        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: formatRequests
            }
        });

        console.log('Basic formatting applied successfully!');
        
    } catch (error) {
        console.error('Error applying formatting:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

applyBasicFormatting();
