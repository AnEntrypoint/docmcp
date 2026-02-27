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

async function removeMarkdownAndFormat() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        // First, replace all markdown symbols
        const replaceRequests = [
            // Replace # with nothing
            {
                replaceAllText: {
                    containsText: {
                        text: '#',
                        matchCase: true
                    },
                    replaceText: ''
                }
            },
            // Replace ** with nothing (bold indicators)
            {
                replaceAllText: {
                    containsText: {
                        text: '**',
                        matchCase: true
                    },
                    replaceText: ''
                }
            },
            // Replace ### with nothing
            {
                replaceAllText: {
                    containsText: {
                        text: '###',
                        matchCase: true
                    },
                    replaceText: ''
                }
            },
            // Replace --- (horizontal rule) with blank line
            {
                replaceAllText: {
                    containsText: {
                        text: '---',
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

        // Now get the updated document to apply proper formatting
        const doc = await docs.documents.get({
            documentId: docId
        });
        
        const content = doc.data.body.content[0].paragraph.elements[0].textRun.content;
        
        // Find and format headings
        const formatRequests = [];
        let index = 1;
        
        // Find "Promotional Emails Report" - make it H1
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
        
        // Find section headings
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
        
        // Find email numbers (1., 2., 3.)
        const emailNumbers = ['1.', '2.', '3.'];
        emailNumbers.forEach(number => {
            let pos = content.indexOf(number);
            while (pos !== -1) {
                formatRequests.push({
                    updateTextStyle: {
                        range: {
                            startIndex: index + pos,
                            endIndex: index + pos + number.length
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
                pos = content.indexOf(number, pos + 1);
            }
        });

        // Apply the formatting
        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: formatRequests
            }
        });

        console.log('Markdown removed and document formatted successfully!');
        
    } catch (error) {
        console.error('Error processing document:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

removeMarkdownAndFormat();
