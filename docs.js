import { google } from 'googleapis';

function extractText(content, map = null) {
  let text = '';
  let idx = 0;
  if (map) map.push([idx, idx]);

  for (const elem of content || []) {
    if (elem.paragraph) {
      for (const run of elem.paragraph.elements || []) {
        if (run.textRun) {
          const start = text.length;
          text += run.textRun.content;
          if (map) map.push([start, start + run.textRun.content.length]);
        }
      }
      text += '\n';
    } else if (elem.table) {
      for (const row of elem.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          const cellText = extractText(cell.content, null);
          text += cellText + '\t';
        }
        text += '\n';
      }
    }
  }
  return text;
}

export async function readDocument(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const result = await docs.documents.get({ documentId: docId });
  return extractText(result.data.body.content);
}

export async function editDocument(auth, docId, oldText, newText) {
  const text = await readDocument(auth, docId);
  if (!text.includes(oldText)) {
    throw new Error(`Text not found`);
  }
  if (text.indexOf(oldText) !== text.lastIndexOf(oldText)) {
    throw new Error(`Multiple matches`);
  }

  const idx = text.indexOf(oldText);
  const docs = google.docs({ version: 'v1', auth });

  const requests = [{
    deleteContentRange: { range: { startIndex: idx + 1, endIndex: idx + oldText.length + 1 } }
  }, {
    insertText: { location: { index: idx + 1 }, text: newText }
  }];

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests }
  });
}

export async function insertDocument(auth, docId, text, position = 'end') {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });

  let index;
  if (position === 'end') {
    const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
    index = lastElem.endIndex || doc.data.body.content.length;
  } else if (typeof position === 'number') {
    index = position;
  } else {
    const content = await readDocument(auth, docId);
    const pos = content.indexOf(position);
    if (pos === -1) throw new Error(`Position not found`);
    index = pos + position.length + 1;
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ insertText: { location: { index }, text } }] }
  });
}
