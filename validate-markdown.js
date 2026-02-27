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

export async function validateAndFixMarkdown(docId, fix = true) {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        
        console.log('📋 Validating document for markdown issues...');
        
        // Check document content
        const doc = await docs.documents.get({ documentId: docId });
        
        let hasIssues = false;
        const issues = [];
        const requests = [];
        
        // Check each paragraph for markdown
        doc.data.body.content.forEach((contentBlock, blockIndex) => {
            if (contentBlock.paragraph && contentBlock.paragraph.elements) {
                contentBlock.paragraph.elements.forEach((element, elemIndex) => {
                    if (element.textRun && element.textRun.content) {
                        const text = element.textRun.content;
                        
                        // Detect markdown patterns
                        if (text.includes('#')) {
                            hasIssues = true;
                            issues.push(`Markdown heading (#) in block ${blockIndex + 1}`);
                            if (fix) {
                                // Replace # characters directly in text content
                                const fixedText = text.replace(/\#+/g, '').trim();
                                requests.push({
                                    replaceAllText: {
                                        containsText: {
                                            text: text,
                                            matchCase: true
                                        },
                                        replaceText: fixedText
                                    }
                                });
                            }
                        }
                        
                        if (text.includes('**')) {
                            hasIssues = true;
                            issues.push(`Markdown bold (**) in block ${blockIndex + 1}`);
                            if (fix) {
                                const fixedText = text.replace(/\*\*/g, '');
                                requests.push({
                                    replaceAllText: {
                                        containsText: {
                                            text: text,
                                            matchCase: true
                                        },
                                        replaceText: fixedText
                                    }
                                });
                            }
                        }
                        
                        if (text.includes('---')) {
                            hasIssues = true;
                            issues.push(`Markdown horizontal rule (---) in block ${blockIndex + 1}`);
                            if (fix) {
                                const fixedText = text.replace(/---/g, '');
                                requests.push({
                                    replaceAllText: {
                                        containsText: {
                                            text: text,
                                            matchCase: true
                                        },
                                        replaceText: fixedText
                                    }
                                });
                            }
                        }
                    }
                });
            }
        });
        
        // Check for duplicate content
        let fullText = '';
        doc.data.body.content.forEach(contentBlock => {
            if (contentBlock.paragraph && contentBlock.paragraph.elements) {
                for (const element of contentBlock.paragraph.elements) {
                    if (element.textRun && element.textRun.content) {
                        fullText += element.textRun.content;
                    }
                }
            }
        });
        
        const reportHeader = 'Promotional Emails Report';
        const reportFooter = '4. Periodically check for new promotional emails';
        
        const firstReportStart = fullText.indexOf(reportHeader);
        const firstReportEnd = fullText.indexOf(reportFooter) + reportFooter.length;
        
        const secondReportStart = fullText.indexOf(reportHeader, firstReportStart + 1);
        const secondReportEnd = fullText.indexOf(reportFooter, secondReportStart + 1) + reportFooter.length;
        
        if (secondReportStart !== -1) {
            hasIssues = true;
            issues.push(`Duplicate report content found (${secondReportStart}-${secondReportEnd})`);
            if (fix) {
                requests.push({
                    deleteContentRange: {
                        range: {
                            startIndex: secondReportStart + 1,
                            endIndex: secondReportEnd + 1
                        }
                    }
                });
            }
        }
        
        // Execute fixes if needed
        if (fix && requests.length > 0) {
            console.log(`🔧 Fixing ${issues.length} issues...`);
            await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: { requests }
            });
            
            // Final check after fixes
            const fixedDoc = await docs.documents.get({ documentId: docId });
            let fixedText = '';
            fixedDoc.data.body.content.forEach(contentBlock => {
                if (contentBlock.paragraph && contentBlock.paragraph.elements) {
                    for (const element of contentBlock.paragraph.elements) {
                        if (element.textRun && element.textRun.content) {
                            fixedText += element.textRun.content;
                        }
                    }
                }
            });
            
            // Verify fixes
            const remainingIssues = [];
            if (fixedText.includes('#')) remainingIssues.push('Markdown heading (#)');
            if (fixedText.includes('**')) remainingIssues.push('Markdown bold (**)');
            if (fixedText.includes('---')) remainingIssues.push('Markdown horizontal rule (---)');
            
            const finalSecondReportStart = fixedText.indexOf(reportHeader, firstReportStart + 1);
            if (finalSecondReportStart !== -1) {
                remainingIssues.push('Duplicate report content');
            }
            
            if (remainingIssues.length === 0) {
                console.log('✅ All markdown issues fixed!');
            } else {
                console.log('⚠️  Some issues remain:', remainingIssues);
            }
        } else if (!hasIssues) {
            console.log('✅ No markdown issues detected');
        } else {
            console.log('⚠️  Issues detected but not fixed:', issues);
        }
        
        return {
            hasIssues,
            issues,
            fixed: fix && requests.length > 0
        };
        
    } catch (error) {
        console.error('❌ Error validating/fixing document:', error.message);
        console.error('Stack trace:', error.stack);
        return {
            hasIssues: true,
            issues: [error.message],
            fixed: false
        };
    }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const [docId] = process.argv.slice(2);
    if (!docId) {
        console.error('Usage: node validate-markdown.js <document-id>');
        process.exit(1);
    }
    validateAndFixMarkdown(docId, true).then(result => {
        if (result.hasIssues && !result.fixed) {
            process.exit(1);
        }
    });
}
