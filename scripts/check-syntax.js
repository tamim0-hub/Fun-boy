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

const JSON_FILES = ['package.json', 'package-lock.json', 'config.json', 'appstate.json', 'Script/commands/cache/conversation-teach.json'];
for (const relative of JSON_FILES) {
  const full = path.join(ROOT, relative);
  try {
    if (fs.existsSync(full)) JSON.parse(fs.readFileSync(full, 'utf8'));
    else if (relative === 'Script/commands/cache/conversation-teach.json') {
      // Ensure default format if missing
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, JSON.stringify({ version: 1, pairs: {}, stats: {}, profiles: {}, styles: {} }, null, 2));
    }
    console.log(`✅ JSON OK: ${relative}`);
  } catch (err) {
    failures += 1;
    console.error(`❌ JSON parse failed: ${relative} — ${err.message}`);
  }
}

if (failures > 0) process.exit(1);

const COMMAND_FILES = {
  baby: 'Script/commands/baby.js',
  ai: 'Script/commands/ai.js',
  gpt: 'Script/commands/gpt.js',
  flatter: 'Script/commands/flatter.js',
  whoami: 'Script/commands/whoami.js',
  tools: 'Script/commands/tools.js'
};

for (const [name, relative] of Object.entries(COMMAND_FILES)) {
  try {
    const mod = require(path.join(ROOT, relative));
    if (!mod.config || !mod.run) throw new Error(`missing config or run export`);
    console.log(`✅ Command export OK: ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`❌ Command export smoke check failed: ${name} — ${err.message}`);
  }
}

if (failures > 0) process.exit(1);

try {
  const { localReply } = require(path.join(ROOT, 'utils/conversation.js'));
  const samples = [
    { input: 'তুমি কে', opts: { userID: 'u1', userName: 'Unknown User' } },
    { input: 'আমি তোমাকে miss করি', opts: { userID: 'u2', userName: 'Sadia' } },
    { input: 'আমি তোমাকে miss করি', opts: { userID: 'u3', userName: 'Tamim' } },
    { input: 'random কথা', opts: { userID: 'u4', userName: 'Someone' } }
  ];
  for (const { input, opts } of samples) {
    const reply = localReply(input, opts);
    if (!reply || typeof reply !== 'string') throw new Error(`empty reply for "${input}"`);
    console.log(`✅ Conversation smoke OK (${opts.userName}): ${reply.slice(0, 80)}...`);
  }
} catch (err) {
  failures += 1;
  console.error(`❌ Conversation smoke check failed: ${err.message}`);
}

if (failures > 0) process.exit(1);

console.log('Running npm audit --omit=dev --audit-level=high ...');
const audit = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
console.log(audit.stdout || '');
if (audit.status !== 0) {
  console.error(audit.stderr || '');
  console.error('⚠️ npm audit reported high/critical vulnerabilities. No new vulnerabilities should be introduced.');
  process.exit(1);
}

console.log('\n✅ All checks passed.');
