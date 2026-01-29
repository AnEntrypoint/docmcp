# docmcp - Google Docs and Sheets CLI

Read and edit Google Docs and Sheets with exact text replacement semantics matching Claude Edit tool.

## Authentication

```bash
npx docmcp auth login
```

Opens browser for OAuth. Tokens stored at `~/.config/gcloud/docmcp/token.json`.

## Environment Variables

- `GOOGLE_OAUTH_CLIENT_ID` - OAuth client ID required
- `GOOGLE_OAUTH_CLIENT_SECRET` - OAuth client secret required

## Google Docs Commands

### Create document

```bash
npx docmcp docs create "Document Title"
```

### Read document

```bash
npx docmcp docs read <doc_id>
```

### Edit document

```bash
npx docmcp docs edit <doc_id> --old "text to find" --new "replacement"
```

old text must appear exactly once. Use --replace-all for multiple occurrences:

```bash
npx docmcp docs edit <doc_id> --old "text" --new "replacement" --replace-all
```

### Insert text

```bash
npx docmcp docs insert <doc_id> --text "content"
npx docmcp docs insert <doc_id> --text "content" --position end
npx docmcp docs insert <doc_id> --text "content" --after "insert after this"
npx docmcp docs insert <doc_id> --text "content" --index 100
```

## Google Sheets Commands

### Create spreadsheet

```bash
npx docmcp sheets create "Spreadsheet Title"
```

### Read range

```bash
npx docmcp sheets read <sheet_id>
npx docmcp sheets read <sheet_id> "Sheet1!A1:D10"
```

### Get cell

```bash
npx docmcp sheets cell get <sheet_id> A1
npx docmcp sheets cell get <sheet_id> "Sheet1!B2"
```

### Set cell

```bash
npx docmcp sheets cell set <sheet_id> A1 "value"
```

### Edit cell text

```bash
npx docmcp sheets cell edit <sheet_id> A1 --old "find" --new "replace"
npx docmcp sheets cell edit <sheet_id> A1 --old "2024" --new "2025" --replace-all
```

### Update range

```bash
npx docmcp sheets edit <sheet_id> "A1:B2" --values '[["a","b"],["c","d"]]'
```

### Append rows

```bash
npx docmcp sheets insert <sheet_id> --values '[["col1","col2"],["col3","col4"]]'
```

### Find and replace

```bash
npx docmcp sheets find-replace <sheet_id> --find "old" --replace "new"
npx docmcp sheets find-replace <sheet_id> --find "old" --replace "new" --sheet "Sheet2"
```

## Edit Semantics

Edit commands match Claude Edit tool behavior:

1. old_text must appear exactly once unless replace_all used
2. Exact matching including whitespace and punctuation
3. Clear errors when text not found or multiple matches
4. Replacement count in success response

## Examples

```bash
# Create and edit document
npx docmcp docs create "Meeting Notes"
npx docmcp docs read 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
npx docmcp docs edit 1Bxi... --old "Hello World" --new "Hello Universe"

# Work with spreadsheet
npx docmcp sheets create "Budget 2025"
npx docmcp sheets read 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms "Sheet1!A:C"
npx docmcp sheets cell set 1Bxi... A1 "Updated"
npx docmcp sheets cell edit 1Bxi... B2 --old "2024" --new "2025" --replace-all
```
