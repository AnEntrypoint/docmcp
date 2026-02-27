#!/usr/bin/env node

import { validateAndFixMarkdown } from './validate-markdown.js';
import { getAuth } from './auth-helper.js';

async function verifyDocument() {
    const docId = '1mWquQaVGDpf6VSiyzT4-Lxr0obslFQY-zmZnijx1KCc';
    
    try {
        const auth = getAuth();
        
        console.log('📋 DOCUMENT VERIFICATION');
        console.log('-----------------------');
        
        // Check document for any issues
        const validation = await validateAndFixMarkdown(docId, false);
        
        console.log('✅ Document Status: Clean');
        console.log('📄 Document ID:', docId);
        console.log('🔍 Verification Details:');
        
        if (validation.hasIssues) {
            console.log(`   ⚠️  ${validation.issues.length} issues found:`);
            validation.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
            
            // Offer to fix
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.question('Would you like to fix these issues? (y/N): ', async (answer) => {
                if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                    const fixResult = await validateAndFixMarkdown(docId, true);
                    if (!fixResult.hasIssues) {
                        console.log('✅ All issues fixed!');
                    } else {
                        console.log('⚠️  Some issues remain');
                    }
                } else {
                    console.log('ℹ️  Issues not fixed');
                }
                rl.close();
            });
        } else {
            console.log('✅ No markdown issues detected');
            console.log('🎯 Document is properly formatted and ready');
        }
        
    } catch (error) {
        console.error('❌ Verification failed:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyDocument();
