#!/usr/bin/env node

console.log('=== Package.json Configuration ===');
console.log('name:', process.env.npm_package_name);
console.log('version:', process.env.npm_package_version);
console.log('main:', process.env.npm_package_main);
console.log('scripts.start:', process.env.npm_package_scripts_start);

console.log('\n=== Command Line Arguments ===');
console.log('process.argv:', process.argv);