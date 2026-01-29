import { google } from 'googleapis';
import { readDocument, getAllIndices, parseColor } from './docs-core.js';

export async function formatDocument(auth, docId, searchText, formatting) {
  const text = await readDocument(auth, docId);
  const indices = getAllIndices(text, searchText);

  if (indices.length === 0) {
    throw new Error(
      `Text not found in document. ` +
      `Make sure the text exists exactly as specified.`
    );
  }

  const docs = google.docs({ version: 'v1', auth });
  const requests = [];

  for (const idx of indices) {
    const startIndex = idx + 1;
    const endIndex = idx + searchText.length + 1;

    const textStyle = {};

    if (formatting.bold !== undefined) textStyle.bold = formatting.bold;
    if (formatting.italic !== undefined) textStyle.italic = formatting.italic;
    if (formatting.underline !== undefined) textStyle.underline = formatting.underline;
    if (formatting.strikethrough !== undefined) textStyle.strikethrough = formatting.strikethrough;
    if (formatting.fontSize) {
      textStyle.fontSize = { magnitude: formatting.fontSize, unit: 'PT' };
    }
    if (formatting.fontFamily) {
      textStyle.weightedFontFamily = { fontFamily: formatting.fontFamily };
    }
    if (formatting.foregroundColor) {
      const color = parseColor(formatting.foregroundColor);
      if (color) textStyle.foregroundColor = { color: { rgbColor: color } };
    }
    if (formatting.backgroundColor) {
      const color = parseColor(formatting.backgroundColor);
      if (color) textStyle.backgroundColor = { color: { rgbColor: color } };
    }

    const fields = Object.keys(textStyle).join(',');

    if (fields) {
      requests.push({
        updateTextStyle: {
          range: { startIndex, endIndex },
          textStyle,
          fields
        }
      });
    }

    if (formatting.heading) {
      const headingMap = {
        'TITLE': 'TITLE',
        'SUBTITLE': 'SUBTITLE',
        'HEADING_1': 'HEADING_1',
        'HEADING_2': 'HEADING_2',
        'HEADING_3': 'HEADING_3',
        'HEADING_4': 'HEADING_4',
        'HEADING_5': 'HEADING_5',
        'HEADING_6': 'HEADING_6',
        'NORMAL_TEXT': 'NORMAL_TEXT'
      };
      const namedStyle = headingMap[formatting.heading.toUpperCase()] || 'NORMAL_TEXT';
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { namedStyleType: namedStyle },
          fields: 'namedStyleType'
        }
      });
    }

    if (formatting.alignment) {
      const alignMap = {
        'LEFT': 'START',
        'CENTER': 'CENTER',
        'RIGHT': 'END',
        'JUSTIFY': 'JUSTIFIED'
      };
      const alignment = alignMap[formatting.alignment.toUpperCase()] || 'START';
      requests.push({
        updateParagraphStyle: {
          range: { startIndex, endIndex },
          paragraphStyle: { alignment },
          fields: 'alignment'
        }
      });
    }
  }

  if (requests.length === 0) {
    throw new Error('No formatting options specified.');
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests }
  });

  return { formattedOccurrences: indices.length };
}
