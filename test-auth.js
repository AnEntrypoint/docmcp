import fs from 'fs';
import path from 'path';
import os from 'os';

function loadConfig() {
  const configFile = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'config.json');
  if (!fs.existsSync(configFile)) return null;
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

// Test 1: Check if sample config exists in project
const projectConfig = path.join(process.cwd(), 'config.json');
if (fs.existsSync(projectConfig)) {
  console.log('Found config.json in project root. Contents:');
  console.log(fs.readFileSync(projectConfig, 'utf8'));
}

// Test 2: Load from home directory (should not exist yet)
const homeConfig = loadConfig();
console.log('Home config:', homeConfig);

// Test 3: Syntax check the modified files
console.log('\nSyntax check:');
try {
  const cliContent = fs.readFileSync(path.join(process.cwd(), 'cli.js'), 'utf8');
  new Function(cliContent);
  console.log('cli.js: syntax OK');
} catch (e) {
  console.error('cli.js syntax error:', e.message);
}

try {
  const serverContent = fs.readFileSync(path.join(process.cwd(), 'stdio-server.js'), 'utf8');
  new Function(serverContent);
  console.log('stdio-server.js: syntax OK');
} catch (e) {
  console.error('stdio-server.js syntax error:', e.message);
}

console.log('\nDone.');
