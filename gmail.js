import { google } from 'googleapis';

function getGmail(auth) {
  return google.gmail({ version: 'v1', auth });
}

function decodeBase64(data) {
  if (!data) return '';
  const decoded = Buffer.from(data, 'base64').toString('utf-8');
  return decoded;
}

function extractBody(payload) {
  let body = '';
  
  if (payload.body && payload.body.data) {
    body = decodeBase64(payload.body.data);
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body = decodeBase64(part.body.data);
        break;
      } else if (part.mimeType === 'text/html' && part.body && part.body.data && !body) {
        body = decodeBase64(part.body.data);
      } else if (part.parts) {
        const nestedBody = extractBody(part);
        if (nestedBody && !body) {
          body = nestedBody;
        }
      }
    }
  }
  
  return body;
}

function extractHeaders(headers) {
  const result = {};
  const fields = ['From', 'To', 'Subject', 'Date', 'Cc', 'Bcc', 'Reply-To'];
  for (const header of headers || []) {
    if (fields.includes(header.name)) {
      result[header.name.toLowerCase().replace('-', '_')] = header.value;
    }
  }
  return result;
}

export async function listEmails(auth, maxResults = 20, query = null, labelIds = null) {
  const gmail = getGmail(auth);
  
  const params = {
    userId: 'me',
    maxResults
  };
  
  if (query) params.q = query;
  if (labelIds) params.labelIds = Array.isArray(labelIds) ? labelIds : [labelIds];
  
  const listRes = await gmail.users.messages.list(params);
  const messages = listRes.data.messages || [];
  
  if (messages.length === 0) {
    return { emails: [], count: 0 };
  }
  
  const emails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      });
      
      const headers = extractHeaders(detail.data.payload.headers);
      
      return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: detail.data.snippet,
        ...headers,
        labelIds: detail.data.labelIds || []
      };
    })
  );
  
  return { emails, count: emails.length };
}

export async function searchEmails(auth, query, maxResults = 20) {
  return listEmails(auth, maxResults, query);
}

export async function readEmail(auth, messageId, format = 'full') {
  const gmail = getGmail(auth);
  
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format
  });
  
  const message = res.data;
  const headers = extractHeaders(message.payload.headers);
  const body = extractBody(message.payload);
  
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds || [],
    snippet: message.snippet,
    ...headers,
    body,
    internalDate: message.internalDate
  };
}

export async function getEmailAttachments(auth, messageId) {
  const gmail = getGmail(auth);
  
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  });
  
  const attachments = [];
  
  function findAttachments(payload) {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size
          });
        }
        if (part.parts) {
          findAttachments(part);
        }
      }
    }
  }
  
  findAttachments(res.data.payload);
  
  return { messageId, attachments };
}

export async function downloadAttachment(auth, messageId, attachmentId) {
  const gmail = getGmail(auth);
  
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId
  });
  
  return {
    data: res.data.data,
    size: res.data.size
  };
}

export async function getLabels(auth) {
  const gmail = getGmail(auth);
  
  const res = await gmail.users.labels.list({ userId: 'me' });
  
  return {
    labels: (res.data.labels || []).map(label => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
      threadsTotal: label.threadsTotal,
      threadsUnread: label.threadsUnread,
      labelListVisibility: label.labelListVisibility,
      messageListVisibility: label.messageListVisibility,
      color: label.color
    }))
  };
}

export async function createLabel(auth, requestBody) {
  const gmail = getGmail(auth);

  const res = await gmail.users.labels.create({
    userId: 'me',
    requestBody
  });

  return res.data;
}

export async function updateLabel(auth, labelId, requestBody) {
  const gmail = getGmail(auth);

  const res = await gmail.users.labels.patch({
    userId: 'me',
    id: labelId,
    requestBody
  });

  return res.data;
}

export async function deleteLabel(auth, labelId) {
  const gmail = getGmail(auth);

  await gmail.users.labels.delete({
    userId: 'me',
    id: labelId
  });

  return { deleted: labelId };
}

export async function listFilters(auth) {
  const gmail = getGmail(auth);

  const res = await gmail.users.settings.filters.list({ userId: 'me' });
  return { filters: res.data.filter || [] };
}

export async function getFilter(auth, filterId) {
  const gmail = getGmail(auth);

  const res = await gmail.users.settings.filters.get({
    userId: 'me',
    id: filterId
  });

  return res.data;
}

