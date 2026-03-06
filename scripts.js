import {
  ensureScriptsTab,
  getScriptsFromTab,
  verifyScriptExists,
  verifyAndHealScripts,
  removeScriptFromTab,
  removeMultipleScriptsFromTab,
  addScriptToTab,
  resolveScriptEntry
} from './scripts-helpers.js';
import { google } from 'googleapis';

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
        scripts: result.scripts.map((s, i) => ({
          index: i, name: s.name, scriptId: s.scriptId, url: s.url, created: s.created
        })),
        healed: true, removedCount: result.removed.length
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

export async function searchScripts(auth, query, maxResults = 20) {
  const drive = google.drive({ version: 'v3', auth });
  const escaped = String(query || '').replace(/'/g, "\\'");
  const q = [
    "mimeType='application/vnd.google-apps.script'",
    "trashed=false",
    escaped ? `(name contains '${escaped}' or fullText contains '${escaped}')` : ''
  ].filter(Boolean).join(' and ');

  const res = await drive.files.list({
    q,
    pageSize: Math.max(1, Math.min(Number(maxResults) || 20, 100)),
    fields: 'files(id,name,webViewLink,createdTime,modifiedTime,owners(displayName,emailAddress))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  return {
    scripts: (res.data.files || []).map((f) => ({
      scriptId: f.id,
      name: f.name,
      url: f.webViewLink || `https://script.google.com/d/${f.id}/edit`,
      created: f.createdTime,
      modified: f.modifiedTime,
      owners: (f.owners || []).map((o) => ({ name: o.displayName, email: o.emailAddress }))
    })),
    count: (res.data.files || []).length
  };
}
