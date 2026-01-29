import { google } from 'googleapis';

const SCRIPTS_TAB = '_scripts';
const SCRIPTS_HEADERS = ['Script Name', 'Script ID', 'Script URL', 'Created'];

async function ensureScriptsTab(auth, sheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTab = spreadsheet.data.sheets.find(s => s.properties.title === SCRIPTS_TAB);
  
  if (existingTab) return existingTab.properties.sheetId;

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        addSheet: {
          properties: {
            title: SCRIPTS_TAB,
            hidden: true
          }
        }
      }]
    }
  });

  const newSheetId = response.data.replies[0].addSheet.properties.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: { values: [SCRIPTS_HEADERS] }
  });

  return newSheetId;
}

async function getScriptsFromTab(auth, sheetId) {
  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SCRIPTS_TAB}!A2:D`
    });
    
    const rows = response.data.values || [];
    return rows.map((row, idx) => ({
      index: idx,
      name: row[0] || '',
      scriptId: row[1] || '',
      url: row[2] || '',
      created: row[3] || ''
    }));
  } catch (e) {
    if (e.message?.includes('Unable to parse range')) return [];
    throw e;
  }
}

async function addScriptToTab(auth, sheetId, name, scriptId, url) {
  await ensureScriptsTab(auth, sheetId);
  const sheets = google.sheets({ version: 'v4', auth });
  const created = new Date().toISOString();
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A:D`,
    valueInputOption: 'RAW',
    requestBody: { values: [[name, scriptId, url, created]] }
  });
}

async function removeScriptFromTab(auth, sheetId, scriptId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const scripts = await getScriptsFromTab(auth, sheetId);
  const scriptIndex = scripts.findIndex(s => s.scriptId === scriptId);
  
  if (scriptIndex === -1) throw new Error(`Script ${scriptId} not found in _scripts tab`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const scriptsTab = spreadsheet.data.sheets.find(s => s.properties.title === SCRIPTS_TAB);
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: scriptsTab.properties.sheetId,
            dimension: 'ROWS',
            startIndex: scriptIndex + 1,
            endIndex: scriptIndex + 2
          }
        }
      }]
    }
  });
}

export async function createScript(auth, sheetId, scriptName) {
  const script = google.script({ version: 'v1', auth });
  
  const response = await script.projects.create({
    requestBody: {
      title: scriptName,
      parentId: sheetId
    }
  });

  const scriptId = response.data.scriptId;
  const url = `https://script.google.com/d/${scriptId}/edit`;

  await addScriptToTab(auth, sheetId, scriptName, scriptId, url);

  return { scriptId, name: scriptName, url };
}

export async function listScripts(auth, sheetId) {
  await ensureScriptsTab(auth, sheetId);
  return getScriptsFromTab(auth, sheetId);
}

export async function readScript(auth, sheetId, scriptIdentifier) {
  const scripts = await getScriptsFromTab(auth, sheetId);
  let scriptEntry;

  if (typeof scriptIdentifier === 'number') {
    scriptEntry = scripts[scriptIdentifier];
    if (!scriptEntry) throw new Error(`Script index ${scriptIdentifier} not found.`);
  } else {
    scriptEntry = scripts.find(s => s.name === scriptIdentifier || s.scriptId === scriptIdentifier);
    if (!scriptEntry) throw new Error(`Script "${scriptIdentifier}" not found in attached scripts.`);
  }

  const script = google.script({ version: 'v1', auth });
  const response = await script.projects.getContent({ scriptId: scriptEntry.scriptId });

  const files = (response.data.files || []).map(f => ({
    name: f.name,
    type: f.type,
    source: f.source
  }));

  return { scriptId: scriptEntry.scriptId, name: scriptEntry.name, files };
}

export async function editScript(auth, sheetId, scriptIdentifier, fileName, oldText, newText, replaceAll = false) {
  const scriptData = await readScript(auth, sheetId, scriptIdentifier);
  const file = scriptData.files.find(f => f.name === fileName);
  
  if (!file) {
    const available = scriptData.files.map(f => f.name).join(', ');
    throw new Error(`File "${fileName}" not found in script. Available files: ${available}`);
  }

  const source = file.source;
  const count = (source.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

  if (count === 0) throw new Error(`old_text not found in file "${fileName}".`);
  if (count > 1 && !replaceAll) {
    throw new Error(`old_text appears ${count} times. Use replace_all or provide more context.`);
  }

  const newSource = replaceAll 
    ? source.split(oldText).join(newText)
    : source.replace(oldText, newText);

  const updatedFiles = scriptData.files.map(f => 
    f.name === fileName ? { ...f, source: newSource } : f
  );

  const script = google.script({ version: 'v1', auth });
  await script.projects.updateContent({
    scriptId: scriptData.scriptId,
    requestBody: { files: updatedFiles }
  });

  return { edited: true, file: fileName, replacements: replaceAll ? count : 1 };
}

export async function writeScript(auth, sheetId, scriptIdentifier, fileName, content, fileType = 'SERVER_JS') {
  const scriptData = await readScript(auth, sheetId, scriptIdentifier);
  const existingFile = scriptData.files.find(f => f.name === fileName);
  
  let updatedFiles;
  if (existingFile) {
    updatedFiles = scriptData.files.map(f => 
      f.name === fileName ? { name: f.name, type: f.type, source: content } : f
    );
  } else {
    updatedFiles = [...scriptData.files, { name: fileName, type: fileType, source: content }];
  }

  const script = google.script({ version: 'v1', auth });
  await script.projects.updateContent({
    scriptId: scriptData.scriptId,
    requestBody: { files: updatedFiles }
  });

  return { written: true, file: fileName, isNew: !existingFile };
}

export async function deleteScript(auth, sheetId, scriptIdentifier) {
  const scripts = await getScriptsFromTab(auth, sheetId);
  let scriptEntry;

  if (typeof scriptIdentifier === 'number') {
    scriptEntry = scripts[scriptIdentifier];
    if (!scriptEntry) throw new Error(`Script index ${scriptIdentifier} not found.`);
  } else {
    scriptEntry = scripts.find(s => s.name === scriptIdentifier || s.scriptId === scriptIdentifier);
    if (!scriptEntry) throw new Error(`Script "${scriptIdentifier}" not found in attached scripts.`);
  }

  await removeScriptFromTab(auth, sheetId, scriptEntry.scriptId);

  return { deleted: true, scriptId: scriptEntry.scriptId, name: scriptEntry.name };
}

export async function runScript(auth, sheetId, scriptIdentifier, functionName, parameters = []) {
  const scripts = await getScriptsFromTab(auth, sheetId);
  let scriptEntry;

  if (typeof scriptIdentifier === 'number') {
    scriptEntry = scripts[scriptIdentifier];
    if (!scriptEntry) throw new Error(`Script index ${scriptIdentifier} not found.`);
  } else {
    scriptEntry = scripts.find(s => s.name === scriptIdentifier || s.scriptId === scriptIdentifier);
    if (!scriptEntry) throw new Error(`Script "${scriptIdentifier}" not found in attached scripts.`);
  }

  const script = google.script({ version: 'v1', auth });
  
  const response = await script.scripts.run({
    scriptId: scriptEntry.scriptId,
    requestBody: {
      function: functionName,
      parameters
    }
  });

  if (response.data.error) {
    const err = response.data.error;
    throw new Error(`Script error: ${err.message || JSON.stringify(err)}`);
  }

  return { 
    executed: true, 
    function: functionName, 
    result: response.data.response?.result ?? null 
  };
}
