#!/usr/bin/env node

import { start, stop } from '../test.mjs';

process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stop();
  process.exit(0);
});

start().then(() => {
  console.log('Ready for testing. Press Ctrl+C to exit.');
  process.stdin.on('readable', () => {
    const chunk = process.stdin.read();
    if (chunk === null) return;
  });
}).catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
