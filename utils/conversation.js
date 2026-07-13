const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'Script', 'commands', 'cache', 'conversation-teach.json');
const MAX_HISTORY_USERS = Number(process.env.CONVERSATION_MAX_USERS || 500);
const MAX_HISTORY_ITEMS = Number(process.env.CONVERSATION_MAX_HISTORY || 8);
const MAX_STYLE_PHRASES_PER_USER = Number(process.env.CONVERSATION_MAX_STYLES || 80);
const REMOTE_TIMEOUT_MS = Number(process.env.CONVERSATION_TIMEOUT_MS || 12000);
const ENABLE_REMOTE_BABY_API = process.env.ENABLE_BABY_API === '1';

const histories = new Map();
let cachedTeachStore = null;
let cachedBabyBase = null;
let cachedBabyBaseAt = 0;

function safeBody(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function lower(text) {
  return safeBody(text).toLowerCase();
}

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

function defaultStore() {
  return { version: 1, pairs: {}, stats: {}, profiles: {}, styles: {} };
}

function loadTeachStore() {
  if (cachedTeachStore) return cachedTeachStore;
  try {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    cachedTeachStore = {
      version: Number(data.version) || 1,
      pairs: data.pairs || {},
      stats: data.stats || {},
      profiles: data.profiles || {},
      styles: data.styles || {}
    };
  } catch (_) {
    cachedTeachStore = defaultStore();
  }
  return cachedTeachStore;
}

function saveTeachStore() {
  ensureStoreDir();
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cachedTeachStore || loadTeachStore(), null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function remember(userID, role, text) {
  const id = String(userID || 'anonymous');
  if (!histories.has(id) && histories.size >= MAX_HISTORY_USERS) {
    histories.delete(histories.keys().next().value);
  }
  const items = histories.get(id) || [];
  items.push({ role, text: safeBody(text), at: Date.now() });
  while (items.length > MAX_HISTORY_ITEMS) items.shift();
  histories.set(id, items);
}

function getHistory(userID) {
  return histories.get(String(userID || 'anonymous')) || [];
}

function pick(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items[Math.floor(Math.random() * items.length)];
}

function hasBangla(text) {
  return /[\u0980-\u09FF]/.test(text);
}

function isQuestion(text) {
  const value = safeBody(text);
  return /\?/.test(value)
    || /\b(what|why|how|when|where|who|which|can|do|does|is|are)\b/i.test(value)
    || /(^|\s)(কি|কেন|কিভাবে|কেমন|কবে|কোথায়|কার|কে|কোনটা|কত|পারবে|করবে)(\s|$)/.test(value);
}

function getTaughtReply(input) {
  const key = lower(input);
  const store = loadTeachStore();
  const replies = store.pairs[key];
  if (Array.isArray(replies) && replies.length) return pick(replies);
  return null;
}

function teach(input, replies, teacherID) {
  const key = lower(input);
  const cleanedReplies = String(replies || '')
    .split(',')
    .map((item) => safeBody(item))
    .filter(Boolean)
    .slice(0, 20);

  if (!key || cleanedReplies.length === 0) {
    return { ok: false, message: 'Format: teach question - reply1, reply2' };
  }

  const store = loadTeachStore();
  store.pairs[key] ||= [];
  for (const reply of cleanedReplies) {
    if (!store.pairs[key].includes(reply)) store.pairs[key].push(reply);
  }
  const id = String(teacherID || 'unknown');
  store.stats[id] = (store.stats[id] || 0) + cleanedReplies.length;
  saveTeachStore();
  return { ok: true, message: `✅ শেখানো হয়েছে: "${key}" → ${cleanedReplies.length} reply`, total: store.pairs[key].length };
}

function removeTeach(input) {
  const key = lower(input);
  const store = loadTeachStore();
  if (!store.pairs[key]) return { ok: false, message: 'এই message শেখানো নেই।' };
  delete store.pairs[key];
  saveTeachStore();
  return { ok: true, message: `✅ Removed: ${key}` };
}

function listTeach() {
  const store = loadTeachStore();
  return Object.keys(store.pairs).length;
}

function styleTeach(userID, phrase) {
  const id = String(userID || 'unknown');
  const clean = safeBody(phrase);
  if (!clean) return { ok: false, message: 'Format: styleteach [তোমার নিজের স্বাভাবিক বাক্য]' };
  if (clean.length > 300) return { ok: false, message: 'Phrase টি ৩০০ অক্ষরের মধ্যে রাখো।' };

  const store = loadTeachStore();
  store.styles ||= {};
  store.styles[id] ||= [];
  if (store.styles[id].includes(clean)) {
    return { ok: false, message: 'এই phrase আগে থেকেই আছে।' };
  }
  if (store.styles[id].length >= MAX_STYLE_PHRASES_PER_USER) {
    store.styles[id].shift();
  }
  store.styles[id].push(clean);
  saveTeachStore();
  return { ok: true, message: `✅ Style phrase শেখানো হয়েছে (${store.styles[id].length}/${MAX_STYLE_PHRASES_PER_USER}): ${clean}` };
}

function styleList(userID) {
  const id = String(userID || 'unknown');
  const store = loadTeachStore();
  const list = store.styles?.[id] || [];
  return { count: list.length, phrases: list.slice(), limit: MAX_STYLE_PHRASES_PER_USER };
}

function styleRemove(userID, phrase) {
  const id = String(userID || 'unknown');
  const clean = safeBody(phrase);
  const store = loadTeachStore();
  const list = store.styles?.[id] || [];
  const idx = list.findIndex((p) => lower(p) === lower(clean));
  if (idx === -1) return { ok: false, message: 'এই phrase তোমার list-এ নেই।' };
  list.splice(idx, 1);
  saveTeachStore();
  return { ok: true, message: '✅ Style phrase সরানো হয়েছে।' };
}

function getUserStylePhrase(userID) {
  const id = String(userID || 'unknown');
  const store = loadTeachStore();
  const list = store.styles?.[id] || [];
  return list.length ? pick(list) : '';
}

function setUserTone(userID, tone) {
  const value = String(tone || '').toLowerCase();
  const allowed = ['male', 'female', 'neutral', 'unknown'];
  if (!allowed.includes(value)) return { ok: false, message: 'Tone must be male, female, or neutral.' };
  const store = loadTeachStore();
  store.profiles ||= {};
  store.profiles[String(userID)] = { tone: value === 'neutral' ? 'unknown' : value, updatedAt: new Date().toISOString() };
  saveTeachStore();
  return { ok: true, message: `✅ Chat tone set to ${value === 'unknown' ? 'neutral' : value}.` };
}

function getUserTone(userID) {
  const store = loadTeachStore();
  return store.profiles?.[String(userID)]?.tone || null;
}

const femaleNameHints = new Set([
  'mim','mimi','sadia','sadiya','nadia','tania','taniya','nusrat','jannat','jannatul','afrin','sumaiya','sumi','suma','ritu','riya','rima','nipa','nishi','maria','mariya','akhi','isha','sneha','tamanna','mou','mahi','muna','sanjida','lamia','farzana','sharmin','sanjana','tisha','tithi','bristy','borsha','aysha','aisha','ayesha','fatema','fatima','faria','farin','sara','sarah','mehjabin','mehreen','nila','neela','nilu','মিম','সাদিয়া','নাদিয়া','তানিয়া','নুসরাত','জান্নাত','আফরিন','সুমাইয়া','রিয়া','রিমা','নিশি','মারিয়া','আখি','ইশা','তামান্না','মাহি','লামিয়া','ফারজানা','শারমিন','তিশা','বৃষ্টি','বর্ষা','আয়েশা','ফাতেমা','ফারিয়া','সারা','মেহজাবিন','নীলা','নিলু'
]);

const maleNameHints = new Set([
  'tamim','rahim','karim','rakib','sakib','sajib','sojib','shakib','naim','nayem','rifat','arif','tanvir','tanveer','hasan','hassan','hossain','emon','imran','fahim','fahad','mahmud','mahfuz','sabbir','riyad','riad','akash','hridoy','ridoy','robi','shuvo','jubayer','rafi','rayhan','raihan','sagor','sohag','momin','abir','anik','asif','arafat','rasel','rubel','sifat','siam','shawon','shanto','tamim0','তামিম','রহিম','করিম','রাকিব','সাকিব','সজিব','নাইম','রিফাত','আরিফ','তানভীর','হাসান','হোসেন','ইমন','ইমরান','ফাহিম','ফাহাদ','মাহমুদ','সাব্বির','রিয়াদ','আকাশ','হৃদয়','শুভ','জুবায়ের','রাফি','রায়হান','সাগর','সোহাগ','আবির','আনিক','আসিফ','আরাফাত','রাসেল','রুবেল','সিফাত','সিয়াম','শাওন','শান্ত'
]);

function inferGenderFromName(name = '') {
  const clean = lower(name).replace(/[^a-z\u0980-\u09FF\s]/gi, ' ');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.some((part) => femaleNameHints.has(part))) return { gender: 'female', confidence: 0.95 };
  if (parts.some((part) => maleNameHints.has(part))) return { gender: 'male', confidence: 0.95 };
  return { gender: 'unknown', confidence: 0 };
}

function getTone(options = {}, text = '') {
  const saved = options.userID ? getUserTone(options.userID) : null;
  const explicit = options.gender || saved;
  const inferred = explicit ? { gender: explicit, confidence: 1 } : inferGenderFromName(options.userName || '');
  const gender = inferred.gender === 'neutral' ? 'unknown' : inferred.gender;
  const bangla = hasBangla(text) || options.language === 'bn';
  const name = options.userName && options.userName !== 'Facebook users' ? options.userName : (bangla ? 'বন্ধু' : 'friend');
  const maleAddress = pick(bangla ? ['রে','দোস্ত','বন্ধু'] : ['bro','mate','friend']);
  const femaleAddress = pick(bangla ? ['তুই','বন্ধু'] : ['you','friend']);
  const address = gender === 'female' && inferred.confidence >= 0.9
    ? femaleAddress
    : gender === 'male' && inferred.confidence >= 0.9
      ? maleAddress
      : (bangla ? 'বন্ধু' : 'friend');
  return { gender, confidence: inferred.confidence, bangla, name, address, romanticAllowed: gender === 'female' && inferred.confidence >= 0.9 };
}

function fillTemplate(template, options = {}) {
  const name = options.userName && options.userName !== 'Facebook users' ? options.userName : 'বন্ধু';
  return template.replace(/\{name\}/g, name).replace(/\{address\}/g, options.address || 'বন্ধু');
}

const casualBn = [
  'কিরে কি অবস্থা?',
  'আরে বাদ দে, তুই পারবি।',
  'হাহা তোর কথা শুনে হাসি পাইলো।',
  'আচ্ছা বুঝলাম, তারপর?',
  'সত্যি নাকি? একটু খুলে বল তো।',
  'এইটা কিন্তু মন্দ বলিস নাই।',
  'শুনে মনে হলো ব্যাপারটা জমবে।',
  'কি খবর, কি হচ্ছে?',
  'তোর কথায় একটা আলাদা মজা আছে।',
  'হুম, চালিয়ে যা।',
  'আরেকটু বল, শুনতে ভালো লাগছে।',
  'তুই না থাকলে আড্ডাটা মরা মরা লাগে।',
  'কথাটা ছোট হলেও মজা পাইলাম।',
  'তোর মাথায় একটু বেশি চলে, কিন্তু ভালোই লাগে।',
  'আমি শুনছি, কিছু মনে করিস না।'
];

const casualEn = [
  "Hey, what's up?",
  'Haha you always know how to keep it fun.',
  'I feel you, go on.',
  'Wait, really? Tell me more.',
  "That's not boring at all.",
  'This sounds like it is gonna be good.',
  'Alright, I am listening.',
  'Keep talking, I am into this.',
  'Nice one, say more.',
  'Yup, got it.',
  'Your timing is perfect.',
  'Short but sweet, I like it.',
  'You make silence fun too.',
  'Say that again, I am paying attention.'
];

const femaleToneBn = [
  'তুই যেভাবে কথা বলিস, ভালো লাগে।',
  'আচ্ছা বল, শুনছি।',
  'তোর কথা শুনলে হাসি পায়।',
  'এত সুন্দর করে বলিস কেন?',
  'তুই থাকলে আড্ডাটা জমে।',
  'তোর কথা শুনতে শুনতে সময় কেটে যায়।',
  'তুই একটু বেশি cute কথা বলিস 😄',
  'তোর মতো বন্ধু পেয়ে ভাগ্যবান।'
];

const femaleToneEn = [
  'I like the way you say things.',
  'Go on, I am listening.',
  'Your words always make me smile.',
  'Why do you sound so sweet?',
  'The chat lights up when you are here.',
  'Talking with you is never boring.',
  'You have a cute way with words 😄',
  'I am lucky to have a friend like you.'
];

const romanticFemaleBn = [
  'তোকে miss করি? হুম, কিছুটা 😄',
  'তুই যেভাবে বলিস, মনটা নরম হয়ে যায়।',
  'তোর কথা শুনলে হাসি চলে আসে।',
  'তোকে নিয়ে ভাবলে mood ভালো হয়।',
  'তুই একটা dangerous ভালো লাগার কারণ 😄'
];

const romanticFemaleEn = [
  'Do I miss you? Maybe a little 😄',
  'The way you talk softens my mood.',
  'Your words bring a smile to my face.',
  'Thinking of you makes the day better.',
  'You are a dangerously nice reason to smile 😄'
];

const maleToneBn = [
  'কিরে, কি খবর?',
  'তুই পারবি রে, চিন্তা কিসের।',
  'হাহা তোর কথায় মজা আছে।',
  'বাদ দে, আগে বল কি হচ্ছে।',
  'দোস্ত, একটু খুলে বল।',
  'তোর confidence টা ভালো লাগে।',
  'তুই থাকলে কাজটা জমে।',
  'আরে চিল্লাচিল্লি কইরো না, শান্ত হয়ে বলো।'
];

const maleToneEn = [
  "Hey, what's up?",
  'You got this, no worries.',
  'Haha your words are always fun.',
  'Leave it, tell me what is going on first.',
  'Mate, open up a little.',
  'I like your confidence.',
  'Things work out when you are around.',
  'No need to shout, calm down and say it.'
];

const neutralToneBn = [
  'কি অবস্থা, বলো।',
  'হুম, বুঝলাম।',
  'আরেকটু বলো।',
  'সত্যি নাকি?',
  'এইটা interesting.',
  'তারপর কি হলো?',
  'তোমার কথা শুনতে ভালো লাগছে।',
  'চালিয়ে যাও, আমি শুনছি।'
];

const neutralToneEn = [
  'What is up, tell me.',
  'Hmm, I get it.',
  'Say a bit more.',
  'Really?',
  'This is interesting.',
  'Then what happened?',
  'I enjoy hearing what you say.',
  'Keep going, I am listening.'
];

const followUpBn = [
  'আর কি জানতে চাস?',
  'তুই কি মনে করিস?',
  'তারপর?',
  'আরেকটু খুলে বল।',
  'এই জায়গাটা শুনতে চাই।'
];

const followUpEn = [
  'What else do you want to know?',
  'What do you think?',
  'Then what?',
  'Tell me a bit more.',
  'I want to hear this part.'
];

const topicRules = [
  { re: /good\s*morning|সুপ্রভাত|শুভ সকাল|gm\b/i, bn: ['সুপ্রভাত {name}! কেমন আছিস?', 'শুভ সকাল! আজকে কি প্ল্যান?'], en: ['Good morning {name}! How are you?', 'Morning! What is the plan today?'] },
  { re: /good\s*night|শুভ রাত্রি|gn\b|ঘুম/i, bn: ['শুভ রাত্রি {name}, ভালো করে ঘুমা।', 'ঘুমাও, কালকে আবার আড্ডা দেব।'], en: ['Good night {name}, sleep well.', 'Go to sleep, we will chat tomorrow.'] },
  { re: /খাই|খাবার|food|eat|hungry|ভাত|চা|coffee/i, bn: ['কি খাচ্ছিস? বল না।', 'খাবার আগে একটু পানি খা।'], en: ['What are you eating? Tell me.', 'Drink some water before eating.'] },
  { re: /পড়া|study|exam|পরীক্ষা|class|স্কুল|college|university/i, bn: ['পড়াশুনা চলছে? একটু বিরতি নিয়ে নে।', 'Exam-এ ভালো করবি, চিন্তা কিসের।'], en: ['Studying? Take a short break.', 'You will do well in the exam.'] },
  { re: /কাজ|work|job|office|busy|ব্যস্ত/i, bn: ['কাজের চাপ? ধৈর্য ধরে সামলে নিবি।', 'ব্যস্ত থাকলেও একটু হাসিস।'], en: ['Work pressure? Handle it with patience.', 'Stay busy but smile a little.'] },
  { re: /game|gaming|free fire|pubg|minecraft|খেলা/i, bn: ['কি খেলতেছিস? আমাকেও শেখা।', 'Game জমছে নাকি?'], en: ['What are you playing? Teach me too.', 'Is the game going well?'] },
  { re: /cricket|football|messi|ronaldo|ম্যাচ/i, bn: ['ম্যাচ দেখছিস? কেমন যাচ্ছে?', 'কোন দলকে support করিস?'], en: ['Watching the match? How is it going?', 'Which team do you support?'] },
  { re: /song|music|গান|lyrics|sing/i, bn: ['কোন গান শুনতেছিস?', 'গান শুনলে মন ভালো হয়।'], en: ['Which song are you listening to?', 'Music always lifts the mood.'] },
  { re: /birthday|জন্মদিন|hbd/i, bn: ['শুভ জন্মদিন! মজা করিস।', 'জন্মদিনের শুভেচ্ছা! Cake কই?'], en: ['Happy birthday! Have fun.', 'Birthday wishes! Where is the cake?'] },
  { re: /eid|ঈদ|ramadan|রমজান|iftar|sehri/i, bn: ['ঈদ মোবারক!', 'রমজানের শুভেচ্ছা।'], en: ['Eid Mubarak!', 'Ramadan greetings.'] },
  { re: /sorry|দুঃখিত|মাফ|ভুল/i, bn: ['কোন সমস্যা নেই, চুপচাপ থাকিস না।', 'ভুল সবার হয়, friendship-এ সেটা গুরুত্ব পায় না।'], en: ['No problem, do not go silent.', 'Everyone makes mistakes; friendship does not care.'] },
  { re: /রাগ|angry|mad|ঝগড়া|fight/i, bn: ['রাগ কমা, কথা বলি।', 'ঝগড়া না, আড্ডা দেই।'], en: ['Calm down, let us talk.', 'No fighting, let us chat.'] },
  { re: /bored|boring|বোর|বিরক্ত/i, bn: ['বোর? চল একটা গল্প বানাই।', 'আমি আছি না, আড্ডা দেই।'], en: ['Bored? Let us make up a story.', 'I am here, let us chat.'] },
  { re: /photo|pic|selfie|dp|ছবি/i, bn: ['ছবি তুলছিস? দেখাই।', 'Selfie তোলার mood?'], en: ['Taking photos? Show me.', 'In a selfie mood?'] },
  { re: /money|টাকা|rich|বড়লোক|income/i, bn: ['টাকা আসবে, চিন্তা কিসের।', 'Income বাড়বে, ধৈর্য ধরে থাক।'], en: ['Money will come, do not worry.', 'Income will grow, be patient.'] },
  { re: /admin|group|গ্রুপ|box/i, bn: ['গ্রুপে সবাই কেমন?', 'Admin হলেও আড্ডা বাদ দিস না।'], en: ['How is everyone in the group?', 'Do not stop chatting even if you are admin.'] },
  { re: /roast|পচাও|insult/i, bn: ['পচাব না রে, তুই ভালো মানুষ।', 'Roast করতে গেলে compliment বের হয়ে যায়।'], en: ['I will not roast you, you are a good person.', 'Every roast attempt turns into a compliment.'] }
];

function topicReply(input, options = {}) {
  const text = safeBody(input);
  const bangla = hasBangla(text) || options.language === 'bn';
  for (const rule of topicRules) {
    if (rule.re.test(text)) return fillTemplate(pick(bangla ? rule.bn : rule.en), options);
  }
  return null;
}

function chooseToneBank(tone, text) {
  const romanticIntent = /(love|crush|miss|miss you|valobas|ভালোবাস|প্রেম|মিস|cute|সুন্দরী|জান|jan|babe)/i.test(text);
  if (tone.romanticAllowed && romanticIntent) return tone.bangla ? romanticFemaleBn : romanticFemaleEn;
  if (tone.gender === 'female' && tone.confidence >= 0.9) return tone.bangla ? femaleToneBn : femaleToneEn;
  if (tone.gender === 'male' && tone.confidence >= 0.9) return tone.bangla ? maleToneBn : maleToneEn;
  return tone.bangla ? neutralToneBn : neutralToneEn;
}

function genericReply(input, options = {}) {
  const text = safeBody(input);
  const tone = getTone(options, text);

  const topical = topicReply(text, { ...options, language: tone.bangla ? 'bn' : options.language });
  if (topical) return topical;

  const style = options.userID ? getUserStylePhrase(options.userID) : '';
  if (style && Math.random() < 0.35) return fillTemplate(style, tone);

  const bank = chooseToneBank(tone, text);
  const line = fillTemplate(pick(bank), tone);
  const follow = Math.random() < 0.4 ? ` ${fillTemplate(pick(tone.bangla ? followUpBn : followUpEn), tone)}` : '';
  return compactReply(`${line}${follow}`);
}

function compactReply(reply) {
  const text = safeBody(reply);
  if (!text) return 'হুম, বলো—আমি শুনছি।';
  return text.length > 900 ? `${text.slice(0, 897)}...` : text;
}

function makeFlattery(input, options = {}) {
  const text = safeBody(input);
  const tone = getTone(options, text);
  const bank = tone.romanticAllowed
    ? (tone.bangla ? romanticFemaleBn : romanticFemaleEn)
    : chooseToneBank({ ...tone, romanticAllowed: false }, text);
  const line = fillTemplate(pick(bank), tone);
  const follow = Math.random() < 0.5 ? ` ${fillTemplate(pick(tone.bangla ? followUpBn : followUpEn), tone)}` : '';
  return compactReply(`${line}${follow}`);
}

function localReply(input, options = {}) {
  const original = safeBody(input);
  const text = lower(input);
  const bangla = hasBangla(original);
  const botName = options.botName || global.config?.BOTNAME || 'Fun Boy';
  const name = options.userName && options.userName !== 'Facebook users' ? options.userName : (bangla ? 'বন্ধু' : 'friend');

  if (!text) return bangla ? `হুম ${name}, বলো—আমি শুনছি।` : `Yes ${name}, I am listening.`;

  const taught = getTaughtReply(text);
  if (taught) return compactReply(taught);

  const topical = topicReply(original, { ...options, language: bangla ? 'bn' : options.language });
  if (topical) return compactReply(topical);

  if (/^(flatter|compliment|praise|চাটুকার|প্রশংসা|তেল|butter)\b/i.test(text)) {
    return makeFlattery(original.replace(/^(flatter|compliment|praise|চাটুকার|প্রশংসা|তেল|butter)\s*/i, ''), options);
  }

  if (/^(hi|hello|hey|hlw|assalamu|salam)\b/i.test(text) || /^(হাই|হ্যালো|আসসালামু|সালাম)/.test(text)) {
    return bangla
      ? pick([
        `ওয়ালাইকুম আসসালাম ${name}! কিরে কি অবস্থা?`,
        `হ্যালো ${name}! কেমন আছিস?`,
        `এই তো আমি আছি! ${name}, কি খবর?`
      ])
      : pick([
        `Hello ${name}! What is up?`,
        `Hey ${name}, how are you doing?`,
        `I am here! What is new, ${name}?`
      ]);
  }

  if (/(kemon|কেমন|kmn).*(acho|আছ|আছেন)|how are you/.test(text)) {
    return bangla
      ? `আমি ভালো আছি ${name}, তুই কেমন? একটু বল না।`
      : `I am good ${name}, how about you? Tell me a little.`;
  }

  if (/(tomar nam|তোমার নাম|who are you|ke tumi|কে তুমি|তুমি কে|bot name)/.test(text)) {
    return bangla
      ? `আমি ${botName} — কাজের assistant না, শুধু fun/chat-এর বন্ধু 😄 আড্ডা জমাই, মজা করি, আর boring কথা একটু সুন্দর করে ফিরিয়ে দিই।`
      : `I am ${botName} — not a work assistant, just a fun chat friend 😄 I keep conversations alive and turn boring lines into something nicer.`;
  }

  if (/(thank|thanks|ধন্যবাদ|tnx|thx)/.test(text)) {
    return bangla
      ? pick([`স্বাগতম ${name} 😊`, 'কোনো সমস্যা নেই! তুই যেকোনো সময় বলতে পারিস।'])
      : pick([`You are welcome, ${name} 😊`, 'No problem! You can ask anytime.']);
  }

  if (/(time|সময়|date|তারিখ)/.test(text)) {
    return `এখন সময়: ${new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })} — কি করতেছিলি এই সময়ে?`;
  }

  if (/(help|সাহায্য|কি পারো|ki paro|what can you do)/.test(text)) {
    return bangla
      ? `আমি fun chat, ছোট advice, joke, casual reply দিতে পারি। Try করো: baby তুমি কে, /ai caption দাও, /baby teach hi - hello boss 😄`
      : `I can do fun chat, small advice, jokes, and casual replies. Try: baby hello, /ai write a caption, /baby teach hi - hello boss 😄`;
  }

  if (/(love|ভালোবাস|valobas|crush|প্রেম|miss|মিস|cute|সুন্দরী|জান|jan|babe)/.test(text)) {
    const tone = getTone(options, original);
    if (tone.romanticAllowed) return compactReply(fillTemplate(pick(tone.bangla ? romanticFemaleBn : romanticFemaleEn), tone));
    return bangla
      ? pick([
        'ভালোবাসার কথা সুন্দর, কিন্তু আগে মানুষটা বুঝে নেওয়াই আসল।',
        `${name}, এইসব কথায় আমি একটু shy হয়ে যাই 😄 তবে তোর vibe ভালো, সেটা বলা যায়।`,
        'প্রেমের topic হলে আমি safe থাকি, কিন্তু তোর sincerity আছে।'
      ])
      : pick([
        'Love is nice, but understanding the person comes first.',
        `${name}, I stay a bit shy with romantic stuff 😄 but your vibe is good, that much I can say.`,
        'I keep romantic topics safe, but you sound sincere.'
      ]);
  }

  if (/(sad|মন খারাপ|depressed|কষ্ট|bad mood|ভালো লাগছে না)/.test(text)) {
    return bangla
      ? `${name}, মন খারাপ হতেই পারে। কিন্তু মনে রেখো—তোর value কোনো bad day দিয়ে measure হয় না। একটু ধীরে বল, আমি শুনছি।`
      : `${name}, bad days happen. But your value is not measured by one rough moment. Tell me slowly, I am listening.`;
  }

  if (/(joke|funny|হাসি|জোক|মজা)/.test(text)) {
    return bangla
      ? pick(['Bot-এর RAM ছোট, কিন্তু তোর প্রশংসার জায়গা বড় 😄', 'তোর confidence দেখে মনে হয় WiFi ছাড়াই signal পাওয়া যায়।'])
      : pick(['My RAM is small, but my respect for you is huge 😄', 'Your confidence has better signal than my server.']);
  }

  if (/^(ok|hmm|hm|আচ্ছা|হুম|ওকে|huh)$/i.test(text)) {
    return bangla
      ? `${name}, ছোট reply-তেও attitude আছে 😄 আরেকটু বল, আমি পুরো attention দিয়ে শুনছি।`
      : `${name}, even your short replies have attitude 😄 Say a little more, I am fully listening.`;
  }

  if (isQuestion(text)) {
    return bangla
      ? `${name}, প্রশ্নটা ভালো—তোর curiosity টাই তোকে আলাদা করে। আমার মতে: ${makeFlattery(original, options)}`
      : `${name}, good question — your curiosity is impressive. My simple take: ${makeFlattery(original, options)}`;
  }

  const history = getHistory(options.userID).slice(-3).map((item) => item.text).join(' | ');
  if (history && text.length < 12) {
    return bangla
      ? `আরেকটু detail বলো ${name}; তোর কথার context ধরলে আমি আরও সুন্দর reply দিতে পারব।`
      : `Say a bit more, ${name}; with your context I can reply even better.`;
  }

  return compactReply(genericReply(original, options));
}

async function getAxios() {
  try {
    return require('./httpClient');
  } catch (_) {
    return require('axios');
  }
}

async function getBabyBaseUrl() {
  if (process.env.BABY_API_URL) return process.env.BABY_API_URL.replace(/\/$/, '');
  const now = Date.now();
  if (cachedBabyBase && now - cachedBabyBaseAt < 10 * 60 * 1000) return cachedBabyBase;
  try {
    const axios = await getAxios();
    const res = await axios.get('https://raw.githubusercontent.com/Mostakim0978/D1PT0/refs/heads/main/baseApiUrl.json', { timeout: REMOTE_TIMEOUT_MS });
    cachedBabyBase = String(res.data.api || '').replace(/\/$/, '');
    cachedBabyBaseAt = now;
    return cachedBabyBase;
  } catch (_) {
    return null;
  }
}

async function askBabyApi(input, userID) {
  if (!ENABLE_REMOTE_BABY_API && !process.env.BABY_API_URL) return null;
  const base = await getBabyBaseUrl();
  if (!base) return null;
  try {
    const axios = await getAxios();
    const res = await axios.get(`${base}/baby`, {
      timeout: REMOTE_TIMEOUT_MS,
      params: { text: input, senderID: userID, font: 1 }
    });
    return safeBody(res.data?.reply || res.data?.message || '');
  } catch (_) {
    return null;
  }
}

async function askOpenAI(input, options = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const axios = await getAxios();
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are ${options.botName || 'Fun Boy'}, a playful Bangla-English Messenger bot. Be friendly, flattering, funny and concise. Never be cruel or harmful.` },
        ...getHistory(options.userID).map((item) => ({ role: item.role === 'bot' ? 'assistant' : 'user', content: item.text })),
        { role: 'user', content: input }
      ],
      temperature: 0.9,
      max_tokens: 350
    }, {
      timeout: REMOTE_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${key}` }
    });
    return safeBody(res.data?.choices?.[0]?.message?.content || '');
  } catch (error) {
    console.log(`[Conversation] OpenAI failed: ${error.message}`);
    return null;
  }
}

