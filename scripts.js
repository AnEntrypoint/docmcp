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
import { readScriptFiles, editScriptFile, writeScriptFile, searchScriptsOnDrive } from './scripts-api.js';
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
  const files = await readScriptFiles(auth, scriptEntry.scriptId);
  return { scriptId: scriptEntry.scriptId, name: scriptEntry.name, files };
}

export async function editScript(auth, sheetId, scriptIdentifier, fileName, oldText, newText, replaceAll = false) {
  const scriptEntry = await resolveScriptEntry(auth, sheetId, scriptIdentifier);
  return editScriptFile(auth, scriptEntry.scriptId, fileName, oldText, newText, replaceAll);
}

export async function writeScript(auth, sheetId, scriptIdentifier, fileName, content, fileType = 'SERVER_JS') {
  const scriptEntry = await resolveScriptEntry(auth, sheetId, scriptIdentifier);
  return writeScriptFile(auth, scriptEntry.scriptId, fileName, content, fileType);
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
  return searchScriptsOnDrive(auth, query, maxResults);
}
