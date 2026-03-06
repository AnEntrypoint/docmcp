import * as docs from './docs.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import { handleDocsImageActions, handleDocsSectionActions } from './handlers-dispatch.js';
import { handleSheetsToolCall } from './handlers-sheets.js';
import { handleGmailToolCall } from './handlers-gmail.js';
import { formatDocsResponse, formatJsonResponse } from './handlers-utils.js';

export async function handleDocsToolCall(name, args, auth) {
  switch (name) {
    case 'docs_get_sections': {
      const result = await sections.getSections(auth, args.doc_id);
      return formatJsonResponse(result);
    }
    case 'docs_section': {
      return handleDocsSectionActions(name, args, auth);
    }
    case 'docs_delete_section': {
      const result = await sections.deleteSection(auth, args.doc_id, args.section);
      return { content: [{ type: 'text', text: `Deleted section "${result.deleted}"` }] };
    }
    case 'docs_move_section': {
      const result = await sections.moveSection(auth, args.doc_id, args.section, args.target);
      return { content: [{ type: 'text', text: `Moved section "${result.moved}"` }] };
    }
    case 'docs_replace_section': {
      const result = await sections.replaceSection(auth, args.doc_id, args.section, args.content, args.preserve_heading !== false);
      return { content: [{ type: 'text', text: `Replaced section "${result.replaced}" (heading preserved: ${result.preservedHeading})` }] };
    }
    case 'docs_image': {
      return handleDocsImageActions(name, args, auth);
    }
    case 'docs_insert_image': {
      const result = await media.insertImage(auth, args.doc_id, args.image_url, args.position || 'end', args.width, args.height);
      return { content: [{ type: 'text', text: `Inserted image at index ${result.index}` }] };
    }
    case 'docs_list_images': {
      const result = await media.listImages(auth, args.doc_id);
      return formatJsonResponse(result);
    }
    case 'docs_delete_image': {
      const result = await media.deleteImage(auth, args.doc_id, args.image_index);
      return { content: [{ type: 'text', text: `Deleted image at index ${result.imageIndex}` }] };
    }
    case 'docs_replace_image': {
      const result = await media.replaceImage(auth, args.doc_id, args.image_index, args.new_image_url, args.width, args.height);
      return { content: [{ type: 'text', text: `Replaced image at index ${result.imageIndex}` }] };
    }
    case 'docs_create': {
      const result = await docs.createDocument(auth, args.title);
      return { content: [{ type: 'text', text: `Created document "${result.title}" with ID: ${result.docId}` }] };
    }
    case 'docs_read': {
      const content = await docs.readDocument(auth, args.doc_id);
      return { content: [{ type: 'text', text: content }] };
    }
    case 'docs_edit': {
      const result = await docs.editDocument(auth, args.doc_id, args.old_text, args.new_text, args.replace_all || false);
      const msg = result.replacements === 1 ? `Replaced 1 occurrence` : `Replaced ${result.replacements} occurrences`;
      return { content: [{ type: 'text', text: msg }] };
    }
    case 'docs_insert': {
      await docs.insertDocument(auth, args.doc_id, args.text, args.position || 'end');
      return { content: [{ type: 'text', text: `Inserted text into document` }] };
    }
    case 'docs_get_info': {
      const info = await docs.getDocumentInfo(auth, args.doc_id);
      return formatJsonResponse(info);
    }
    case 'docs_list': {
      const docsList = await docs.listDocuments(auth, args.max_results || 20, args.query || null);
      return formatJsonResponse(docsList);
    }
    case 'docs_format': {
      const formatting = {};
      const mapConfig = { bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strikethrough',
        font_size: 'fontSize', font_family: 'fontFamily', foreground_color: 'foregroundColor',
        background_color: 'backgroundColor', heading: 'heading', alignment: 'alignment' };
      Object.entries(mapConfig).forEach(([k, v]) => { if (k in args && args[k] !== undefined) formatting[v] = args[k]; });
      const result = await docs.formatDocument(auth, args.doc_id, args.search_text, formatting);
      return formatDocsResponse(`Formatted ${result.formattedOccurrences} occurrence(s)`);
    }
    case 'docs_insert_table': {
      const result = await docs.insertTable(auth, args.doc_id, args.rows, args.cols, args.position || 'end');
      return { content: [{ type: 'text', text: `Inserted ${result.rows}x${result.cols} table` }] };
    }
    case 'docs_delete': {
      const result = await docs.deleteText(auth, args.doc_id, args.text, args.delete_all || false);
      return { content: [{ type: 'text', text: `Deleted ${result.replacements} occurrence(s)` }] };
    }
    case 'docs_get_structure': {
      const structure = await docs.getDocumentStructure(auth, args.doc_id);
      return formatJsonResponse(structure);
    }
    case 'docs_batch': {
      const result = await docs.batchUpdate(auth, args.doc_id, args.operations);
      return { content: [{ type: 'text', text: `Applied ${result.operationsApplied} operations` }] };
    }
    case 'drive_search': {
      const results = await docs.searchDrive(auth, args.query, args.type || 'all', args.max_results || 20);
      return formatJsonResponse(results);
    }
    default:
      return null;
  }
}

export { handleSheetsToolCall } from './handlers-sheets.js';
export { handleGmailToolCall } from './handlers-gmail.js';
