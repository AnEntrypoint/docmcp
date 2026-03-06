import { parseApiResponse, validateParams } from './api-call-wrapper.js';
import { withErrorHandling, handleApiError } from './error-handling.js';

export async function scriptsCreate(sheetId, scriptName) {
  validateParams({ sheetId, scriptName }, ['sheetId', 'scriptName']);
  try {
    const response = await callTool('scripts_create', { sheetId, script_name: scriptName });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'scriptsCreate');
    throw error;
  }
}

export async function scriptsList(sheetId) {
  validateParams({ sheetId }, ['sheetId']);
  try {
    const response = await callTool('scripts_list', { sheetId });
    return parseApiResponse(response).data || [];
  } catch (error) {
    handleApiError(error, 'scriptsList');
    throw error;
  }
}

export async function scriptsRead(sheetId, scriptId) {
  validateParams({ sheetId, scriptId }, ['sheetId', 'scriptId']);
  try {
    const response = await callTool('scripts_read', { sheetId, script: scriptId });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'scriptsRead');
    throw error;
  }
}

export async function scriptsWrite(sheetId, scriptId, fileName, content, mode = 'write') {
  validateParams({ sheetId, scriptId, fileName, content }, ['sheetId', 'scriptId', 'fileName', 'content']);
  try {
    const response = await callTool('scripts_write', { 
      sheetId, 
      script: scriptId,
      file_name: fileName,
      content,
      mode
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'scriptsWrite');
    throw error;
  }
}

export async function scriptsDelete(sheetId, scriptId) {
  validateParams({ sheetId, scriptId }, ['sheetId', 'scriptId']);
  try {
    const response = await callTool('scripts_delete', { sheetId, script: scriptId });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'scriptsDelete');
    throw error;
  }
}
