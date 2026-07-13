module.exports.config = {
  name: 'whoami',
  version: '1.0.0',
  hasPermssion: 0,
  credits: 'Arena.ai',
  description: 'Fun Boy bot identity/personality',
  commandCategory: 'fun',
  usages: 'whoami',
  cooldowns: 3
};

module.exports.run = async ({ api, event }) => {
  const botName = global.config?.BOTNAME || 'Fun Boy';
  const body = [
    `আমি ${botName} 🤡`,
    '',
    'কাজ না, আগে fun — এইটাই আমার philosophy.',
    'আমি group/chat alive রাখি, হালকা চাটুকারিতা করি, mood ভালো করি, আর কথাকে boring হতে দিই না।',
    '',
    'আমার style:',
    '• মানুষের মতো casual reply',
    '• safe flirting only when tone confidently female',
    '• ছেলে/unknown হলে friendly respect style',
    '• API না থাকলেও local reply engine',
    '• 512MB RAM মাথায় রেখে lightweight behavior',
    '',
    'Try:',
    '• baby hello',
    '• /flatter তোমার নাম',
    '• /ai আজকে mood ভালো করার মতো কিছু বলো',
    '• /baby tone female | male | neutral'
  ].join('\n');

  return api.sendMessage(body, event.threadID, event.messageID);
};
