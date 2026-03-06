import { google } from 'googleapis';

const SCRIPTS_TAB = '_scripts';
const SCRIPTS_HEADERS = ['Script Name', 'Script ID', 'Script URL', 'Created', 'Verified'];

export async function ensureScriptsTab(auth, sheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTab = spreadsheet.data.sheets.find(s => s.properties.title === SCRIPTS_TAB);
  if (existingTab) return existingTab.properties.sheetId;
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: SCRIPTS_TAB, hidden: true } } }] }
  });
  const newSheetId = response.data.replies[0].addSheet.properties.sheetId;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A1:E1`,
    valueInputOption: 'RAW',
    requestBody: { values: [SCRIPTS_HEADERS] }
  });
  return newSheetId;
}

export async function getScriptsFromTab(auth, sheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SCRIPTS_TAB}!A2:E`
    });
    const rows = response.data.values || [];
    return rows.map((row, idx) => ({
      index: idx,
      name: row[0] || '',
      scriptId: row[1] || '',
      url: row[2] || '',
      created: row[3] || '',
      verified: row[4] || ''
    }));
  } catch (e) {
    if (e.message?.includes('Unable to parse range')) return [];
    throw e;
  }
}

export async function verifyScriptExists(auth, scriptId) {
  const script = google.script({ version: 'v1', auth });
  try {
    await script.projects.get({ scriptId });
    return true;
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found') || e.message?.includes('404')) return false;
    throw e;
  }
}

export async function verifyAndHealScripts(auth, sheetId, scripts) {
  if (scripts.length === 0) return { scripts: [], healed: false, removed: [] };
  const validScripts = [];
  const invalidScriptIds = [];
  for (const script of scripts) {
    const exists = await verifyScriptExists(auth, script.scriptId);
    if (exists) {
      validScripts.push(script);
    } else {
      invalidScriptIds.push(script.scriptId);
    }
  }
  if (invalidScriptIds.length > 0) {
    const { removeMultipleScriptsFromTab } = await import('./scripts.js');
    await removeMultipleScriptsFromTab(auth, sheetId, invalidScriptIds);
  }
  return { scripts: validScripts, healed: invalidScriptIds.length > 0, removed: invalidScriptIds };
}

export async function removeScriptFromTab(auth, sheetId, scriptId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const scripts = await getScriptsFromTab(auth, sheetId);
  const filtered = scripts.filter(s => s.scriptId !== scriptId);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A2:E`,
    valueInputOption: 'RAW',
    requestBody: { values: filtered.length > 0 ? filtered.map(s => [s.name, s.scriptId, s.url, s.created, s.verified]) : [] }
  });
}

export async function removeMultipleScriptsFromTab(auth, sheetId, scriptIds) {
  const sheets = google.sheets({ version: 'v4', auth });
  const scripts = await getScriptsFromTab(auth, sheetId);
  const filtered = scripts.filter(s => !scriptIds.includes(s.scriptId));
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A2:E`,
    valueInputOption: 'RAW',
    requestBody: { values: filtered.length > 0 ? filtered.map(s => [s.name, s.scriptId, s.url, s.created, s.verified]) : [] }
  });
}

export async function getScriptFromTab(auth, sheetId, scriptIdentifier) {
  const scripts = await getScriptsFromTab(auth, sheetId);
  return scripts.find(s => s.scriptId === scriptIdentifier || s.name === scriptIdentifier);
}

export async function addScriptToTab(auth, sheetId, scriptName, scriptId, url = '', verified = '') {
  const sheets = google.sheets({ version: 'v4', auth });
  const scripts = await getScriptsFromTab(auth, sheetId);
  scripts.push({ name: scriptName, scriptId, url, created: new Date().toISOString(), verified });
  const values = scripts.map(s => [s.name, s.scriptId, s.url, s.created, s.verified]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A2:E`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

export async function resolveScriptEntry(auth, sheetId, scriptIdentifier, options = {}) {
  const { verify = true } = options;
  let scripts = await getScriptsFromTab(auth, sheetId);
  let scriptEntry;
  if (typeof scriptIdentifier === 'number') {
    scriptEntry = scripts[scriptIdentifier];
    if (!scriptEntry) throw new Error(`Script index ${scriptIdentifier} not found.`);
  } else {
    scriptEntry = scripts.find(s => s.name === scriptIdentifier || s.scriptId === scriptIdentifier);
    if (!scriptEntry) throw new Error(`Script "${scriptIdentifier}" not found in attached scripts.`);
  }
  if (verify) {
    const exists = await verifyScriptExists(auth, scriptEntry.scriptId);
    if (!exists) {
      await removeScriptFromTab(auth, sheetId, scriptEntry.scriptId);
      throw new Error(`Script "${scriptEntry.name}" no longer exists. Tracking entry removed.`);
    }
  }
  return scriptEntry;
}
