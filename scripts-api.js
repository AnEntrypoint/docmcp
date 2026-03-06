import { google } from 'googleapis';
import { removeScriptFromTab } from './scripts-helpers.js';
import { countMatches } from './text-utils.js';

async function getScriptContent(auth, scriptId) {
  const script = google.script({ version: 'v1', auth });
  try {
    const response = await script.projects.getContent({ scriptId });
    return response.data.files || [];
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found')) throw new Error(`Script no longer exists.`);
    throw e;
  }
}

async function updateScriptContent(auth, scriptId, files) {
  const script = google.script({ version: 'v1', auth });
  try {
    await script.projects.updateContent({ scriptId, requestBody: { files } });
  } catch (e) {
    if (e.code === 404 || e.message?.includes('not found')) throw new Error(`Script no longer exists.`);
    throw e;
  }
}

export async function readScriptFiles(auth, scriptId) {
  const files = await getScriptContent(auth, scriptId);
  return files.map(f => ({ name: f.name, type: f.type, source: f.source }));
}

export async function editScriptFile(auth, scriptId, fileName, oldText, newText, replaceAll = false) {
  const files = await getScriptContent(auth, scriptId);
  const file = files.find(f => f.name === fileName);
  if (!file) {
    const available = files.map(f => f.name).join(', ');
    throw new Error(`File "${fileName}" not found. Available: ${available}`);
  }
  const count = countMatches(file.source, oldText);
  if (count > 1 && !replaceAll) throw new Error(`old_text appears ${count} times. Use replace_all.`);
  const newSource = replaceAll ? file.source.split(oldText).join(newText) : file.source.replace(oldText, newText);
  const updated = files.map(f => f.name === fileName ? { ...f, source: newSource } : f);
  await updateScriptContent(auth, scriptId, updated);
  return { edited: true, file: fileName, replacements: replaceAll ? count : 1 };
}

export async function writeScriptFile(auth, scriptId, fileName, content, fileType = 'SERVER_JS') {
  const files = await getScriptContent(auth, scriptId);
  const existing = files.find(f => f.name === fileName);
  const updated = existing ? files.map(f => f.name === fileName ? { name: f.name, type: f.type, source: content } : f) : [...files, { name: fileName, type: fileType, source: content }];
  await updateScriptContent(auth, scriptId, updated);
  return { written: true, file: fileName, isNew: !existing };
}

export async function searchScriptsOnDrive(auth, query, maxResults = 20) {
  const drive = google.drive({ version: 'v3', auth });
  const escaped = String(query || '').replace(/'/g, "\\'");
  const q = ["mimeType='application/vnd.google-apps.script'", "trashed=false", escaped ? `(name contains '${escaped}' or fullText contains '${escaped}')` : ''].filter(Boolean).join(' and ');
  const res = await drive.files.list({
    q, pageSize: Math.max(1, Math.min(Number(maxResults) || 20, 100)),
    fields: 'files(id,name,webViewLink,createdTime,modifiedTime,owners(displayName,emailAddress))',
    supportsAllDrives: true, includeItemsFromAllDrives: true
  });
  return {
    scripts: (res.data.files || []).map((f) => ({
      scriptId: f.id, name: f.name, url: f.webViewLink || `https://script.google.com/d/${f.id}/edit`,
      created: f.createdTime, modified: f.modifiedTime,
      owners: (f.owners || []).map((o) => ({ name: o.displayName, email: o.emailAddress }))
    })),
    count: (res.data.files || []).length
  };
}
