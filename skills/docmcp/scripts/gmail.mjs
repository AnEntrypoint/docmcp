import { google } from 'googleapis';

const gmail = google.gmail('v1');

/**
 * List Gmail messages
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.query - Search query (e.g., "from:example@example.com is:unread")
 * @param {number} params.max_results - Maximum number of messages to return (default: 10)
 * @returns {Array} List of messages with id and threadId
 */
export async function listMessages(auth, params) {
  const res = await gmail.users.messages.list({
    auth,
    userId: 'me',
    q: params.query,
    maxResults: params.max_results || 10
  });
  return res.data.messages || [];
}

/**
 * Get Gmail message details
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to retrieve
 * @param {boolean} params.format - Format to return (full, minimal, raw, metadata) (default: "full")
 * @returns {Object} Message details
 */
export async function getMessage(auth, params) {
  const res = await gmail.users.messages.get({
    auth,
    userId: 'me',
    id: params.message_id,
    format: params.format || 'full'
  });
  return res.data;
}

/**
 * Send an email
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body (HTML or plain text)
 * @param {string} params.from - Sender name (optional)
 * @param {Array} params.cc - CC recipients (optional)
 * @param {Array} params.bcc - BCC recipients (optional)
 * @param {Array} params.attachments - File attachments (optional, array of { filename, content })
 * @returns {Object} Send result
 */
export async function sendMessage(auth, params) {
  // Create email content
  const emailLines = [];
  emailLines.push(`To: ${params.to}`);
  emailLines.push(`Subject: ${params.subject}`);
  if (params.from) {
    emailLines.push(`From: ${params.from}`);
  }
  if (params.cc) {
    emailLines.push(`Cc: ${Array.isArray(params.cc) ? params.cc.join(',') : params.cc}`);
  }
  if (params.bcc) {
    emailLines.push(`Bcc: ${Array.isArray(params.bcc) ? params.bcc.join(',') : params.bcc}`);
  }
  
  // Determine if body is HTML or plain text
  const contentType = params.body.includes('<html') || params.body.includes('<body') ? 'text/html' : 'text/plain';
  emailLines.push(`Content-Type: ${contentType}; charset=utf-8`);
  emailLines.push('MIME-Version: 1.0');
  emailLines.push('');
  emailLines.push(params.body);
  
  // Encode email
  const raw = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const res = await gmail.users.messages.send({
    auth,
    userId: 'me',
    requestBody: { raw }
  });
  
  return res.data;
}

/**
 * Get Gmail threads
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.query - Search query (e.g., "from:example@example.com")
 * @param {number} params.max_results - Maximum number of threads to return (default: 10)
 * @returns {Array} List of threads
 */
export async function listThreads(auth, params) {
  const res = await gmail.users.threads.list({
    auth,
    userId: 'me',
    q: params.query,
    maxResults: params.max_results || 10
  });
  return res.data.threads || [];
}

/**
 * Get Gmail thread details
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.thread_id - Thread ID to retrieve
 * @param {boolean} params.format - Format to return (full, minimal, raw, metadata) (default: "full")
 * @returns {Object} Thread details
 */
export async function getThread(auth, params) {
  const res = await gmail.users.threads.get({
    auth,
    userId: 'me',
    id: params.thread_id,
    format: params.format || 'full'
  });
  return res.data;
}

/**
 * Modify message labels
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to modify
 * @param {Array} params.add_labels - Labels to add
 * @param {Array} params.remove_labels - Labels to remove
 * @returns {Object} Modify result
 */
export async function modifyMessage(auth, params) {
  const res = await gmail.users.messages.modify({
    auth,
    userId: 'me',
    id: params.message_id,
    requestBody: {
      addLabelIds: params.add_labels || [],
      removeLabelIds: params.remove_labels || []
    }
  });
  return res.data;
}

/**
 * Mark message as read
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to mark as read
 * @returns {Object} Modify result
 */
export async function markAsRead(auth, params) {
  return modifyMessage(auth, {
    message_id: params.message_id,
    remove_labels: ['UNREAD']
  });
}

/**
 * Mark message as unread
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to mark as unread
 * @returns {Object} Modify result
 */
export async function markAsUnread(auth, params) {
  return modifyMessage(auth, {
    message_id: params.message_id,
    add_labels: ['UNREAD']
  });
}

/**
 * Trash a message
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to trash
 * @returns {Object} Trash result
 */
export async function trashMessage(auth, params) {
  const res = await gmail.users.messages.trash({
    auth,
    userId: 'me',
    id: params.message_id
  });
  return res.data;
}

/**
 * Untrash a message
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to untrash
 * @returns {Object} Untrash result
 */
export async function untrashMessage(auth, params) {
  const res = await gmail.users.messages.untrash({
    auth,
    userId: 'me',
    id: params.message_id
  });
  return res.data;
}

/**
 * Delete a message permanently
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.message_id - Message ID to delete
 * @returns {Object} Delete result
 */
export async function deleteMessage(auth, params) {
  const res = await gmail.users.messages.delete({
    auth,
    userId: 'me',
    id: params.message_id
  });
  return res.data;
}

/**
 * List Gmail labels
 * @param {Object} auth - Authentication object
 * @returns {Array} List of labels
 */
export async function listLabels(auth) {
  const res = await gmail.users.labels.list({
    auth,
    userId: 'me'
  });
  return res.data.labels || [];
}

/**
 * Get Gmail label details
 * @param {Object} auth - Authentication object
 * @param {Object} params - Parameters
 * @param {string} params.label_id - Label ID to retrieve
 * @returns {Object} Label details
 */
export async function getLabel(auth, params) {
  const res = await gmail.users.labels.get({
    auth,
    userId: 'me',
    id: params.label_id
  });
  return res.data;
}
