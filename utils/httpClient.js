const axios = require('axios');
const http = require('http');
const https = require('https');

const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 20000);
const DEFAULT_MAX_BODY_MB = Number(process.env.HTTP_MAX_BODY_MB || 25);
const DEFAULT_MAX_BODY_BYTES = DEFAULT_MAX_BODY_MB * 1024 * 1024;

const client = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  maxContentLength: DEFAULT_MAX_BODY_BYTES,
  maxBodyLength: DEFAULT_MAX_BODY_BYTES,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 16, maxFreeSockets: 4, timeout: DEFAULT_TIMEOUT_MS }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 16, maxFreeSockets: 4, timeout: DEFAULT_TIMEOUT_MS }),
  headers: {
    'User-Agent': 'FunBoyBot/10.1.1 (+https://github.com/tamim0-hub/Fun-boy)'
  }
});

function installAxiosDefaults(instance = axios) {
  instance.defaults.timeout = instance.defaults.timeout || DEFAULT_TIMEOUT_MS;
  instance.defaults.maxContentLength = instance.defaults.maxContentLength || DEFAULT_MAX_BODY_BYTES;
  instance.defaults.maxBodyLength = instance.defaults.maxBodyLength || DEFAULT_MAX_BODY_BYTES;
  instance.defaults.httpAgent = instance.defaults.httpAgent || client.defaults.httpAgent;
  instance.defaults.httpsAgent = instance.defaults.httpsAgent || client.defaults.httpsAgent;
  instance.defaults.headers = instance.defaults.headers || {};
  instance.defaults.headers.common = instance.defaults.headers.common || {};
  if (!instance.defaults.headers.common['User-Agent']) {
    instance.defaults.headers.common['User-Agent'] = client.defaults.headers['User-Agent'];
  }
  return instance;
}

installAxiosDefaults(axios);

module.exports = installAxiosDefaults(client);
module.exports.installAxiosDefaults = installAxiosDefaults;
module.exports.DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
module.exports.DEFAULT_MAX_BODY_BYTES = DEFAULT_MAX_BODY_BYTES;
