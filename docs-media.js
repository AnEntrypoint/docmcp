import { google } from 'googleapis';
import { extractText } from './docs-core.js';

export async function insertImage(auth, docId, imageUrl, position = 'end', width = null, height = null) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body.content;

  let index;
  if (position === 'end') {
    const lastElem = content[content.length - 1];
    index = (lastElem.endIndex || content.length) - 1;
  } else if (typeof position === 'number') {
    index = position + 1;
  } else {
    const text = extractText(content);
    const pos = text.indexOf(position);
    if (pos === -1) throw new Error(`Position text "${position}" not found in document.`);
    index = pos + position.length + 1;
  }

  const imageProperties = {};
  if (width || height) {
    imageProperties.objectSize = {};
    if (width) imageProperties.objectSize.width = { magnitude: width, unit: 'PT' };
    if (height) imageProperties.objectSize.height = { magnitude: height, unit: 'PT' };
  }

  const request = {
    insertInlineImage: {
      location: { index },
      uri: imageUrl,
      ...(Object.keys(imageProperties).length > 0 && { objectSize: imageProperties.objectSize })
    }
  };

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [request] }
  });

  return { inserted: true, imageUrl, index };
}

export async function listImages(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });
  const images = [];
  let imageIndex = 0;

  function findImages(elements, parentPath = '') {
    for (const elem of elements || []) {
      if (elem.paragraph) {
        for (const run of elem.paragraph.elements || []) {
          if (run.inlineObjectElement) {
            const objectId = run.inlineObjectElement.inlineObjectId;
            const inlineObject = doc.data.inlineObjects?.[objectId];
            if (inlineObject) {
              const props = inlineObject.inlineObjectProperties?.embeddedObject;
              images.push({
                index: imageIndex++,
                objectId,
                startIndex: run.startIndex,
                endIndex: run.endIndex,
                title: props?.title || null,
                description: props?.description || null,
                sourceUri: props?.imageProperties?.sourceUri || props?.imageProperties?.contentUri || null,
                width: props?.size?.width?.magnitude || null,
                height: props?.size?.height?.magnitude || null
              });
            }
          }
        }
      } else if (elem.table) {
        for (const row of elem.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            findImages(cell.content, `${parentPath}table/`);
          }
        }
      }
    }
  }

  findImages(doc.data.body.content);
  return images;
}

export async function deleteImage(auth, docId, imageIndex) {
  const images = await listImages(auth, docId);
  
  if (imageIndex < 0 || imageIndex >= images.length) {
    throw new Error(`Image index ${imageIndex} out of range. Document has ${images.length} images (0-${images.length - 1}).`);
  }

  const image = images[imageIndex];
  const docs = google.docs({ version: 'v1', auth });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{
        deleteContentRange: {
          range: { startIndex: image.startIndex, endIndex: image.endIndex }
        }
      }]
    }
  });

  return { deleted: true, imageIndex, objectId: image.objectId };
}

export async function replaceImage(auth, docId, imageIndex, newImageUrl, width = null, height = null) {
  const images = await listImages(auth, docId);
  
  if (imageIndex < 0 || imageIndex >= images.length) {
    throw new Error(`Image index ${imageIndex} out of range. Document has ${images.length} images (0-${images.length - 1}).`);
  }

  const image = images[imageIndex];
  const docs = google.docs({ version: 'v1', auth });

  const requests = [
    {
      deleteContentRange: {
        range: { startIndex: image.startIndex, endIndex: image.endIndex }
      }
    }
  ];

  const insertRequest = {
    insertInlineImage: {
      location: { index: image.startIndex },
      uri: newImageUrl
    }
  };

  if (width || height) {
    insertRequest.insertInlineImage.objectSize = {};
    if (width) insertRequest.insertInlineImage.objectSize.width = { magnitude: width, unit: 'PT' };
    if (height) insertRequest.insertInlineImage.objectSize.height = { magnitude: height, unit: 'PT' };
  }

  requests.push(insertRequest);

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests }
  });

  return { replaced: true, imageIndex, newImageUrl };
}
