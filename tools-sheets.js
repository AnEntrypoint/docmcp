export const SCRIPTS_TOOLS = [
  {
    name: 'scripts_create',
    description: 'create apps script project attached to spreadsheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script_name: { type: 'string', description: 'script project name' }
      },
      required: ['sheet_id', 'script_name']
    }
  },
  {
    name: 'scripts_list',
    description: 'list scripts attached to spreadsheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' }
      },
      required: ['sheet_id']
    }
  },
  {
    name: 'scripts_read',
    description: 'read script content including all files',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'script name or ID' },
            { type: 'number', description: 'script index 0-based' }
          ],
          description: 'script to read'
        }
      },
      required: ['sheet_id', 'script']
    }
  },
  {
    name: 'scripts_write',
    description: 'write or edit script file content mode edit for old_text new_text replacement mode write for full overwrite',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'script name or ID' },
            { type: 'number', description: 'script index 0-based' }
          ],
          description: 'script to modify'
        },
        file_name: { type: 'string', description: 'file name in script' },
        mode: { type: 'string', enum: ['write', 'edit'], description: 'write for full overwrite edit for replacement default write', default: 'write' },
        content: { type: 'string', description: 'full content for write mode' },
        old_text: { type: 'string', description: 'text to find for edit mode' },
        new_text: { type: 'string', description: 'replacement text for edit mode' },
        replace_all: { type: 'boolean', description: 'replace all occurrences for edit mode default false', default: false },
        file_type: { type: 'string', enum: ['SERVER_JS', 'HTML'], description: 'file type for new files default SERVER_JS', default: 'SERVER_JS' }
      },
      required: ['sheet_id', 'script', 'file_name']
    }
  },
  {
    name: 'scripts_delete',
    description: 'delete script from spreadsheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'script name or ID' },
            { type: 'number', description: 'script index 0-based' }
          ],
          description: 'script to delete'
        }
      },
      required: ['sheet_id', 'script']
    }
  },
  {
    name: 'scripts_run',
    description: 'execute function in script must be deployed as API executable',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'script name or ID' },
            { type: 'number', description: 'script index 0-based' }
          ],
          description: 'script containing function'
        },
        function_name: { type: 'string', description: 'function to execute' },
        parameters: { type: 'array', description: 'parameters to pass', items: {} }
      },
      required: ['sheet_id', 'script', 'function_name']
    }
  }
];

