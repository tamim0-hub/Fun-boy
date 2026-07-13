module.exports.config = {
  name: 'whoami',
  version: '1.1.0',
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
    'আমি কোনো serious assistant না; শুধু একটা fun/chat bot যা group/chat alive রাখে, মজা করে, আর boring reply natural করে দেয়।',
    '',
    'আমার style:',
    '• মানুষের মতো casual আড্ডা',
    '• নাম দেখে conservative gender guess; unknown/ambiguous থাকে neutral',
    '• মেয়ে হলে soft/flirty tone; ছেলে/unknown হলে friendly/dost style',
    '• কোনো external AI API ছাড়াই local reply engine কাজ করে',
    '• 512MB RAM মাথায় রেখে lightweight',
    '',
    'Try:',
    '• baby hello',
    '• /flatter তোমার নাম',
    '• /ai আজকে mood ভালো করার মতো কিছু বলো',
    '• /baby tone female | male | neutral',
    '• /baby styleteach তোর কথা শুনে হাসি পাইলো',
    '• /baby stylelist'
  ].join('\n');

  return api.sendMessage(body, event.threadID, event.messageID);
};
