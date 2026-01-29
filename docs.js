import { google } from 'googleapis';

function extractText(content) {
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

function countOccurrences(text, search) {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

function getAllIndices(text, search) {
  const indices = [];
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    indices.push(pos);
    pos += search.length;
  }
  return indices;
}

export async function readDocument(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const result = await docs.documents.get({ documentId: docId });
  return extractText(result.data.body.content);
}

export async function editDocument(auth, docId, oldText, newText, replaceAll = false) {
  const text = await readDocument(auth, docId);
  const count = countOccurrences(text, oldText);

  if (count === 0) {
    throw new Error(
      `old_text not found in document. ` +
      `Make sure the text exists exactly as specified, including whitespace and punctuation.`
    );
  }

  if (count > 1 && !replaceAll) {
    throw new Error(
      `old_text appears ${count} times in document. ` +
      `The edit will fail because old_text must be unique. ` +
      `Either include more surrounding context to make it unique, ` +
      `or set replace_all to true to replace all ${count} occurrences.`
    );
  }

  const docs = google.docs({ version: 'v1', auth });
  const indices = getAllIndices(text, oldText);

  const requests = [];
  for (let i = indices.length - 1; i >= 0; i--) {
    const idx = indices[i];
    requests.push({
      deleteContentRange: { range: { startIndex: idx + 1, endIndex: idx + oldText.length + 1 } }
    });
    requests.push({
      insertText: { location: { index: idx + 1 }, text: newText }
    });
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests }
  });

  return { replacements: indices.length };
}

export async function insertDocument(auth, docId, text, position = 'end') {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });

  let index;
  if (position === 'end') {
    const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
    index = (lastElem.endIndex || doc.data.body.content.length) - 1;
  } else if (typeof position === 'number') {
    index = position + 1;
  } else {
    const content = extractText(doc.data.body.content);
    const pos = content.indexOf(position);
    if (pos === -1) {
      throw new Error(
        `Position text not found in document. ` +
        `Make sure the text exists exactly as specified.`
      );
    }
    index = pos + position.length + 1;
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ insertText: { location: { index }, text } }] }
  });
}
