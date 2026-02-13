import { google } from 'googleapis';

function extractText(content) {
  let text = '';
  for (const elem of content || []) {
    if (elem.paragraph) { for (const run of elem.paragraph.elements || []) { if (run.textRun) text += run.textRun.content; } }
    else if (elem.table) { for (const row of elem.table.tableRows || []) { for (const cell of row.tableCells || []) { text += extractText(cell.content) + '\t'; } text += '\n'; } }
  }
  return text;
}

export async function getSections(auth, { doc_id }) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: doc_id });
  const content = doc.data.body.content || [];
  const sections = [];
  let current = null;
  for (const elem of content) {
    if (!elem.paragraph) continue;
    const style = elem.paragraph.paragraphStyle?.namedStyleType;
    let isHeading = false, level = 0, name = '';
    if (style && (style.startsWith('HEADING') || style === 'TITLE')) {
      isHeading = true;
      level = style === 'TITLE' ? 0 : parseInt(style.replace('HEADING_', '')) || 1;
      for (const run of elem.paragraph.elements || []) { if (run.textRun) name += run.textRun.content; }
      name = name.trim();
    }
    if (isHeading) {
      if (current) { current.endIndex = elem.startIndex; sections.push(current); }
      current = { name, level, startIndex: elem.startIndex, endIndex: null };
    }
  }
  if (current) { const last = content[content.length - 1]; current.endIndex = last?.endIndex || current.startIndex + 1; sections.push(current); }
  return sections.map((s, i) => ({ ...s, index: i }));
}

function findSection(sections, id) {
  if (typeof id === 'number') { const s = sections[id]; if (!s) throw new Error(`Section index ${id} not found`); return s; }
  const s = sections.find(s => s.name.toLowerCase() === id.toLowerCase());
  if (!s) throw new Error(`Section "${id}" not found. Available: ${sections.map(s => s.name).join(', ')}`);
  return s;
}

export async function section(auth, { doc_id, action, section: sectionId, target, content, preserve_heading = true }) {
  const docs = google.docs({ version: 'v1', auth });
  const sections = await getSections(auth, { doc_id });
  const sec = findSection(sections.map ? sections : sections, sectionId);

  if (action === 'delete') {
    const doc = await docs.documents.get({ documentId: doc_id });
    const last = doc.data.body.content[doc.data.body.content.length - 1];
    let end = sec.endIndex;
    if (end >= last.endIndex) end = last.endIndex - 1;
    await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests: [{ deleteContentRange: { range: { startIndex: sec.startIndex, endIndex: end } } }] } });
    return { deleted: sec.name };
  }
  if (action === 'move') {
    const doc = await docs.documents.get({ documentId: doc_id });
    let sectionText = '';
    for (const elem of doc.data.body.content) {
      if (elem.startIndex >= sec.startIndex && elem.startIndex < sec.endIndex && elem.paragraph) {
        for (const run of elem.paragraph.elements || []) { if (run.textRun) sectionText += run.textRun.content; }
      }
    }
    let targetIndex;
    if (target === 'start') targetIndex = 1;
    else if (target === 'end') { const last = doc.data.body.content[doc.data.body.content.length - 1]; targetIndex = last.endIndex - 1; }
    else if (typeof target === 'number') { targetIndex = target < sections.length ? sections[target].startIndex : doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1; }
    else { const ts = sections.findIndex(s => s.name.toLowerCase() === target.toLowerCase()); if (ts === -1) throw new Error(`Target section "${target}" not found`); targetIndex = sections[ts].startIndex; }
    const requests = [];
    if (targetIndex > sec.endIndex) { requests.push({ insertText: { location: { index: targetIndex }, text: sectionText } }); requests.push({ deleteContentRange: { range: { startIndex: sec.startIndex, endIndex: sec.endIndex } } }); }
    else if (targetIndex < sec.startIndex) { requests.push({ deleteContentRange: { range: { startIndex: sec.startIndex, endIndex: sec.endIndex } } }); requests.push({ insertText: { location: { index: targetIndex }, text: sectionText } }); }
    else return { moved: sec.name, message: 'Already at target' };
    await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests } });
    return { moved: sec.name };
  }
  if (action === 'replace') {
    const doc = await docs.documents.get({ documentId: doc_id });
    let headingEnd = sec.startIndex;
    for (const elem of doc.data.body.content) { if (elem.startIndex === sec.startIndex && elem.paragraph) { headingEnd = elem.endIndex; break; } }
    const deleteStart = preserve_heading ? headingEnd : sec.startIndex;
    let deleteEnd = sec.endIndex;
    const last = doc.data.body.content[doc.data.body.content.length - 1];
    if (deleteEnd >= last.endIndex) deleteEnd = last.endIndex - 1;
    const requests = [];
    if (deleteStart < deleteEnd) requests.push({ deleteContentRange: { range: { startIndex: deleteStart, endIndex: deleteEnd } } });
    requests.push({ insertText: { location: { index: deleteStart }, text: content } });
    await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests } });
    return { replaced: sec.name, preservedHeading: preserve_heading };
  }
  throw new Error(`Unknown action: ${action}`);
}

