module.exports = function ({ api, models, Users, Threads, Currencies }) {
  const logger = require('../../utils/log.js');
  const moment = require('moment-timezone');

  return function ({ event }) {
    const timeStart = Date.now();
    const time = moment.tz('Asia/Dhaka').format('HH:mm:ss L');
    const { userBanned, threadBanned } = global.data;
    const { events } = global.client;
    const { allowInbox, DeveloperMode } = global.config;
    let { senderID, threadID } = event;

    senderID = String(senderID);
    threadID = String(threadID);

    if (userBanned.has(senderID) || threadBanned.has(threadID) || (allowInbox === false && senderID === threadID)) return;
    if (event.type === 'change_thread_image') event.logMessageType = 'change_thread_image';

    for (const [key, value] of events.entries()) {
      if (!value?.config?.eventType || value.config.eventType.indexOf(event.logMessageType) === -1) continue;

      const eventRun = events.get(key);
      try {
        eventRun.run({
          api,
          event,
          models,
          Users,
          Threads,
          Currencies
        });
        if (DeveloperMode === true) {
          logger(global.getText('handleEvent', 'executeEvent', time, eventRun.config.name, threadID, Date.now() - timeStart), '[ Event ]');
        }
      } catch (error) {
        logger(global.getText('handleEvent', 'eventError', eventRun.config.name, error.stack || error.message || String(error)), 'error');
      }
    }
  };
};
