import { google } from 'googleapis';
import { parseA1Range, colToNum } from './sheets-core.js';

export async function sortRange(auth, sheetId, range, sortColumn, ascending = true) {
  const sheets = google.sheets({ version: 'v4', auth });

  const parsed = parseA1Range(range);
  if (!parsed) throw new Error(`Invalid range format: ${range}`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  let targetSheet = spreadsheet.data.sheets[0];
  if (parsed.sheetName) {
    targetSheet = spreadsheet.data.sheets.find(s => s.properties.title === parsed.sheetName);
    if (!targetSheet) throw new Error(`Sheet tab not found: ${parsed.sheetName}`);
  }

  const sortColumnIndex = typeof sortColumn === 'number' ? sortColumn : colToNum(sortColumn);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        sortRange: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: parsed.startRow,
            endRowIndex: parsed.endRow + 1,
            startColumnIndex: parsed.startCol,
            endColumnIndex: parsed.endCol + 1
          },
          sortSpecs: [{
            dimensionIndex: sortColumnIndex,
            sortOrder: ascending ? 'ASCENDING' : 'DESCENDING'
          }]
        }
      }]
    }
  });

  return { sorted: range, column: sortColumn, ascending };
}

export async function insertRowsColumns(auth, sheetId, sheetName, dimension, startIndex, count) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        insertDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: dimension.toUpperCase() === 'ROW' ? 'ROWS' : 'COLUMNS',
            startIndex,
            endIndex: startIndex + count
          },
          inheritFromBefore: startIndex > 0
        }
      }]
    }
  });

  return { dimension, startIndex, count };
}

export async function deleteRowsColumns(auth, sheetId, sheetName, dimension, startIndex, count) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: dimension.toUpperCase() === 'ROW' ? 'ROWS' : 'COLUMNS',
            startIndex,
            endIndex: startIndex + count
          }
        }
      }]
    }
  });

  return { dimension, startIndex, count };
}

export async function setColumnWidth(auth, sheetId, sheetName, startColumn, endColumn, width) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  const startIdx = colToNum(startColumn);
  const endIdx = colToNum(endColumn) + 1;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        updateDimensionProperties: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'COLUMNS',
            startIndex: startIdx,
            endIndex: endIdx
          },
          properties: { pixelSize: width },
          fields: 'pixelSize'
        }
      }]
    }
  });

  return { startColumn, endColumn, width };
}

export async function setRowHeight(auth, sheetId, sheetName, startRow, endRow, height) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        updateDimensionProperties: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: startRow - 1,
            endIndex: endRow
          },
          properties: { pixelSize: height },
          fields: 'pixelSize'
        }
      }]
    }
  });

  return { startRow, endRow, height };
}

export async function batchUpdate(auth, sheetId, operations) {
  const sheets = google.sheets({ version: 'v4', auth });

  const valueUpdates = [];
  const formatRequests = [];

  for (const op of operations) {
    if (op.type === 'setValue') {
      valueUpdates.push({
        range: op.range,
        values: op.values
      });
    } else if (op.type === 'format') {
      const parsed = parseA1Range(op.range);
      if (!parsed) continue;

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      let targetSheet = spreadsheet.data.sheets[0];
      if (parsed.sheetName) {
        targetSheet = spreadsheet.data.sheets.find(s => s.properties.title === parsed.sheetName);
      }

      const cellFormat = {};
      if (op.backgroundColor) {
        const hex = op.backgroundColor.replace('#', '');
        cellFormat.backgroundColor = {
          red: parseInt(hex.substring(0, 2), 16) / 255,
          green: parseInt(hex.substring(2, 4), 16) / 255,
          blue: parseInt(hex.substring(4, 6), 16) / 255
        };
      }
      if (op.bold !== undefined) {
        cellFormat.textFormat = cellFormat.textFormat || {};
        cellFormat.textFormat.bold = op.bold;
      }

      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: targetSheet.properties.sheetId,
            startRowIndex: parsed.startRow,
            endRowIndex: parsed.endRow + 1,
            startColumnIndex: parsed.startCol,
            endColumnIndex: parsed.endCol + 1
          },
          cell: { userEnteredFormat: cellFormat },
          fields: 'userEnteredFormat'
        }
      });
    }
  }

  const results = { valuesUpdated: 0, formatsApplied: 0 };

  if (valueUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: valueUpdates
      }
    });
    results.valuesUpdated = valueUpdates.length;
  }

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: formatRequests }
    });
    results.formatsApplied = formatRequests.length;
  }

  return results;
}
