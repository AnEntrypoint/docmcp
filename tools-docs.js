export const SECTION_TOOLS = [
  {
    name: 'docs_get_sections',
    description: 'parse doc return sections with name level start end indices',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' }
      },
      required: ['doc_id']
    }
  },
  {
    name: 'docs_section',
    description: 'delete move or replace section by name or index',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        action: { type: 'string', enum: ['delete', 'move', 'replace'], description: 'action to perform' },
        section: {
          oneOf: [
            { type: 'string', description: 'section name' },
            { type: 'number', description: 'section index 0-based' }
          ],
          description: 'section to act on'
        },
        target: {
          oneOf: [
            { type: 'string', description: 'start end or section name to move before' },
            { type: 'number', description: 'target position index 0-based' }
          ],
          description: 'where to move section for move action'
        },
        content: { type: 'string', description: 'new content for replace action' },
        preserve_heading: { type: 'boolean', description: 'keep heading for replace default true', default: true }
      },
      required: ['doc_id', 'action', 'section']
    }
  }
];

export const MEDIA_TOOLS = [
  {
    name: 'docs_image',
    description: 'insert list delete or replace image in doc',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        action: { type: 'string', enum: ['insert', 'list', 'delete', 'replace'], description: 'action to perform' },
        image_url: { type: 'string', description: 'image URL for insert or replace' },
        image_index: { type: 'number', description: 'image index 0-based for delete or replace' },
        position: {
          oneOf: [
            { type: 'string', description: 'end or text to insert after' },
            { type: 'number', description: 'character index' }
          ],
          description: 'where to insert default end'
        },
        width: { type: 'number', description: 'width in points' },
        height: { type: 'number', description: 'height in points' }
      },
      required: ['doc_id', 'action']
    }
  }
];

export const DOCS_TOOLS = [
  {
    name: 'docs_create',
    description: 'create new doc returns id and title',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'doc title' }
      },
      required: ['title']
    }
  },
  {
    name: 'docs_read',
    description: 'read doc text content',
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
    description: 'replace text in doc old_text must be unique unless replace_all true',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        old_text: { type: 'string', description: 'text to find and replace' },
        new_text: { type: 'string', description: 'replacement text' },
        replace_all: { type: 'boolean', description: 'replace all occurrences default false', default: false }
      },
      required: ['doc_id', 'old_text', 'new_text']
    }
  },
  {
    name: 'docs_insert',
    description: 'insert text at position end index or after text',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        text: { type: 'string', description: 'text to insert' },
        position: {
          oneOf: [
            { type: 'string', description: 'end or text to insert after' },
            { type: 'number', description: 'character index' }
          ],
          description: 'where to insert default end'
        }
      },
      required: ['doc_id', 'text']
    }
  },
  {
    name: 'docs_get_info',
    description: 'get doc metadata title dates owners',
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
    description: 'list docs optionally filtered by name',
    inputSchema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: 'max docs default 20', default: 20 },
        query: { type: 'string', description: 'search query to filter by name' }
      }
    }
  },
  {
    name: 'docs_format',
    description: 'format text bold italic colors fonts alignment headings',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        search_text: { type: 'string', description: 'text to format must exist in doc' },
        bold: { type: 'boolean', description: 'apply bold' },
        italic: { type: 'boolean', description: 'apply italic' },
        underline: { type: 'boolean', description: 'apply underline' },
        strikethrough: { type: 'boolean', description: 'apply strikethrough' },
        font_size: { type: 'number', description: 'font size in points' },
        font_family: { type: 'string', description: 'font family name' },
        foreground_color: { type: 'string', description: 'text color hex' },
        background_color: { type: 'string', description: 'highlight color hex' },
        heading: { type: 'string', enum: ['TITLE', 'SUBTITLE', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6', 'NORMAL_TEXT'], description: 'heading style' },
        alignment: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFY'], description: 'paragraph alignment' }
      },
      required: ['doc_id', 'search_text']
    }
  },
  {
    name: 'docs_insert_table',
    description: 'insert table with rows and cols',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        rows: { type: 'number', description: 'number of rows' },
        cols: { type: 'number', description: 'number of columns' },
        position: {
          oneOf: [
            { type: 'string', description: 'end or text to insert after' },
            { type: 'number', description: 'character index' }
          ],
          description: 'where to insert default end'
        }
      },
      required: ['doc_id', 'rows', 'cols']
    }
  },
  {
    name: 'docs_delete',
    description: 'delete text from doc',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        text: { type: 'string', description: 'text to delete' },
        delete_all: { type: 'boolean', description: 'delete all occurrences default false', default: false }
      },
      required: ['doc_id', 'text']
    }
  },
  {
    name: 'docs_get_structure',
    description: 'get doc structure headings hierarchy',
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
    description: 'execute multiple doc operations in one batch',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: { type: 'string', description: 'Google Doc ID' },
        operations: {
          type: 'array',
          description: 'array of operations type insert delete format with params',
          items: { type: 'object' }
        }
      },
      required: ['doc_id', 'operations']
    }
  }
];
