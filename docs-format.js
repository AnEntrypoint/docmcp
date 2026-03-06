import { parseApiResponse, validateParams } from './api-call-wrapper.js';
import { withErrorHandling, handleApiError } from './error-handling.js';

export async function docsFormat(docId, searchText, formatOptions) {
  validateParams({ docId, searchText }, ['docId', 'searchText']);
  try {
    const response = await callTool('docs_format', {
      doc_id: docId,
      search_text: searchText,
      ...formatOptions
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'docsFormat');
    throw error;
  }
}

export async function docsInsertTable(docId, rows, cols, position = 'end') {
  validateParams({ docId, rows, cols }, ['docId', 'rows', 'cols']);
  try {
    const response = await callTool('docs_insert_table', {
      doc_id: docId,
      rows,
      cols,
      position
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'docsInsertTable');
    throw error;
  }
}

export async function docsInsertImage(docId, imageUrl, width = null, height = null, position = 'end') {
  validateParams({ docId, imageUrl }, ['docId', 'imageUrl']);
  try {
    const response = await callTool('docs_image', {
      doc_id: docId,
      action: 'insert',
      image_url: imageUrl,
      width,
      height,
      position
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'docsInsertImage');
    throw error;
  }
}

export async function docsDeleteImage(docId, imageIndex) {
  validateParams({ docId, imageIndex }, ['docId', 'imageIndex']);
  try {
    const response = await callTool('docs_image', {
      doc_id: docId,
      action: 'delete',
      image_index: imageIndex
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'docsDeleteImage');
    throw error;
  }
}

export async function docsReplaceImage(docId, imageIndex, imageUrl, width = null, height = null) {
  validateParams({ docId, imageIndex, imageUrl }, ['docId', 'imageIndex', 'imageUrl']);
  try {
    const response = await callTool('docs_image', {
      doc_id: docId,
      action: 'replace',
      image_index: imageIndex,
      image_url: imageUrl,
      width,
      height
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'docsReplaceImage');
    throw error;
  }
}
