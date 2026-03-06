import { parseApiResponse, validateParams } from './api-call-wrapper.js';
import { withErrorHandling, handleApiError } from './error-handling.js';

export async function sheetsTabAdd(sheetId, title) {
  validateParams({ sheetId, title }, ['sheetId', 'title']);
  try {
    const response = await callTool('sheets_tab', { 
      sheetId, 
      action: 'add',
      title 
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsTabAdd');
    throw error;
  }
}

export async function sheetsTabRename(sheetId, sheetName, title) {
  validateParams({ sheetId, sheetName, title }, ['sheetId', 'sheetName', 'title']);
  try {
    const response = await callTool('sheets_tab', { 
      sheetId, 
      action: 'rename',
      sheet_name: sheetName,
      title
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsTabRename');
    throw error;
  }
}

export async function sheetsTabDelete(sheetId, sheetName) {
  validateParams({ sheetId, sheetName }, ['sheetId', 'sheetName']);
  try {
    const response = await callTool('sheets_tab', { 
      sheetId, 
      action: 'delete',
      sheet_name: sheetName
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsTabDelete');
    throw error;
  }
}

export async function sheetsFreezeRows(sheetId, sheetName, rows) {
  validateParams({ sheetId, sheetName, rows }, ['sheetId', 'sheetName', 'rows']);
  try {
    const response = await callTool('sheets_freeze', { 
      sheetId, 
      sheet_name: sheetName,
      rows
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsFreezeRows');
    throw error;
  }
}

export async function sheetsFreezeCols(sheetId, sheetName, columns) {
  validateParams({ sheetId, sheetName, columns }, ['sheetId', 'sheetName', 'columns']);
  try {
    const response = await callTool('sheets_freeze', { 
      sheetId, 
      sheet_name: sheetName,
      columns
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'sheetsFreezeCols');
    throw error;
  }
}
