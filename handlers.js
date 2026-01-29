import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import * as scripts from './scripts.js';

export async function handleDocsToolCall(name, args, auth) {
  switch (name) {
    case 'docs_get_sections': {
      const result = await sections.getSections(auth, args.doc_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      if (args.bold !== undefined) formatting.bold = args.bold;
      if (args.italic !== undefined) formatting.italic = args.italic;
      if (args.underline !== undefined) formatting.underline = args.underline;
      if (args.strikethrough !== undefined) formatting.strikethrough = args.strikethrough;
      if (args.font_size) formatting.fontSize = args.font_size;
      if (args.font_family) formatting.fontFamily = args.font_family;
      if (args.foreground_color) formatting.foregroundColor = args.foreground_color;
      if (args.background_color) formatting.backgroundColor = args.background_color;
      if (args.heading) formatting.heading = args.heading;
      if (args.alignment) formatting.alignment = args.alignment;
      const result = await docs.formatDocument(auth, args.doc_id, args.search_text, formatting);
      return { content: [{ type: 'text', text: `Formatted ${result.formattedOccurrences} occurrence(s)` }] };
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
    default:
      return null;
  }
}

export async function handleSheetsToolCall(name, args, auth) {
  switch (name) {
    case 'scripts_create': {
      const result = await scripts.createScript(auth, args.sheet_id, args.script_name);
      return { content: [{ type: 'text', text: `Created script "${result.name}" with ID: ${result.scriptId}\nURL: ${result.url}` }] };
    }
    case 'scripts_list': {
      const result = await scripts.listScripts(auth, args.sheet_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'scripts_read': {
      const result = await scripts.readScript(auth, args.sheet_id, args.script);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'scripts_edit': {
      const result = await scripts.editScript(auth, args.sheet_id, args.script, args.file_name, args.old_text, args.new_text, args.replace_all || false);
      return { content: [{ type: 'text', text: `Replaced ${result.replacements} occurrence(s) in ${result.file}` }] };
    }
    case 'scripts_write': {
      const result = await scripts.writeScript(auth, args.sheet_id, args.script, args.file_name, args.content, args.file_type || 'SERVER_JS');
      return { content: [{ type: 'text', text: `Wrote file "${result.file}" (${result.isNew ? 'created' : 'updated'})` }] };
    }
    case 'scripts_delete': {
      const result = await scripts.deleteScript(auth, args.sheet_id, args.script);
      return { content: [{ type: 'text', text: `Deleted script "${result.name}" (${result.scriptId})` }] };
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
      if (args.background_color) formatting.backgroundColor = args.background_color;
      if (args.text_color) formatting.textColor = args.text_color;
      if (args.bold !== undefined) formatting.bold = args.bold;
      if (args.italic !== undefined) formatting.italic = args.italic;
      if (args.font_size) formatting.fontSize = args.font_size;
      if (args.font_family) formatting.fontFamily = args.font_family;
      if (args.horizontal_alignment) formatting.horizontalAlignment = args.horizontal_alignment;
      if (args.vertical_alignment) formatting.verticalAlignment = args.vertical_alignment;
      if (args.wrap_strategy) formatting.wrapStrategy = args.wrap_strategy;
      if (args.number_format) formatting.numberFormat = args.number_format;
      if (args.borders) formatting.borders = args.borders;
      const result = await sheets.formatRange(auth, args.sheet_id, args.range, formatting);
      return { content: [{ type: 'text', text: `Formatted range ${result.formatted}` }] };
    }
    case 'sheets_merge': {
      const result = await sheets.mergeCells(auth, args.sheet_id, args.range);
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
    case 'sheets_insert_rows_cols': {
      const result = await sheets.insertRowsColumns(auth, args.sheet_id, args.sheet_name, args.dimension, args.start_index, args.count);
      return { content: [{ type: 'text', text: `Inserted ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}` }] };
    }
    case 'sheets_delete_rows_cols': {
      const result = await sheets.deleteRowsColumns(auth, args.sheet_id, args.sheet_name, args.dimension, args.start_index, args.count);
      return { content: [{ type: 'text', text: `Deleted ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}` }] };
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
