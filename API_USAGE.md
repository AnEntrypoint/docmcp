# DocMCP HTTP API

REST API for Google Docs and Sheets operations. All `/mcp/*` endpoints require `Authorization: Bearer <jwt_token>` header.

## Authentication

```
POST /oauth/authorize
Returns: { auth_url: "https://accounts.google.com/..." }

POST /oauth/callback
{ "code": "authorization_code" }
Returns: { mcp_token: "jwt_token_here", user: {...}, token_expires_in: 86400 }
```

## Google Docs

### docs_create
```
POST /mcp/docs/create
{ "title": "Document Title" }
Returns: { docId, title }
```

### docs_read
```
POST /mcp/docs/read
{ "doc_id": "google_doc_id" }
Returns: { doc_id, content }
```

### docs_edit
```
POST /mcp/docs/edit
{ "doc_id": "id", "old_text": "find", "new_text": "replace", "replace_all": false }
Returns: { doc_id, replacements }
```

### docs_insert
```
POST /mcp/docs/insert
{ "doc_id": "id", "text": "content", "position": "end" }
Returns: { doc_id, status }
```

### docs_delete
```
POST /mcp/docs/delete
{ "doc_id": "id", "text": "to delete", "delete_all": false }
Returns: { doc_id, deletions }
```

### docs_get_info
```
POST /mcp/docs/get_info
{ "doc_id": "id" }
Returns: { doc_id, title, createdTime, modifiedTime, owners }
```

### docs_get_structure
```
POST /mcp/docs/get_structure
{ "doc_id": "id" }
Returns: { doc_id, headings }
```

### docs_list
```
POST /mcp/docs/list
{ "max_results": 20, "query": "optional filter" }
Returns: { documents: [...] }
```

### docs_format
```
POST /mcp/docs/format
{ "doc_id": "id", "search_text": "text", "bold": true, "italic": false, ... }
Returns: { doc_id, status }
```

### docs_insert_table
```
POST /mcp/docs/insert_table
{ "doc_id": "id", "rows": 3, "cols": 4, "position": "end" }
Returns: { doc_id, status }
```

### docs_batch
```
POST /mcp/docs/batch
{ "doc_id": "id", "operations": [...] }
Returns: { doc_id, results }
```

### docs_get_sections
```
POST /mcp/docs/get_sections
{ "doc_id": "id" }
Returns: { doc_id, sections: [{ name, level, start, end }] }
```

### docs_section
```
POST /mcp/docs/section
{ "doc_id": "id", "action": "delete|move|replace", "section": "name or index", ... }
Returns: { doc_id, status }
```

### docs_image
```
POST /mcp/docs/image
{ "doc_id": "id", "action": "insert|list|delete|replace", "image_url": "url", ... }
Returns: { doc_id, status } or { doc_id, images: [...] }
```

## Google Sheets

### sheets_create
```
POST /mcp/sheets/create
{ "title": "Spreadsheet Title" }
Returns: { sheetId, title }
```

### sheets_read
```
POST /mcp/sheets/read
{ "sheet_id": "id", "range": "Sheet1" }
Returns: { sheet_id, range, values }
```

### sheets_edit
```
POST /mcp/sheets/edit
{ "sheet_id": "id", "range": "A1:B5", "values": [[...]] }
Returns: { sheet_id, range, status }
```

### sheets_insert
```
POST /mcp/sheets/insert
{ "sheet_id": "id", "range": "Sheet1", "values": [[...]] }
Returns: { sheet_id, range, status }
```

### sheets_get_cell
```
POST /mcp/sheets/get_cell
{ "sheet_id": "id", "cell": "A1" }
Returns: { sheet_id, cell, value }
```

### sheets_set_cell
```
POST /mcp/sheets/set_cell
{ "sheet_id": "id", "cell": "A1", "value": "content" }
Returns: { sheet_id, cell, status }
```

### sheets_edit_cell
```
POST /mcp/sheets/edit_cell
{ "sheet_id": "id", "cell": "A1", "old_text": "find", "new_text": "replace", "replace_all": false }
Returns: { sheet_id, cell, replacements }
```

