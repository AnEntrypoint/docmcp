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

async function checkDocumentStructure() {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
        
        const doc = await docs.documents.get({
            documentId: docId
        });
        
        console.log('Document Content Structure:');
        console.log('---------------------------');
        console.log('Length:', doc.data.body.content.length);
        console.log('First content block type:', doc.data.body.content[0].paragraph?.elements[0]?.textRun?.content ? 'Text' : doc.data.body.content[0].paragraph?.elements[0]?.inlineObjectElement ? 'Image' : JSON.stringify(doc.data.body.content[0].paragraph?.elements[0], null, 2));
        
        if (doc.data.body.content.length > 1) {
            console.log('');
            console.log('Additional content blocks:');
            for (let i = 1; i < doc.data.body.content.length; i++) {
                const content = doc.data.body.content[i];
                if (content.paragraph) {
                    console.log(`  ${i}: Paragraph (${content.paragraph.elements.length} elements)`);
                    const text = content.paragraph.elements.map(el => el.textRun?.content || '').join('');
                    if (text.length > 0) {
                        console.log(`    First ${Math.min(100, text.length)} chars: "${text.substring(0, 100)}"`);
                    }
                } else if (content.table) {
                    console.log(`  ${i}: Table (${content.table.rows.length} rows)`);
                }
            }
        }
        
        // Get full text content
        let fullText = '';
        doc.data.body.content.forEach(content => {
            if (content.paragraph) {
                fullText += content.paragraph.elements.map(el => el.textRun?.content || '').join('');
            }
        });
        
        console.log('');
        console.log('Full Text Content (first 200 chars):');
        console.log('-----------------------------------');
        console.log(fullText.substring(0, 200));
        
        // Find duplicate content
        const reportHeader = 'Promotional Emails Report';
        const reportFooter = '4. Periodically check for new promotional emails';
        
        const firstHeaderIndex = fullText.indexOf(reportHeader);
        const secondHeaderIndex = fullText.indexOf(reportHeader, firstHeaderIndex + 1);
        
        if (secondHeaderIndex !== -1) {
            console.log('');
            console.log('🔍 Duplicate report detected!');
            console.log(`- First report: ${firstHeaderIndex} to ${fullText.indexOf(reportFooter, firstHeaderIndex) + reportFooter.length}`);
            console.log(`- Second report: ${secondHeaderIndex} to ${fullText.indexOf(reportFooter, secondHeaderIndex) + reportFooter.length}`);
            
            // Delete the duplicate content
            const deleteStart = secondHeaderIndex;
            const deleteEnd = fullText.indexOf(reportFooter, secondHeaderIndex) + reportFooter.length;
            
            await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                    requests: [{
                        deleteContentRange: {
                            range: {
                                startIndex: deleteStart,
                                endIndex: deleteEnd
                            }
                        }
                    }]
                }
            });
            
            console.log('✅ Duplicate content removed');
        } else {
            console.log('');
            console.log('✅ No duplicate content found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

checkDocumentStructure();
