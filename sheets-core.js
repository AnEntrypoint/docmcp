import { parseApiResponse, validateParams, extractResponseData } from './api-call-wrapper.js';
import { withErrorHandling, handleApiError } from './error-handling.js';

export async function sheetsRead(sheetId, range = 'Sheet1') {
  validateParams({ sheetId }, ['sheetId']);
  try {
    const response = await callTool('sheets_read', { sheetId, range });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsRead');
    throw error;
  }
}

export async function sheetsWrite(sheetId, range, values) {
  validateParams({ sheetId, range, values }, ['sheetId', 'range', 'values']);
  try {
    const response = await callTool('sheets_edit', { sheetId, range, values });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsWrite');
    throw error;
  }
}

export async function sheetsInsert(sheetId, values, range = 'Sheet1') {
  validateParams({ sheetId, values }, ['sheetId', 'values']);
  try {
    const response = await callTool('sheets_insert', { sheetId, values, range });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsInsert');
    throw error;
  }
}

export async function sheetsClear(sheetId, range) {
  validateParams({ sheetId, range }, ['sheetId', 'range']);
  try {
    const response = await callTool('sheets_clear', { sheetId, range });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsClear');
    throw error;
  }
}

export async function sheetsCreateTab(sheetId, title) {
  validateParams({ sheetId, title }, ['sheetId', 'title']);
  try {
    const response = await callTool('sheets_tab', { 
      sheetId, 
      action: 'add',
      title 
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsCreateTab');
    throw error;
  }
}

export async function sheetsFormat(sheetId, range, formatOptions) {
  validateParams({ sheetId, range }, ['sheetId', 'range']);
  try {
    const response = await callTool('sheets_format', { 
      sheetId, 
      range, 
      ...formatOptions 
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsFormat');
    throw error;
  }
}
