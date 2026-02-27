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
        
        // Get current document content to find positions
        const doc = await docs.documents.get({
            documentId: docId
        });
        
        let currentContent = '';
        if (doc.data.body.content.length > 0 && doc.data.body.content[0].paragraph && doc.data.body.content[0].paragraph.elements) {
            currentContent = doc.data.body.content[0].paragraph.elements.map(el => el.textRun?.content || '').join('');
        }
        
        const formatRequests = [
            // Title
            {
                updateTextStyle: {
                    range: {
                        startIndex: 1,
                        endIndex: 'Promotional Emails Report'.length + 1
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
            },
            // Date and Prepared by
            {
                updateTextStyle: {
                    range: {
                        startIndex: 'Promotional Emails Report'.length + 2,
                        endIndex: 'Promotional Emails Report\nDate: 2026-02-26\nPrepared by: docmcp Assistant'.length + 1
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
            },
            // Section headings
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('Summary') + 1,
                        endIndex: currentContent.indexOf('Summary') + 'Summary'.length + 1
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
            },
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('Promotional Emails Details') + 1,
                        endIndex: currentContent.indexOf('Promotional Emails Details') + 'Promotional Emails Details'.length + 1
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
            },
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('Analysis') + 1,
                        endIndex: currentContent.indexOf('Analysis') + 'Analysis'.length + 1
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
            },
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('Recommendations') + 1,
                        endIndex: currentContent.indexOf('Recommendations') + 'Recommendations'.length + 1
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
            },
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('Next Steps') + 1,
                        endIndex: currentContent.indexOf('Next Steps') + 'Next Steps'.length + 1
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
            },
            // Email headings
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('1. Pinnacle Promotion') + 1,
                        endIndex: currentContent.indexOf('1. Pinnacle Promotion') + '1. Pinnacle Promotion'.length + 1
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
            },
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('2. AutoTrader Newsletter') + 1,
                        endIndex: currentContent.indexOf('2. AutoTrader Newsletter') + '2. AutoTrader Newsletter'.length + 1
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
            },
            {
                updateTextStyle: {
                    range: {
                        startIndex: currentContent.indexOf('3. Procompare Lead Generation') + 1,
                        endIndex: currentContent.indexOf('3. Procompare Lead Generation') + '3. Procompare Lead Generation'.length + 1
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
            }
        ];

        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: formatRequests
            }
        });

        console.log('✅ Basic formatting applied');
        
    } catch (error) {
        console.error('❌ Error applying formatting:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

applyBasicFormatting();
