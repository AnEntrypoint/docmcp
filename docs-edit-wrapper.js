import { validateAndFixMarkdown } from './validate-markdown.js';
import * as docsEdit from './docs-edit.js';

// Export all original functions
export {
    deleteText,
    insertTable,
    batchUpdate
} from './docs-edit.js';

// Wrap editDocument with validation
export async function editDocument(auth, docId, oldText, newText, replaceAll = false) {
    // Call original edit function
    const result = await docsEdit.editDocument(auth, docId, oldText, newText, replaceAll);
    
    // Run validation and fix markdown issues automatically
    console.log('📋 Validating document after edit...');
    const validationResult = await validateAndFixMarkdown(docId, true);
    
    if (validationResult.hasIssues) {
        console.log(`⚠️  ${validationResult.issues.length} issues detected and fixed after edit`);
    }
    
    return result;
}

// Wrap insertDocument with validation
export async function insertDocument(auth, docId, text, position = 'end') {
    // Call original insert function
    const result = await docsEdit.insertDocument(auth, docId, text, position);
    
    // Run validation and fix markdown issues automatically
    console.log('📋 Validating document after insert...');
    const validationResult = await validateAndFixMarkdown(docId, true);
    
    if (validationResult.hasIssues) {
        console.log(`⚠️  ${validationResult.issues.length} issues detected and fixed after insert`);
    }
    
    return result;
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.error('This script is a wrapper for docs-edit.js and should not be run directly');
    process.exit(1);
}