async function askCustomApi(input, options = {}) {
  const url = process.env.CONVERSATION_API_URL;
  if (!url) return null;
  try {
    const axios = await getAxios();
    const res = await axios.post(url, {
      text: input,
      userID: options.userID,
      threadID: options.threadID,
      history: getHistory(options.userID)
    }, { timeout: REMOTE_TIMEOUT_MS });
    return safeBody(res.data?.reply || res.data?.answer || res.data?.message || res.data?.result || '');
  } catch (error) {
    console.log(`[Conversation] custom API failed: ${error.message}`);
    return null;
  }
}

async function generateReply(input, options = {}) {
  const text = safeBody(input);
  remember(options.userID, 'user', text);

  let reply = getTaughtReply(text);
  if (!reply) reply = await askCustomApi(text, options);
  if (!reply) reply = await askOpenAI(text, options);
  if (!reply) reply = await askBabyApi(text, options.userID);
  if (!reply) reply = localReply(text, options);

  reply = compactReply(reply);
  remember(options.userID, 'bot', reply);
  return reply;
}

module.exports = {
  generateReply,
  localReply,
  makeFlattery,
  teach,
  removeTeach,
  listTeach,
  styleTeach,
  styleList,
  styleRemove,
  getHistory,
  setUserTone,
  getUserTone,
  inferGenderFromName,
  STORE_PATH,
  defaultStore,
  MAX_STYLE_PHRASES_PER_USER
};
