import { google } from 'googleapis';

function parseColor(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return null;
  return { red: parseInt(hex.substring(0, 2), 16) / 255, green: parseInt(hex.substring(2, 4), 16) / 255, blue: parseInt(hex.substring(4, 6), 16) / 255 };
}

function parseA1(range) {
  const m = range.match(/^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!m) return null;
  const c2n = (col) => { let n = 0; for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  return { sheetName: m[1] || null, startCol: c2n(m[2]), startRow: parseInt(m[3]) - 1, endCol: m[4] ? c2n(m[4]) : c2n(m[2]), endRow: m[5] ? parseInt(m[5]) - 1 : parseInt(m[3]) - 1 };
}

function colToNum(col) { if (typeof col === 'number') return col; let n = 0; for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

export async function create(auth, { title }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.create({ requestBody: { properties: { title } } });
  return { sheetId: r.data.spreadsheetId, title: r.data.properties.title };
}

export async function read(auth, { sheet_id, range = 'Sheet1' }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: sheet_id, range });
  return r.data.values || [];
}

export async function edit(auth, { sheet_id, range, values }) {
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.update({ spreadsheetId: sheet_id, range, valueInputOption: 'USER_ENTERED', requestBody: { values } });
  return { updated: range };
}

export async function insert(auth, { sheet_id, range = 'Sheet1', values }) {
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.append({ spreadsheetId: sheet_id, range, valueInputOption: 'USER_ENTERED', requestBody: { values } });
  return { appended: true };
}

export async function getCell(auth, { sheet_id, cell }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: sheet_id, range: cell });
  return { value: r.data.values?.[0]?.[0] ?? null };
}

export async function setCell(auth, { sheet_id, cell, value }) {
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.update({ spreadsheetId: sheet_id, range: cell, valueInputOption: 'USER_ENTERED', requestBody: { values: [[value]] } });
  return { set: cell };
}

export async function editCell(auth, { sheet_id, cell, old_text, new_text, replace_all = false }) {
  const { value } = await getCell(auth, { sheet_id, cell });
  if (value === null) throw new Error(`Cell ${cell} is empty`);
  const text = String(value);
  let count = 0, pos = 0;
  while ((pos = text.indexOf(old_text, pos)) !== -1) { count++; pos += old_text.length; }
  if (count === 0) throw new Error(`old_text not found in cell ${cell}`);
  if (count > 1 && !replace_all) throw new Error(`old_text appears ${count} times. Use replace_all.`);
  const updated = replace_all ? text.split(old_text).join(new_text) : text.replace(old_text, new_text);
  await setCell(auth, { sheet_id, cell, value: updated });
  return { replacements: replace_all ? count : 1 };
}

export async function findReplace(auth, { sheet_id, find, replace, sheet_name = null }) {
  const s = google.sheets({ version: 'v4', auth });
  const req = { findReplace: { find, replacement: replace, allSheets: !sheet_name, matchEntireCell: false, matchCase: false } };
  if (sheet_name) {
    const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
    const tab = sp.data.sheets.find(t => t.properties.title === sheet_name);
    if (!tab) throw new Error(`Sheet tab not found: ${sheet_name}`);
    req.findReplace.sheetId = tab.properties.sheetId;
  }
  const r = await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [req] } });
  return { replacements: r.data.replies?.[0]?.findReplace?.occurrencesChanged || 0 };
}

export async function getInfo(auth, { sheet_id }) {
  const s = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  const info = { id: sp.data.spreadsheetId, title: sp.data.properties.title, sheets: sp.data.sheets.map(t => ({ sheetId: t.properties.sheetId, title: t.properties.title, index: t.properties.index, rowCount: t.properties.gridProperties.rowCount, columnCount: t.properties.gridProperties.columnCount, frozen: { rows: t.properties.gridProperties.frozenRowCount || 0, columns: t.properties.gridProperties.frozenColumnCount || 0 } })) };
  try { const f = await drive.files.get({ fileId: sheet_id, fields: 'id,name,createdTime,modifiedTime,owners' }); info.createdTime = f.data.createdTime; info.modifiedTime = f.data.modifiedTime; info.owners = f.data.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || []; } catch (_) {}
  return info;
}

export async function list(auth, { max_results = 20, query = null } = {}) {
  const drive = google.drive({ version: 'v3', auth });
  let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  if (query) q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  const r = await drive.files.list({ q, pageSize: max_results, orderBy: 'modifiedTime desc', fields: 'files(id,name,createdTime,modifiedTime)' });
  return r.data.files || [];
}

export async function clear(auth, { sheet_id, range, clear_formats = false }) {
  const s = google.sheets({ version: 'v4', auth });
  if (clear_formats) {
    const parsed = parseA1(range);
    if (!parsed) throw new Error(`Invalid range: ${range}`);
    const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
    let tab = sp.data.sheets[0];
    if (parsed.sheetName) { tab = sp.data.sheets.find(t => t.properties.title === parsed.sheetName); if (!tab) throw new Error(`Tab not found: ${parsed.sheetName}`); }
    await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ updateCells: { range: { sheetId: tab.properties.sheetId, startRowIndex: parsed.startRow, endRowIndex: parsed.endRow + 1, startColumnIndex: parsed.startCol, endColumnIndex: parsed.endCol + 1 }, fields: 'userEnteredValue,userEnteredFormat' } }] } });
  } else { await s.spreadsheets.values.clear({ spreadsheetId: sheet_id, range }); }
  return { cleared: range };
}

export async function getFormula(auth, { sheet_id, cell }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.get({ spreadsheetId: sheet_id, ranges: [cell], fields: 'sheets.data.rowData.values(userEnteredValue,effectiveValue,formattedValue)' });
  const d = r.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0];
  if (!d) return { value: null, formula: null };
  return { value: d.effectiveValue?.numberValue ?? d.effectiveValue?.stringValue ?? d.formattedValue ?? null, formula: d.userEnteredValue?.formulaValue || null, formattedValue: d.formattedValue || null };
}
