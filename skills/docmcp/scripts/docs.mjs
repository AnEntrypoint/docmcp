import { google } from 'googleapis';

function extractText(content) {
  let text = '';
  for (const elem of content || []) {
    if (elem.paragraph) {
      for (const run of elem.paragraph.elements || []) {
        if (run.textRun) text += run.textRun.content;
      }
    } else if (elem.table) {
      for (const row of elem.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          text += extractText(cell.content) + '\t';
        }
        text += '\n';
      }
    }
  }
  return text;
}

function getAllIndices(text, search) {
  const indices = [];
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) { indices.push(pos); pos += search.length; }
  return indices;
}

function parseColor(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return null;
  return { red: parseInt(hex.substring(0, 2), 16) / 255, green: parseInt(hex.substring(2, 4), 16) / 255, blue: parseInt(hex.substring(4, 6), 16) / 255 };
}

export async function create(auth, { title }) {
  const docs = google.docs({ version: 'v1', auth });
  const r = await docs.documents.create({ requestBody: { title } });
  return { docId: r.data.documentId, title: r.data.title };
}

export async function read(auth, { doc_id }) {
  const docs = google.docs({ version: 'v1', auth });
  const r = await docs.documents.get({ documentId: doc_id });
  return { text: extractText(r.data.body.content) };
}

export async function edit(auth, { doc_id, old_text, new_text, replace_all = false }) {
  const { text } = await read(auth, { doc_id });
  const indices = getAllIndices(text, old_text);
  if (indices.length === 0) throw new Error('old_text not found in document');
  if (indices.length > 1 && !replace_all) throw new Error(`old_text appears ${indices.length} times. Use replace_all or provide more context.`);
  const docs = google.docs({ version: 'v1', auth });
  const requests = [];
  for (let i = indices.length - 1; i >= 0; i--) {
    requests.push({ deleteContentRange: { range: { startIndex: indices[i] + 1, endIndex: indices[i] + old_text.length + 1 } } });
    if (new_text) requests.push({ insertText: { location: { index: indices[i] + 1 }, text: new_text } });
  }
  await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests } });
  return { replacements: indices.length };
}

export async function insert(auth, { doc_id, text, position = 'end' }) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: doc_id });
  let index;
  if (position === 'end') {
    const last = doc.data.body.content[doc.data.body.content.length - 1];
    index = (last.endIndex || doc.data.body.content.length) - 1;
  } else if (typeof position === 'number') { index = position + 1; }
  else {
    const content = extractText(doc.data.body.content);
    const pos = content.indexOf(position);
    if (pos === -1) throw new Error('Position text not found');
    index = pos + position.length + 1;
  }
  await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests: [{ insertText: { location: { index }, text } }] } });
  return { inserted: true };
}

export async function deleteText(auth, { doc_id, text, delete_all = false }) {
  return edit(auth, { doc_id, old_text: text, new_text: '', replace_all: delete_all });
}

export async function format(auth, args) {
  const { doc_id, search_text, bold, italic, underline, strikethrough, font_size, font_family, foreground_color, background_color, heading, alignment } = args;
  const { text } = await read(auth, { doc_id });
  const indices = getAllIndices(text, search_text);
  if (indices.length === 0) throw new Error('Text not found');
  const docs = google.docs({ version: 'v1', auth });
  const requests = [];
  for (const idx of indices) {
    const s = idx + 1, e = idx + search_text.length + 1;
    const ts = {};
    if (bold !== undefined) ts.bold = bold;
    if (italic !== undefined) ts.italic = italic;
    if (underline !== undefined) ts.underline = underline;
    if (strikethrough !== undefined) ts.strikethrough = strikethrough;
    if (font_size) ts.fontSize = { magnitude: font_size, unit: 'PT' };
    if (font_family) ts.weightedFontFamily = { fontFamily: font_family };
    if (foreground_color) { const c = parseColor(foreground_color); if (c) ts.foregroundColor = { color: { rgbColor: c } }; }
    if (background_color) { const c = parseColor(background_color); if (c) ts.backgroundColor = { color: { rgbColor: c } }; }
    const fields = Object.keys(ts).join(',');
    if (fields) requests.push({ updateTextStyle: { range: { startIndex: s, endIndex: e }, textStyle: ts, fields } });
    if (heading) {
      const map = { TITLE: 'TITLE', SUBTITLE: 'SUBTITLE', HEADING_1: 'HEADING_1', HEADING_2: 'HEADING_2', HEADING_3: 'HEADING_3', HEADING_4: 'HEADING_4', HEADING_5: 'HEADING_5', HEADING_6: 'HEADING_6', NORMAL_TEXT: 'NORMAL_TEXT' };
      requests.push({ updateParagraphStyle: { range: { startIndex: s, endIndex: e }, paragraphStyle: { namedStyleType: map[heading.toUpperCase()] || 'NORMAL_TEXT' }, fields: 'namedStyleType' } });
    }
    if (alignment) {
      const map = { LEFT: 'START', CENTER: 'CENTER', RIGHT: 'END', JUSTIFY: 'JUSTIFIED' };
      requests.push({ updateParagraphStyle: { range: { startIndex: s, endIndex: e }, paragraphStyle: { alignment: map[alignment.toUpperCase()] || 'START' }, fields: 'alignment' } });
    }
  }
  if (requests.length === 0) throw new Error('No formatting options specified');
  await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests } });
  return { formattedOccurrences: indices.length };
}

export async function insertTable(auth, { doc_id, rows, cols, position = 'end' }) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: doc_id });
  let index;
  if (position === 'end') { const last = doc.data.body.content[doc.data.body.content.length - 1]; index = (last.endIndex || doc.data.body.content.length) - 1; }
  else if (typeof position === 'number') { index = position + 1; }
  else { const content = extractText(doc.data.body.content); const pos = content.indexOf(position); if (pos === -1) throw new Error('Position not found'); index = pos + position.length + 1; }
  await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests: [{ insertTable: { rows, columns: cols, location: { index } } }] } });
  return { rows, cols };
}

export async function getInfo(auth, { doc_id }) {
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });
  const doc = await docs.documents.get({ documentId: doc_id });
  const info = { id: doc.data.documentId, title: doc.data.title };
  try {
    const file = await drive.files.get({ fileId: doc_id, fields: 'id,name,mimeType,createdTime,modifiedTime,owners,size' });
    info.createdTime = file.data.createdTime; info.modifiedTime = file.data.modifiedTime;
    info.owners = file.data.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || [];
  } catch (_) { info.note = 'Drive metadata unavailable'; }
  return info;
}

export async function getStructure(auth, { doc_id }) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: doc_id });
  const structure = [];
  for (const elem of doc.data.body.content || []) {
    if (!elem.paragraph) continue;
    const style = elem.paragraph.paragraphStyle?.namedStyleType;
    if (style && (style.startsWith('HEADING') || style === 'TITLE')) {
      let text = '';
      for (const run of elem.paragraph.elements || []) { if (run.textRun) text += run.textRun.content; }
      structure.push({ level: style === 'TITLE' ? 0 : parseInt(style.replace('HEADING_', '')) || 0, text: text.trim(), index: elem.startIndex, ...(style === 'TITLE' && { isTitle: true }) });
    }
  }
  return structure;
}

export async function list(auth, { max_results = 20, query = null } = {}) {
  const drive = google.drive({ version: 'v3', auth });
  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (query) q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  const r = await drive.files.list({ q, pageSize: max_results, orderBy: 'modifiedTime desc', fields: 'files(id,name,createdTime,modifiedTime)' });
  return r.data.files || [];
}
