import { google } from 'googleapis';

const SCRIPTS_TAB = '_scripts';
const SCRIPTS_HEADERS = ['Script Name', 'Script ID', 'Script URL', 'Created', 'Verified'];

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
    range: `${SCRIPTS_TAB}!A1:E1`,
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

async function verifyScriptExists(auth, scriptId) {
  const script = google.script({ version: 'v1', auth });
  try {
    await script.projects.get({ scriptId });
    return true;
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found') || e.message?.includes('404')) {
      return false;
    }
    throw e;
  }
}

async function verifyAndHealScripts(auth, sheetId, scripts) {
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
    await removeMultipleScriptsFromTab(auth, sheetId, invalidScriptIds);
  }
  
  return {
    scripts: validScripts,
    healed: invalidScriptIds.length > 0,
    removed: invalidScriptIds
  };
}

async function removeMultipleScriptsFromTab(auth, sheetId, scriptIds) {
  if (scriptIds.length === 0) return;
  
  const sheets = google.sheets({ version: 'v4', auth });
  const scripts = await getScriptsFromTab(auth, sheetId);
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const scriptsTab = spreadsheet.data.sheets.find(s => s.properties.title === SCRIPTS_TAB);
  
  if (!scriptsTab) return;
  
  const indicesToRemove = scripts
    .filter(s => scriptIds.includes(s.scriptId))
    .map(s => s.index)
    .sort((a, b) => b - a);
  
  if (indicesToRemove.length === 0) return;
  
  const requests = indicesToRemove.map(idx => ({
    deleteDimension: {
      range: {
        sheetId: scriptsTab.properties.sheetId,
        dimension: 'ROWS',
        startIndex: idx + 1,
        endIndex: idx + 2
      }
    }
  }));
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests }
  });
}

async function addScriptToTab(auth, sheetId, name, scriptId, url) {
  await ensureScriptsTab(auth, sheetId);
  const sheets = google.sheets({ version: 'v4', auth });
  const created = new Date().toISOString();
  const verified = created;
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!A:E`,
    valueInputOption: 'RAW',
    requestBody: { values: [[name, scriptId, url, created, verified]] }
  });
}

async function removeScriptFromTab(auth, sheetId, scriptId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const scripts = await getScriptsFromTab(auth, sheetId);
  const scriptIndex = scripts.findIndex(s => s.scriptId === scriptId);
  
  if (scriptIndex === -1) return false;

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
  
  return true;
}

async function updateScriptVerified(auth, sheetId, scriptIndex) {
  const sheets = google.sheets({ version: 'v4', auth });
  const verified = new Date().toISOString();
  
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${SCRIPTS_TAB}!E${scriptIndex + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[verified]] }
  });
}

async function resolveScriptEntry(auth, sheetId, scriptIdentifier, options = {}) {
  const { heal = true, verify = true } = options;
  
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
      if (heal) {
        await removeScriptFromTab(auth, sheetId, scriptEntry.scriptId);
      }
      throw new Error(`Script "${scriptEntry.name}" (${scriptEntry.scriptId}) no longer exists. ${heal ? 'Tracking entry removed.' : 'Run listScripts to sync.'}`);
    }
    await updateScriptVerified(auth, sheetId, scriptEntry.index);
  }

  return scriptEntry;
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

  const exists = await verifyScriptExists(auth, scriptId);
  if (!exists) {
    throw new Error(`Script created but verification failed. Script ID: ${scriptId}`);
  }

  return { scriptId, name: scriptName, url };
}

export async function listScripts(auth, sheetId, options = {}) {
  const { heal = true } = options;
  
  await ensureScriptsTab(auth, sheetId);
  const scripts = await getScriptsFromTab(auth, sheetId);
  
  if (heal && scripts.length > 0) {
    const result = await verifyAndHealScripts(auth, sheetId, scripts);
    if (result.healed) {
      return {
        scripts: result.scripts.map(s => ({
          index: result.scripts.indexOf(s),
          name: s.name,
          scriptId: s.scriptId,
          url: s.url,
          created: s.created
        })),
        healed: true,
        removedCount: result.removed.length
      };
    }
    return { scripts: result.scripts, healed: false };
  }
  
  return { scripts, healed: false };
}

export async function readScript(auth, sheetId, scriptIdentifier) {
  const scriptEntry = await resolveScriptEntry(auth, sheetId, scriptIdentifier);

  const script = google.script({ version: 'v1', auth });
  
  let response;
  try {
    response = await script.projects.getContent({ scriptId: scriptEntry.scriptId });
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found')) {
      await removeScriptFromTab(auth, sheetId, scriptEntry.scriptId);
      throw new Error(`Script "${scriptEntry.name}" no longer exists. Tracking entry removed.`);
    }
    throw e;
  }

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
  
  try {
    await script.projects.updateContent({
      scriptId: scriptData.scriptId,
      requestBody: { files: updatedFiles }
    });
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found')) {
      await removeScriptFromTab(auth, sheetId, scriptData.scriptId);
      throw new Error(`Script "${scriptData.name}" no longer exists. Tracking entry removed.`);
    }
    throw e;
  }

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
  
  try {
    await script.projects.updateContent({
      scriptId: scriptData.scriptId,
      requestBody: { files: updatedFiles }
    });
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found')) {
      await removeScriptFromTab(auth, sheetId, scriptData.scriptId);
      throw new Error(`Script "${scriptData.name}" no longer exists. Tracking entry removed.`);
    }
    throw e;
  }

  return { written: true, file: fileName, isNew: !existingFile };
}

export async function deleteScript(auth, sheetId, scriptIdentifier) {
  const scriptEntry = await resolveScriptEntry(auth, sheetId, scriptIdentifier, { verify: false });

  const removed = await removeScriptFromTab(auth, sheetId, scriptEntry.scriptId);
  
  if (!removed) {
    throw new Error(`Script "${scriptEntry.name}" not found in tracking.`);
  }

  return { 
    deleted: true, 
    scriptId: scriptEntry.scriptId, 
    name: scriptEntry.name,
    note: 'Removed from tracking. Apps Script projects cannot be deleted via API.'
  };
}

export async function runScript(auth, sheetId, scriptIdentifier, functionName, parameters = []) {
  const scriptEntry = await resolveScriptEntry(auth, sheetId, scriptIdentifier);

  const script = google.script({ version: 'v1', auth });
  
  let response;
  try {
    response = await script.scripts.run({
      scriptId: scriptEntry.scriptId,
      requestBody: {
        function: functionName,
        parameters,
        devMode: true
      }
    });
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found')) {
      await removeScriptFromTab(auth, sheetId, scriptEntry.scriptId);
      throw new Error(`Script "${scriptEntry.name}" no longer exists. Tracking entry removed.`);
    }
    throw e;
  }

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

export async function syncScripts(auth, sheetId) {
  await ensureScriptsTab(auth, sheetId);
  const scripts = await getScriptsFromTab(auth, sheetId);
  
  if (scripts.length === 0) {
    return { synced: true, total: 0, valid: 0, removed: 0 };
  }
  
  const result = await verifyAndHealScripts(auth, sheetId, scripts);
  
  return {
    synced: true,
    total: scripts.length,
    valid: result.scripts.length,
    removed: result.removed.length,
    removedIds: result.removed
  };
}
