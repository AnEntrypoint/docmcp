import { google } from 'googleapis';

export function parseColor(colorStr) {
  if (!colorStr) return null;
  const hex = colorStr.replace('#', '');
  if (hex.length !== 6) return null;
  return {
    red: parseInt(hex.substring(0, 2), 16) / 255,
    green: parseInt(hex.substring(2, 4), 16) / 255,
    blue: parseInt(hex.substring(4, 6), 16) / 255
  };
}

export function parseA1Range(range) {
  const match = range.match(/^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!match) return null;
  const colToNum = (col) => {
    let num = 0;
    for (const char of col.toUpperCase()) {
      num = num * 26 + (char.charCodeAt(0) - 64);
    }
    return num - 1;
  };
  return {
    sheetName: match[1] || null,
    startCol: colToNum(match[2]),
    startRow: parseInt(match[3]) - 1,
    endCol: match[4] ? colToNum(match[4]) : colToNum(match[2]),
    endRow: match[5] ? parseInt(match[5]) - 1 : parseInt(match[3]) - 1
  };
}

export function colToNum(col) {
  if (typeof col === 'number') return col;
  let num = 0;
  for (const char of col.toUpperCase()) {
    num = num * 26 + (char.charCodeAt(0) - 64);
  }
  return num - 1;
}

export async function createSheet(auth, title) {
  const sheets = google.sheets({ version: 'v4', auth });
  const result = await sheets.spreadsheets.create({
    requestBody: { properties: { title } }
  });
  return { sheetId: result.data.spreadsheetId, title: result.data.properties.title };
}

export async function readSheet(auth, sheetId, range = 'Sheet1') {
  const sheets = google.sheets({ version: 'v4', auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });
  return result.data.values || [];
}

export async function editSheet(auth, sheetId, range, values) {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });
}

export async function insertSheet(auth, sheetId, range, values) {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });
}

export async function getCell(auth, sheetId, cell) {
  const sheets = google.sheets({ version: 'v4', auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: cell
  });
  return result.data.values?.[0]?.[0] ?? null;
}

export async function setCell(auth, sheetId, cell, value) {
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: cell,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] }
  });
}

export async function editCell(auth, sheetId, cell, oldText, newText, replaceAll = false) {
  const currentValue = await getCell(auth, sheetId, cell);

  if (currentValue === null || currentValue === undefined) {
    throw new Error(`Cell ${cell} is empty. Cannot perform text replacement on empty cell.`);
  }

  const cellText = String(currentValue);
  let count = 0;
  let pos = 0;
  while ((pos = cellText.indexOf(oldText, pos)) !== -1) {
    count++;
    pos += oldText.length;
  }

  if (count === 0) {
    throw new Error(`old_text not found in cell ${cell}. Make sure the text exists exactly as specified.`);
  }

  if (count > 1 && !replaceAll) {
    throw new Error(
      `old_text appears ${count} times in cell ${cell}. ` +
      `The edit will fail because old_text must be unique. ` +
      `Either include more surrounding context to make it unique, ` +
      `or set replace_all to true to replace all ${count} occurrences.`
    );
  }

  let updatedValue;
  if (replaceAll) {
    updatedValue = cellText.split(oldText).join(newText);
  } else {
    updatedValue = cellText.replace(oldText, newText);
  }

  await setCell(auth, sheetId, cell, updatedValue);
  return { replacements: replaceAll ? count : 1 };
}

export async function findReplace(auth, sheetId, find, replace, sheetName = null) {
  const sheets = google.sheets({ version: 'v4', auth });

  const request = {
    findReplace: {
      find,
      replacement: replace,
      allSheets: !sheetName,
      matchEntireCell: false,
      matchCase: false
    }
  };

  if (sheetName) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);
    request.findReplace.sheetId = sheet.properties.sheetId;
  }

  const result = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [request] }
  });

  const occurrences = result.data.replies?.[0]?.findReplace?.occurrencesChanged || 0;
  return { replacements: occurrences };
}

export async function clearRange(auth, sheetId, range, clearFormats = false) {
  const sheets = google.sheets({ version: 'v4', auth });

  if (clearFormats) {
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
          updateCells: {
            range: {
              sheetId: targetSheet.properties.sheetId,
              startRowIndex: parsed.startRow,
              endRowIndex: parsed.endRow + 1,
              startColumnIndex: parsed.startCol,
              endColumnIndex: parsed.endCol + 1
            },
            fields: 'userEnteredValue,userEnteredFormat'
          }
        }]
      }
    });
  } else {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range
    });
  }

  return { cleared: range };
}

export async function getCellFormula(auth, sheetId, cell) {
  const sheets = google.sheets({ version: 'v4', auth });

  const result = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    ranges: [cell],
    fields: 'sheets.data.rowData.values(userEnteredValue,effectiveValue,formattedValue)'
  });

  const cellData = result.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0];
  if (!cellData) return { value: null, formula: null };

  return {
    value: cellData.effectiveValue?.numberValue ?? cellData.effectiveValue?.stringValue ?? cellData.formattedValue ?? null,
    formula: cellData.userEnteredValue?.formulaValue || null,
    formattedValue: cellData.formattedValue || null
  };
}
