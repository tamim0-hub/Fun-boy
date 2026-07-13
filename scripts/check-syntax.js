#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK_DIRS = ['Script', 'includes', 'utils', 'scripts'];
const EXTRA_FILES = ['Cyber.js', 'Ullash.js'];

function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, output);
    else if (entry.isFile() && entry.name.endsWith('.js')) output.push(fullPath);
  }
  return output;
}

const files = [
  ...EXTRA_FILES.map((file) => path.join(ROOT, file)).filter(fs.existsSync),
  ...CHECK_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
];

let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    console.error(`\n❌ Syntax check failed: ${path.relative(ROOT, file)}`);
    console.error(result.stderr || result.stdout);
  }
}

if (failures > 0) {
  console.error(`\n${failures} file(s) failed syntax validation.`);
  process.exit(1);
}

console.log(`✅ Syntax OK (${files.length} JavaScript files checked).`);
