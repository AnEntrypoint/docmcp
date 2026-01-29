export const SCRIPTS_TOOLS = [
  {
    name: 'scripts_create',
    description: 'Create a new Google Apps Script project attached to a spreadsheet. The script is tracked in a hidden _scripts tab.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID to attach the script to' },
        script_name: { type: 'string', description: 'Name for the new script project' }
      },
      required: ['sheet_id', 'script_name']
    }
  },
  {
    name: 'scripts_list',
    description: 'List all scripts attached to a spreadsheet (from the _scripts tab).',
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
    description: 'Read the full content of an attached script including all files.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'Script name or ID' },
            { type: 'number', description: 'Script index (0-based)' }
          ],
          description: 'Script to read'
        }
      },
      required: ['sheet_id', 'script']
    }
  },
  {
    name: 'scripts_edit',
    description: 'Edit script content using old_text/new_text pattern (like Claude Edit tool).',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'Script name or ID' },
            { type: 'number', description: 'Script index (0-based)' }
          ],
          description: 'Script to edit'
        },
        file_name: { type: 'string', description: 'Name of the file within the script (e.g., "Code")' },
        old_text: { type: 'string', description: 'The exact text to find and replace' },
        new_text: { type: 'string', description: 'The text to replace it with' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)', default: false }
      },
      required: ['sheet_id', 'script', 'file_name', 'old_text', 'new_text']
    }
  },
  {
    name: 'scripts_write',
    description: 'Overwrite entire script file content or create a new file.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'Script name or ID' },
            { type: 'number', description: 'Script index (0-based)' }
          ],
          description: 'Script to write to'
        },
        file_name: { type: 'string', description: 'Name of the file (e.g., "Code", "Utilities")' },
        content: { type: 'string', description: 'Full content for the file' },
        file_type: { type: 'string', enum: ['SERVER_JS', 'HTML'], description: 'File type (default: SERVER_JS)', default: 'SERVER_JS' }
      },
      required: ['sheet_id', 'script', 'file_name', 'content']
    }
  },
  {
    name: 'scripts_delete',
    description: 'Delete an attached script (removes from _scripts tab). Only works for scripts tracked in the sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'Script name or ID' },
            { type: 'number', description: 'Script index (0-based)' }
          ],
          description: 'Script to delete'
        }
      },
      required: ['sheet_id', 'script']
    }
  },
  {
    name: 'scripts_run',
    description: 'Execute a function in an attached script. The script must be deployed as an API executable.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        script: {
          oneOf: [
            { type: 'string', description: 'Script name or ID' },
            { type: 'number', description: 'Script index (0-based)' }
          ],
          description: 'Script containing the function'
        },
        function_name: { type: 'string', description: 'Name of the function to execute' },
        parameters: { type: 'array', description: 'Array of parameters to pass to the function', items: {} }
      },
      required: ['sheet_id', 'script', 'function_name']
    }
  }
];

