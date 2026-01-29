import { google } from 'googleapis';
import { readDocument, extractText, countOccurrences, getAllIndices, parseColor } from './docs-core.js';

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
    if (newText) {
      requests.push({
        insertText: { location: { index: idx + 1 }, text: newText }
      });
    }
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

export async function deleteText(auth, docId, searchText, replaceAll = false) {
  return editDocument(auth, docId, searchText, '', replaceAll);
}

export async function insertTable(auth, docId, rows, cols, position = 'end') {
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
      throw new Error(`Position text not found in document.`);
    }
    index = pos + position.length + 1;
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{
        insertTable: {
          rows,
          columns: cols,
          location: { index }
        }
      }]
    }
  });

  return { rows, cols };
}

export async function batchUpdate(auth, docId, operations) {
  const docs = google.docs({ version: 'v1', auth });
  const requests = [];

  for (const op of operations) {
    switch (op.type) {
      case 'insert':
        requests.push({
          insertText: {
            location: { index: op.index + 1 },
            text: op.text
          }
        });
        break;
      case 'delete':
        requests.push({
          deleteContentRange: {
            range: { startIndex: op.startIndex + 1, endIndex: op.endIndex + 1 }
          }
        });
        break;
      case 'format':
        const textStyle = {};
        if (op.bold !== undefined) textStyle.bold = op.bold;
        if (op.italic !== undefined) textStyle.italic = op.italic;
        if (op.underline !== undefined) textStyle.underline = op.underline;
        const fields = Object.keys(textStyle).join(',');
        if (fields) {
          requests.push({
            updateTextStyle: {
              range: { startIndex: op.startIndex + 1, endIndex: op.endIndex + 1 },
              textStyle,
              fields
            }
          });
        }
        break;
    }
  }

  if (requests.length === 0) {
    throw new Error('No valid operations provided.');
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests }
  });

  return { operationsApplied: requests.length };
}
