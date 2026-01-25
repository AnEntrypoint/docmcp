#!/usr/bin/env node

import { start, stop } from './test.mjs';

async function testAll() {
  console.log('=== DocMCP Local Test Runner ===\n');

  try {
    const state = await start({ skipAuth: true });
    const port = state.port;
    const token = state.mcp_token;
    const base = `http://127.0.0.1:${port}`;

    console.log(`Server running on port ${port}\n`);

    const tests = [
      { name: 'docs/read', path: '/mcp/docs/read', body: { doc_id: 'doc-123' } },
      { name: 'docs/edit', path: '/mcp/docs/edit', body: { doc_id: 'doc-123', old_text: 'a', new_text: 'b' } },
      { name: 'docs/insert', path: '/mcp/docs/insert', body: { doc_id: 'doc-123', text: 'new' } },
      { name: 'sheets/read', path: '/mcp/sheets/read', body: { sheet_id: 'sheet-456' } },
      { name: 'sheets/edit', path: '/mcp/sheets/edit', body: { sheet_id: 'sheet-456', range: 'A1', values: [['x']] } },
      { name: 'sheets/insert', path: '/mcp/sheets/insert', body: { sheet_id: 'sheet-456', values: [['y']] } }
    ];

    let passed = 0;
    for (const test of tests) {
      try {
        const res = await fetch(base + test.path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(test.body)
        });

        if (res.status === 200) {
          const data = await res.json();
          console.log(`✓ ${test.name}`);
          passed++;
        } else {
          console.log(`✗ ${test.name} [${res.status}]`);
        }
      } catch (err) {
        console.log(`✗ ${test.name}: ${err.message}`);
      }
    }

    console.log(`\n${passed}/${tests.length} tests passed\n`);

    await stop();
    process.exit(passed === tests.length ? 0 : 1);
  } catch (err) {
    console.error('Error:', err.message);
    await stop();
    process.exit(1);
  }
}

testAll();