export const SHEETS_TOOLS = [
  {
    name: 'sheets_create',
    description: 'create new spreadsheet returns id and title',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'spreadsheet title' }
      },
      required: ['title']
    }
  },
  {
    name: 'sheets_read',
    description: 'read values from range returns 2D array',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range default Sheet1' }
      },
      required: ['sheet_id']
    }
  },
  {
    name: 'sheets_edit',
    description: 'update values in range overwrites with new values',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range' },
        values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values' }
      },
      required: ['sheet_id', 'range', 'values']
    }
  },
  {
    name: 'sheets_insert',
    description: 'append rows after existing data',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range default Sheet1' },
        values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values to append' }
      },
      required: ['sheet_id', 'values']
    }
  },
  {
    name: 'sheets_get_cell',
    description: 'get single cell value',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'cell reference A1 or Sheet1!B2' }
      },
      required: ['sheet_id', 'cell']
    }
  },
  {
    name: 'sheets_set_cell',
    description: 'set single cell value replaces content',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'cell reference A1 or Sheet1!B2' },
        value: { description: 'value to set' }
      },
      required: ['sheet_id', 'cell', 'value']
    }
  },
  {
    name: 'sheets_edit_cell',
    description: 'replace text in cell old_text must be unique unless replace_all true',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'cell reference' },
        old_text: { type: 'string', description: 'text to find and replace' },
        new_text: { type: 'string', description: 'replacement text' },
        replace_all: { type: 'boolean', description: 'replace all occurrences default false', default: false }
      },
      required: ['sheet_id', 'cell', 'old_text', 'new_text']
    }
  },
  {
    name: 'sheets_find_replace',
    description: 'find and replace text across all cells in sheet',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        find: { type: 'string', description: 'text to find' },
        replace: { type: 'string', description: 'replacement text' },
        sheet_name: { type: 'string', description: 'tab name optional searches all if omitted' }
      },
      required: ['sheet_id', 'find', 'replace']
    }
  },
  {
    name: 'sheets_get_info',
    description: 'get spreadsheet metadata title tabs dimensions owners',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' }
      },
      required: ['sheet_id']
    }
  },
  {
    name: 'sheets_list',
    description: 'list spreadsheets optionally filtered by name',
    inputSchema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: 'max results default 20', default: 20 },
        query: { type: 'string', description: 'search query to filter by name' }
      }
    }
  },
  {
    name: 'sheets_tab',
    description: 'add delete or rename sheet tab',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        action: { type: 'string', enum: ['add', 'delete', 'rename'], description: 'action to perform' },
        title: { type: 'string', description: 'tab title for add or new name for rename' },
        sheet_name: { type: 'string', description: 'tab name for delete or rename' }
      },
      required: ['sheet_id', 'action']
    }
  },
  {
    name: 'sheets_clear',
    description: 'clear values from range optionally clear formatting',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range' },
        clear_formats: { type: 'boolean', description: 'also clear formatting default false', default: false }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_format',
    description: 'format range colors fonts alignment borders number formats',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range' },
        background_color: { type: 'string', description: 'background color hex' },
        text_color: { type: 'string', description: 'text color hex' },
        bold: { type: 'boolean', description: 'apply bold' },
        italic: { type: 'boolean', description: 'apply italic' },
        font_size: { type: 'number', description: 'font size in points' },
        font_family: { type: 'string', description: 'font family name' },
        horizontal_alignment: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT'], description: 'horizontal alignment' },
        vertical_alignment: { type: 'string', enum: ['TOP', 'MIDDLE', 'BOTTOM'], description: 'vertical alignment' },
        wrap_strategy: { type: 'string', enum: ['OVERFLOW', 'CLIP', 'WRAP'], description: 'text wrap strategy' },
        number_format: {
          type: 'object',
          description: 'number format type and pattern',
          properties: {
            type: { type: 'string', enum: ['NUMBER', 'CURRENCY', 'PERCENT', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC', 'TEXT'] },
            pattern: { type: 'string', description: 'format pattern' }
          }
        },
        borders: {
          type: 'object',
          description: 'border settings',
          properties: {
            style: { type: 'string', enum: ['SOLID', 'SOLID_MEDIUM', 'SOLID_THICK', 'DASHED', 'DOTTED', 'DOUBLE'] },
            color: { type: 'string', description: 'border color hex' },
            inner: { type: 'boolean', description: 'also apply inner borders' }
          }
        }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_merge',
    description: 'merge or unmerge cells in range',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range' },
        action: { type: 'string', enum: ['merge', 'unmerge'], description: 'merge or unmerge default merge', default: 'merge' }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_freeze',
    description: 'freeze rows and columns in tab 0 to unfreeze',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'tab name' },
        rows: { type: 'number', description: 'rows to freeze 0 to unfreeze', default: 0 },
        columns: { type: 'number', description: 'columns to freeze 0 to unfreeze', default: 0 }
      },
      required: ['sheet_id', 'sheet_name']
    }
  },
  {
    name: 'sheets_sort',
    description: 'sort range by column',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range' },
        sort_column: {
          oneOf: [
            { type: 'string', description: 'column letter A B' },
            { type: 'number', description: 'column index 0-based' }
          ],
          description: 'column to sort by'
        },
        ascending: { type: 'boolean', description: 'sort ascending default true', default: true }
      },
      required: ['sheet_id', 'range', 'sort_column']
    }
  },
  {
    name: 'sheets_rows_cols',
    description: 'insert or delete rows or columns',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'tab name' },
        action: { type: 'string', enum: ['insert', 'delete'], description: 'insert or delete' },
        dimension: { type: 'string', enum: ['ROW', 'COLUMN'], description: 'rows or columns' },
        start_index: { type: 'number', description: '0-based start index' },
        count: { type: 'number', description: 'number to insert or delete' }
      },
      required: ['sheet_id', 'sheet_name', 'action', 'dimension', 'start_index', 'count']
    }
  },
  {
    name: 'sheets_dimension_size',
    description: 'set column width or row height in pixels',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'tab name' },
        dimension: { type: 'string', enum: ['COLUMN', 'ROW'], description: 'column or row' },
        start: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'start column letter or 0-based index for columns or 1-based row number for rows' },
        end: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'end column letter or 0-based index for columns or 1-based row number for rows' },
        size: { type: 'number', description: 'size in pixels' }
      },
      required: ['sheet_id', 'sheet_name', 'dimension', 'start', 'end', 'size']
    }
  },
  {
    name: 'sheets_get_formula',
    description: 'get cell formula and value',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'cell reference A1 or Sheet1!B2' }
      },
      required: ['sheet_id', 'cell']
    }
  },
  {
    name: 'sheets_batch',
    description: 'execute multiple operations in one batch',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        operations: {
          type: 'array',
          description: 'array of operations type setValue format with range values backgroundColor bold',
          items: { type: 'object' }
        }
      },
      required: ['sheet_id', 'operations']
    }
  }
];
