const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SECRETS_DIR = path.join(ROOT_DIR, '.secrets');
const DEFAULT_CREDENTIALS_PATH = path.join(SECRETS_DIR, 'credentials.enc.json');
const DEFAULT_KEY_PATH = path.join(SECRETS_DIR, 'master.key');
const KDF_DIGEST = 'sha512';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KDF_ITERATIONS = 210000;
const ENCODING = 'base64';

function ensureSecretDir() {
  fs.mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
}

function chmodPrivate(filePath) {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (_) {
    // chmod is best-effort on some hosting filesystems.
  }
}

function getCredentialFilePath() {
  return path.resolve(process.env.CREDENTIALS_FILE || DEFAULT_CREDENTIALS_PATH);
}

function getEncryptionKey({ createIfMissing = false } = {}) {
  if (process.env.FB_CREDENTIALS_KEY && process.env.FB_CREDENTIALS_KEY.trim()) {
    return process.env.FB_CREDENTIALS_KEY.trim();
  }

  if (process.env.CREDENTIALS_KEY && process.env.CREDENTIALS_KEY.trim()) {
    return process.env.CREDENTIALS_KEY.trim();
  }

  if (fs.existsSync(DEFAULT_KEY_PATH)) {
    return fs.readFileSync(DEFAULT_KEY_PATH, 'utf8').trim();
  }

  if (!createIfMissing) return null;

  ensureSecretDir();
  const key = crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(DEFAULT_KEY_PATH, key + '\n', { mode: 0o600 });
  chmodPrivate(DEFAULT_KEY_PATH);
  return key;
}

function deriveKey(passphrase, salt) {
  if (!passphrase || typeof passphrase !== 'string') {
    throw new Error('Missing credential encryption key. Set FB_CREDENTIALS_KEY or run npm run login:setup.');
  }

  return crypto.pbkdf2Sync(passphrase, salt, KDF_ITERATIONS, KEY_LENGTH, KDF_DIGEST);
}

function encryptCredentials(credentials, passphrase = getEncryptionKey({ createIfMissing: true })) {
  const payload = {
    email: String(credentials.email || credentials.EMAIL || '').trim(),
    password: String(credentials.password || credentials.PASSWORD || ''),
    otpKey: String(credentials.otpKey || credentials.OTPKEY || '').trim(),
    savedAt: new Date().toISOString()
  };

  if (!payload.email || !payload.password) {
    throw new Error('Email/phone and password are required.');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2',
    digest: KDF_DIGEST,
    iterations: KDF_ITERATIONS,
    salt: salt.toString(ENCODING),
    iv: iv.toString(ENCODING),
    tag: tag.toString(ENCODING),
    ciphertext: ciphertext.toString(ENCODING),
    updatedAt: new Date().toISOString()
  };
}

function saveEncryptedCredentials(credentials, options = {}) {
  const filePath = path.resolve(options.filePath || getCredentialFilePath());
  const passphrase = options.passphrase || getEncryptionKey({ createIfMissing: true });
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const encrypted = encryptCredentials(credentials, passphrase);
  fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2) + '\n', { mode: 0o600 });
  chmodPrivate(filePath);
  return filePath;
}

function decryptCredentials(encrypted, passphrase = getEncryptionKey()) {
  if (!encrypted || encrypted.version !== 1 || encrypted.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported credentials file format.');
  }

  const salt = Buffer.from(encrypted.salt, ENCODING);
  const iv = Buffer.from(encrypted.iv, ENCODING);
  const tag = Buffer.from(encrypted.tag, ENCODING);
  const ciphertext = Buffer.from(encrypted.ciphertext, ENCODING);
  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

function loadEncryptedCredentials(options = {}) {
  const filePath = path.resolve(options.filePath || getCredentialFilePath());
  if (!fs.existsSync(filePath)) return null;
  const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return decryptCredentials(encrypted, options.passphrase || getEncryptionKey());
}

function redactConfigCredentials(config) {
  if (!config || typeof config !== 'object') return config;
  const redacted = Array.isArray(config) ? [...config] : { ...config };
  if ('EMAIL' in redacted) redacted.EMAIL = '';
  if ('PASSWORD' in redacted) redacted.PASSWORD = '';
  if ('OTPKEY' in redacted) redacted.OTPKEY = '';
  return redacted;
}

function maskIdentifier(value) {
  const text = String(value || '');
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${text.slice(0, 2)}${'*'.repeat(Math.max(3, text.length - 4))}${text.slice(-2)}`;
}

module.exports = {
  ROOT_DIR,
  SECRETS_DIR,
  DEFAULT_CREDENTIALS_PATH,
  DEFAULT_KEY_PATH,
  getCredentialFilePath,
  getEncryptionKey,
  saveEncryptedCredentials,
  loadEncryptedCredentials,
  redactConfigCredentials,
  maskIdentifier
};
