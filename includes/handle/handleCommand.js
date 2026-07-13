module.exports = function ({ api, models, Users, Threads, Currencies }) {
  const stringSimilarity = require('string-similarity');
  const logger = require('../../utils/log.js');
  const moment = require('moment-timezone');

  const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return async function ({ event }) {
    const dateNow = Date.now();
    const time = moment.tz('Asia/Dhaka').format('HH:mm:ss DD/MM/YYYY');
    const { allowInbox, PREFIX, ADMINBOT, NDH, DeveloperMode } = global.config;
    const { userBanned, threadBanned, threadInfo, threadData, commandBanned } = global.data;
    const { commands } = global.client;
    let { body, senderID, threadID, messageID } = event;

    if (typeof body !== 'string') return;

    senderID = String(senderID);
    threadID = String(threadID);

    const threadSetting = threadData.get(threadID) || {};
    const activePrefix = threadSetting.hasOwnProperty('PREFIX') ? threadSetting.PREFIX : PREFIX;
    const prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(activePrefix)})\\s*`);
    if (!prefixRegex.test(body)) return;

    const adminbot = require('../../config.json');
    const isBotAdmin = ADMINBOT.includes(senderID);
    const isSupport = NDH.includes(senderID);

    if (!global.data.allThreadID.includes(threadID) && !isBotAdmin && adminbot.adminPaOnly === true) {
      return api.sendMessage('MODE » Only admins can use bots in their own inbox', threadID, messageID);
    }

    if (!isBotAdmin && adminbot.adminOnly === true) {
      return api.sendMessage('MODE » Only admins can use bots', threadID, messageID);
    }

    if (!isSupport && !isBotAdmin && adminbot.ndhOnly === true) {
      return api.sendMessage('MODE » Only bot support can use bots', threadID, messageID);
    }

    let threadInf = threadInfo.get(threadID);
    try {
      threadInf = threadInf || await Threads.getInfo(threadID);
    } catch (error) {
      logger(`Cannot get thread info for ${threadID}: ${error.message}`, '[ Thread Info ]');
      threadInf = { adminIDs: [] };
    }

    let dataAdbox = { adminbox: {} };
    try {
      dataAdbox = require('../../Script/commands/cache/data.json');
    } catch (_) {
      // Optional cache file; keep command handling alive if it is missing/corrupt.
    }

    const findd = Array.isArray(threadInf.adminIDs) ? threadInf.adminIDs.find((el) => el.id == senderID) : null;
    if (dataAdbox.adminbox?.hasOwnProperty(threadID) && dataAdbox.adminbox[threadID] === true && !isBotAdmin && !findd && event.isGroup === true) {
      return api.sendMessage('MODE » Only admins can use bots', event.threadID, event.messageID);
    }

    if (userBanned.has(senderID) || threadBanned.has(threadID) || (allowInbox === false && senderID === threadID)) {
      if (!isBotAdmin) {
        if (userBanned.has(senderID)) {
          const { reason, dateAdded } = userBanned.get(senderID) || {};
          return api.sendMessage(global.getText('handleCommand', 'userBanned', reason, dateAdded), threadID, async (_err, info) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        }

        if (threadBanned.has(threadID)) {
          const { reason, dateAdded } = threadBanned.get(threadID) || {};
          return api.sendMessage(global.getText('handleCommand', 'threadBanned', reason, dateAdded), threadID, async (_err, info) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        }
      }
    }

    const [matchedPrefix] = body.match(prefixRegex);
    const args = body.slice(matchedPrefix.length).trim().split(/ +/).filter(Boolean);
    const commandName = String(args.shift() || '').toLowerCase();
    if (!commandName) return;

    let command = commands.get(commandName);
    if (!command) {
      const allCommandName = [...commands.keys()];
      if (allCommandName.length === 0) return api.sendMessage('No commands are currently loaded.', threadID, messageID);

      const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
      if (checker.bestMatch.rating >= 0.5) {
        command = global.client.commands.get(checker.bestMatch.target);
      } else {
        return api.sendMessage(global.getText('handleCommand', 'commandNotExist', checker.bestMatch.target), threadID, messageID);
      }
    }

    if (!command || !command.config || typeof command.run !== 'function') {
      return api.sendMessage(`Command "${commandName}" is not loaded correctly.`, threadID, messageID);
    }

    if (commandBanned.get(threadID) || commandBanned.get(senderID)) {
      if (!isBotAdmin) {
        const banThreads = commandBanned.get(threadID) || [];
        const banUsers = commandBanned.get(senderID) || [];
        if (banThreads.includes(command.config.name)) {
          return api.sendMessage(global.getText('handleCommand', 'commandThreadBanned', command.config.name), threadID, async (_err, info) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        }
        if (banUsers.includes(command.config.name)) {
          return api.sendMessage(global.getText('handleCommand', 'commandUserBanned', command.config.name), threadID, async (_err, info) => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return api.unsendMessage(info.messageID);
          }, messageID);
        }
      }
    }

    if (String(command.config.commandCategory || '').toLowerCase() === 'nsfw' && !global.data.threadAllowNSFW.includes(threadID) && !isBotAdmin) {
      return api.sendMessage(global.getText('handleCommand', 'threadNotAllowNSFW'), threadID, async (_err, info) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return api.unsendMessage(info.messageID);
      }, messageID);
    }

    let threadInfoForPerm = threadInf;
    if (event.isGroup === true) {
      try {
        threadInfoForPerm = threadInfo.get(threadID) || await Threads.getInfo(threadID);
        if (!threadInfoForPerm || Object.keys(threadInfoForPerm).length === 0) throw new Error('empty thread info');
      } catch (err) {
        logger(global.getText('handleCommand', 'cantGetInfoThread', err.message || 'error'));
        threadInfoForPerm = { adminIDs: [] };
      }
    }

    let permssion = 0;
    const find = Array.isArray(threadInfoForPerm.adminIDs) ? threadInfoForPerm.adminIDs.find((el) => el.id == senderID) : null;
    if (isSupport) permssion = 2;
    if (isBotAdmin) permssion = 3;
    else if (!isBotAdmin && !isSupport && find) permssion = 1;

    if ((command.config.hasPermssion || 0) > permssion) {
      return api.sendMessage(global.getText('handleCommand', 'permssionNotEnough', command.config.name), event.threadID, event.messageID);
    }

    if (!global.client.cooldowns.has(command.config.name)) global.client.cooldowns.set(command.config.name, new Map());
    const timestamps = global.client.cooldowns.get(command.config.name);
    const expirationTime = (command.config.cooldowns || 1) * 1000;
    if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime) {
      return api.sendMessage(`You just used this command. Try again in ${((timestamps.get(senderID) + expirationTime - dateNow) / 1000).toFixed(1)} seconds.`, threadID, messageID);
    }

    let getText2;
    if (command.languages && typeof command.languages === 'object' && command.languages.hasOwnProperty(global.config.language)) {
      getText2 = (...values) => {
        let lang = command.languages[global.config.language][values[0]] || '';
        for (let i = values.length; i > 0; i -= 1) {
          lang = lang.replace(RegExp(`%${i}`, 'g'), values[i]);
        }
        return lang;
      };
    } else {
      getText2 = () => {};
    }

    try {
      await command.run({
        api,
        event,
        args,
        models,
        Users,
        Threads,
        Currencies,
        permssion,
        getText: getText2
      });
      timestamps.set(senderID, dateNow);
      if (DeveloperMode === true) {
        logger(global.getText('handleCommand', 'executeCommand', time, commandName, senderID, threadID, args.join(' '), Date.now() - dateNow), '[ DEV MODE ]');
      }
    } catch (e) {
      logger(`Command ${commandName} failed: ${e.stack || e}`, '[ Command Error ]');
      return api.sendMessage(global.getText('handleCommand', 'commandError', commandName, e.message || e), threadID, messageID);
    }
  };
};
