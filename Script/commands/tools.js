const os = require('os');

module.exports.config = {
  name: 'tools',
  version: '1.0.1',
  hasPermssion: 0,
  credits: 'Arena.ai',
  description: 'Show useful bot tools and runtime status.',
  commandCategory: 'system',
  usages: '[status|ping|uptime|help]',
  cooldowns: 5
};

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes ? `${minutes}m` : '',
    `${secs}s`
  ].filter(Boolean).join(' ');
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function buildStatusMessage() {
  const memory = process.memoryUsage();
  return [
    '🧰 Fun Boy Tools',
    '',
    `✅ Status: Online`,
    `⏱️ Uptime: ${formatDuration(process.uptime())}`,
    `🧠 Memory: ${formatBytes(memory.rss)} RSS / ${formatBytes(memory.heapUsed)} heap`,
    `🖥️ Host: ${os.hostname()} (${os.platform()} ${os.arch()})`,
    `🟢 Node: ${process.version}`,
    `⚙️ CPU: ${os.cpus()?.[0]?.model || 'Unknown'}`,
    '',
    'Commands:',
    '• tools status — bot runtime status',
    '• tools ping — quick health check',
    '• tools uptime — uptime only',
    '• tools help — this menu'
  ].join('\n');
}

module.exports.run = async function ({ api, event, args }) {
  const subCommand = String(args?.[0] || 'help').toLowerCase();
  const threadID = event.threadID;
  const messageID = event.messageID;

  let body;
  switch (subCommand) {
    case 'ping':
      body = '🏓 Pong! Bot is responsive.';
      break;
    case 'uptime':
      body = `⏱️ Uptime: ${formatDuration(process.uptime())}`;
      break;
    case 'status':
    case 'help':
    default:
      body = buildStatusMessage();
      break;
  }

  return api.sendMessage(body, threadID, messageID);
};
