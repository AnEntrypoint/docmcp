import * as docs from './docs.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import { handleDocsImageActions, handleDocsSectionActions } from './handlers-dispatch.js';
import { handleSheetsToolCall } from './handlers-sheets.js';
import { handleGmailToolCall } from './handlers-gmail.js';

export async function handleDocsToolCall(name, args, auth) {
  switch (name) {
    case 'docs_get_sections': {
      const result = await sections.getSections(auth, args.doc_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }
    case 'docs_list': {
      const docsList = await docs.listDocuments(auth, args.max_results || 20, args.query || null);
      return { content: [{ type: 'text', text: JSON.stringify(docsList, null, 2) }] };
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
      return { content: [{ type: 'text', text: JSON.stringify(structure, null, 2) }] };
    }
    case 'docs_batch': {
      const result = await docs.batchUpdate(auth, args.doc_id, args.operations);
      return { content: [{ type: 'text', text: `Applied ${result.operationsApplied} operations` }] };
    }
    case 'drive_search': {
      const results = await docs.searchDrive(auth, args.query, args.type || 'all', args.max_results || 20);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
    default:
      return null;
  }
}

export async function handleSheetsToolCall(name, args, auth) {
  switch (name) {
    case 'scripts_search': {
      const result = await scripts.searchScripts(auth, args.query, args.max_results || 20);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'scripts_create': {
      const result = await scripts.createScript(auth, args.sheet_id, args.script_name);
      return { content: [{ type: 'text', text: `Created script "${result.name}" with ID: ${result.scriptId}\nURL: ${result.url}` }] };
    }
    case 'scripts_list': {
      const result = await scripts.listScripts(auth, args.sheet_id);
      let text = JSON.stringify(result.scripts, null, 2);
      if (result.healed) {
        text += `\n\n(Auto-healed: removed ${result.removedCount} stale script entries)`;
      }
      return { content: [{ type: 'text', text }] };
    }
    case 'scripts_sync': {
      const result = await scripts.syncScripts(auth, args.sheet_id);
      return { content: [{ type: 'text', text: `Synced scripts: ${result.valid}/${result.total} valid, ${result.removed} removed` }] };
    }
    case 'scripts_read': {
      const result = await scripts.readScript(auth, args.sheet_id, args.script);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'scripts_write': {
      if (args.mode === 'edit') {
        const result = await scripts.editScript(auth, args.sheet_id, args.script, args.file_name, args.old_text, args.new_text, args.replace_all || false);
        return { content: [{ type: 'text', text: `Replaced ${result.replacements} occurrence(s) in ${result.file}` }] };
      } else {
        const result = await scripts.writeScript(auth, args.sheet_id, args.script, args.file_name, args.content, args.file_type || 'SERVER_JS');
        return { content: [{ type: 'text', text: `Wrote file "${result.file}" (${result.isNew ? 'created' : 'updated'})` }] };
      }
    }
    case 'scripts_edit': {
      const result = await scripts.editScript(auth, args.sheet_id, args.script, args.file_name, args.old_text, args.new_text, args.replace_all || false);
      return { content: [{ type: 'text', text: `Replaced ${result.replacements} occurrence(s) in ${result.file}` }] };
    }
    case 'scripts_delete': {
      const result = await scripts.deleteScript(auth, args.sheet_id, args.script);
      return { content: [{ type: 'text', text: `Removed script "${result.name}" from tracking (${result.scriptId})\nNote: ${result.note}` }] };
    }
    case 'scripts_run': {
      const result = await scripts.runScript(auth, args.sheet_id, args.script, args.function_name, args.parameters || []);
      return { content: [{ type: 'text', text: `Executed function "${result.function}"\nResult: ${JSON.stringify(result.result)}` }] };
    }
    case 'sheets_create': {
      const result = await sheets.createSheet(auth, args.title);
      return { content: [{ type: 'text', text: `Created spreadsheet "${result.title}" with ID: ${result.sheetId}` }] };
    }
    case 'sheets_read': {
      const values = await sheets.readSheet(auth, args.sheet_id, args.range || 'Sheet1');
      return { content: [{ type: 'text', text: JSON.stringify(values, null, 2) }] };
    }
    case 'sheets_edit': {
      await sheets.editSheet(auth, args.sheet_id, args.range, args.values);
      return { content: [{ type: 'text', text: `Updated range ${args.range}` }] };
    }
    case 'sheets_insert': {
      await sheets.insertSheet(auth, args.sheet_id, args.range || 'Sheet1', args.values);
      return { content: [{ type: 'text', text: `Appended rows` }] };
    }
    case 'sheets_get_cell': {
      const value = await sheets.getCell(auth, args.sheet_id, args.cell);
      return { content: [{ type: 'text', text: value !== null ? String(value) : '(empty)' }] };
    }
    case 'sheets_set_cell': {
      await sheets.setCell(auth, args.sheet_id, args.cell, args.value);
      return { content: [{ type: 'text', text: `Set cell ${args.cell}` }] };
    }
    case 'sheets_edit_cell': {
      const result = await sheets.editCell(auth, args.sheet_id, args.cell, args.old_text, args.new_text, args.replace_all || false);
      return { content: [{ type: 'text', text: `Replaced ${result.replacements} occurrence(s) in cell ${args.cell}` }] };
    }
    case 'sheets_find_replace': {
      const result = await sheets.findReplace(auth, args.sheet_id, args.find, args.replace, args.sheet_name || null);
      return { content: [{ type: 'text', text: `Replaced ${result.replacements} occurrences` }] };
    }
    case 'sheets_get_info': {
      const info = await sheets.getSpreadsheetInfo(auth, args.sheet_id);
      return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }
    case 'sheets_list': {
      const sheetsList = await sheets.listSpreadsheets(auth, args.max_results || 20, args.query || null);
      return { content: [{ type: 'text', text: JSON.stringify(sheetsList, null, 2) }] };
    }
    case 'sheets_tab': {
      if (args.action === 'add') {
        const result = await sheets.addSheetTab(auth, args.sheet_id, args.title);
        return { content: [{ type: 'text', text: `Added sheet tab "${result.title}" with ID: ${result.sheetId}` }] };
      } else if (args.action === 'delete') {
        const result = await sheets.deleteSheetTab(auth, args.sheet_id, args.sheet_name);
        return { content: [{ type: 'text', text: `Deleted sheet tab "${result.deleted}"` }] };
      } else if (args.action === 'rename') {
        const result = await sheets.renameSheetTab(auth, args.sheet_id, args.sheet_name, args.title);
        return { content: [{ type: 'text', text: `Renamed sheet tab "${result.oldName}" to "${result.newName}"` }] };
      }
      throw new Error(`Unknown tab action: ${args.action}`);
    }
    case 'sheets_add_sheet': {
      const result = await sheets.addSheetTab(auth, args.sheet_id, args.title);
      return { content: [{ type: 'text', text: `Added sheet tab "${result.title}" with ID: ${result.sheetId}` }] };
    }
    case 'sheets_delete_sheet': {
      const result = await sheets.deleteSheetTab(auth, args.sheet_id, args.sheet_name);
      return { content: [{ type: 'text', text: `Deleted sheet tab "${result.deleted}"` }] };
    }
    case 'sheets_rename_sheet': {
      const result = await sheets.renameSheetTab(auth, args.sheet_id, args.old_name, args.new_name);
      return { content: [{ type: 'text', text: `Renamed sheet tab "${result.oldName}" to "${result.newName}"` }] };
    }
    case 'sheets_clear': {
      const result = await sheets.clearRange(auth, args.sheet_id, args.range, args.clear_formats || false);
      return { content: [{ type: 'text', text: `Cleared range ${result.cleared}` }] };
    }
    case 'sheets_format': {
      const formatting = {};
      const mapConfig = { background_color: 'backgroundColor', text_color: 'textColor', bold: 'bold', italic: 'italic',
        font_size: 'fontSize', font_family: 'fontFamily', horizontal_alignment: 'horizontalAlignment',
        vertical_alignment: 'verticalAlignment', wrap_strategy: 'wrapStrategy', number_format: 'numberFormat', borders: 'borders' };
      Object.entries(mapConfig).forEach(([k, v]) => { if (k in args && args[k] !== undefined) formatting[v] = args[k]; });
      const result = await sheets.formatRange(auth, args.sheet_id, args.range, formatting);
      return formatDocsResponse(`Formatted range ${result.formatted}`);
    }
    case 'sheets_merge': {
      const action = args.action || 'merge';
      const result = await sheets.mergeCells(auth, args.sheet_id, args.range, action);
      if (action === 'unmerge') {
        return { content: [{ type: 'text', text: `Unmerged cells in range ${result.unmerged}` }] };
      }
      return { content: [{ type: 'text', text: `Merged cells in range ${result.merged}` }] };
    }
    case 'sheets_unmerge': {
      const result = await sheets.unmergeCells(auth, args.sheet_id, args.range);
      return { content: [{ type: 'text', text: `Unmerged cells in range ${result.unmerged}` }] };
    }
    case 'sheets_freeze': {
      const result = await sheets.setFrozen(auth, args.sheet_id, args.sheet_name, args.rows || 0, args.columns || 0);
      return { content: [{ type: 'text', text: `Froze ${result.frozenRows} rows and ${result.frozenColumns} columns` }] };
    }
    case 'sheets_sort': {
      const result = await sheets.sortRange(auth, args.sheet_id, args.range, args.sort_column, args.ascending !== false);
      return { content: [{ type: 'text', text: `Sorted range ${result.sorted} by column ${result.column} (${result.ascending ? 'ascending' : 'descending'})` }] };
    }
    case 'sheets_rows_cols': {
      const result = await sheets.modifyRowsColumns(auth, args.sheet_id, args.sheet_name, args.action, args.dimension, args.start_index, args.count);
      const actionPast = args.action === 'delete' ? 'Deleted' : 'Inserted';
      return { content: [{ type: 'text', text: `${actionPast} ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}` }] };
    }
    case 'sheets_insert_rows_cols': {
      const result = await sheets.insertRowsColumns(auth, args.sheet_id, args.sheet_name, args.dimension, args.start_index, args.count);
      return { content: [{ type: 'text', text: `Inserted ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}` }] };
    }
    case 'sheets_delete_rows_cols': {
      const result = await sheets.deleteRowsColumns(auth, args.sheet_id, args.sheet_name, args.dimension, args.start_index, args.count);
      return { content: [{ type: 'text', text: `Deleted ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}` }] };
    }
    case 'sheets_dimension_size': {
      const result = await sheets.setDimensionSize(auth, args.sheet_id, args.sheet_name, args.dimension, args.start, args.end, args.size);
      return { content: [{ type: 'text', text: `Set ${result.dimension.toLowerCase()} size to ${result.size}px for ${result.start} to ${result.end}` }] };
    }
    case 'sheets_set_column_width': {
      const result = await sheets.setColumnWidth(auth, args.sheet_id, args.sheet_name, args.start_column, args.end_column, args.width);
      return { content: [{ type: 'text', text: `Set column width to ${result.width}px for columns ${result.startColumn} to ${result.endColumn}` }] };
    }
    case 'sheets_set_row_height': {
      const result = await sheets.setRowHeight(auth, args.sheet_id, args.sheet_name, args.start_row, args.end_row, args.height);
      return { content: [{ type: 'text', text: `Set row height to ${result.height}px for rows ${result.startRow} to ${result.endRow}` }] };
    }
    case 'sheets_get_formula': {
      const result = await sheets.getCellFormula(auth, args.sheet_id, args.cell);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'sheets_batch': {
      const result = await sheets.batchUpdate(auth, args.sheet_id, args.operations);
      return { content: [{ type: 'text', text: `Updated ${result.valuesUpdated} values, applied ${result.formatsApplied} formats` }] };
    }
    default:
      return null;
  }
}

export async function handleGmailToolCall(name, args, auth) {
  switch (name) {
    case 'gmail_list': {
      const result = await gmail.listEmails(auth, args.max_results || 20, args.query || null, args.label_ids || null);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_search': {
      const result = await gmail.searchEmails(auth, args.query, args.max_results || 20);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_read': {
      const result = await gmail.readEmail(auth, args.message_id, args.format || 'full');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_get_attachments': {
      const result = await gmail.getEmailAttachments(auth, args.message_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_download_attachment': {
      const result = await gmail.downloadAttachment(auth, args.message_id, args.attachment_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_get_labels': {
      const result = await gmail.getLabels(auth);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_create_label': {
      const result = await gmail.createLabel(auth, buildLabelConfig(args));
      return formatJsonResponse(result);
    }
    case 'gmail_update_label': {
      const config = buildLabelConfig(args);
      delete config.name; if (args.name) config.name = args.name;
      const result = await gmail.updateLabel(auth, args.label_id, config);
      return formatJsonResponse(result);
    }
    case 'gmail_delete_label': {
      const result = await gmail.deleteLabel(auth, args.label_id);
      return { content: [{ type: 'text', text: `Deleted label ${result.deleted}` }] };
    }
    case 'gmail_list_filters': {
      const result = await gmail.listFilters(auth);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_get_filter': {
      const result = await gmail.getFilter(auth, args.filter_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_create_filter': {
      const criteria = gmail.normalizeFilterCriteriaInput(args.criteria || {});
      const action = gmail.normalizeFilterActionInput(args.action || {});
      const result = await gmail.createFilter(auth, criteria, action);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_delete_filter': {
      const result = await gmail.deleteFilter(auth, args.filter_id);
      return { content: [{ type: 'text', text: `Deleted filter ${result.deleted}` }] };
    }
    case 'gmail_replace_filter': {
      const criteria = gmail.normalizeFilterCriteriaInput(args.criteria || {});
      const action = gmail.normalizeFilterActionInput(args.action || {});
      const result = await gmail.replaceFilter(auth, args.filter_id, criteria, action);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'gmail_send': {
      const result = await gmail.sendEmail(auth, args.to, args.subject, args.body, args.cc || null, args.bcc || null);
      return { content: [{ type: 'text', text: `Sent email to ${args.to}\nMessage ID: ${result.id}` }] };
    }
    case 'gmail_delete': {
      const result = await gmail.deleteEmail(auth, args.message_id);
      return { content: [{ type: 'text', text: `Permanently deleted email ${result.deleted}` }] };
    }
    case 'gmail_trash': {
      const result = await gmail.trashEmail(auth, args.message_id);
      return { content: [{ type: 'text', text: `Moved email ${result.id} to trash` }] };
    }
    case 'gmail_modify_labels': {
      const result = await gmail.modifyLabels(auth, args.message_id, args.add_labels || [], args.remove_labels || []);
      return { content: [{ type: 'text', text: `Modified labels for email ${result.id}` }] };
    }
    case 'gmail_bulk_modify_labels': {
      const result = await gmail.bulkModifyLabelsByQuery(
        auth,
        args.query,
        args.add_labels || [],
        args.remove_labels || [],
        args.max_results || 2000
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    default:
      return null;
  }
}
