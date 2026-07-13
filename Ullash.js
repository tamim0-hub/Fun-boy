const { spawn } = require('child_process');
const axios = require('axios');
const express = require('express');
const path = require('path');
const logger = require('./utils/log');

const app = express();
const port = Number(process.env.PORT || 8080);
const MAX_RESTARTS = Number(process.env.MAX_RESTARTS || 10);
const RESTART_DELAY_MS = Number(process.env.RESTART_DELAY_MS || 3000);
const BOT_OLD_SPACE_MB = Number(process.env.BOT_OLD_SPACE_MB || 384);

let child = null;
global.countRestart = global.countRestart || 0;

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (_req, res) => {
  res.status(child && !child.killed ? 200 : 503).json({
    ok: Boolean(child && !child.killed),
    bot: child && !child.killed ? 'running' : 'stopped',
    restarts: global.countRestart,
    uptime: process.uptime()
  });
});

app.listen(port, () => {
  logger(`Dashboard is running on port ${port}.`, '[ Starting ]');
}).on('error', (err) => {
  if (err.code === 'EACCES') {
    logger(`Permission denied. Cannot bind to port ${port}.`, '[ Error ]');
  } else {
    logger(`Server error: ${err.message}`, '[ Error ]');
  }
});

function startBot(message) {
  if (message) logger(message, '[ Starting ]');

  child = spawn(process.execPath, [
    `--max-old-space-size=${BOT_OLD_SPACE_MB}`,
    '--expose-gc',
    '--trace-warnings',
    '--async-stack-traces',
    '--require',
    path.join(__dirname, 'utils/resourceGuard.js'),
    '--require',
    path.join(__dirname, 'utils/runtimeCredentials.js'),
    'Cyber.js'
  ], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      MALLOC_ARENA_MAX: process.env.MALLOC_ARENA_MAX || '2',
      MEMORY_RSS_LIMIT_MB: process.env.MEMORY_RSS_LIMIT_MB || '460',
      MEMORY_HEAP_LIMIT_MB: process.env.MEMORY_HEAP_LIMIT_MB || String(Math.max(256, BOT_OLD_SPACE_MB - 32))
    }
  });

  child.on('close', (codeExit, signal) => {
    const stoppedBySignal = signal === 'SIGTERM' || signal === 'SIGINT';
    if (!stoppedBySignal && codeExit !== 0 && global.countRestart < MAX_RESTARTS) {
      global.countRestart += 1;
      logger(`Bot exited with code ${codeExit}. Restarting in ${RESTART_DELAY_MS}ms... (${global.countRestart}/${MAX_RESTARTS})`, '[ Restarting ]');
      setTimeout(() => startBot(), RESTART_DELAY_MS);
      return;
    }

    logger(`Bot stopped. code=${codeExit ?? 'null'} signal=${signal ?? 'none'} restarts=${global.countRestart}`, '[ Stopped ]');
  });

  child.on('error', (error) => {
    logger(`Bot process error: ${error.message}`, '[ Error ]');
  });
}

async function checkUpdateInfo() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/cyber-ullash/cyber-bot/main/data.json', { timeout: 7000 });
    if (res.data?.name) logger(res.data.name, '[ NAME ]');
    if (res.data?.version) logger(`Version: ${res.data.version}`, '[ VERSION ]');
    if (res.data?.description) logger(res.data.description, '[ DESCRIPTION ]');
  } catch (err) {
    logger(`Failed to fetch update info: ${err.message}`, '[ Update Error ]');
  }
}

function shutdown(signal) {
  logger(`Received ${signal}. Shutting down...`, '[ Shutdown ]');
  if (child && !child.killed) child.kill(signal);
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (error) => logger(`Unhandled rejection: ${error?.stack || error}`, '[ Error ]'));
process.on('uncaughtException', (error) => logger(`Uncaught exception: ${error?.stack || error}`, '[ Error ]'));

checkUpdateInfo();
startBot('Starting Fun Boy bot...');
