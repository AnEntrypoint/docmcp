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

async function finalizeFormatting() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        // Get current content
        const doc = await docs.documents.get({
            documentId: docId
        });
        
        let fullText = '';
        for (const contentBlock of doc.data.body.content) {
            if (contentBlock.paragraph && contentBlock.paragraph.elements) {
                for (const element of contentBlock.paragraph.elements) {
                    if (element.textRun && element.textRun.content) {
                        fullText += element.textRun.content;
                    }
                }
            }
        }
        
        // Clean up any remaining leftover formatting characters
        const finalRequests = [
            {
                replaceAllText: {
                    containsText: {
                        text: 'Promotional Emails ReportPromotional Emails Report',
                        matchCase: true
                    },
                    replaceText: 'Promotional Emails Report'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'Date: 2026-02-26Date: 2026-02-26',
                        matchCase: true
                    },
                    replaceText: 'Date: 2026-02-26'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'Prepared by: docmcp AssistantPrepared by: docmcp Assistant',
                        matchCase: true
                    },
                    replaceText: 'Prepared by: docmcp Assistant'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'SummarySummary',
                        matchCase: true
                    },
                    replaceText: 'Summary'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'Promotional Emails DetailsPromotional Emails Details',
                        matchCase: true
                    },
                    replaceText: 'Promotional Emails Details'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'AnalysisAnalysis',
                        matchCase: true
                    },
                    replaceText: 'Analysis'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'RecommendationsRecommendations',
                        matchCase: true
                    },
                    replaceText: 'Recommendations'
                }
            },
            {
                replaceAllText: {
                    containsText: {
                        text: 'Next StepsNext Steps',
                        matchCase: true
                    },
                    replaceText: 'Next Steps'
                }
            }
        ];

        await docs.documents.batchUpdate({
            documentId: docId,
            requestBody: {
                requests: finalRequests
            }
        });

        // Apply consistent spacing
        const spacingRequests = [
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
                requests: spacingRequests
            }
        });

        console.log('✓ Final formatting complete');
        
    } catch (error) {
        console.error('❌ Error finalizing formatting:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

finalizeFormatting();
