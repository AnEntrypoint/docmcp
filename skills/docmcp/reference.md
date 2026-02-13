# API Reference

## Google Docs Operations

### docs.create
Create a new Google Doc.
- `title` (string, required): Document title

Returns: `{ docId, title }`

### docs.read
Read document text content.
- `doc_id` (string, required): Google Doc ID

Returns: `{ text: "full document text" }`

### docs.edit
Replace text in a document. old_text must be unique unless replace_all is true.
- `doc_id` (string, required): Google Doc ID
- `old_text` (string, required): Text to find
- `new_text` (string, required): Replacement text
- `replace_all` (boolean, default false): Replace all occurrences

Returns: `{ replacements: number }`

### docs.insert
Insert text at a position.
- `doc_id` (string, required): Google Doc ID
- `text` (string, required): Text to insert
- `position` (string|number, default "end"): "end", text-to-insert-after, or character index

Returns: `{ inserted: true }`

### docs.delete
Delete text from document.
- `doc_id` (string, required): Google Doc ID
- `text` (string, required): Text to delete
- `delete_all` (boolean, default false): Delete all occurrences

Returns: `{ replacements: number }`

### docs.format
Format text in a document.
- `doc_id` (string, required): Google Doc ID
- `search_text` (string, required): Text to format (must exist in doc)
- `bold` (boolean): Apply bold
- `italic` (boolean): Apply italic
- `underline` (boolean): Apply underline
- `strikethrough` (boolean): Apply strikethrough
- `font_size` (number): Font size in points
- `font_family` (string): Font family name
- `foreground_color` (string): Text color as hex (e.g. "#ff0000")
- `background_color` (string): Highlight color as hex
- `heading` (string): TITLE, SUBTITLE, HEADING_1-6, NORMAL_TEXT
- `alignment` (string): LEFT, CENTER, RIGHT, JUSTIFY

Returns: `{ formattedOccurrences: number }`

### docs.insert_table
Insert a table.
- `doc_id` (string, required): Google Doc ID
- `rows` (number, required): Number of rows
- `cols` (number, required): Number of columns
- `position` (string|number, default "end"): Where to insert

Returns: `{ rows, cols }`

### docs.get_info
Get document metadata.
- `doc_id` (string, required): Google Doc ID

Returns: `{ id, title, createdTime, modifiedTime, owners }`

### docs.get_structure
Get document headings hierarchy.
- `doc_id` (string, required): Google Doc ID

Returns: Array of `{ level, text, index, isTitle? }`

### docs.list
List Google Docs.
- `max_results` (number, default 20): Max docs to return
- `query` (string): Filter by name

Returns: Array of `{ id, name, createdTime, modifiedTime }`

### docs.get_sections
Parse document into sections.
- `doc_id` (string, required): Google Doc ID

Returns: Array of `{ name, level, startIndex, endIndex, index }`

### docs.section
Manage document sections.
- `doc_id` (string, required): Google Doc ID
- `action` (string, required): "delete", "move", or "replace"
- `section` (string|number, required): Section name or 0-based index
- `target` (string|number): For move: "start", "end", section name, or index
- `content` (string): For replace: new content
- `preserve_heading` (boolean, default true): Keep heading when replacing

### docs.image
Manage images in a document.
- `doc_id` (string, required): Google Doc ID
- `action` (string, required): "insert", "list", "delete", "replace"
- `image_url` (string): URL for insert/replace
- `image_index` (number): 0-based index for delete/replace
- `position` (string|number, default "end"): For insert
- `width` (number): Width in points
- `height` (number): Height in points

### docs.batch
Execute multiple operations in one batch.
- `doc_id` (string, required): Google Doc ID
- `operations` (array, required): Operations with type "insert" (index, text), "delete" (startIndex, endIndex), or "format" (startIndex, endIndex, bold, italic, underline)

Returns: `{ operationsApplied: number }`

---

## Google Sheets Operations

### sheets.create
Create a new spreadsheet.
- `title` (string, required): Spreadsheet title

Returns: `{ sheetId, title }`

### sheets.read
Read values from a range.
- `sheet_id` (string, required): Spreadsheet ID
- `range` (string, default "Sheet1"): A1 notation range

Returns: 2D array of values

### sheets.edit
Update values in a range.
- `sheet_id` (string, required): Spreadsheet ID
- `range` (string, required): A1 notation range
- `values` (2D array, required): Values to write

Returns: `{ updated: range }`

### sheets.insert
Append rows after existing data.
- `sheet_id` (string, required): Spreadsheet ID
- `values` (2D array, required): Rows to append
- `range` (string, default "Sheet1"): Target range

Returns: `{ appended: true }`

### sheets.get_cell
Get a single cell value.
- `sheet_id` (string, required): Spreadsheet ID
- `cell` (string, required): Cell reference (A1 or Sheet1!B2)

Returns: `{ value }`

### sheets.set_cell
Set a single cell value.
- `sheet_id` (string, required): Spreadsheet ID
- `cell` (string, required): Cell reference
- `value` (any, required): Value to set

Returns: `{ set: cell }`

### sheets.edit_cell
Replace text within a cell.
- `sheet_id` (string, required): Spreadsheet ID
- `cell` (string, required): Cell reference
- `old_text` (string, required): Text to find
- `new_text` (string, required): Replacement
- `replace_all` (boolean, default false): Replace all occurrences

Returns: `{ replacements: number }`

### sheets.find_replace
Find and replace across all cells.
- `sheet_id` (string, required): Spreadsheet ID
- `find` (string, required): Text to find
- `replace` (string, required): Replacement
- `sheet_name` (string): Limit to specific tab

