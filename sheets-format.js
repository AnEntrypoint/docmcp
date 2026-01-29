import { google } from 'googleapis';
import { parseColor, parseA1Range, colToNum } from './sheets-core.js';

export async function formatRange(auth, sheetId, range, formatting) {
  const sheets = google.sheets({ version: 'v4', auth });

  const parsed = parseA1Range(range);
  if (!parsed) throw new Error(`Invalid range format: ${range}`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  let targetSheet = spreadsheet.data.sheets[0];
  if (parsed.sheetName) {
    targetSheet = spreadsheet.data.sheets.find(s => s.properties.title === parsed.sheetName);
    if (!targetSheet) throw new Error(`Sheet tab not found: ${parsed.sheetName}`);
  }

  const cellFormat = {};
  const fields = [];

  if (formatting.backgroundColor) {
    const color = parseColor(formatting.backgroundColor);
    if (color) {
      cellFormat.backgroundColor = color;
      fields.push('userEnteredFormat.backgroundColor');
    }
  }

  if (formatting.textColor) {
    const color = parseColor(formatting.textColor);
    if (color) {
      cellFormat.textFormat = cellFormat.textFormat || {};
      cellFormat.textFormat.foregroundColor = color;
      fields.push('userEnteredFormat.textFormat.foregroundColor');
    }
  }

  if (formatting.bold !== undefined) {
    cellFormat.textFormat = cellFormat.textFormat || {};
    cellFormat.textFormat.bold = formatting.bold;
    fields.push('userEnteredFormat.textFormat.bold');
  }

  if (formatting.italic !== undefined) {
    cellFormat.textFormat = cellFormat.textFormat || {};
    cellFormat.textFormat.italic = formatting.italic;
    fields.push('userEnteredFormat.textFormat.italic');
  }

  if (formatting.fontSize) {
    cellFormat.textFormat = cellFormat.textFormat || {};
    cellFormat.textFormat.fontSize = formatting.fontSize;
    fields.push('userEnteredFormat.textFormat.fontSize');
  }

  if (formatting.fontFamily) {
    cellFormat.textFormat = cellFormat.textFormat || {};
    cellFormat.textFormat.fontFamily = formatting.fontFamily;
    fields.push('userEnteredFormat.textFormat.fontFamily');
  }

  if (formatting.horizontalAlignment) {
    cellFormat.horizontalAlignment = formatting.horizontalAlignment.toUpperCase();
    fields.push('userEnteredFormat.horizontalAlignment');
  }

  if (formatting.verticalAlignment) {
    cellFormat.verticalAlignment = formatting.verticalAlignment.toUpperCase();
    fields.push('userEnteredFormat.verticalAlignment');
  }

  if (formatting.wrapStrategy) {
    cellFormat.wrapStrategy = formatting.wrapStrategy.toUpperCase();
    fields.push('userEnteredFormat.wrapStrategy');
  }

  if (formatting.numberFormat) {
    cellFormat.numberFormat = {
      type: formatting.numberFormat.type || 'NUMBER',
      pattern: formatting.numberFormat.pattern || ''
    };
    fields.push('userEnteredFormat.numberFormat');
  }

  const requests = [];

  if (fields.length > 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: targetSheet.properties.sheetId,
          startRowIndex: parsed.startRow,
          endRowIndex: parsed.endRow + 1,
          startColumnIndex: parsed.startCol,
          endColumnIndex: parsed.endCol + 1
        },
        cell: { userEnteredFormat: cellFormat },
        fields: fields.join(',')
      }
    });
  }

  if (formatting.borders) {
    const borderStyle = {
      style: formatting.borders.style || 'SOLID',
      color: parseColor(formatting.borders.color) || { red: 0, green: 0, blue: 0 }
    };

    requests.push({
      updateBorders: {
        range: {
          sheetId: targetSheet.properties.sheetId,
          startRowIndex: parsed.startRow,
          endRowIndex: parsed.endRow + 1,
          startColumnIndex: parsed.startCol,
          endColumnIndex: parsed.endCol + 1
        },
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle,
        innerHorizontal: formatting.borders.inner ? borderStyle : undefined,
        innerVertical: formatting.borders.inner ? borderStyle : undefined
      }
    });
  }

  if (requests.length === 0) {
    throw new Error('No formatting options specified.');
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests }
  });

  return { formatted: range };
}

export async function mergeCells(auth, sheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth });

  const parsed = parseA1Range(range);
  if (!parsed) throw new Error(`Invalid range format: ${range}`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  let targetSheet = spreadsheet.data.sheets[0];
  if (parsed.sheetName) {
    targetSheet = spreadsheet.data.sheets.find(s => s.properties.title === parsed.sheetName);
    if (!targetSheet) throw new Error(`Sheet tab not found: ${parsed.sheetName}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        mergeCells: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: parsed.startRow,
            endRowIndex: parsed.endRow + 1,
            startColumnIndex: parsed.startCol,
            endColumnIndex: parsed.endCol + 1
          },
          mergeType: 'MERGE_ALL'
        }
      }]
    }
  });

  return { merged: range };
}

export async function unmergeCells(auth, sheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth });

  const parsed = parseA1Range(range);
  if (!parsed) throw new Error(`Invalid range format: ${range}`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  let targetSheet = spreadsheet.data.sheets[0];
  if (parsed.sheetName) {
    targetSheet = spreadsheet.data.sheets.find(s => s.properties.title === parsed.sheetName);
    if (!targetSheet) throw new Error(`Sheet tab not found: ${parsed.sheetName}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        unmergeCells: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: parsed.startRow,
            endRowIndex: parsed.endRow + 1,
            startColumnIndex: parsed.startCol,
            endColumnIndex: parsed.endCol + 1
          }
        }
      }]
    }
  });

  return { unmerged: range };
}
