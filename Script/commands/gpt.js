const { generateReply } = require('../../utils/conversation');

module.exports.config = {
  name: 'gpt',
  version: '2.0.0',
  hasPermssion: 0,
  credits: 'Islamick Chat + Arena.ai',
  usePrefix: true,
  description: 'AI conversation reply with safe fallback',
  commandCategory: 'chat',
  cooldowns: 2,
  usages: 'gpt [question]'
};

module.exports.run = async ({ api, event, args, Users }) => {
  try {
    const question = args.join(' ').trim();
    if (!question) {
      return api.sendMessage('আপনার প্রশ্ন লিখুন। উদাহরণ: /gpt আজকের প্ল্যান বানাও', event.threadID, event.messageID);
    }

    let userName = 'বন্ধু';
    try {
      if (Users?.getNameUser) userName = await Users.getNameUser(event.senderID);
    } catch (_) {}

    const answer = await generateReply(question, {
      userID: event.senderID,
      threadID: event.threadID,
      userName,
      botName: global.config?.BOTNAME || 'Fun Boy',
      allowBabyApi: false
    });

    return api.sendMessage(`${global.config?.BOTNAME || 'Fun Boy'}\n\n${answer}`, event.threadID, event.messageID);
  } catch (error) {
    console.error('GPT command error:', error);
    return api.sendMessage('⚠️ AI reply দিতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।', event.threadID, event.messageID);
  }
};
