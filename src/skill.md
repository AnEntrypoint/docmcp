# docmcp - Google Docs & Sheets CLI

Read and edit Google Docs and Sheets with exact text replacement semantics matching Claude's Edit tool.

## Authentication

First authenticate with Google:

```bash
npx docmcp auth login
```

This opens a browser for OAuth. Tokens are stored at `~/.config/gcloud/docmcp/token.json`.

## Google Docs Commands

### Read a document

```bash
npx docmcp docs read <doc_id>
```

Returns the full text content of the document.

### Edit a document (exact replacement)

```bash
npx docmcp docs edit <doc_id> --old "text to find" --new "replacement text"
```

The `old` text must appear exactly once in the document. If it appears multiple times, the command fails with an error showing the count.

To replace all occurrences:

```bash
npx docmcp docs edit <doc_id> --old "text" --new "replacement" --replace-all
```

### Insert text

```bash
npx docmcp docs insert <doc_id> --text "content to insert"
npx docmcp docs insert <doc_id> --text "content" --position end
npx docmcp docs insert <doc_id> --text "content" --after "insert after this text"
npx docmcp docs insert <doc_id> --text "content" --index 100
```

## Google Sheets Commands

### Read a range

```bash
npx docmcp sheets read <sheet_id>
npx docmcp sheets read <sheet_id> "Sheet1!A1:D10"
```

Returns a 2D array of cell values as JSON.

### Get a single cell

```bash
npx docmcp sheets cell get <sheet_id> A1
npx docmcp sheets cell get <sheet_id> "Sheet1!B2"
```

### Set a single cell

```bash
npx docmcp sheets cell set <sheet_id> A1 "new value"
```

Completely replaces the cell content.

### Edit text within a cell

```bash
npx docmcp sheets cell edit <sheet_id> A1 --old "find" --new "replace"
```

Same uniqueness requirement as docs edit. Use `--replace-all` for multiple occurrences.

### Update a range

```bash
npx docmcp sheets edit <sheet_id> "A1:B2" --values '[["a","b"],["c","d"]]'
```

### Append rows

```bash
npx docmcp sheets insert <sheet_id> --values '[["row1col1","row1col2"],["row2col1","row2col2"]]'
```

### Find and replace across sheet

```bash
npx docmcp sheets find-replace <sheet_id> --find "old" --replace "new"
npx docmcp sheets find-replace <sheet_id> --find "old" --replace "new" --sheet "Sheet2"
```

Replaces ALL occurrences across the entire sheet (or specified tab).

## Edit Tool Semantics

The edit commands match Claude's file Edit tool behavior:

1. **Uniqueness requirement**: `--old` text must appear exactly once unless `--replace-all` is used
2. **Exact matching**: Text must match exactly including whitespace and punctuation
3. **Helpful errors**: When text not found or appears multiple times, error message includes context and suggestions
4. **Replacement count**: Success message shows how many replacements were made

## Examples

```bash
npx docmcp docs read 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

npx docmcp docs edit 1Bxi... --old "Hello World" --new "Hello Universe"

npx docmcp sheets read 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms "Sheet1!A:C"

npx docmcp sheets cell set 1Bxi... A1 "Updated Value"

npx docmcp sheets cell edit 1Bxi... B2 --old "2024" --new "2025" --replace-all
```

## Environment Variables

- `GOOGLE_OAUTH_CLIENT_ID` - OAuth client ID (required)
- `GOOGLE_OAUTH_CLIENT_SECRET` - OAuth client secret (required)

These can be set in environment or the CLI will prompt for them.
