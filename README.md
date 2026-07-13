# Fun Boy Bot

A modernized Messenger bot runtime with a lightweight dashboard and encrypted login credential support.

## Quick start

```bash
npm install
npm run login:setup
npm start
```

Open the dashboard at `http://localhost:8080` and health JSON at `http://localhost:8080/health`.

## Encrypted Facebook login

Do **not** put your Facebook password in `config.json`.

Use:

```bash
npm run login:setup
```

The setup command asks for your Facebook phone/email and password, then stores them in `.secrets/credentials.enc.json` using AES-256-GCM encryption. At runtime `Ullash.js` preloads `utils/runtimeCredentials.js`, decrypts the credentials in memory, and injects them into the bot config without writing the plaintext password back to `config.json` or `config.json.temp`.

### Hosting recommendation

For stronger encryption on hosting providers, set this secret environment variable before running setup/start:

```bash
FB_CREDENTIALS_KEY=<a-long-random-secret>
```

You can also provide credentials through hosting secrets as `FB_EMAIL`, `FB_PASSWORD`, and optional `FB_OTPKEY`; encrypted file storage is still recommended for persistent login setup.

## Useful scripts

- `npm start` — start dashboard + bot
- `npm run login:setup` — save encrypted login credentials
- `npm run check` — syntax-check JavaScript files, validate JSON files, command export smoke checks, sample conversation smoke checks, and run `npm audit --omit=dev --audit-level=high`
- `npm test` — same as `npm run check`

## Conversation / AI replies

The `/baby`, `/ai`, `/gpt`, and `/flatter` commands share a **no-API local conversation engine** tuned for fun/casual Bangla-English chatting:

- Local Bangla/English fallback replies work without any API key
- Replies are casual and human-like (e.g. "কিরে কি অবস্থা", "আচ্ছা বুঝলাম, তারপর?", "সত্যি নাকি? একটু খুলে বল তো") instead of robotic AI templates
- Generic or random text always gets a reply; the bot never stays silent
- Lightweight name-based tone detection uses only known name hints; unknown/ambiguous names stay neutral
- Likely female names get softer/flirty replies; likely male names get casual friend style without overusing “ভাই”
- Users can override their own tone with `/baby tone female`, `/baby tone male`, or `/baby tone neutral`
- `/flatter [name/text]` generates casual compliments
- `/whoami` explains Fun Boy's fun/chat personality
- `/baby teach question - reply1, reply2` stores local taught replies in `Script/commands/cache/conversation-teach.json`
- `/baby styleteach [phrase]` teaches the bot your own natural phrase style (max 80 phrases per user)
- `/baby stylelist` shows your saved style phrases
- `/baby styleremove [phrase]` removes one of your saved style phrases
- `/baby remove question` removes a taught message
- `/baby list` shows the local teach count
- Optional advanced AI: set `OPENAI_API_KEY` or `CONVERSATION_API_URL` in hosting secrets
- Optional old baby remote API: set `ENABLE_BABY_API=1`

Auto conversation is triggered when a message starts with `baby`, `bby`, `bot`, `fun boy`, or mentions the bot.

## 512MB RAM hosting

The launcher is tuned for small hosts by default:

- Bot V8 old-space limit: `BOT_OLD_SPACE_MB=384`
- RSS restart guard: `MEMORY_RSS_LIMIT_MB=460`
- Heap restart guard: `MEMORY_HEAP_LIMIT_MB=352`
- Native allocator arenas: `MALLOC_ARENA_MAX=2`
- Conversation engine keeps reply banks small and lightweight so it runs comfortably in 512MB RAM

You can override these as hosting environment variables if your platform needs different limits. When memory approaches the limit the bot logs a warning; if it crosses the limit it exits with code `78` so `Ullash.js` can restart it cleanly instead of letting the host kill it.

## Security notes

- `.secrets/`, `.env`, SQLite runtime files, `appstate.json`, and `config.json.temp` are ignored by git.
- `appstate.json` in the repository is an empty placeholder so real session cookies are not committed.
- Keep your `FB_CREDENTIALS_KEY` private. If it is leaked, rotate your Facebook password and generate a new key.
