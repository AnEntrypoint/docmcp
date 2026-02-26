#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('=== Project Structure ===');
const files = fs.readdirSync('.');
console.log('Files in current directory:', files.filter(f => !f.startsWith('.')).sort());

console.log('\n=== Package.json Content ===');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('name:', packageJson.name);
console.log('version:', packageJson.version);
console.log('main:', packageJson.main);
console.log('type:', packageJson.type);
console.log('scripts:', Object.keys(packageJson.scripts).sort());
console.log('bin:', Object.keys(packageJson.bin || {}).sort());

console.log('\n=== Package.json Start Script ===');
if (packageJson.scripts?.start) {
  console.log('start:', packageJson.scripts.start);
} else {
  console.log('❌ No start script defined');
}

console.log('\n=== Checking for Configuration Files ===');
const configFiles = [
  'nixpacks.toml',
  'Dockerfile',
  'Procfile',
  '.nixpacksignore',
  '.dockerignore'
];

configFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
    if (file === 'nixpacks.toml') {
      console.log('Content:', fs.readFileSync(file, 'utf8').substring(0, 200) + '...');
    }
  } else {
    console.log(`❌ ${file} not found`);
  }
});

console.log('\n=== Verification Summary ===');
let hasIssues = false;

if (!packageJson.scripts?.start) {
  console.log('❌ Start script is missing');
  hasIssues = true;
}

if (packageJson.scripts?.start && !packageJson.scripts.start.includes('http-server')) {
  console.log('❌ Start script should run http-server.js');
  hasIssues = true;
}

if (packageJson.scripts?.start && !packageJson.scripts.start.includes('--port 3000')) {
  console.log('❌ Start script should use port 3000');
  hasIssues = true;
}

if (packageJson.main !== 'http-server.js') {
  console.log('❌ Main entry point should be http-server.js');
  hasIssues = true;
}

if (!fs.existsSync('nixpacks.toml')) {
  console.log('❌ nixpacks.toml configuration file is missing');
  hasIssues = true;
}

if (hasIssues) {
  console.log('\n❌ Please fix the issues above');
} else {
  console.log('\n✅ Configuration looks correct!');
}