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
    description: 'list all email labels with visibility, counts, and color metadata',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'gmail_create_label',
    description: 'create a Gmail label',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'label display name' },
        label_list_visibility: { type: 'string', enum: ['labelHide', 'labelShow', 'labelShowIfUnread'], description: 'left-nav visibility' },
        message_list_visibility: { type: 'string', enum: ['hide', 'show'], description: 'message list visibility' },
        color: {
          type: 'object',
          properties: {
            text_color: { type: 'string', description: 'hex color like #000000' },
            background_color: { type: 'string', description: 'hex color like #ffffff' }
          }
        }
      },
      required: ['name']
    }
  },
  {
    name: 'gmail_update_label',
    description: 'update an existing Gmail label',
    inputSchema: {
      type: 'object',
      properties: {
        label_id: { type: 'string', description: 'label id to update' },
        name: { type: 'string', description: 'new label name' },
        label_list_visibility: { type: 'string', enum: ['labelHide', 'labelShow', 'labelShowIfUnread'], description: 'left-nav visibility' },
        message_list_visibility: { type: 'string', enum: ['hide', 'show'], description: 'message list visibility' },
        color: {
          type: 'object',
          properties: {
            text_color: { type: 'string', description: 'hex color like #000000' },
            background_color: { type: 'string', description: 'hex color like #ffffff' }
          }
        }
      },
      required: ['label_id']
    }
  },
  {
    name: 'gmail_delete_label',
    description: 'delete a Gmail label by id',
    inputSchema: {
      type: 'object',
      properties: {
        label_id: { type: 'string', description: 'label id to delete' }
      },
      required: ['label_id']
    }
  },
  {
    name: 'gmail_list_filters',
    description: 'list all Gmail filters',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'gmail_get_filter',
    description: 'get one Gmail filter by id',
    inputSchema: {
      type: 'object',
      properties: {
        filter_id: { type: 'string', description: 'filter id' }
      },
      required: ['filter_id']
    }
  },
  {
    name: 'gmail_create_filter',
    description: 'create a Gmail filter with criteria and action',
    inputSchema: {
      type: 'object',
      properties: {
        criteria: {
          type: 'object',
          description: 'Gmail filter criteria (from, to, subject, query, negated_query, has_attachment, size, size_comparison)',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            subject: { type: 'string' },
            query: { type: 'string' },
            negated_query: { type: 'string' },
            has_attachment: { type: 'boolean' },
            size: { type: 'number' },
            size_comparison: { type: 'string', enum: ['larger', 'smaller'] }
          }
        },
        action: {
          type: 'object',
          description: 'Gmail filter action (add/remove labels, forward)',
          properties: {
            add_label_ids: { type: 'array', items: { type: 'string' } },
            remove_label_ids: { type: 'array', items: { type: 'string' } },
            forward: { type: 'string', description: 'forwarding address (must already be configured in Gmail)' }
          }
        }
      },
      required: ['criteria', 'action']
    }
  },
  {
    name: 'gmail_delete_filter',
    description: 'delete a Gmail filter by id',
    inputSchema: {
      type: 'object',
      properties: {
        filter_id: { type: 'string', description: 'filter id to delete' }
      },
      required: ['filter_id']
    }
  },
  {
    name: 'gmail_replace_filter',
    description: 'replace an existing Gmail filter (Gmail has no native update API)',
    inputSchema: {
      type: 'object',
      properties: {
        filter_id: { type: 'string', description: 'existing filter id to replace' },
        criteria: {
          type: 'object',
          description: 'criteria fields to override (from, to, subject, query, negated_query, has_attachment, size, size_comparison)',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            subject: { type: 'string' },
            query: { type: 'string' },
            negated_query: { type: 'string' },
            has_attachment: { type: 'boolean' },
            size: { type: 'number' },
            size_comparison: { type: 'string', enum: ['larger', 'smaller'] }
          }
        },
        action: {
          type: 'object',
          description: 'action fields to override (add/remove labels, forward)',
          properties: {
            add_label_ids: { type: 'array', items: { type: 'string' } },
            remove_label_ids: { type: 'array', items: { type: 'string' } },
            forward: { type: 'string' }
          }
        }
      },
      required: ['filter_id']
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
  },
  {
    name: 'gmail_bulk_modify_labels',
    description: 'bulk add or remove labels from emails matching a Gmail query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail query to match messages for bulk processing' },
        add_labels: { type: 'array', items: { type: 'string' }, description: 'label ids to add to each matched message' },
        remove_labels: { type: 'array', items: { type: 'string' }, description: 'label ids to remove from each matched message' },
        max_results: { type: 'number', description: 'maximum matched messages to process (default 2000)', default: 2000 }
      },
      required: ['query']
    }
  }
];
