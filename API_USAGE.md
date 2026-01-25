# DocMCP Document Editing API

Document editing tools work exactly like internal editing tools - direct mutations with exact string matching.

## Authentication

All `/mcp/*` endpoints require `Authorization: Bearer <jwt_token>` header.

### Get Token
```
POST /oauth/authorize
→ Returns: { auth_url: "https://accounts.google.com/..." }

User visits auth_url, grants permission, gets authorization code

POST /oauth/callback
{ "code": "authorization_code" }
→ Returns: { mcp_token: "jwt_token_here", user: {...}, token_expires_in: 86400 }
```

## Document Editing

### Read Document
```
POST /mcp/docs/read
{ "doc_id": "google_doc_id" }
→ Returns: { doc_id, content: "full text content" }
```

### Edit Document (Exact String Match)
```
POST /mcp/docs/edit
{ 
  "doc_id": "google_doc_id",
  "old_text": "text to find",
  "new_text": "replacement text"
}
→ Returns: { doc_id, status: "edited" }

Fails if:
- old_text not found → 500 "Text not found"
- Multiple matches → 500 "Multiple matches found"
```

### Insert into Document
```
POST /mcp/docs/insert
{ 
  "doc_id": "google_doc_id",
  "text": "content to append",
  "position": "end"  // or string marker or numeric index
}
→ Returns: { doc_id, status: "inserted" }
```

## Sheet Editing

### Read Sheet
```
POST /mcp/sheets/read
{ 
  "sheet_id": "google_sheet_id",
  "range": "Sheet1"  // default: "Sheet1"
}
→ Returns: { sheet_id, range, values: [["A1","B1"],["A2","B2"]] }
```

### Edit Sheet (Range Update)
```
POST /mcp/sheets/edit
{ 
  "sheet_id": "google_sheet_id",
  "range": "Sheet1!A1:B5",
  "values": [["header1","header2"],["val1","val2"]]
}
→ Returns: { sheet_id, range, status: "edited" }
```

### Insert into Sheet
```
POST /mcp/sheets/insert
{ 
  "sheet_id": "google_sheet_id",
  "range": "Sheet1",
  "values": [["new row data"]]
}
→ Returns: { sheet_id, range, status: "inserted" }
```

## Key Design Principles

1. **Exact String Matching** - Like Edit tool, finds exact match or fails clearly
2. **No Multiple Matches** - Rejects ambiguous edits to prevent silent corruption
3. **Real Mutations** - All operations directly modify Google Docs/Sheets
4. **Token-Based Auth** - Bearer JWT tokens with 24h expiration
5. **Modular Architecture** - Separate oauth/docs/sheets modules under 200 lines each
