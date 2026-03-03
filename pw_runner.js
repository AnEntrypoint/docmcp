const {spawnSync} = require('child_process');
const fs = require('fs');

const snapCode = fs.readFileSync('C:/dev/docmcp/pw_snap.js', 'utf8');

const r = spawnSync('playwriter', ['-s', '1', '--timeout', '15000', '-e', snapCode], {
  encoding: 'utf8',
  timeout: 20000,
  stdio: ['pipe', 'pipe', 'pipe']
});

fs.writeFileSync('C:/dev/docmcp/pw_result.txt', JSON.stringify({
  stdout: r.stdout,
  stderr: r.stderr,
  status: r.status,
  error: r.error ? r.error.message : null
}));
