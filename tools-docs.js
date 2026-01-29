export const SECTION_TOOLS = [
  {
    name: 'docs_get_sections',
    description: 'Parse document and return sections identified by headings. Each section includes name, level, start/end indices.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_delete_section',
    description: 'Delete a section by name or index. Removes the heading and all content until the next section.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        section: {
          oneOf: [
            { type: 'string', description: 'Section name (heading text)' },
            { type: 'number', description: 'Section index (0-based)' }
          ],
          description: 'Section to delete'
        }
      },
      required: ['doc_id', 'section']
    }
  },
  {
    name: 'docs_move_section',
    description: 'Move a section to a different position in the document.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        section: {
          oneOf: [
            { type: 'string', description: 'Section name (heading text)' },
            { type: 'number', description: 'Section index (0-based)' }
          ],
          description: 'Section to move'
        },
        target: {
          oneOf: [
            { type: 'string', description: '"start", "end", or section name to move before' },
            { type: 'number', description: 'Target position index (0-based)' }
          ],
          description: 'Where to move the section'
        }
      },
      required: ['doc_id', 'section', 'target']
    }
  },
  {
    name: 'docs_replace_section',
    description: 'Replace entire section content with new text. Optionally preserves the heading.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        section: {
          oneOf: [
            { type: 'string', description: 'Section name (heading text)' },
            { type: 'number', description: 'Section index (0-based)' }
          ],
          description: 'Section to replace'
        },
        content: { type: 'string', description: 'New content for the section' },
        preserve_heading: { type: 'boolean', description: 'Keep the section heading (default: true)', default: true }
      },
      required: ['doc_id', 'section', 'content']
    }
  }
];

export const MEDIA_TOOLS = [
  {
    name: 'docs_insert_image',
    description: 'Insert an image from URL into the document.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        image_url: { type: 'string', description: 'URL of the image to insert' },
        position: {
          oneOf: [
            { type: 'string', description: '"end" or text to insert after' },
            { type: 'number', description: 'Character index' }
          ],
          description: 'Where to insert (default: "end")'
        },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' }
      },
      required: ['doc_id', 'image_url']
    }
  },
  {
    name: 'docs_list_images',
    description: 'List all images in the document with their positions and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_delete_image',
    description: 'Delete an image by its index (from docs_list_images).',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        image_index: { type: 'number', description: 'Image index (0-based, from docs_list_images)' }
      },
      required: ['doc_id', 'image_index']
    }
  },
  {
    name: 'docs_replace_image',
    description: 'Replace an image with a new one from URL.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        image_index: { type: 'number', description: 'Image index (0-based, from docs_list_images)' },
        new_image_url: { type: 'string', description: 'URL of the new image' },
        width: { type: 'number', description: 'Width in points (optional)' },
        height: { type: 'number', description: 'Height in points (optional)' }
      },
      required: ['doc_id', 'image_index', 'new_image_url']
    }
  }
];

export const DOCS_TOOLS = [
  {
    name: 'docs_create',
    description: 'Create a new Google Doc with the specified title. Returns the document ID and title.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the new document' }
      },
      required: ['title']
    }
  },
  {
    name: 'docs_read',
    description: 'Read the full text content of a Google Doc. Returns the complete document text.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_edit',
    description: 'Performs exact string replacement in a Google Doc. The old_text must be unique in the document unless replace_all is true.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        old_text: { type: 'string', description: 'The exact text to find and replace' },
        new_text: { type: 'string', description: 'The text to replace it with' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)', default: false }
      },
      required: ['doc_id', 'old_text', 'new_text']
    }
  },
  {
    name: 'docs_insert',
    description: 'Insert text into a Google Doc at a specified position. Position can be "end" to append, a character index, or text to insert after.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        text: { type: 'string', description: 'Text to insert' },
        position: {
          oneOf: [
            { type: 'string', description: '"end" or text to insert after' },
            { type: 'number', description: 'Character index' }
          ],
          description: 'Where to insert (default: "end")'
        }
      },
      required: ['doc_id', 'text']
    }
  },
  {
    name: 'docs_get_info',
    description: 'Get document metadata including title, created/modified times, and owners.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_list',
    description: 'List recent Google Docs, optionally filtered by name. Returns document IDs and titles.',
    inputSchema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: 'Maximum documents to return (default: 20)', default: 20 },
        query: { type: 'string', description: 'Optional search query to filter by name' }
      }
    }
  },
  {
    name: 'docs_format',
    description: 'Apply formatting to text in a Google Doc. Finds text and applies styles like bold, italic, colors, fonts, and paragraph styles.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        search_text: { type: 'string', description: 'Text to format (must exist in document)' },
        bold: { type: 'boolean', description: 'Apply bold' },
        italic: { type: 'boolean', description: 'Apply italic' },
        underline: { type: 'boolean', description: 'Apply underline' },
        strikethrough: { type: 'boolean', description: 'Apply strikethrough' },
        font_size: { type: 'number', description: 'Font size in points' },
        font_family: { type: 'string', description: 'Font family name (e.g., "Arial", "Times New Roman")' },
        foreground_color: { type: 'string', description: 'Text color as hex (e.g., "#FF0000")' },
        background_color: { type: 'string', description: 'Background/highlight color as hex' },
        heading: { type: 'string', enum: ['TITLE', 'SUBTITLE', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6', 'NORMAL_TEXT'], description: 'Paragraph heading style' },
        alignment: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFY'], description: 'Paragraph alignment' }
      },
      required: ['doc_id', 'search_text']
    }
  },
  {
    name: 'docs_insert_table',
    description: 'Insert a table into a Google Doc.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        position: {
          oneOf: [
            { type: 'string', description: '"end" or text to insert after' },
            { type: 'number', description: 'Character index' }
          ],
          description: 'Where to insert (default: "end")'
        }
      },
      required: ['doc_id', 'rows', 'cols']
    }
  },
  {
    name: 'docs_delete',
    description: 'Delete text from a Google Doc by finding and removing it.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        text: { type: 'string', description: 'Text to delete' },
        delete_all: { type: 'boolean', description: 'Delete all occurrences (default: false)', default: false }
      },
      required: ['doc_id', 'text']
    }
  },
  {
    name: 'docs_get_structure',
    description: 'Get the document structure showing headings and their hierarchy.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_batch',
    description: 'Execute multiple document operations in a single batch for efficiency.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        operations: {
          type: 'array',
          description: 'Array of operations: {type: "insert"|"delete"|"format", ...params}',
          items: { type: 'object' }
        }
      },
      required: ['doc_id', 'operations']
    }
  }
];
