import { parseApiResponse, validateParams } from './api-call-wrapper.js';
import { withErrorHandling, handleApiError } from './error-handling.js';

export async function gmailList(query = '', maxResults = 10) {
  try {
    const response = await callTool('gmail_list', { query, max_results: maxResults });
    return parseApiResponse(response).data || [];
  } catch (error) {
    handleApiError(error, 'gmailList');
    throw error;
  }
}

export async function gmailSearch(query, maxResults = 20) {
  validateParams({ query }, ['query']);
  try {
    const response = await callTool('gmail_search', { query, max_results: maxResults });
    return parseApiResponse(response).data || [];
  } catch (error) {
    handleApiError(error, 'gmailSearch');
    throw error;
  }
}

export async function gmailRead(messageId) {
  validateParams({ messageId }, ['messageId']);
  try {
    const response = await callTool('gmail_read', { message_id: messageId });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'gmailRead');
    throw error;
  }
}

export async function gmailCreateLabel(name, color = null) {
  validateParams({ name }, ['name']);
  try {
    const response = await callTool('gmail_create_label', { name, color });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'gmailCreateLabel');
    throw error;
  }
}

export async function gmailModifyLabels(messageId, addLabels = [], removeLabels = []) {
  validateParams({ messageId }, ['messageId']);
  try {
    const response = await callTool('gmail_modify_labels', { 
      message_id: messageId,
      add_labels: addLabels,
      remove_labels: removeLabels
    });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'gmailModifyLabels');
    throw error;
  }
}

export async function gmailSend(to, subject, body) {
  validateParams({ to, subject, body }, ['to', 'subject', 'body']);
  try {
    const response = await callTool('gmail_send', { to, subject, body });
    return parseApiResponse(response).data;
  } catch (error) {
    handleApiError(error, 'gmailSend');
    throw error;
  }
}
