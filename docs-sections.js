import { google } from 'googleapis';

function detectHeadingFromText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('######')) return { level: 6, name: trimmed.slice(6).trim() };
  if (trimmed.startsWith('#####')) return { level: 5, name: trimmed.slice(5).trim() };
  if (trimmed.startsWith('####')) return { level: 4, name: trimmed.slice(4).trim() };
  if (trimmed.startsWith('###')) return { level: 3, name: trimmed.slice(3).trim() };
  if (trimmed.startsWith('##')) return { level: 2, name: trimmed.slice(2).trim() };
  if (trimmed.startsWith('#')) return { level: 1, name: trimmed.slice(1).trim() };
  return null;
}

export async function getSections(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body.content || [];
  const sections = [];
  let currentSection = null;

  for (const elem of content) {
    if (elem.paragraph) {
      const style = elem.paragraph.paragraphStyle?.namedStyleType;
      let isHeading = false;
      let headingLevel = 0;
      let headingName = '';
      let headingStyle = style;

      if (style && (style.startsWith('HEADING') || style === 'TITLE')) {
        isHeading = true;
        headingLevel = style === 'TITLE' ? 0 : parseInt(style.replace('HEADING_', '')) || 1;
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) headingName += run.textRun.content;
        }
        headingName = headingName.trim();
      } else {
        let text = '';
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) text += run.textRun.content;
        }
        const mdHeading = detectHeadingFromText(text);
        if (mdHeading) {
          isHeading = true;
          headingLevel = mdHeading.level;
          headingName = mdHeading.name;
          headingStyle = `MARKDOWN_H${mdHeading.level}`;
        }
      }

      if (isHeading) {
        if (currentSection) {
          currentSection.endIndex = elem.startIndex;
          sections.push(currentSection);
        }
        currentSection = {
          name: headingName,
          level: headingLevel,
          startIndex: elem.startIndex,
          endIndex: null,
          headingStyle
        };
      }
    }
  }

  if (currentSection) {
    const lastElem = content[content.length - 1];
    currentSection.endIndex = lastElem?.endIndex || currentSection.startIndex + 1;
    sections.push(currentSection);
  }

  return sections.map((s, i) => ({ ...s, index: i }));
}

export async function deleteSection(auth, docId, sectionIdentifier) {
  const sections = await getSections(auth, docId);
  let section;

  if (typeof sectionIdentifier === 'number') {
    section = sections[sectionIdentifier];
    if (!section) throw new Error(`Section index ${sectionIdentifier} not found. Document has ${sections.length} sections.`);
  } else {
    section = sections.find(s => s.name.toLowerCase() === sectionIdentifier.toLowerCase());
    if (!section) {
      const available = sections.map(s => s.name).join(', ');
      throw new Error(`Section "${sectionIdentifier}" not found. Available sections: ${available}`);
    }
  }

  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });
  const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
  const docEndIndex = lastElem?.endIndex || section.endIndex;
  let endIndex = section.endIndex;
  if (endIndex >= docEndIndex) {
    endIndex = docEndIndex - 1;
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{
        deleteContentRange: {
          range: { startIndex: section.startIndex, endIndex }
        }
      }]
    }
  });

  return { deleted: section.name, startIndex: section.startIndex, endIndex };
}

export async function moveSection(auth, docId, sectionIdentifier, targetPosition) {
  const docs = google.docs({ version: 'v1', auth });
  const sections = await getSections(auth, docId);
  let section;
  let sectionIndex;

  if (typeof sectionIdentifier === 'number') {
    sectionIndex = sectionIdentifier;
    section = sections[sectionIndex];
    if (!section) throw new Error(`Section index ${sectionIdentifier} not found.`);
  } else {
    sectionIndex = sections.findIndex(s => s.name.toLowerCase() === sectionIdentifier.toLowerCase());
    if (sectionIndex === -1) throw new Error(`Section "${sectionIdentifier}" not found.`);
    section = sections[sectionIndex];
  }

  let targetIndex;
  if (typeof targetPosition === 'number') {
    if (targetPosition < 0 || targetPosition > sections.length) {
      throw new Error(`Target position ${targetPosition} out of range (0-${sections.length}).`);
    }
    if (targetPosition === 0) {
      targetIndex = 1;
    } else if (targetPosition >= sections.length) {
      const doc = await docs.documents.get({ documentId: docId });
      const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
      targetIndex = lastElem.endIndex - 1;
    } else {
      targetIndex = sections[targetPosition].startIndex;
    }
  } else if (targetPosition === 'start') {
    targetIndex = 1;
  } else if (targetPosition === 'end') {
    const doc = await docs.documents.get({ documentId: docId });
    const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
    targetIndex = lastElem.endIndex - 1;
  } else {
    const targetSectionIdx = sections.findIndex(s => s.name.toLowerCase() === targetPosition.toLowerCase());
    if (targetSectionIdx === -1) throw new Error(`Target section "${targetPosition}" not found.`);
    targetIndex = sections[targetSectionIdx].startIndex;
  }

  const doc = await docs.documents.get({ documentId: docId });
  let sectionText = '';
  for (const elem of doc.data.body.content) {
    if (elem.startIndex >= section.startIndex && elem.startIndex < section.endIndex) {
      if (elem.paragraph) {
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) sectionText += run.textRun.content;
        }
      }
    }
  }

  const requests = [];
  if (targetIndex > section.endIndex) {
    requests.push({ insertText: { location: { index: targetIndex }, text: sectionText } });
    requests.push({ deleteContentRange: { range: { startIndex: section.startIndex, endIndex: section.endIndex } } });
  } else if (targetIndex < section.startIndex) {
    requests.push({ deleteContentRange: { range: { startIndex: section.startIndex, endIndex: section.endIndex } } });
    requests.push({ insertText: { location: { index: targetIndex }, text: sectionText } });
  } else {
    return { moved: section.name, message: 'Section already at target position' };
  }

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  return { moved: section.name, from: section.startIndex, to: targetIndex };
}

export async function replaceSection(auth, docId, sectionIdentifier, newContent, preserveHeading = true) {
  const docs = google.docs({ version: 'v1', auth });
  const sections = await getSections(auth, docId);
  let section;

  if (typeof sectionIdentifier === 'number') {
    section = sections[sectionIdentifier];
    if (!section) throw new Error(`Section index ${sectionIdentifier} not found.`);
  } else {
    section = sections.find(s => s.name.toLowerCase() === sectionIdentifier.toLowerCase());
    if (!section) throw new Error(`Section "${sectionIdentifier}" not found.`);
  }

  const doc = await docs.documents.get({ documentId: docId });
  let headingEndIndex = section.startIndex;
  for (const elem of doc.data.body.content) {
    if (elem.startIndex === section.startIndex && elem.paragraph) {
      headingEndIndex = elem.endIndex;
      break;
    }
  }

  const deleteStart = preserveHeading ? headingEndIndex : section.startIndex;
  let deleteEnd = section.endIndex;

  const docContent = doc.data.body.content;
  const lastElem = docContent[docContent.length - 1];
  const docEndIndex = lastElem?.endIndex || deleteEnd;
  if (deleteEnd >= docEndIndex) {
    deleteEnd = docEndIndex - 1;
  }

  if (deleteStart >= deleteEnd) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{ insertText: { location: { index: deleteStart }, text: newContent } }]
      }
    });
  } else {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          { deleteContentRange: { range: { startIndex: deleteStart, endIndex: deleteEnd } } },
          { insertText: { location: { index: deleteStart }, text: newContent } }
        ]
      }
    });
  }

  return { replaced: section.name, preservedHeading: preserveHeading };
}