Returns: `{ replacements: number }`

### sheets.get_info
Get spreadsheet metadata.
- `sheet_id` (string, required): Spreadsheet ID

Returns: `{ id, title, sheets: [...tabs], createdTime, modifiedTime, owners }`

### sheets.list
List spreadsheets.
- `max_results` (number, default 20)
- `query` (string): Filter by name

Returns: Array of `{ id, name, createdTime, modifiedTime }`

### sheets.tab
Manage sheet tabs.
- `sheet_id` (string, required): Spreadsheet ID
- `action` (string, required): "add", "delete", "rename"
- `title` (string): Tab title (for add/rename)
- `sheet_name` (string): Existing tab name (for delete/rename)

### sheets.clear
Clear values from a range.
- `sheet_id` (string, required): Spreadsheet ID
- `range` (string, required): A1 range
- `clear_formats` (boolean, default false): Also clear formatting

### sheets.format
Format a range.
- `sheet_id` (string, required): Spreadsheet ID
- `range` (string, required): A1 range
- `background_color` (string): Hex color
- `text_color` (string): Hex color
- `bold` (boolean)
- `italic` (boolean)
- `font_size` (number): Points
- `font_family` (string)
- `horizontal_alignment` (string): LEFT, CENTER, RIGHT
- `vertical_alignment` (string): TOP, MIDDLE, BOTTOM
- `wrap_strategy` (string): OVERFLOW, CLIP, WRAP
- `number_format` (object): `{ type, pattern }` where type is NUMBER, CURRENCY, PERCENT, DATE, TIME, DATE_TIME, SCIENTIFIC, TEXT
- `borders` (object): `{ style, color, inner }` where style is SOLID, SOLID_MEDIUM, SOLID_THICK, DASHED, DOTTED, DOUBLE

### sheets.merge
Merge or unmerge cells.
- `sheet_id` (string, required): Spreadsheet ID
- `range` (string, required): A1 range
- `action` (string, default "merge"): "merge" or "unmerge"

### sheets.freeze
Freeze rows and columns.
- `sheet_id` (string, required): Spreadsheet ID
- `sheet_name` (string, required): Tab name
- `rows` (number, default 0): Rows to freeze (0 to unfreeze)
- `columns` (number, default 0): Columns to freeze

### sheets.sort
Sort a range by column.
- `sheet_id` (string, required): Spreadsheet ID
- `range` (string, required): A1 range
- `sort_column` (string|number, required): Column letter or 0-based index
- `ascending` (boolean, default true)

### sheets.rows_cols
Insert or delete rows/columns.
- `sheet_id` (string, required): Spreadsheet ID
- `sheet_name` (string, required): Tab name
- `action` (string, required): "insert" or "delete"
- `dimension` (string, required): "ROW" or "COLUMN"
- `start_index` (number, required): 0-based start
- `count` (number, required): How many

### sheets.dimension_size
Set column width or row height.
- `sheet_id` (string, required): Spreadsheet ID
- `sheet_name` (string, required): Tab name
- `dimension` (string, required): "COLUMN" or "ROW"
- `start` (string|number, required): Start column letter or row number
- `end` (string|number, required): End column letter or row number
- `size` (number, required): Size in pixels

### sheets.get_formula
Get cell formula and computed value.
- `sheet_id` (string, required): Spreadsheet ID
- `cell` (string, required): Cell reference

Returns: `{ value, formula, formattedValue }`

### sheets.batch
Execute multiple operations.
- `sheet_id` (string, required): Spreadsheet ID
- `operations` (array, required): Operations with type "setValue" (range, values) or "format" (range, backgroundColor, bold)

---

## Google Drive

### drive.search
Search Google Drive for docs and sheets.
- `query` (string, required): Search query
- `type` (string, default "all"): "all", "docs", "sheets"
- `max_results` (number, default 20)

Returns: Array of `{ id, name, type, createdTime, modifiedTime }`

---

## Apps Script

### scripts.create
Create a script project attached to a spreadsheet.
- `sheet_id` (string, required): Spreadsheet ID
- `script_name` (string, required): Project name

Returns: `{ scriptId, name, url }`

### scripts.list
List scripts attached to a spreadsheet. Auto-heals stale entries.
- `sheet_id` (string, required): Spreadsheet ID

### scripts.read
Read script content including all files.
- `sheet_id` (string, required): Spreadsheet ID
- `script` (string|number, required): Script name, ID, or 0-based index

Returns: `{ scriptId, name, files: [{ name, type, source }] }`

### scripts.write
Write or create a script file.
- `sheet_id` (string, required): Spreadsheet ID
- `script` (string|number, required): Script identifier
- `file_name` (string, required): File name
- `content` (string, required): File content
- `file_type` (string, default "SERVER_JS"): "SERVER_JS" or "HTML"

### scripts.edit
Edit text within a script file.
- `sheet_id` (string, required): Spreadsheet ID
- `script` (string|number, required): Script identifier
- `file_name` (string, required): File name
- `old_text` (string, required): Text to find
- `new_text` (string, required): Replacement
- `replace_all` (boolean, default false)

### scripts.delete
Remove script from tracking.
- `sheet_id` (string, required): Spreadsheet ID
- `script` (string|number, required): Script identifier

### scripts.run
Execute a function in a script.
- `sheet_id` (string, required): Spreadsheet ID
- `script` (string|number, required): Script identifier
- `function_name` (string, required): Function to execute
- `parameters` (array, default []): Parameters to pass

### scripts.sync
Verify all tracked scripts and remove stale entries.
- `sheet_id` (string, required): Spreadsheet ID
