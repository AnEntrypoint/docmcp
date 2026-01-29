import { google } from 'googleapis';

export async function getSpreadsheetInfo(auth, sheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

  const sheetTabs = spreadsheet.data.sheets.map(s => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    index: s.properties.index,
    rowCount: s.properties.gridProperties.rowCount,
    columnCount: s.properties.gridProperties.columnCount,
    frozen: {
      rows: s.properties.gridProperties.frozenRowCount || 0,
      columns: s.properties.gridProperties.frozenColumnCount || 0
    }
  }));

  const info = {
    id: spreadsheet.data.spreadsheetId,
    title: spreadsheet.data.properties.title,
    sheets: sheetTabs
  };

  try {
    const file = await drive.files.get({
      fileId: sheetId,
      fields: 'id,name,createdTime,modifiedTime,owners'
    });
    info.createdTime = file.data.createdTime;
    info.modifiedTime = file.data.modifiedTime;
    info.owners = file.data.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || [];
  } catch (e) {
    info.note = 'Drive metadata unavailable (requires drive scope)';
  }

  return info;
}

export async function listSpreadsheets(auth, maxResults = 20, query = null) {
  const drive = google.drive({ version: 'v3', auth });

  let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const result = await drive.files.list({
    q,
    pageSize: maxResults,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,createdTime,modifiedTime)'
  });

  return result.data.files || [];
}

export async function addSheetTab(auth, sheetId, title) {
  const sheets = google.sheets({ version: 'v4', auth });

  const result = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: { title }
        }
      }]
    }
  });

  const newSheet = result.data.replies[0].addSheet;
  return {
    sheetId: newSheet.properties.sheetId,
    title: newSheet.properties.title
  };
}

export async function deleteSheetTab(auth, sheetId, sheetName) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteSheet: { sheetId: sheet.properties.sheetId }
      }]
    }
  });

  return { deleted: sheetName };
}

export async function renameSheetTab(auth, sheetId, oldName, newName) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === oldName);
  if (!sheet) throw new Error(`Sheet tab not found: ${oldName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: sheet.properties.sheetId,
            title: newName
          },
          fields: 'title'
        }
      }]
    }
  });

  return { oldName, newName };
}

export async function setFrozen(auth, sheetId, sheetName, rows = 0, columns = 0) {
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet tab not found: ${sheetName}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: {
            sheetId: sheet.properties.sheetId,
            gridProperties: {
              frozenRowCount: rows,
              frozenColumnCount: columns
            }
          },
          fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
        }
      }]
    }
  });

  return { frozenRows: rows, frozenColumns: columns };
}
