#!/usr/bin/env node
const readline = require('readline');
const { saveEncryptedCredentials, getCredentialFilePath, DEFAULT_KEY_PATH } = require('../utils/secureCredentials');

function question(rl, prompt, { silent = false } = {}) {
  if (!silent) {
    return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer)));
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const onData = (char) => {
      char = String(char);
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.off('data', onData);
          process.stdout.write('\n');
          break;
        default:
          process.stdout.write('*');
          break;
      }
    };
    stdin.on('data', onData);
    rl.question(prompt, (answer) => {
      stdin.off('data', onData);
      resolve(answer);
    });
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  let email = args.email || args.phone || process.env.FB_EMAIL || process.env.CYBER_EMAIL || '';
  let password = args.password || process.env.FB_PASSWORD || process.env.CYBER_PASSWORD || '';
  let otpKey = args.otp || args.otpKey || process.env.FB_OTPKEY || process.env.CYBER_OTPKEY || '';

  if (!email || !password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    try {
      if (!email) email = (await question(rl, 'Facebook email/phone: ')).trim();
      if (!password) password = await question(rl, 'Facebook password: ', { silent: true });
      if (!otpKey) otpKey = (await question(rl, '2FA/TOTP key (optional, press Enter to skip): ')).trim();
    } finally {
      rl.close();
    }
  }

  const filePath = saveEncryptedCredentials({ email, password, otpKey });
  console.log('\n✅ Login credentials encrypted successfully.');
  console.log(`   Credentials file: ${filePath}`);
  console.log(`   Runtime reads: ${getCredentialFilePath()}`);
  if (!process.env.FB_CREDENTIALS_KEY && !process.env.CREDENTIALS_KEY) {
    console.log(`   Local encryption key: ${DEFAULT_KEY_PATH}`);
    console.log('   Hosting tip: set FB_CREDENTIALS_KEY as a secret environment variable for stronger security.');
  }
  console.log('   Plain-text password was not written to config.json.');
})().catch((error) => {
  console.error(`\n❌ Failed to save encrypted login: ${error.message}`);
  process.exitCode = 1;
});