export async function image(auth, { doc_id, action: act, image_url, image_index, position = 'end', width, height }) {
  const docs = google.docs({ version: 'v1', auth });
  if (act === 'list') {
    const doc = await docs.documents.get({ documentId: doc_id });
    const images = [];
    let idx = 0;
    const find = (elems) => {
      for (const elem of elems || []) {
        if (elem.paragraph) { for (const run of elem.paragraph.elements || []) { if (run.inlineObjectElement) { const oid = run.inlineObjectElement.inlineObjectId; const obj = doc.data.inlineObjects?.[oid]; if (obj) { const p = obj.inlineObjectProperties?.embeddedObject; images.push({ index: idx++, objectId: oid, startIndex: run.startIndex, endIndex: run.endIndex, sourceUri: p?.imageProperties?.sourceUri || null, width: p?.size?.width?.magnitude || null, height: p?.size?.height?.magnitude || null }); } } } }
        else if (elem.table) { for (const row of elem.table.tableRows || []) { for (const cell of row.tableCells || []) { find(cell.content); } } }
      }
    };
    find(doc.data.body.content);
    return images;
  }
  if (act === 'insert') {
    const doc = await docs.documents.get({ documentId: doc_id });
    let index;
    if (position === 'end') { const last = doc.data.body.content[doc.data.body.content.length - 1]; index = (last.endIndex || doc.data.body.content.length) - 1; }
    else if (typeof position === 'number') index = position + 1;
    else { const text = extractText(doc.data.body.content); const pos = text.indexOf(position); if (pos === -1) throw new Error('Position text not found'); index = pos + position.length + 1; }
    const req = { insertInlineImage: { location: { index }, uri: image_url } };
    if (width || height) { req.insertInlineImage.objectSize = {}; if (width) req.insertInlineImage.objectSize.width = { magnitude: width, unit: 'PT' }; if (height) req.insertInlineImage.objectSize.height = { magnitude: height, unit: 'PT' }; }
    await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests: [req] } });
    return { inserted: true };
  }
  if (act === 'delete' || act === 'replace') {
    const images = await image(auth, { doc_id, action: 'list' });
    if (image_index < 0 || image_index >= images.length) throw new Error(`Image index ${image_index} out of range (0-${images.length - 1})`);
    const img = images[image_index];
    const requests = [{ deleteContentRange: { range: { startIndex: img.startIndex, endIndex: img.endIndex } } }];
    if (act === 'replace') {
      const req = { insertInlineImage: { location: { index: img.startIndex }, uri: image_url } };
      if (width || height) { req.insertInlineImage.objectSize = {}; if (width) req.insertInlineImage.objectSize.width = { magnitude: width, unit: 'PT' }; if (height) req.insertInlineImage.objectSize.height = { magnitude: height, unit: 'PT' }; }
      requests.push(req);
    }
    await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests } });
    return act === 'delete' ? { deleted: true, imageIndex: image_index } : { replaced: true, imageIndex: image_index };
  }
  throw new Error(`Unknown image action: ${act}`);
}

export async function batch(auth, { doc_id, operations }) {
  const docs = google.docs({ version: 'v1', auth });
  const requests = [];
  for (const op of operations) {
    if (op.type === 'insert') requests.push({ insertText: { location: { index: op.index + 1 }, text: op.text } });
    else if (op.type === 'delete') requests.push({ deleteContentRange: { range: { startIndex: op.startIndex + 1, endIndex: op.endIndex + 1 } } });
    else if (op.type === 'format') {
      const ts = {};
      if (op.bold !== undefined) ts.bold = op.bold;
      if (op.italic !== undefined) ts.italic = op.italic;
      if (op.underline !== undefined) ts.underline = op.underline;
      const fields = Object.keys(ts).join(',');
      if (fields) requests.push({ updateTextStyle: { range: { startIndex: op.startIndex + 1, endIndex: op.endIndex + 1 }, textStyle: ts, fields } });
    }
  }
  if (requests.length === 0) throw new Error('No valid operations');
  await docs.documents.batchUpdate({ documentId: doc_id, requestBody: { requests } });
  return { operationsApplied: requests.length };
}

export async function searchDrive(auth, { query, type = 'all', max_results = 20 }) {
  const drive = google.drive({ version: 'v3', auth });
  const mimeTypes = { docs: "mimeType='application/vnd.google-apps.document'", sheets: "mimeType='application/vnd.google-apps.spreadsheet'", all: "(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet')" };
  const escaped = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `${mimeTypes[type] || mimeTypes.all} and trashed=false and (name contains '${escaped}' or fullText contains '${escaped}')`;
  const r = await drive.files.list({ q, pageSize: max_results, orderBy: 'modifiedTime desc', fields: 'files(id,name,mimeType,createdTime,modifiedTime,owners)' });
  return (r.data.files || []).map(f => ({ id: f.id, name: f.name, type: f.mimeType === 'application/vnd.google-apps.document' ? 'doc' : 'sheet', createdTime: f.createdTime, modifiedTime: f.modifiedTime }));
}
