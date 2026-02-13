import { google } from 'googleapis';

const SCRIPTS_TAB = '_scripts';
const HEADERS = ['Script Name', 'Script ID', 'Script URL', 'Created', 'Verified'];

async function ensureTab(auth, sheetId) {
  const s = google.sheets({ version: 'v4', auth });
  const sp = await s.spreadsheets.get({ spreadsheetId: sheetId });
  const existing = sp.data.sheets.find(t => t.properties.title === SCRIPTS_TAB);
  if (existing) return existing.properties.sheetId;
  const r = await s.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: [{ addSheet: { properties: { title: SCRIPTS_TAB, hidden: true } } }] } });
  const id = r.data.replies[0].addSheet.properties.sheetId;
  await s.spreadsheets.values.update({ spreadsheetId: sheetId, range: `${SCRIPTS_TAB}!A1:E1`, valueInputOption: 'RAW', requestBody: { values: [HEADERS] } });
  return id;
}

async function getEntries(auth, sheetId) {
  const s = google.sheets({ version: 'v4', auth });
  try {
    const r = await s.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SCRIPTS_TAB}!A2:E` });
    return (r.data.values || []).map((row, i) => ({ index: i, name: row[0] || '', scriptId: row[1] || '', url: row[2] || '', created: row[3] || '' }));
  } catch (e) { if (e.message?.includes('Unable to parse range')) return []; throw e; }
}

async function verifyExists(auth, scriptId) {
  const sc = google.script({ version: 'v1', auth });
  try { await sc.projects.get({ scriptId }); return true; } catch (e) { if (e.code === 404 || e.message?.includes('not found')) return false; throw e; }
}

async function resolve(auth, sheetId, identifier) {
  const entries = await getEntries(auth, sheetId);
  let entry;
  if (typeof identifier === 'number') { entry = entries[identifier]; if (!entry) throw new Error(`Script index ${identifier} not found`); }
  else { entry = entries.find(e => e.name === identifier || e.scriptId === identifier); if (!entry) throw new Error(`Script "${identifier}" not found`); }
  const exists = await verifyExists(auth, entry.scriptId);
  if (!exists) throw new Error(`Script "${entry.name}" (${entry.scriptId}) no longer exists`);
  return entry;
}

export async function createScript(auth, { sheet_id, script_name }) {
  const sc = google.script({ version: 'v1', auth });
  const r = await sc.projects.create({ requestBody: { title: script_name, parentId: sheet_id } });
  const scriptId = r.data.scriptId;
  const url = `https://script.google.com/d/${scriptId}/edit`;
  await ensureTab(auth, sheet_id);
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.append({ spreadsheetId: sheet_id, range: `${SCRIPTS_TAB}!A:E`, valueInputOption: 'RAW', requestBody: { values: [[script_name, scriptId, url, new Date().toISOString(), new Date().toISOString()]] } });
  return { scriptId, name: script_name, url };
}

export async function listScripts(auth, { sheet_id }) {
  await ensureTab(auth, sheet_id);
  const entries = await getEntries(auth, sheet_id);
  const valid = [];
  const stale = [];
  for (const e of entries) {
    if (await verifyExists(auth, e.scriptId)) valid.push(e);
    else stale.push(e);
  }
  if (stale.length > 0) {
    const s = google.sheets({ version: 'v4', auth });
    const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
    const tab = sp.data.sheets.find(t => t.properties.title === SCRIPTS_TAB);
    if (tab) {
      const indices = stale.map(e => e.index).sort((a, b) => b - a);
      const requests = indices.map(i => ({ deleteDimension: { range: { sheetId: tab.properties.sheetId, dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } }));
      await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests } });
    }
  }
  return { scripts: valid, healed: stale.length > 0, removedCount: stale.length };
}

export async function readScript(auth, { sheet_id, script: identifier }) {
  const entry = await resolve(auth, sheet_id, identifier);
  const sc = google.script({ version: 'v1', auth });
  const r = await sc.projects.getContent({ scriptId: entry.scriptId });
  return { scriptId: entry.scriptId, name: entry.name, files: (r.data.files || []).map(f => ({ name: f.name, type: f.type, source: f.source })) };
}

export async function writeScript(auth, { sheet_id, script: identifier, file_name, content, file_type = 'SERVER_JS' }) {
  const data = await readScript(auth, { sheet_id, script: identifier });
  const existing = data.files.find(f => f.name === file_name);
  const files = existing ? data.files.map(f => f.name === file_name ? { name: f.name, type: f.type, source: content } : f) : [...data.files, { name: file_name, type: file_type, source: content }];
  const sc = google.script({ version: 'v1', auth });
  await sc.projects.updateContent({ scriptId: data.scriptId, requestBody: { files } });
  return { file: file_name, isNew: !existing };
}

export async function editScript(auth, { sheet_id, script: identifier, file_name, old_text, new_text, replace_all = false }) {
  const data = await readScript(auth, { sheet_id, script: identifier });
  const file = data.files.find(f => f.name === file_name);
  if (!file) throw new Error(`File "${file_name}" not found. Available: ${data.files.map(f => f.name).join(', ')}`);
  const count = (file.source.match(new RegExp(old_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count === 0) throw new Error(`old_text not found in "${file_name}"`);
  if (count > 1 && !replace_all) throw new Error(`old_text appears ${count} times. Use replace_all.`);
  const newSource = replace_all ? file.source.split(old_text).join(new_text) : file.source.replace(old_text, new_text);
  const files = data.files.map(f => f.name === file_name ? { ...f, source: newSource } : f);
  const sc = google.script({ version: 'v1', auth });
  await sc.projects.updateContent({ scriptId: data.scriptId, requestBody: { files } });
  return { file: file_name, replacements: replace_all ? count : 1 };
}

export async function deleteScript(auth, { sheet_id, script: identifier }) {
  const entries = await getEntries(auth, sheet_id);
  let entry;
  if (typeof identifier === 'number') entry = entries[identifier];
  else entry = entries.find(e => e.name === identifier || e.scriptId === identifier);
  if (!entry) throw new Error(`Script "${identifier}" not found`);
  const s = google.sheets({ version: 'v4', auth });
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  const tab = sp.data.sheets.find(t => t.properties.title === SCRIPTS_TAB);
  if (tab) { await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ deleteDimension: { range: { sheetId: tab.properties.sheetId, dimension: 'ROWS', startIndex: entry.index + 1, endIndex: entry.index + 2 } } }] } }); }
  return { name: entry.name, scriptId: entry.scriptId, note: 'Removed from tracking. Apps Script projects cannot be deleted via API.' };
}

export async function runScript(auth, { sheet_id, script: identifier, function_name, parameters = [] }) {
  const entry = await resolve(auth, sheet_id, identifier);
  const sc = google.script({ version: 'v1', auth });
  const r = await sc.scripts.run({ scriptId: entry.scriptId, requestBody: { function: function_name, parameters, devMode: true } });
  if (r.data.error) throw new Error(`Script error: ${r.data.error.message || JSON.stringify(r.data.error)}`);
  return { function: function_name, result: r.data.response?.result ?? null };
}

export async function syncScripts(auth, { sheet_id }) {
  await ensureTab(auth, sheet_id);
  const entries = await getEntries(auth, sheet_id);
  if (entries.length === 0) return { total: 0, valid: 0, removed: 0 };
  const result = await listScripts(auth, { sheet_id });
  return { total: entries.length, valid: result.scripts.length, removed: result.removedCount };
}
