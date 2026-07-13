module.exports.config = {
  name: "imagesearch",
  version: "1.0.1",
  hasPermssion: 0,
  credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
  description: "Search an Image",
  commandCategory: "image",
  usages: "imagesearch [text]",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "googlethis": ""
  }
};

module.exports.run = async ({ event, api, args }) => {
  const axios = global.nodemodule['axios'] || require('axios');
  const google = global.nodemodule['googlethis'] || require('googlethis');
  const fs = global.nodemodule['fs-extra'] || require('fs-extra');

  try {
    const query = (event.type === 'message_reply') ? event.messageReply.body : args.join(' ');
    if (!query) return api.sendMessage('⚠️ Please enter a search keyword.', event.threadID, event.messageID);

    api.sendMessage(`🔎 Searching for ${query}...`, event.threadID, event.messageID);

    const result = await google.image(query, { safe: false });
    if (!Array.isArray(result) || result.length === 0) {
      return api.sendMessage('⚠️ Your image search did not return any result.', event.threadID, event.messageID);
    }

    const streams = [];
    let counter = 0;

    for (const image of result) {
      if (counter >= 6) break;
      const url = image.url;
      if (!url || !/\.(jpe?g|png|webp)(\?.*)?$/i.test(url)) continue;

      const filePath = `${__dirname}/cache/search-image-${counter}.jpg`;
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxContentLength: 8 * 1024 * 1024,
          maxBodyLength: 8 * 1024 * 1024,
          headers: { 'User-Agent': 'Mozilla/5.0 FunBoyBot/1.0' }
        });
        fs.writeFileSync(filePath, Buffer.from(response.data));
        streams.push(fs.createReadStream(filePath).on('end', () => {
          if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
        }));
        counter += 1;
      } catch (error) {
        console.log(`Image download failed: ${error.message}`);
      }
    }

    if (streams.length === 0) {
      return api.sendMessage('⚠️ Found results, but could not download any supported image.', event.threadID, event.messageID);
    }

    const msg = {
      body: `--------------------\nImage Search Result\n"${query}"\n\nFound: ${result.length} image${result.length > 1 ? 's' : ''}\nShowing: ${streams.length} image${streams.length > 1 ? 's' : ''}\n--------------------`,
      attachment: streams
    };

    return api.sendMessage(msg, event.threadID, event.messageID);
  } catch (e) {
    console.log(`ERR: ${e.stack || e}`);
    return api.sendMessage(`⚠️ ERR: ${e.message || e}`, event.threadID, event.messageID);
  }
};
