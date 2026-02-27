#!/usr/bin/env node
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TOKEN_FILE = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

async function getAuth() {
  const tokens = loadTokens();
  if (tokens && tokens.client_id && tokens.client_secret) {
    const client = new OAuth2Client(tokens.client_id, tokens.client_secret);
    client.setCredentials(tokens);
    return client;
  }
  throw new Error(`No tokens found at ${TOKEN_FILE}. Run 'docmcp auth login' first.`);
}

async function updateDocumentContent(auth, docId, content) {
  const docs = google.docs({ version: 'v1', auth });
  
  const requests = [
    {
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: 10000
        }
      }
    },
    {
      insertText: {
        location: {
          index: 1
        },
        text: content
      }
    }
  ];
  
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: requests
    }
  });
  
  console.log('Document content updated');
}

async function main() {
  try {
    const auth = await getAuth();
    const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
    
    const content = `# Promotional Emails Report
## Date: 2026-02-26
## Prepared by: docmcp Assistant

---

## Summary
This report contains information about promotional emails received in the last 24 hours. It includes details about senders, subjects, timestamps, and categorization.

## Total Promotional Emails Found: 3

---

## Promotional Emails Details

### 1. Pinnacle Promotion
- **Date**: Thu, 26 Feb 2026 12:00:19 UTC
- **Sender**: promotions@pinnacle.co.za
- **Subject**: Pinnacle FireSale: Unlock Exceptional Service with In-Stock Opportunities
- **Recipient**: Vos James <admin@coas.co.za>
- **Category**: CATEGORY_UPDATES
- **Status**: UNREAD
- **Snippet**: 🚨 Limited-Time Steals❗️  
- **Current Label**: Label_48 (custom label)

---

### 2. AutoTrader Newsletter
- **Date**: Thu, 26 Feb 2026 12:02:07 +0200
- **Sender**: newsletter@autotrader.co.za
- **Subject**: VW's Amarok, a rival to the Raptor?
- **Recipient**: admin@coas.co.za
- **Category**: CATEGORY_PROMOTIONS
- **Status**: UNREAD
- **Snippet**: VW takes on SA's performance bakkies with new turbopetrol Amarok, Audi RS Q8 performance review, Honda Amaze long-term update, Chery's diesel PHEV bakkie KP31 coming to Mzansi! We drive the new
- **Current Label**: Label_48 (custom label)

---

### 3. Procompare Lead Generation
- **Date**: Thu, 26 Feb 2026 07:41:13 UTC
- **Sender**: robyn@procompare.co.za
- **Subject**: Client needs an Accountant. Interested?
- **Recipient**: admin@coas.co.za
- **Category**: CATEGORY_UPDATES
- **Status**: UNREAD
- **Snippet**: Hey there, A new request for an Accountant in your area just came in. Would you be interested in quoting for this job? Act fast – the first to respond gets the lead for free! Contact Client Category:
- **Current Label**: Label_48 (custom label)

---

## Analysis

### Categorization Issues
1. **Pinnacle Promotion**: Incorrectly categorized as CATEGORY_UPDATES (should be CATEGORY_PROMOTIONS)
2. **Procompare Lead Generation**: Incorrectly categorized as CATEGORY_UPDATES (should be CATEGORY_PROMOTIONS)
3. **AutoTrader Newsletter**: Correctly categorized as CATEGORY_PROMOTIONS

### Recommendations

1. **Unsubscribe Actions**: 
   - Check each promotional email for unsubscribe links
   - Consider unsubscribing from irrelevant promotional lists
   - Set up filters to automatically delete or label promotional emails

2. **Filter Suggestion**:
   Create a Gmail filter with these criteria:
   - From: promotions@pinnacle.co.za OR newsletter@autotrader.co.za OR robyn@procompare.co.za
   - Action: Mark as read, Apply label "Promotions", Skip Inbox

3. **Label Management**:
   Review custom Label_48 to see if it's redundant with Gmail's built-in CATEGORY_PROMOTIONS

---

## Next Steps

1. Open each promotional email and look for unsubscribe links
2. Review and manage your email preferences with each sender
3. Consider creating filters for better email management
4. Periodically check for new promotional emails`;
    
    await updateDocumentContent(auth, docId, content);
    console.log('Document created successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