### sheets_find_replace
```
POST /mcp/sheets/find_replace
{ "sheet_id": "id", "find": "text", "replace": "new", "sheet_name": "optional" }
Returns: { sheet_id, replacements }
```

### sheets_get_info
```
POST /mcp/sheets/get_info
{ "sheet_id": "id" }
Returns: { sheet_id, title, tabs, owners }
```

### sheets_list
```
POST /mcp/sheets/list
{ "max_results": 20, "query": "optional" }
Returns: { spreadsheets: [...] }
```

### sheets_tab
```
POST /mcp/sheets/tab
{ "sheet_id": "id", "action": "add|delete|rename", "title": "name", "sheet_name": "for delete/rename" }
Returns: { sheet_id, status }
```

### sheets_clear
```
POST /mcp/sheets/clear
{ "sheet_id": "id", "range": "A1:D10", "clear_formats": false }
Returns: { sheet_id, range, status }
```

### sheets_format
```
POST /mcp/sheets/format
{ "sheet_id": "id", "range": "A1:B5", "bold": true, "background_color": "#ff0000", ... }
Returns: { sheet_id, range, status }
```

### sheets_merge
```
POST /mcp/sheets/merge
{ "sheet_id": "id", "range": "A1:C1", "action": "merge|unmerge" }
Returns: { sheet_id, range, status }
```

### sheets_freeze
```
POST /mcp/sheets/freeze
{ "sheet_id": "id", "sheet_name": "Sheet1", "rows": 1, "columns": 0 }
Returns: { sheet_id, status }
```

### sheets_sort
```
POST /mcp/sheets/sort
{ "sheet_id": "id", "range": "A1:D10", "sort_column": "A", "ascending": true }
Returns: { sheet_id, range, status }
```

### sheets_rows_cols
```
POST /mcp/sheets/rows_cols
{ "sheet_id": "id", "sheet_name": "Sheet1", "action": "insert|delete", "dimension": "ROW|COLUMN", "start_index": 0, "count": 1 }
Returns: { sheet_id, status }
```

### sheets_dimension_size
```
POST /mcp/sheets/dimension_size
{ "sheet_id": "id", "sheet_name": "Sheet1", "dimension": "COLUMN|ROW", "start": "A", "end": "C", "size": 150 }
Returns: { sheet_id, status }
```

### sheets_get_formula
```
POST /mcp/sheets/get_formula
{ "sheet_id": "id", "cell": "A1" }
Returns: { sheet_id, cell, formula, value }
```

### sheets_batch
```
POST /mcp/sheets/batch
{ "sheet_id": "id", "operations": [...] }
Returns: { sheet_id, results }
```

## Apps Script

### scripts_create
```
POST /mcp/scripts/create
{ "sheet_id": "id", "script_name": "MyScript" }
Returns: { sheet_id, scriptId, status }
```

### scripts_list
```
POST /mcp/scripts/list
{ "sheet_id": "id" }
Returns: { sheet_id, scripts: [...] }
```

### scripts_read
```
POST /mcp/scripts/read
{ "sheet_id": "id", "script": "name or index" }
Returns: { sheet_id, files: [...] }
```

### scripts_write
```
POST /mcp/scripts/write
{ "sheet_id": "id", "script": "name", "file_name": "Code.gs", "mode": "write|edit", "content": "...", "old_text": "...", "new_text": "..." }
Returns: { sheet_id, status }
```

### scripts_delete
```
POST /mcp/scripts/delete
{ "sheet_id": "id", "script": "name or index" }
Returns: { sheet_id, status }
```

### scripts_run
```
POST /mcp/scripts/run
{ "sheet_id": "id", "script": "name", "function_name": "myFunction", "parameters": [...] }
Returns: { sheet_id, result }
```

## Edit Semantics

1. old_text must be unique unless replace_all is true
2. Exact matching including whitespace
3. Returns replacement count on success
4. Clear error messages for not found or multiple matches
