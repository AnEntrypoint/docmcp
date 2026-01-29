---
name: docmcp
description: Read and edit Google Docs and Sheets via CLI. Perform exact text replacements matching Claude Edit tool behavior. Run `npx docmcp skill` for complete instructions.
---

## Quick Start

```bash
npx docmcp docs read <doc_id>
npx docmcp docs edit <doc_id> --old "text to find" --new "replacement"
npx docmcp sheets read <sheet_id> [range]
npx docmcp sheets cell get <sheet_id> <cell>
npx docmcp sheets cell set <sheet_id> <cell> <value>
```

## Full Documentation

**Always run `npx docmcp skill` to get the complete, up-to-date skill instructions.**

The CLI provides the same editing semantics as Claude's file editing tools:
- `old_text` must be unique unless `--replace-all` is specified
- Exact string matching with helpful error messages
- Returns replacement counts for feedback