export const SHEETS_TOOLS = [
  {
    name: 'sheets_create',
    description: 'Create a new Google Sheet with the specified title. Returns the spreadsheet ID and title.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the new spreadsheet' }
      },
      required: ['title']
    }
  },
  {
    name: 'sheets_read',
    description: 'Read values from a Google Sheet range. Returns a 2D array of cell values.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation (default: "Sheet1")' }
      },
      required: ['sheet_id']
    }
  },
  {
    name: 'sheets_edit',
    description: 'Update values in a Google Sheet range. Overwrites the specified range with new values.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' },
        values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values' }
      },
      required: ['sheet_id', 'range', 'values']
    }
  },
  {
    name: 'sheets_insert',
    description: 'Append rows to a Google Sheet after existing data.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation (default: "Sheet1")' },
        values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values to append' }
      },
      required: ['sheet_id', 'values']
    }
  },
  {
    name: 'sheets_get_cell',
    description: 'Get a single cell value from a Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'Cell reference (e.g. "A1", "Sheet1!B2")' }
      },
      required: ['sheet_id', 'cell']
    }
  },
  {
    name: 'sheets_set_cell',
    description: 'Set a single cell value in a Google Sheet. Completely replaces the cell content.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'Cell reference (e.g. "A1", "Sheet1!B2")' },
        value: { description: 'Value to set' }
      },
      required: ['sheet_id', 'cell', 'value']
    }
  },
  {
    name: 'sheets_edit_cell',
    description: 'Performs exact string replacement within a cell. The old_text must be unique within the cell unless replace_all is true.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'Cell reference' },
        old_text: { type: 'string', description: 'The exact text to find and replace' },
        new_text: { type: 'string', description: 'The text to replace it with' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)', default: false }
      },
      required: ['sheet_id', 'cell', 'old_text', 'new_text']
    }
  },
  {
    name: 'sheets_find_replace',
    description: 'Find and replace text across ALL matching cells in a Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        sheet_name: { type: 'string', description: 'Specific sheet tab (optional, searches all if omitted)' }
      },
      required: ['sheet_id', 'find', 'replace']
    }
  },
  {
    name: 'sheets_get_info',
    description: 'Get spreadsheet metadata including title, sheet tabs, dimensions, and owners.',
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
    description: 'List recent Google Sheets, optionally filtered by name.',
    inputSchema: {
      type: 'object',
      properties: {
        max_results: { type: 'number', description: 'Maximum spreadsheets to return (default: 20)', default: 20 },
        query: { type: 'string', description: 'Optional search query to filter by name' }
      }
    }
  },
  {
    name: 'sheets_add_sheet',
    description: 'Add a new sheet tab to a spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        title: { type: 'string', description: 'Title for the new sheet tab' }
      },
      required: ['sheet_id', 'title']
    }
  },
  {
    name: 'sheets_delete_sheet',
    description: 'Delete a sheet tab from a spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'Name of the sheet tab to delete' }
      },
      required: ['sheet_id', 'sheet_name']
    }
  },
  {
    name: 'sheets_rename_sheet',
    description: 'Rename a sheet tab in a spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        old_name: { type: 'string', description: 'Current name of the sheet tab' },
        new_name: { type: 'string', description: 'New name for the sheet tab' }
      },
      required: ['sheet_id', 'old_name', 'new_name']
    }
  },
  {
    name: 'sheets_clear',
    description: 'Clear values from a range. Optionally clear formatting too.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' },
        clear_formats: { type: 'boolean', description: 'Also clear formatting (default: false)', default: false }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_format',
    description: 'Apply formatting to a range of cells including colors, fonts, alignment, borders, and number formats.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' },
        background_color: { type: 'string', description: 'Background color as hex (e.g., "#FFFF00")' },
        text_color: { type: 'string', description: 'Text color as hex' },
        bold: { type: 'boolean', description: 'Apply bold' },
        italic: { type: 'boolean', description: 'Apply italic' },
        font_size: { type: 'number', description: 'Font size in points' },
        font_family: { type: 'string', description: 'Font family name' },
        horizontal_alignment: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT'], description: 'Horizontal alignment' },
        vertical_alignment: { type: 'string', enum: ['TOP', 'MIDDLE', 'BOTTOM'], description: 'Vertical alignment' },
        wrap_strategy: { type: 'string', enum: ['OVERFLOW', 'CLIP', 'WRAP'], description: 'Text wrap strategy' },
        number_format: {
          type: 'object',
          description: 'Number format with type and pattern',
          properties: {
            type: { type: 'string', enum: ['NUMBER', 'CURRENCY', 'PERCENT', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC', 'TEXT'] },
            pattern: { type: 'string', description: 'Format pattern (e.g., "#,##0.00", "$#,##0.00", "yyyy-mm-dd")' }
          }
        },
        borders: {
          type: 'object',
          description: 'Border settings',
          properties: {
            style: { type: 'string', enum: ['SOLID', 'SOLID_MEDIUM', 'SOLID_THICK', 'DASHED', 'DOTTED', 'DOUBLE'] },
            color: { type: 'string', description: 'Border color as hex' },
            inner: { type: 'boolean', description: 'Also apply inner borders' }
          }
        }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_merge',
    description: 'Merge cells in a range.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_unmerge',
    description: 'Unmerge previously merged cells.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' }
      },
      required: ['sheet_id', 'range']
    }
  },
  {
    name: 'sheets_freeze',
    description: 'Freeze rows and/or columns in a sheet tab.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'Name of the sheet tab' },
        rows: { type: 'number', description: 'Number of rows to freeze (0 to unfreeze)', default: 0 },
        columns: { type: 'number', description: 'Number of columns to freeze (0 to unfreeze)', default: 0 }
      },
      required: ['sheet_id', 'sheet_name']
    }
  },
  {
    name: 'sheets_sort',
    description: 'Sort a range by a specified column.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        range: { type: 'string', description: 'A1 range notation' },
        sort_column: {
          oneOf: [
            { type: 'string', description: 'Column letter (e.g., "A", "B")' },
            { type: 'number', description: 'Column index (0-based)' }
          ],
          description: 'Column to sort by'
        },
        ascending: { type: 'boolean', description: 'Sort ascending (default: true)', default: true }
      },
      required: ['sheet_id', 'range', 'sort_column']
    }
  },
  {
    name: 'sheets_insert_rows_cols',
    description: 'Insert rows or columns at a specified position.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'Name of the sheet tab' },
        dimension: { type: 'string', enum: ['ROW', 'COLUMN'], description: 'Insert rows or columns' },
        start_index: { type: 'number', description: '0-based index where to insert' },
        count: { type: 'number', description: 'Number of rows/columns to insert' }
      },
      required: ['sheet_id', 'sheet_name', 'dimension', 'start_index', 'count']
    }
  },
  {
    name: 'sheets_delete_rows_cols',
    description: 'Delete rows or columns at a specified position.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'Name of the sheet tab' },
        dimension: { type: 'string', enum: ['ROW', 'COLUMN'], description: 'Delete rows or columns' },
        start_index: { type: 'number', description: '0-based index where to start deleting' },
        count: { type: 'number', description: 'Number of rows/columns to delete' }
      },
      required: ['sheet_id', 'sheet_name', 'dimension', 'start_index', 'count']
    }
  },
  {
    name: 'sheets_set_column_width',
    description: 'Set the width of columns.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'Name of the sheet tab' },
        start_column: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'Start column (letter or 0-based index)' },
        end_column: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'End column (letter or 0-based index)' },
        width: { type: 'number', description: 'Width in pixels' }
      },
      required: ['sheet_id', 'sheet_name', 'start_column', 'end_column', 'width']
    }
  },
  {
    name: 'sheets_set_row_height',
    description: 'Set the height of rows.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        sheet_name: { type: 'string', description: 'Name of the sheet tab' },
        start_row: { type: 'number', description: 'Start row (1-based)' },
        end_row: { type: 'number', description: 'End row (1-based)' },
        height: { type: 'number', description: 'Height in pixels' }
      },
      required: ['sheet_id', 'sheet_name', 'start_row', 'end_row', 'height']
    }
  },
  {
    name: 'sheets_get_formula',
    description: 'Get the formula and value of a cell.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1", "Sheet1!B2")' }
      },
      required: ['sheet_id', 'cell']
    }
  },
  {
    name: 'sheets_batch',
    description: 'Execute multiple sheet operations in a single batch for efficiency.',
    inputSchema: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string', description: 'Google Sheet ID' },
        operations: {
          type: 'array',
          description: 'Array of operations: {type: "setValue"|"format", range, values?, backgroundColor?, bold?}',
          items: { type: 'object' }
        }
      },
      required: ['sheet_id', 'operations']
    }
  }
];
