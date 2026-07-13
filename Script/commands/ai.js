const { generateReply } = require('../../utils/conversation');

module.exports.config = {
  name: 'ai',
  version: '2.0.0',
  credits: '𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️ + Arena.ai',
  description: 'Smart conversation AI with Bangla/English fallback',
  cooldowns: 2,
  hasPermssion: 0,
  commandCategory: 'chat',
  usages: 'ai [message]'
};

module.exports.run = async ({ api, args, event, Users }) => {
  try {
    const prompt = args.join(' ').trim();
    const imageUrl = event.type === 'message_reply' && event.messageReply?.attachments?.[0]?.url
      ? event.messageReply.attachments[0].url
      : '';

    if (!prompt && !imageUrl) {
      return api.sendMessage('Assalamu Alaikum 😊\nআমি কিভাবে সাহায্য করতে পারি? লিখুন: /ai আপনার প্রশ্ন', event.threadID, event.messageID);
    }

    let userName = 'বন্ধু';
    try {
      if (Users?.getNameUser) userName = await Users.getNameUser(event.senderID);
    } catch (_) {}

    const text = imageUrl
      ? `${prompt || 'এই ছবিটা সম্পর্কে বলো'}\nImage URL: ${imageUrl}`
      : prompt;

    const reply = await generateReply(text, {
      userID: event.senderID,
      threadID: event.threadID,
      userName,
      botName: global.config?.BOTNAME || 'Fun Boy',
      allowBabyApi: false
    });

    return api.sendMessage(reply, event.threadID, event.messageID);
  } catch (error) {
    console.error('AI command error:', error);
    return api.sendMessage(`⚠️ AI error: ${error.message}`, event.threadID, event.messageID);
  }
};
