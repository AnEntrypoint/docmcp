export const GMAIL_TOOLS = [
  {
    name: 'gmail_list',
    description: 'list recent emails from inbox',
    inputSchema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: 'max results default 20', default: 20 },
        query: { type: 'string', description: 'search query same as Gmail search' },
        label_ids: { type: 'array', items: { type: 'string' }, description: 'filter by labels INBOX SENT DRAFT etc' }
      }
    }
  },
  {
    name: 'gmail_search',
    description: 'search emails using Gmail search syntax',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'search query from: to: subject: has:attachment etc' },
        max_results: { type: 'number', description: 'max results default 20', default: 20 }
      },
      required: ['query']
    }
  },
  {
    name: 'gmail_read',
    description: 'read full email content by message id',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message id' },
        format: { type: 'string', enum: ['full', 'metadata', 'minimal'], description: 'format default full', default: 'full' }
      },
      required: ['message_id']
    }
  },
  {
    name: 'gmail_get_attachments',
    description: 'list attachments in an email',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message id' }
      },
      required: ['message_id']
    }
  },
  {
    name: 'gmail_download_attachment',
    description: 'download attachment content as base64',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message id' },
        attachment_id: { type: 'string', description: 'attachment id from gmail_get_attachments' }
      },
      required: ['message_id', 'attachment_id']
    }
  },
  {
    name: 'gmail_get_labels',
    description: 'list all email labels',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'gmail_send',
    description: 'send an email',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'recipient email address' },
        subject: { type: 'string', description: 'email subject' },
        body: { type: 'string', description: 'email body text' },
        cc: { type: 'string', description: 'cc recipient' },
        bcc: { type: 'string', description: 'bcc recipient' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'gmail_delete',
    description: 'permanently delete an email',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message id' }
      },
      required: ['message_id']
    }
  },
  {
    name: 'gmail_trash',
    description: 'move email to trash',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message id' }
      },
      required: ['message_id']
    }
  },
  {
    name: 'gmail_modify_labels',
    description: 'add or remove labels from email',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'Gmail message id' },
        add_labels: { type: 'array', items: { type: 'string' }, description: 'label ids to add' },
        remove_labels: { type: 'array', items: { type: 'string' }, description: 'label ids to remove' }
      },
      required: ['message_id']
    }
  }
];
