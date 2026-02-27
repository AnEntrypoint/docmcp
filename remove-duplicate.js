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

async function checkAndRemoveDuplicate() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        // Get current document content
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
        
        console.log('Current document length:', fullText.length, 'characters');
        
        // Find duplicate content
        const duplicateText = '# Promotional Emails Report';
        const firstIndex = fullText.indexOf(duplicateText);
        const secondIndex = fullText.indexOf(duplicateText, firstIndex + 1);
        
        if (secondIndex !== -1) {
            console.log('✓ Found duplicate report starting at character:', secondIndex);
            
            // Find end of duplicate report - look for "Next Steps" followed by 4 items
            const endPattern = '4. Periodically check for new promotional emails';
            const duplicateEnd = fullText.indexOf(endPattern, secondIndex) + endPattern.length;
            
            // Remove the duplicate content
            await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                    requests: [
                        {
                            deleteContentRange: {
                                range: {
                                    startIndex: secondIndex + 1, // +1 to skip the first character (section break)
                                    endIndex: duplicateEnd + 1
                                }
                            }
                        }
                    ]
                }
            });
            
            console.log('✓ Duplicate content removed');
        } else {
            console.log('✓ No duplicate content found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

checkAndRemoveDuplicate();
