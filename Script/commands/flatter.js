const { makeFlattery } = require('../../utils/conversation');

module.exports.config = {
  name: 'flatter',
  version: '1.0.0',
  hasPermssion: 0,
  credits: 'Arena.ai',
  description: 'Premium চাটুকারিতা / compliment generator',
  commandCategory: 'fun',
  usages: 'flatter [name/text]',
  cooldowns: 2
};

module.exports.run = async ({ api, event, args, Users }) => {
  let name = 'বন্ধু';
  try {
    if (Users?.getNameUser) name = await Users.getNameUser(event.senderID);
  } catch (_) {}

  const text = args.join(' ').trim() || name;
  const reply = makeFlattery(text, {
    userID: event.senderID,
    userName: name,
    botName: global.config?.BOTNAME || 'Fun Boy',
    language: /[\u0980-\u09FF]/.test(text) ? 'bn' : undefined
  });

  return api.sendMessage(reply, event.threadID, event.messageID);
};
