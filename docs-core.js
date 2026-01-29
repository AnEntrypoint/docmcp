import { google } from 'googleapis';

export function extractText(content) {
  let text = '';
  for (const elem of content || []) {
    if (elem.paragraph) {
      for (const run of elem.paragraph.elements || []) {
        if (run.textRun) {
          text += run.textRun.content;
        }
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

export function countOccurrences(text, search) {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

export function getAllIndices(text, search) {
  const indices = [];
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    indices.push(pos);
    pos += search.length;
  }
  return indices;
}

export function parseColor(colorStr) {
  if (!colorStr) return null;
  const hex = colorStr.replace('#', '');
  if (hex.length !== 6) return null;
  return {
    red: parseInt(hex.substring(0, 2), 16) / 255,
    green: parseInt(hex.substring(2, 4), 16) / 255,
    blue: parseInt(hex.substring(4, 6), 16) / 255
  };
}

export async function readDocument(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const result = await docs.documents.get({ documentId: docId });
  return extractText(result.data.body.content);
}

export async function createDocument(auth, title) {
  const docs = google.docs({ version: 'v1', auth });
  const result = await docs.documents.create({
    requestBody: { title }
  });
  return { docId: result.data.documentId, title: result.data.title };
}

export async function getDocumentInfo(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  const doc = await docs.documents.get({ documentId: docId });
  
  const info = {
    id: doc.data.documentId,
    title: doc.data.title
  };

  try {
    const file = await drive.files.get({
      fileId: docId,
      fields: 'id,name,mimeType,createdTime,modifiedTime,owners,size'
    });
    info.createdTime = file.data.createdTime;
    info.modifiedTime = file.data.modifiedTime;
    info.owners = file.data.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || [];
  } catch (e) {
    info.note = 'Drive metadata unavailable (requires drive scope)';
  }

  return info;
}

export async function listDocuments(auth, maxResults = 20, query = null) {
  const drive = google.drive({ version: 'v3', auth });

  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const result = await drive.files.list({
    q,
    pageSize: maxResults,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,createdTime,modifiedTime)'
  });

  return result.data.files || [];
}

export async function getDocumentStructure(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });

  const structure = [];

  for (const elem of doc.data.body.content || []) {
    if (elem.paragraph) {
      const style = elem.paragraph.paragraphStyle?.namedStyleType;
      if (style && style.startsWith('HEADING')) {
        let text = '';
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) text += run.textRun.content;
        }
        structure.push({
          level: parseInt(style.replace('HEADING_', '')) || 0,
          text: text.trim(),
          index: elem.startIndex
        });
      } else if (style === 'TITLE') {
        let text = '';
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) text += run.textRun.content;
        }
        structure.push({
          level: 0,
          text: text.trim(),
          index: elem.startIndex,
          isTitle: true
        });
      }
    }
  }

  return structure;
}