export async function createFilter(auth, criteria, action) {
  const gmail = getGmail(auth);

  const res = await gmail.users.settings.filters.create({
    userId: 'me',
    requestBody: { criteria, action }
  });

  return res.data;
}

export async function deleteFilter(auth, filterId) {
  const gmail = getGmail(auth);

  await gmail.users.settings.filters.delete({
    userId: 'me',
    id: filterId
  });

  return { deleted: filterId };
}

export async function replaceFilter(auth, filterId, criteriaPatch = {}, actionPatch = {}) {
  const current = await getFilter(auth, filterId);
  const nextCriteria = { ...(current.criteria || {}), ...(criteriaPatch || {}) };
  const nextAction = { ...(current.action || {}), ...(actionPatch || {}) };
  const created = await createFilter(auth, nextCriteria, nextAction);

  let deleted = false;
  try {
    await deleteFilter(auth, filterId);
    deleted = true;
  } catch (err) {
    return {
      replaced: false,
      oldFilterId: filterId,
      newFilterId: created.id,
      deletedOld: false,
      warning: `Created replacement filter but failed to delete old filter: ${err.message}`
    };
  }

  return {
    replaced: true,
    oldFilterId: filterId,
    newFilterId: created.id,
    deletedOld: deleted,
    filter: created
  };
}

export async function sendEmail(auth, to, subject, body, cc = null, bcc = null) {
  const gmail = getGmail(auth);
  
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`
  ];
  
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  
  lines.push('Content-Type: text/plain; charset=utf-8');
  lines.push('');
  lines.push(body);
  
  const message = lines.join('\r\n');
  const encoded = Buffer.from(message).toString('base64url');
  
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded
    }
  });
  
  return {
    id: res.data.id,
    threadId: res.data.threadId,
    labelIds: res.data.labelIds
  };
}

export async function deleteEmail(auth, messageId) {
  const gmail = getGmail(auth);
  
  await gmail.users.messages.delete({
    userId: 'me',
    id: messageId
  });
  
  return { deleted: messageId };
}

export async function trashEmail(auth, messageId) {
  const gmail = getGmail(auth);
  
  const res = await gmail.users.messages.trash({
    userId: 'me',
    id: messageId
  });
  
  return {
    id: res.data.id,
    threadId: res.data.threadId,
    labelIds: res.data.labelIds
  };
}

export async function modifyLabels(auth, messageId, addLabels = [], removeLabels = []) {
  const gmail = getGmail(auth);
  
  const res = await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: addLabels,
      removeLabelIds: removeLabels
    }
  });
  
  return {
    id: res.data.id,
    threadId: res.data.threadId,
    labelIds: res.data.labelIds
  };
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function listMessageIdsByQuery(auth, query, maxResults = 2000) {
  const gmail = getGmail(auth);
  const pageSize = Math.min(maxResults, 500);
  let pageToken = undefined;
  const ids = [];

  while (ids.length < maxResults) {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(pageSize, maxResults - ids.length),
      pageToken
    });

    const messages = listRes.data.messages || [];
    for (const message of messages) {
      ids.push(message.id);
    }

    pageToken = listRes.data.nextPageToken;
    if (!pageToken || messages.length === 0) break;
  }

  return { ids, count: ids.length };
}

export async function bulkModifyLabels(auth, messageIds = [], addLabels = [], removeLabels = []) {
  const gmail = getGmail(auth);
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return { matched: 0, processed: 0, failedBatches: 0 };
  }

  const chunks = chunkArray(messageIds, 1000);
  let processed = 0;
  let failedBatches = 0;

  for (const ids of chunks) {
    try {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids,
          addLabelIds: addLabels,
          removeLabelIds: removeLabels
        }
      });
      processed += ids.length;
    } catch {
      failedBatches += 1;
    }
  }

  return {
    matched: messageIds.length,
    processed,
    failedBatches
  };
}

export async function bulkModifyLabelsByQuery(auth, query, addLabels = [], removeLabels = [], maxResults = 2000) {
  const listed = await listMessageIdsByQuery(auth, query, maxResults);
  const modified = await bulkModifyLabels(auth, listed.ids, addLabels, removeLabels);
  return {
    query,
    ...modified
  };
}
