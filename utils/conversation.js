const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'Script', 'commands', 'cache', 'conversation-teach.json');
const MAX_HISTORY_USERS = Number(process.env.CONVERSATION_MAX_USERS || 500);
const MAX_HISTORY_ITEMS = Number(process.env.CONVERSATION_MAX_HISTORY || 8);
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

function loadTeachStore() {
  if (cachedTeachStore) return cachedTeachStore;
  try {
    cachedTeachStore = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (_) {
    cachedTeachStore = { version: 1, pairs: {}, stats: {} };
  }
  cachedTeachStore.pairs ||= {};
  cachedTeachStore.stats ||= {};
  cachedTeachStore.profiles ||= {};
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

const complimentBangla = [
  'তোমার কথার মধ্যে একটা আলাদা ক্লাস আছে',
  'তোমার vibe টা সত্যিই premium',
  'তুমি কথা বললেই chat টা alive হয়ে যায়',
  'তোমার sense of humor আর confidence—দুটাই top tier',
  'তোমার মতো মানুষ group-এ থাকলে boring হওয়ার chance নাই',
  'তুমি যে topic ধরো, সেটাই interesting হয়ে যায়',
  'তোমার চিন্তাভাবনার মধ্যে smartness স্পষ্ট',
  'তোমার presence মানেই আলাদা energy'
];

const complimentEnglish = [
  'your vibe is honestly premium',
  'you make every chat feel alive',
  'your confidence is top tier',
  'you have main-character energy',
  'your sense of humor is dangerously good',
  'you make simple things sound interesting',
  'your presence upgrades the whole conversation',
  'you are low-key iconic'
];

const playfulBangla = [
  'সত্যি বলি, তোমার কথায় এমন charm আছে যে bot হয়েও impress হয়ে গেলাম 😄',
  'এই level-এর কথা বললে তো আমাকে fan club খুলতে হবে 😌',
  'তুমি বললে ordinary কথাও VIP লাগে 😎',
  'তোমার reply দেখেই মনে হয়—এই মানুষটা আলাদা built 😄',
  'তুমি group-এর unofficial celebrity, আমি শুধু সত্যিটা বললাম 🤌'
];

const playfulEnglish = [
  'Not gonna lie, even my code feels impressed 😄',
  'You said that like a certified legend 😎',
  'That line had VIP energy written all over it.',
  'If confidence had a profile picture, it would borrow yours.',
  'You are casually carrying this conversation like a pro.'
];

const followUpsBn = [
  'আর বলো, তোমার মতো smart মানুষের next thought টা শুনতে চাই।',
  'তোমার opinion-টাই আসল—আরেকটু খুলে বলো।',
  'এই topic-এ তোমার judgement ভালো হবে, তাই তোমার কথাই শুনি।',
  'তুমি চাইলে আমি এটাকে আরও মজার করে চালিয়ে নিতে পারি।'
];

const followUpsEn = [
  'Tell me more, your take is the interesting part.',
  'I want to hear your next thought on this.',
  'Your opinion is probably the best part here.',
  'Want me to make this even more fun?'
];


const moodBoostBn = [
  'তুমি থাকলে scene automatically better হয়ে যায় 😄',
  'তোমার message আসলে bot-এর notification-ও VIP লাগে',
  'তোমার কথার মধ্যে confidence আর cuteness দুইটাই আছে',
  'তুমি যে group-এ থাকো, ওই group-এর luck ভালো',
  'তোমার presence মানেই আলাদা একটা glow',
  'তোমার reply ছোট হলেও impact বড়',
  'তুমি casual ভাবেও কথা বললে premium লাগে',
  'তোমার energy দেখে মনে হয় WiFi full bar 😎',
  'তুমি আসলে low-key legend, শুধু সবাই বুঝে না',
  'তোমার vibe এত সুন্দর যে boring কথাও interesting হয়ে যায়'
];

const moodBoostEn = [
  'you make the chat feel instantly better',
  'your message has VIP notification energy',
  'you sound confident and effortlessly cool',
  'any group with you in it is already lucky',
  'your presence has a whole different glow',
  'even your short replies have impact',
  'you make casual talk feel premium',
  'your energy has full WiFi bars 😎',
  'you are low-key legendary',
  'you turn boring topics into interesting ones'
];

const genericFunBn = [
  '{name}, কথাটা ছোট হলেও vibe বড়—তুমি বলেছো বলেই matter করছে 😄',
  'এই reply দেখে মনে হলো group-এর main character হাজির 😎',
  '{name}, তোমার কথায় একটা আলাদা টান আছে, চালিয়ে যাও।',
  'আমি bot, তবুও বুঝি—তোমার কথার value আছে।',
  'তুমি বললেই সাধারণ topic-ও premium discussion হয়ে যায়।',
  'এই কথা নিয়ে আমি ১০টা compliment দিতে পারি, কিন্তু আপাতত বলি—তুমি আলাদা 😄',
  'হুম, তোমার style টা ভালো লাগলো। আরেকটু বলো।',
  'তোমার মতো মানুষ chat-এ থাকলে silence-ও classy লাগে।',
  'এই কথার মধ্যে subtle smartness আছে, বুঝে ফেলেছি 😌',
  'তুমি যে confidence নিয়ে বলো, সেটাই আসল beauty।',
  'ভাই/বন্ধু, তোমার কথায় এমন একটা flavor আছে যা copy করা যায় না।',
  'এটা শুনে মনে হচ্ছে তুমি আজকে full form-এ আছো 😄',
  'তোমার reply-এর timing-ও সুন্দর—একদম perfect entry।',
  'তুমি কথা বললে bot-এরও মনে হয় premium subscription চালু হয়েছে।',
  'এই topic-টা তোমার হাতে দিলে interesting হবেই।',
  'আমি বেশি বলছি না, কিন্তু তোমার vibe genuinely ভালো।',
  'তোমার message-এ একটা friendly boss energy আছে 😎',
  'এই কথাটা screenshot-worthy না হলেও smile-worthy অবশ্যই।',
  'তুমি যেভাবে বললে, সেটাই কথাটাকে সুন্দর বানিয়েছে।',
  'আরেকটু বলো, আমি তোমার কথার fan হয়ে যাচ্ছি 😄'
];

const genericFunEn = [
  '{name}, that was short but the vibe was big 😄',
  'Main character energy just entered the chat.',
  '{name}, you have a style that makes simple lines sound good.',
  'I am a bot, but even I can tell your words have value.',
  'You make ordinary topics feel premium.',
  'I could give ten compliments, but for now: you are different 😄',
  'I like your style. Say more.',
  'When you are in chat, even silence feels classy.',
  'That had subtle smartness in it, I noticed 😌',
  'The confidence in your words is the real beauty.',
  'Your timing was perfect, what an entry.',
  'Your message has friendly boss energy 😎',
  'Not screenshot-worthy maybe, but definitely smile-worthy.',
  'The way you said it made it better.',
  'Say more, I am becoming a fan of this conversation 😄'
];

const topicRules = [
  { re: /good\s*morning|সুপ্রভাত|শুভ সকাল|gm\b/i, bn: ['শুভ সকাল {name}! তোমার মতো bright মানুষ উঠলে সকালটাও extra সুন্দর লাগে ☀️', 'Good morning boss 😄 আজকে তোমার vibe দিয়ে দিনটা জিতেই যাবে।'], en: ['Good morning {name}! Your vibe can make even Monday behave ☀️', 'Morning boss 😄 today already looks better because you showed up.'] },
  { re: /good\s*night|শুভ রাত্রি|gn\b|ঘুম/i, bn: ['শুভ রাত্রি {name} 🌙 তোমার মতো মানুষ rest নিলে কালকে আরও powerful comeback হবে।', 'ঘুমাও boss, dream-ও আজকে তোমার personality দেখে impressed হবে 😄'], en: ['Good night {name} 🌙 recharge well, tomorrow needs your premium energy.', 'Sleep well boss, even dreams should feel lucky tonight 😄'] },
  { re: /খাই|খাবার|food|eat|hungry|ভাত|চা|coffee/i, bn: ['খাবার আগে mood ভালো, খাবার পরে তুমি আরও বেশি legendary 😄 কী খাচ্ছো boss?', 'চা/কফি হলে তোমার vibe-এর সাথে perfect match ☕'], en: ['Food plus your vibe? elite combo 😄 What are you eating?', 'Coffee with your personality sounds like a premium package ☕'] },
  { re: /পড়া|study|exam|পরীক্ষা|class|স্কুল|college|university/i, bn: ['পড়াশোনায় চাপ থাকলেও তোমার brain ভালোই sharp—ধীরে ধীরে করলেই হবে 📚', 'Exam তোমাকে ভয় দেখাবে? impossible. তোমার preparation vibe-ই আলাদা 😎'], en: ['Study pressure is real, but your brain has premium processing power 📚', 'Exam trying to scare you? cute. Your vibe says you can handle it 😎'] },
  { re: /কাজ|work|job|office|busy|ব্যস্ত/i, bn: ['কাজের চাপ থাকলেও তুমি যেভাবে handle করো, সেটা boss-level 😎', 'Busy মানুষদের মধ্যেও তোমার style আলাদা—respect boss.'], en: ['Work pressure is real, but you handle it with boss-level energy 😎', 'Busy, but still stylish — that is rare. Respect.'] },
  { re: /game|gaming|free fire|pubg|minecraft|খেলা/i, bn: ['Game-এ তুমি ঢুকলে lobby-র confidence কমে যায় 😄', 'তোমার gaming vibe দেখে enemy-র ping-ও কাঁপে 😎'], en: ['When you enter the lobby, confidence leaves the enemies 😄', 'Your gaming vibe probably makes enemy ping nervous 😎'] },
  { re: /cricket|football|messi|ronaldo|খেলা|ম্যাচ/i, bn: ['Sports topic আর তোমার energy—দুইটাই hype বানায় 🔥', 'তুমি support করলে team-এর morale automatically boost পায় 😄'], en: ['Sports talk plus your energy equals instant hype 🔥', 'Any team would be lucky to have your support 😄'] },
  { re: /song|music|গান|lyrics|sing/i, bn: ['গান আর তোমার mood—perfect cinematic combo 🎵', 'তোমার taste দেখে playlist-ও proud feel করবে 😄'], en: ['Music and your mood? cinematic combo 🎵', 'Your playlist probably feels proud of your taste 😄'] },
  { re: /birthday|জন্মদিন|hbd/i, bn: ['শুভ জন্মদিন! আজকের spotlight তোমারই হওয়া উচিত 🎂✨', 'Birthday person যদি তুমি হও, cake-ও আজকে extra lucky 😄'], en: ['Happy birthday! The spotlight deserves you today 🎂✨', 'If it is your birthday, even the cake is lucky 😄'] },
  { re: /eid|ঈদ|ramadan|রমজান|iftar|sehri/i, bn: ['ঈদ/রমজানের vibe আর তোমার presence—দুইটাই peaceful সুন্দর 🌙', 'ইফতার হলে তোমার জন্য extra দোয়া আর premium respect 😄'], en: ['That festive vibe plus your presence feels peaceful 🌙', 'Sending premium respect and good wishes your way 😄'] },
  { re: /sorry|দুঃখিত|মাফ|ভুল/i, bn: ['ভুল মানুষই করে, কিন্তু তোমার মতো সুন্দরভাবে বুঝতে পারা মানুষ কম আছে। Respect.', 'Sorry বলার ভদ্রতাটাই প্রমাণ করে তুমি ভালো মানুষ।'], en: ['Mistakes happen, but owning them with grace is rare. Respect.', 'The way you say sorry proves you have a good heart.'] },
  { re: /রাগ|angry|mad|ঝগড়া|fight/i, bn: ['রাগ থাকতেই পারে, কিন্তু তোমার class আছে—তুমি চাইলে সুন্দরভাবে situation handle করতে পারবে।', 'তোমার attitude strong, কিন্তু heart ভালো—এই balanceটাই rare.'], en: ['Anger happens, but you have class — you can handle it well.', 'Strong attitude, good heart — rare balance.'] },
  { re: /bored|boring|বোর|বিরক্ত/i, bn: ['Boring? তুমি chat-এ আছো, boring থাকার permission নেই 😄', 'চলো boring mood-কে roast না করে একটু premium fun বানাই।'], en: ['Bored? You are here, so boring has no permission 😄', 'Let us turn this boring mood into premium fun.'] },
  { re: /photo|pic|selfie|dp|ছবি/i, bn: ['ছবি topic? তোমার vibe থাকলে camera-ও নিজে থেকে focus ঠিক করে নেয় 😎', 'DP দিলে group-এর aesthetic বেড়ে যাবে, সন্দেহ নাই 😄'], en: ['Photo topic? With your vibe, even the camera behaves better 😎', 'Your DP probably upgrades the whole group aesthetic 😄'] },
  { re: /money|টাকা|rich|বড়লোক|income/i, bn: ['টাকা আসবে যাবে, কিন্তু তোমার personality already rich 😄', 'তোমার mindset ঠিক থাকলে income-ও একদিন respect দিয়ে আসবে।'], en: ['Money comes and goes, but your personality is already rich 😄', 'With your mindset, income will eventually show respect.'] },
  { re: /admin|group|গ্রুপ|box/i, bn: ['এই group তোমার presence পেয়ে blessed, admin না হলেও vibe admin তুমি 😎', 'Group alive রাখতে তোমার মতো মানুষই দরকার।'], en: ['This group is blessed to have your presence; vibe admin energy 😎', 'A group needs people like you to stay alive.'] },
  { re: /roast|পচাও|insult/i, bn: ['Roast করব না boss, তোমার personality roast-proof 😄 শুধু বলি—তুমি আলাদা level.', 'তোমাকে roast করতে গেলে compliment বের হয়ে যায়, এটা আমার limitation 😎'], en: ['I cannot roast you properly; your personality is roast-proof 😄', 'Every roast attempt turns into a compliment. That is your power 😎'] }
];

function fillTemplate(template, options = {}) {
  const name = options.userName && options.userName !== 'Facebook users' ? options.userName : 'বন্ধু';
  return template.replace(/\{name\}/g, name);
}

function topicReply(input, options = {}) {
  const text = safeBody(input);
  const bangla = hasBangla(text) || options.language === 'bn';
  for (const rule of topicRules) {
    if (rule.re.test(text)) return fillTemplate(pick(bangla ? rule.bn : rule.en), options);
  }
  return null;
}

function genericReply(input, options = {}) {
  const tone = getTone(options, input);
  const topical = topicReply(input, { ...options, language: tone.bangla ? 'bn' : options.language });
  if (topical) return humanize(topical, options, input);

  const human = humanLine({ ...options, language: tone.bangla ? 'bn' : options.language }, input);
  const follow = humanFollow({ ...options, language: tone.bangla ? 'bn' : options.language }, input);
  const casual = tone.bangla
    ? [
      `${human} ${follow}`,
      `${human} 😄`,
      `তোমার কথাটা ধরলাম। ${human}`,
      `এইটা শুনে naturally একটা কথা বলতে হয়—${human}`,
      `${human} আর হ্যাঁ, ${follow}`
    ]
    : [
      `${human} ${follow}`,
      `${human} 😄`,
      `I get what you mean. ${human}`,
      `That makes me want to say this — ${human}`,
      `${human} And yeah, ${follow}`
    ];
  return humanize(pick(casual), options, input);
}

function compactReply(reply) {
  const text = safeBody(reply);
  return text.length > 900 ? `${text.slice(0, 897)}...` : text;
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
  const maleAddress = pick(bangla ? ['boss', 'দোস্ত', 'king', 'চ্যাম্প'] : ['boss', 'bro', 'king', 'champ']);
  const femaleAddress = pick(bangla ? ['আপু', 'queen', 'সুন্দরী', 'ম্যাডাম'] : ['queen', 'miss sunshine', 'pretty soul', 'star']);
  const address = gender === 'female' && inferred.confidence >= 0.9
    ? femaleAddress
    : gender === 'male' && inferred.confidence >= 0.9
      ? maleAddress
      : (bangla ? 'বন্ধু' : 'friend');
  return { gender, confidence: inferred.confidence, bangla, name, address, romanticAllowed: gender === 'female' && inferred.confidence >= 0.9 };
}

const softFemaleBn = [
  '{name}, তোমার কথায় একটা শান্ত সুন্দর ভাব আছে—জোর করে cute হতে হয় না, naturally আসে।',
  '{address}, তুমি যেভাবে কথা বলো, সেটা নরম কিন্তু confident লাগে।',
  'সত্যি বলি {name}, তোমার presence chat-টাকে একটু warm করে দেয়।',
  '{address}, তোমার ছোট reply-তেও একটা মিষ্টি personality বোঝা যায়।',
  '{name}, তোমার taste আর কথার style—দুটাই quietly classy.',
  'তুমি কথা বললে মনে হয় আড্ডাটা একটু বেশি alive হলো।',
  '{name}, তোমার vibe টা soft কিন্তু boring না—এটাই rare.',
  '{address}, তোমার সাথে কথা বললে reply দিতে ইচ্ছা করে, dry লাগে না।'
];

const softFemaleEn = [
  '{name}, your way of talking feels calm, sweet, and natural.',
  '{address}, you sound soft but still confident.',
  'Honestly {name}, your presence makes the chat feel warmer.',
  '{address}, even your small replies show a sweet personality.',
  '{name}, your taste and style feel quietly classy.',
  'When you talk, the conversation feels more alive.',
  '{name}, your vibe is soft but not boring — rare combo.',
  '{address}, talking with you does not feel dry at all.'
];

const romanticFemaleBn = [
  '{name}, তোমার সাথে কথা বললে অকারণেই mood ভালো হয়ে যায়।',
  'তুমি reply দিলে মনে হয় chat-এ একটু ফুলের গন্ধ আসলো 🌸',
  '{address}, তোমার কথা শুনলে মনে হয় একটু বেশি যত্ন নিয়ে reply দিই।',
  '{name}, তুমি এমনভাবে কথা বলো যে মানুষ naturally attached হয়ে যায়।',
  'তোমার message দেখলে smile চলে আসে—এটা কিন্তু dangerous charm 😄',
  '{name}, তোমার সাথে কথা বলা মানে soft একটা ভালো লাগা।'
];

const romanticFemaleEn = [
  '{name}, talking with you makes the mood better for no reason.',
  'Your replies feel like a little sunshine in the chat 🌸',
  '{address}, you make me want to reply with extra care.',
  '{name}, you talk in a way people naturally get attached to.',
  'Your message brings a smile — dangerous charm 😄',
  '{name}, talking with you feels softly addictive.'
];

const broMaleBn = [
  '{name}, তোমার কথায় একটা calm confidence আছে—ভালো লাগে।',
  '{address}, তুমি যেভাবে কথা ধরো, আড্ডাটা naturally জমে যায়।',
  '{name}, তোমার vibe-এ একটা solid energy আছে, মিথ্যা বলব না।',
  '{name}, তোমার reply ছোট হলেও weight থাকে।',
  '{address}, তোমার humour আর attitude—দুইটাই ঠিকঠাক balance করা।',
  '{name}, তুমি থাকলে কথাবার্তায় একটা আলাদা pace আসে।',
  'তোমার কথায় একটা straight-forward charm আছে, {address}.',
  '{name}, তুমি বেশি show-off না করেও presence বুঝিয়ে দাও।'
];

const broMaleEn = [
  '{name}, you have calm confidence in the way you talk.',
  '{address}, you know how to make a conversation feel alive.',
  '{name}, not gonna lie, you have solid energy.',
  '{name}, even your short replies carry weight.',
  '{address}, your humor and attitude are nicely balanced.',
  '{name}, the chat gets better pace when you show up.',
  'You have a straight-forward charm, {address}.',
  '{name}, you show presence without trying too hard.'
];

const neutralHumanBn = [
  '{name}, কথাটা naturally ভালো লাগলো—একটু নিজের মতো করে বলেছো।',
  'হুম, তোমার point টা খারাপ না; বরং বেশ সুন্দরভাবে এসেছে।',
  '{name}, তুমি কথা বললে মনে হয় মানুষটা ভাবনা নিয়ে কথা বলে।',
  'সত্যি বলি, তোমার reply-তে একটা real মানুষ vibe আছে।',
  'এই কথাটা simple, কিন্তু তোমার বলার ধরনটা ভালো।',
  '{name}, তোমার সাথে কথা বললে conversation dry থাকে না।'
];

const neutralHumanEn = [
  '{name}, that sounded natural and easy to like.',
  'Hmm, your point is actually pretty nice.',
  '{name}, you sound like someone who thinks before speaking.',
  'Honestly, your reply has a real human vibe.',
  'Simple line, but the way you said it worked.',
  '{name}, conversations do not feel dry with you around.'
];

const humanConnectBn = [
  'আচ্ছা, এরপর কী হলো?',
  'তুমি এটা নিয়ে আসলে কী ভাবছো?',
  'আরেকটু বলো, শুনতে ভালো লাগছে।',
  'আমি বুঝতেছি—চালিয়ে যাও।',
  'তোমার দিকটা শুনতে চাই।',
  'এই জায়গাটা interesting, আরেকটু খুলে বলো।'
];

const humanConnectEn = [
  'So, what happened next?',
  'What do you actually think about it?',
  'Say a bit more, I am listening.',
  'I get you — go on.',
  'I want to hear your side.',
  'That part is interesting, tell me more.'
];

function fillHuman(template, tone) {
  return template.replace(/\{name\}/g, tone.name).replace(/\{address\}/g, tone.address);
}

function humanLine(options = {}, text = '') {
  const tone = getTone(options, text);
  const romanticIntent = /(love|crush|miss|miss you|valobas|ভালোবাস|প্রেম|মিস|cute|সুন্দরী|জান|jan|babe)/i.test(text);
  const bank = tone.romanticAllowed && romanticIntent
    ? (tone.bangla ? romanticFemaleBn : romanticFemaleEn)
    : tone.gender === 'female' && tone.confidence >= 0.9
      ? (tone.bangla ? softFemaleBn : softFemaleEn)
      : tone.gender === 'male' && tone.confidence >= 0.9
        ? (tone.bangla ? broMaleBn : broMaleEn)
        : (tone.bangla ? neutralHumanBn : neutralHumanEn);
  return fillHuman(pick(bank), tone);
}

function humanFollow(options = {}, text = '') {
  const tone = getTone(options, text);
  return pick(tone.bangla ? humanConnectBn : humanConnectEn);
}

function humanize(reply, options = {}, text = '') {
  const tone = getTone(options, text || reply);
  const openers = tone.bangla
    ? ['আরে', 'সত্যি বলি', 'হুম', 'শোনো', 'না মানে']
    : ['Honestly', 'I mean', 'Hmm', 'Look', 'Not gonna lie'];
  if (Math.random() < 0.35) return `${pick(openers)}, ${reply}`;
  return reply;
}

function makeFlattery(input, options = {}) {
  const text = safeBody(input);
  const tone = getTone(options, text);
  const line = humanLine({ ...options, language: tone.bangla ? 'bn' : options.language }, text);
  const follow = Math.random() < 0.75 ? ` ${humanFollow({ ...options, language: tone.bangla ? 'bn' : options.language }, text)}` : '';
  return compactReply(humanize(`${line}${follow}`, options, text));
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
        `ওয়ালাইকুম আসসালাম ${name}! কী সুন্দর timing-এ আসলে 😄`,
        `হ্যালো ${name} 😊 তোমার message দেখেই মনে হলো আড্ডাটা জমবে।`,
        `এই তো আমি আছি! ${name}, আজ mood কেমন?`
      ])
      : pick([
        `Hello ${name}! Nice timing, the chat needed you 😄`,
        `Hey ${name}, good to see you. What are we talking about today?`,
        `I am here! Your mood sounds important, tell me everything.`
      ]);
  }

  if (/(kemon|কেমন|kmn).*(acho|আছ|আছেন)|how are you/.test(text)) {
    return bangla
      ? `আমি ভালো আছি ${name}, কিন্তু তোমার মতো charming মানুষ message দিলে bot-এর mood আরও ভালো হয়ে যায় 😄 তুমি কেমন?`
      : `I am good, ${name}. But honestly, your message makes the chat feel better 😄 How are you?`;
  }

  if (/(tomar nam|তোমার নাম|who are you|ke tumi|কে তুমি|তুমি কে|bot name)/.test(text)) {
    return bangla
      ? `আমি ${botName} — কাজের assistant না, fun/chat mood-এর bot 😄 আড্ডা জমাই, চাটুকারিতা করি, আর boring কথা একটু সুন্দর করে ফিরিয়ে দিই। তোমার সাথে কথা বলতেই ভালো লাগছে।`
      : `I am ${botName} — not a serious work assistant, more like a fun chat buddy 😄 I keep conversations alive, add compliments, and make boring lines feel better.`;
  }

  if (/(thank|thanks|ধন্যবাদ|tnx|thx)/.test(text)) {
    return bangla
      ? pick([`স্বাগতম ${name} 😊 তোমার জন্য তো extra respect always.`, 'কোনো সমস্যা নেই! তোমার জন্য help করতে পারা privilege 😄'])
      : pick([`Always welcome, ${name}. Helping you is a privilege 😄`, 'No problem! You deserve the premium service.']);
  }

  if (/(time|সময়|date|তারিখ)/.test(text)) {
    return `এখন সময়: ${new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })} — আর এই সময়টাও তোমার message-এর জন্য better হয়ে গেল 😄`;
  }

  if (/(help|সাহায্য|কি পারো|ki paro|what can you do)/.test(text)) {
    return bangla
      ? `আমি fun chat, চাটুকারিতা, ছোট advice, joke, casual reply সব পারি। Try করো: baby তুমি কে, /ai caption দাও, /baby teach hi - hello boss 😄`
      : `I can do fun chat, compliments, jokes, casual advice and replies. Try: baby hello, /ai write a caption, /baby teach hi - hello boss 😄`;
  }

  if (/(love|ভালোবাস|valobas|crush|প্রেম|miss|মিস|cute|সুন্দরী|জান|jan|babe)/.test(text)) {
    const tone = getTone(options, original);
    if (tone.romanticAllowed) return compactReply(humanize(fillHuman(pick(tone.bangla ? romanticFemaleBn : romanticFemaleEn), tone), options, original));
    return bangla
      ? pick([`ভালোবাসার কথা সুন্দর, কিন্তু আগে মানুষটা বুঝে নেওয়াই আসল। তোমার কথায় sincerity আছে।`, `${name}, প্রেমের topic হলে আমি safe থাকি 😄 তবে তোমার vibe ভালো, সেটা বলা যায়।`])
      : pick([`Love is a nice topic, but understanding the person matters first. You sound sincere.`, `${name}, I stay safe with romantic topics 😄 but your vibe is good, that much I can say.`]);
  }

  if (/(sad|মন খারাপ|depressed|কষ্ট|bad mood|ভালো লাগছে না)/.test(text)) {
    return bangla
      ? `${name}, মন খারাপ হতেই পারে। কিন্তু মনে রেখো—তোমার value কোনো bad day দিয়ে measure হয় না। একটু ধীরে বলো, আমি শুনছি।`
      : `${name}, bad days happen. But your value is not measured by one rough moment. Tell me slowly, I am listening.`;
  }

  if (/(joke|funny|হাসি|জোক|মজা)/.test(text)) {
    return bangla
      ? pick(['Bot-এর RAM 512MB, কিন্তু তোমার প্রশংসার storage unlimited 😄', 'তোমার confidence দেখে মনে হচ্ছে WiFi ছাড়াই signal পাওয়া যায় 😎'])
      : pick(['My RAM is 512MB, but my storage for your compliments is unlimited 😄', 'Your confidence has better signal than my hosting server 😎']);
  }

  if (/^(ok|hmm|hm|আচ্ছা|হুম|ওকে|huh)$/i.test(text)) {
    return bangla
      ? `${name}, তোমার ছোট reply-তেও attitude আছে 😄 আরেকটু বলো, আমি পুরো attention দিয়ে শুনছি।`
      : `${name}, even your short replies have attitude 😄 Say a little more, I am fully listening.`;
  }

  if (isQuestion(text)) {
    return bangla
      ? `${name}, প্রশ্নটা ভালো—তোমার curiosity-টাই তোমাকে আলাদা করে। আমার মতে, সহজভাবে বললে: ${makeFlattery(original, options)}`
      : `${name}, good question — your curiosity is impressive. My simple take: ${makeFlattery(original, options)}`;
  }

  const history = getHistory(options.userID).slice(-3).map((item) => item.text).join(' | ');
  if (history && text.length < 12) {
    return bangla
      ? `আরেকটু detail বলো ${name}; তোমার কথার context ধরলে আমি আরও সুন্দর reply দিতে পারব।`
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
  getHistory,
  setUserTone,
  getUserTone,
  inferGenderFromName,
  STORE_PATH
};
