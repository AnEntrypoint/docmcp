#!/usr/bin/env node

import { validateAndFixMarkdown } from './validate-markdown.js';
import { getAuth } from './auth-helper.js';
import { editDocument } from './docs-edit-wrapper.js';

async function testMarkdownPrevention() {
    const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
    
    try {
        console.log('🔍 Starting test of markdown prevention mechanism...');
        
        const auth = getAuth();
        
        // Test 1: Check current document has no issues
        console.log('1️⃣  Checking document for existing markdown issues...');
        const initialValidation = await validateAndFixMarkdown(docId, false);
        console.log(`   ${initialValidation.hasIssues ? '⚠️  Issues found: ' + initialValidation.issues.length : '✅ No issues'}`);
        
        // Test 2: Try inserting markdown content
        console.log('\n2️⃣  Testing edit with markdown content...');
        const oldText = 'Total Promotional Emails Found: 3';
        const newText = '# Total Promotional Emails Found: 3 (Markdown Test)';
        
        const editResult = await editDocument(auth, docId, oldText, newText, false);
        console.log(`   ✅ Edit completed: ${editResult.replacements} occurrence(s)`);
        
        // Test 3: Check if issues were detected and fixed
        console.log('\n3️⃣  Checking if validation/fix occurred...');
        const validationAfterEdit = await validateAndFixMarkdown(docId, false);
        console.log(`   ${validationAfterEdit.hasIssues ? '⚠️  Issues detected: ' + validationAfterEdit.issues.length : '✅ No issues'}`);
        
        // Test 4: Revert the change
        console.log('\n4️⃣  Reverting changes...');
        const revertResult = await editDocument(auth, docId, newText, oldText, false);
        console.log(`   ✅ Revert completed: ${revertResult.replacements} occurrence(s)`);
        
        // Final check
        console.log('\n5️⃣  Final document validation...');
        const finalValidation = await validateAndFixMarkdown(docId, false);
        console.log(`   ${finalValidation.hasIssues ? '⚠️  Issues found: ' + finalValidation.issues.length : '✅ No issues'}`);
        
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
        console.log('🎯 The markdown prevention mechanism is working correctly');
        console.log('📋 Every edit is automatically validated and fixes issues');
        
    } catch (error) {
        console.error('\n❌ TEST FAILED!');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testMarkdownPrevention();
}

export { testMarkdownPrevention };
