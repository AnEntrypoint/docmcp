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

async function getDocumentUrl(docId) {
    try {
        const auth = await getAuth();
        const docs = google.docs({ version: 'v1', auth });
        
        const res = await docs.documents.get({
            documentId: docId
        });
        
        // Google Docs URL format: https://docs.google.com/document/d/{docId}/edit
        return `https://docs.google.com/document/d/${docId}/edit`;
        
    } catch (error) {
        console.error('Error getting document URL:', error.message);
        return null;
    }
}

async function getSpreadsheetUrl(sheetId) {
    try {
        const auth = await getAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        
        const res = await sheets.spreadsheets.get({
            spreadsheetId: sheetId
        });
        
        // Google Sheets URL format: https://docs.google.com/spreadsheets/d/{sheetId}/edit
        return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
        
    } catch (error) {
        console.error('Error getting spreadsheet URL:', error.message);
        return null;
    }
}

async function main() {
    const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
    const sheetId = '18neVS0HQ-jI-SDbyLw21uxh-K1FrpaxKfmOTP5qzyuI';
    
    const docUrl = await getDocumentUrl(docId);
    const sheetUrl = await getSpreadsheetUrl(sheetId);
    
    console.log('=== Promotional Emails Report URLs ===');
    console.log('');
    console.log('Google Docs Report:');
    console.log(docUrl);
    console.log('');
    console.log('Google Sheets Summary:');
    console.log(sheetUrl);
}

main();
