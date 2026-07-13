const fs = require('fs');
const path = require('path');
const Module = require('module');
const {
  ROOT_DIR,
  loadEncryptedCredentials,
  redactConfigCredentials,
  maskIdentifier
} = require('./secureCredentials');
const { normalizeJimp } = require('./jimpCompat');

const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const CONFIG_TEMP_PATH = `${CONFIG_PATH}.temp`;
let credentials = null;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveCredentials() {
  if (credentials) return credentials;

  const envEmail = process.env.FB_EMAIL || process.env.CYBER_EMAIL || '';
  const envPassword = process.env.FB_PASSWORD || process.env.CYBER_PASSWORD || '';
  const envOtpKey = process.env.FB_OTPKEY || process.env.CYBER_OTPKEY || '';

  if (envEmail && envPassword) {
    credentials = { email: envEmail, password: envPassword, otpKey: envOtpKey };
    console.log(`[SecureLogin] Using credentials from environment for ${maskIdentifier(envEmail)}.`);
    return credentials;
  }

  try {
    credentials = loadEncryptedCredentials();
    if (credentials && credentials.email && credentials.password) {
      console.log(`[SecureLogin] Loaded encrypted credentials for ${maskIdentifier(credentials.email)}.`);
      return credentials;
    }
  } catch (error) {
    console.warn(`[SecureLogin] Could not decrypt credentials: ${error.message}`);
  }

  return null;
}

function withRuntimeCredentials(config) {
  const patched = { ...(config || {}) };
  const secureCredentials = resolveCredentials();
  if (secureCredentials) {
    patched.EMAIL = secureCredentials.email;
    patched.PASSWORD = secureCredentials.password;
    if (secureCredentials.otpKey) patched.OTPKEY = secureCredentials.otpKey;
  }
  return patched;
}

function sanitizeConfigTempWrite(file, data) {
  try {
    const filePath = path.resolve(String(file));
    if (filePath === CONFIG_TEMP_PATH && typeof data === 'string') {
      const parsed = JSON.parse(data);
      return JSON.stringify(redactConfigCredentials(parsed), null, 2);
    }
  } catch (_) {
    // Keep writes working even if data is not JSON.
  }
  return data;
}

function installConfigRequirePatch() {
  const originalLoad = Module._load;
  Module._load = function patchedModuleLoad(request, parent, isMain) {
    const resolved = Module._resolveFilename(request, parent, isMain);
    if (path.resolve(resolved) === CONFIG_PATH) {
      const config = withRuntimeCredentials(readJson(CONFIG_PATH));
      require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: config,
        children: [],
        paths: Module._nodeModulePaths(path.dirname(resolved))
      };
      return config;
    }

    const loaded = originalLoad.apply(this, arguments);

    if (request === 'jimp') {
      return normalizeJimp(loaded);
    }

    if (request === 'axios') {
      try {
        const { installAxiosDefaults } = require('./httpClient');
        return installAxiosDefaults(loaded);
      } catch (_) {
        return loaded;
      }
    }

    if (request === 'fs-extra' && loaded && typeof loaded.writeFileSync === 'function' && !loaded.__secureWritePatched) {
      const originalFsExtraWriteFileSync = loaded.writeFileSync;
      loaded.writeFileSync = function patchedFsExtraWriteFileSync(file, data, ...args) {
        return originalFsExtraWriteFileSync.call(this, file, sanitizeConfigTempWrite(file, data), ...args);
      };
      Object.defineProperty(loaded, '__secureWritePatched', { value: true });
    }
    return loaded;
  };
}

function installSafeWritePatch() {
  const originalWriteFileSync = fs.writeFileSync;
  fs.writeFileSync = function patchedWriteFileSync(file, data, ...args) {
    return originalWriteFileSync.call(this, file, sanitizeConfigTempWrite(file, data), ...args);
  };
}

installConfigRequirePatch();
installSafeWritePatch();
