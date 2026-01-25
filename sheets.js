import { google } from 'googleapis';

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
  return result.data.values?.[0]?.[0] || null;
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
    if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
    request.findReplace.sheetId = sheet.properties.sheetId;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [request] }
  });
}
