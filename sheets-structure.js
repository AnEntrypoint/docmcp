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

export async function modifyRowsColumns(auth, sheetId, sheetName, action, dimension, startIndex, count) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  const dimType = dimension.toUpperCase() === 'ROW' ? 'ROWS' : 'COLUMNS';
  const rangeObj = {
    sheetId: sheet.properties.sheetId,
    dimension: dimType,
    startIndex,
    endIndex: startIndex + count
  };

  const request = action === 'delete'
    ? { deleteDimension: { range: rangeObj } }
    : { insertDimension: { range: rangeObj, inheritFromBefore: startIndex > 0 } };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [request] }
  });

  return { action, dimension, startIndex, count };
}

export async function insertRowsColumns(auth, sheetId, sheetName, dimension, startIndex, count) {
  return modifyRowsColumns(auth, sheetId, sheetName, 'insert', dimension, startIndex, count);
}

export async function deleteRowsColumns(auth, sheetId, sheetName, dimension, startIndex, count) {
  return modifyRowsColumns(auth, sheetId, sheetName, 'delete', dimension, startIndex, count);
}

export async function setDimensionSize(auth, sheetId, sheetName, dimension, start, end, size) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  let startIdx, endIdx;
  if (dimension.toUpperCase() === 'COLUMN') {
    startIdx = colToNum(start);
    endIdx = colToNum(end) + 1;
  } else {
    startIdx = (typeof start === 'number' ? start : parseInt(start)) - 1;
    endIdx = typeof end === 'number' ? end : parseInt(end);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        updateDimensionProperties: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: dimension.toUpperCase() === 'COLUMN' ? 'COLUMNS' : 'ROWS',
            startIndex: startIdx,
            endIndex: endIdx
          },
          properties: { pixelSize: size },
          fields: 'pixelSize'
        }
      }]
    }
  });

  return { dimension, start, end, size };
}

export async function setColumnWidth(auth, sheetId, sheetName, startColumn, endColumn, width) {
  return setDimensionSize(auth, sheetId, sheetName, 'COLUMN', startColumn, endColumn, width);
}

export async function setRowHeight(auth, sheetId, sheetName, startRow, endRow, height) {
  return setDimensionSize(auth, sheetId, sheetName, 'ROW', startRow, endRow, height);
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
