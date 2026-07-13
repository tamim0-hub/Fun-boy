const {
  generateReply,
  teach,
  removeTeach,
  listTeach,
  setUserTone,
  getUserTone,
  styleTeach,
  styleList,
  styleRemove
} = require('../../utils/conversation');

module.exports.config = {
  name: 'baby',
  version: '7.2.0',
  credits: 'Dipto + Arena.ai',
  cooldowns: 1,
  hasPermssion: 0,
  description: 'Conversational chat with teach/styleteach/remove/list/tone support and offline fallback',
  commandCategory: 'chat',
  category: 'chat',
  usePrefix: true,
  prefix: true,
  usages: 'baby [message] | teach question - reply1, reply2 | styleteach phrase | stylelist | styleremove phrase | remove question | list | tone male/female/neutral'
};

function pushHandleReply(api, event, info, reply) {
  if (!global.client?.handleReply || !info?.messageID) return;
  global.client.handleReply.push({
    name: module.exports.config.name,
    type: 'reply',
    messageID: info.messageID,
    author: event.senderID,
    lnk: reply
  });
}

async function getUserName(Users, userID) {
  try {
    if (Users?.getNameUser) return await Users.getNameUser(userID);
    if (Users?.getName) return await Users.getName(userID);
  } catch (_) {}
  return 'বন্ধু';
}

async function replyTo(api, event, text) {
  return api.sendMessage(text, event.threadID, (error, info) => {
    if (!error) pushHandleReply(api, event, info, text);
  }, event.messageID);
}

async function handleConversation({ api, event, text, Users, allowBabyApi = true }) {
  const userName = await getUserName(Users, event.senderID);
  const answer = await generateReply(text, {
    userID: event.senderID,
    threadID: event.threadID,
    userName,
    botName: global.config?.BOTNAME || 'Fun Boy',
    allowBabyApi
  });
  return replyTo(api, event, answer);
}

module.exports.run = async function ({ api, event, args, Users }) {
  try {
    const raw = args.join(' ').trim();
    const text = raw.toLowerCase();

    if (!raw) {
      return replyTo(api, event, 'হুম baby, বলো—কি নিয়ে কথা বলবে?');
    }

    if (text === 'list' || text === 'all') {
      const tone = getUserTone(event.senderID) || 'auto/neutral';
      return api.sendMessage(`🧠 Local taught messages: ${listTeach()}\n🎭 Your chat tone: ${tone}`, event.threadID, event.messageID);
    }

    if (text === 'stylelist') {
      const data = styleList(event.senderID);
      const header = `🎨 Your style phrases (${data.count}/${data.limit}):`;
      const body = data.count ? data.phrases.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'তুমি এখনো কোনো style phrase শেখাও নি।';
      return api.sendMessage(`${header}\n${body}`, event.threadID, event.messageID);
    }

    if (text.startsWith('tone ')) {
      const tone = text.replace(/^tone\s+/i, '').trim();
      const result = setUserTone(event.senderID, tone);
      return api.sendMessage(`${result.message}\nTip: tone female হলে শুধু আপনার ID-র জন্য softer style হবে; male/unknown users safe neutral থাকবে।`, event.threadID, event.messageID);
    }

    if (text.startsWith('remove ') || text.startsWith('rm ')) {
      const target = raw.replace(/^(remove|rm)\s+/i, '').split(' - ')[0];
      const result = removeTeach(target);
      return api.sendMessage(result.message, event.threadID, event.messageID);
    }

    if (text.startsWith('styleremove ')) {
      const phrase = raw.replace(/^styleremove\s+/i, '');
      const result = styleRemove(event.senderID, phrase);
      return api.sendMessage(result.message, event.threadID, event.messageID);
    }

    if (text.startsWith('teach ')) {
      const payload = raw.replace(/^teach\s+/i, '');
      const [question, replies] = payload.split(' - ');
      const result = teach(question, replies, event.senderID);
      return api.sendMessage(result.message, event.threadID, event.messageID);
    }

    if (text.startsWith('styleteach ')) {
      const phrase = raw.replace(/^styleteach\s+/i, '');
      const result = styleTeach(event.senderID, phrase);
      return api.sendMessage(result.message, event.threadID, event.messageID);
    }

    if (text.startsWith('msg ') || text.startsWith('message ')) {
      return api.sendMessage('এই version-এ local teach store use হচ্ছে। Reply দেখতে normal message পাঠান।', event.threadID, event.messageID);
    }

    return handleConversation({ api, event, text: raw, Users });
  } catch (e) {
    console.error('Error in baby command:', e);
    return api.sendMessage(`⚠️ Conversation error: ${e.message}`, event.threadID, event.messageID);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply, Users }) {
  try {
    if (event.type !== 'message_reply') return;
    if (handleReply?.author && String(handleReply.author) !== String(event.senderID)) return;
    const text = String(event.body || '').trim();
    if (!text) return;
    return handleConversation({ api, event, text, Users });
  } catch (err) {
    return api.sendMessage(`⚠️ Conversation error: ${err.message}`, event.threadID, event.messageID);
  }
};

module.exports.handleEvent = async function ({ api, event, Users }) {
  try {
    const body = String(event.body || '').trim();
    if (!body) return;

    const botID = typeof api.getCurrentUserID === 'function' ? String(api.getCurrentUserID()) : '';
    const mentionedBot = botID && event.mentions && Object.prototype.hasOwnProperty.call(event.mentions, botID);
    const trigger = /^(baby|bby|bot|fun boy|funboy)\b/i.test(body) || mentionedBot;
    if (!trigger) return;

    const text = body.replace(/^(baby|bby|bot|fun boy|funboy)\b/i, '').replace(new RegExp(`@?${botID}`, 'g'), '').trim();
    return handleConversation({ api, event, text: text || 'hi', Users });
  } catch (err) {
    return api.sendMessage(`⚠️ Conversation error: ${err.message}`, event.threadID, event.messageID);
  }
};
