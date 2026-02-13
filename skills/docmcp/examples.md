# Examples

## Google Docs

### Create a document
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.create '{"title":"Meeting Notes 2026-02-13"}'
```

### Read a document
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.read '{"doc_id":"1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"}'
```

### Edit text in a document
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.edit '{"doc_id":"1Bxi...","old_text":"Draft","new_text":"Final"}'
```

### Replace all occurrences
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.edit '{"doc_id":"1Bxi...","old_text":"TBD","new_text":"Complete","replace_all":true}'
```

### Insert text at end
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.insert '{"doc_id":"1Bxi...","text":"\nNew paragraph added at end."}'
```

### Insert text after specific text
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.insert '{"doc_id":"1Bxi...","text":" (updated)","position":"Section Header"}'
```

### Delete text
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.delete '{"doc_id":"1Bxi...","text":"remove this","delete_all":true}'
```

### Format text bold and red
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.format '{"doc_id":"1Bxi...","search_text":"Important","bold":true,"foreground_color":"#ff0000"}'
```

### Set heading style
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.format '{"doc_id":"1Bxi...","search_text":"Chapter 1","heading":"HEADING_1"}'
```

### Insert a 3x4 table
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.insert_table '{"doc_id":"1Bxi...","rows":3,"cols":4}'
```

### Get document structure
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.get_structure '{"doc_id":"1Bxi..."}'
```

### Get sections
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.get_sections '{"doc_id":"1Bxi..."}'
```

### Delete a section
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.section '{"doc_id":"1Bxi...","action":"delete","section":"Old Section"}'
```

### Move a section to the beginning
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.section '{"doc_id":"1Bxi...","action":"move","section":"Summary","target":"start"}'
```

### Replace section content
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.section '{"doc_id":"1Bxi...","action":"replace","section":"Notes","content":"Updated notes content here.\n","preserve_heading":true}'
```

### Insert an image
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.image '{"doc_id":"1Bxi...","action":"insert","image_url":"https://example.com/image.png","width":300,"height":200}'
```

### List images
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.image '{"doc_id":"1Bxi...","action":"list"}'
```

### List documents
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs docs.list '{"query":"meeting","max_results":10}'
```

---

## Google Sheets

### Create a spreadsheet
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.create '{"title":"Budget 2026"}'
```

### Read a range
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.read '{"sheet_id":"1abc...xyz","range":"Sheet1!A1:D10"}'
```

### Write values to a range
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.edit '{"sheet_id":"1abc...xyz","range":"A1:C2","values":[["Name","Age","City"],["Alice","30","NYC"]]}'
```

### Append rows
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.insert '{"sheet_id":"1abc...xyz","values":[["Bob","25","LA"],["Carol","35","SF"]]}'
```

### Get a cell value
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.get_cell '{"sheet_id":"1abc...xyz","cell":"B2"}'
```

### Set a cell value
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.set_cell '{"sheet_id":"1abc...xyz","cell":"A1","value":"Total"}'
```

### Edit text in a cell
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.edit_cell '{"sheet_id":"1abc...xyz","cell":"A1","old_text":"Draft","new_text":"Final"}'
```

### Find and replace across sheet
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.find_replace '{"sheet_id":"1abc...xyz","find":"2025","replace":"2026"}'
```

### Get spreadsheet info
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.get_info '{"sheet_id":"1abc...xyz"}'
```

### Add a new tab
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.tab '{"sheet_id":"1abc...xyz","action":"add","title":"Q1 Data"}'
```

### Delete a tab
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.tab '{"sheet_id":"1abc...xyz","action":"delete","sheet_name":"Old Tab"}'
```

### Rename a tab
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.tab '{"sheet_id":"1abc...xyz","action":"rename","sheet_name":"Sheet1","title":"Main Data"}'
```

### Format cells bold with blue background
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.format '{"sheet_id":"1abc...xyz","range":"A1:D1","bold":true,"background_color":"#4285f4","text_color":"#ffffff"}'
```

### Add borders
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.format '{"sheet_id":"1abc...xyz","range":"A1:D10","borders":{"style":"SOLID","inner":true}}'
```

### Merge cells
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.merge '{"sheet_id":"1abc...xyz","range":"A1:D1"}'
```

### Freeze header row
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.freeze '{"sheet_id":"1abc...xyz","sheet_name":"Sheet1","rows":1}'
```

### Sort by column B descending
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.sort '{"sheet_id":"1abc...xyz","range":"A1:D10","sort_column":"B","ascending":false}'
```

### Insert 3 rows at index 5
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.rows_cols '{"sheet_id":"1abc...xyz","sheet_name":"Sheet1","action":"insert","dimension":"ROW","start_index":5,"count":3}'
```

### Set column A width to 200px
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.dimension_size '{"sheet_id":"1abc...xyz","sheet_name":"Sheet1","dimension":"COLUMN","start":"A","end":"A","size":200}'
```

### Get cell formula
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.get_formula '{"sheet_id":"1abc...xyz","cell":"C5"}'
```

### Clear a range
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.clear '{"sheet_id":"1abc...xyz","range":"A1:D10"}'
```

### Batch: set values and format
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs sheets.batch '{"sheet_id":"1abc...xyz","operations":[{"type":"setValue","range":"A1:B2","values":[["Name","Score"],["Alice","95"]]},{"type":"format","range":"A1:B1","bold":true,"backgroundColor":"#4285f4"}]}'
```

---

## Google Drive

### Search for files
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs drive.search '{"query":"budget","type":"sheets","max_results":5}'
```

---

## Apps Script

### Create a script project
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.create '{"sheet_id":"1abc...xyz","script_name":"MyScript"}'
```

### List scripts
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.list '{"sheet_id":"1abc...xyz"}'
```

### Read script files
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.read '{"sheet_id":"1abc...xyz","script":"MyScript"}'
```

### Write a script file
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.write '{"sheet_id":"1abc...xyz","script":"MyScript","file_name":"Code","content":"function onOpen() { SpreadsheetApp.getUi().createMenu(\"Custom\").addItem(\"Run\", \"main\").addToUi(); }\nfunction main() { SpreadsheetApp.getActive().toast(\"Hello!\"); }"}'
```

### Edit a script file
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.edit '{"sheet_id":"1abc...xyz","script":"MyScript","file_name":"Code","old_text":"Hello!","new_text":"Updated!"}'
```

### Run a script function
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.run '{"sheet_id":"1abc...xyz","script":"MyScript","function_name":"main"}'
```

### Sync scripts
```bash
node ~/.claude/skills/docmcp/scripts/gdoc.mjs scripts.sync '{"sheet_id":"1abc...xyz"}'
```
