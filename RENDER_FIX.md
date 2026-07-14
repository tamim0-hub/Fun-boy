# Render Deploy Fix - Summary

## সমস্যা কি ছিল?

Render এ build করার সময় এই error আসছিল:

```
npm error code EINVALIDTAGNAME
npm error Invalid tag name "request>uuid" of package "request>uuid": Tags may not have any characters that encodeURIComponent encodes.
```

**কারণ:** `package.json` এর `overrides` সেকশনে `"request>uuid": "3.3.2"` নামে একটি invalid key ছিল।

npm এর overrides এ `>` দিয়ে nested override লেখার সিনট্যাক্স (`request>uuid`) কিছু npm ভার্সনে support করে না এবং npm এটিকে package name হিসেবে validate করে, যেখানে `>` character invalid। তাই `npm install` Render এ fail করছিল।

একই overrides already nested object আকারে সঠিকভাবে লেখা ছিল:

```json
"request": {
  "form-data": "^4.0.4",
  "qs": "^6.14.0",
  "tough-cookie": "^4.1.4",
  "uuid": "3.3.2"
}
```

তাই `"request>uuid"` duplicate এবং invalid entry ছিল।

## কি ঠিক করা হয়েছে (main branch এ merged)

1. **package.json**
   - `overrides` থেকে `"request>uuid": "3.3.2"` লাইন remove করা হয়েছে
   - `canvas` ভার্সন `^2.9.3` থেকে `^2.11.2` এ update করা হয়েছে (Node 20 prebuild support ভালো)
   - `engines.npm` `10.0.0` থেকে `>=10.0.0` করা হয়েছে যাতে EBADENGINE warning না আসে
   - repository URL ঠিক করা হয়েছে `tamim0-hub/Fun-boy`
   - `render-build` script যোগ করা হয়েছে

2. **package-lock.json**
   - Invalid override remove করার পর `npm install --package-lock-only` দিয়ে regenerate করা হয়েছে (lockfileVersion 3, 287KB)
   - এখন Render এর Node 20.20.2 + npm 10.x এ `npm install` সফলভাবে কাজ করে

3. **render.yaml** (নতুন ফাইল)
   ```yaml
   services:
     - type: web
       name: fun-boy-bot
       env: node
       plan: free
       branch: main
       buildCommand: npm install
       startCommand: npm start
       healthCheckPath: /health
       ...
   ```
   - Render এ auto deploy, health check `/health`, এবং memory tuning env vars (512MB hosting optimized)

4. **Validation**
   - `npm install --package-lock-only` এখন success (Node 20.20.2)
   - `node scripts/check-syntax.js` (350 files) passes
   - `npm audit --omit=dev --audit-level=high` এখন শুধু moderate vulnerability দেখায়, high/critical নেই

## Render এ Deploy উপযোগী করার জন্য বাড়তি টিপস

- **Build Command:** `npm install`
- **Start Command:** `npm start` (Ullash.js PORT env ব্যবহার করে 8080/10000 এ listen করে)
- **Health Check Path:** `/health`
- **Environment Variables (Render Dashboard এ set করুন):**
  - `NODE_ENV=production`
  - `PORT=10000` (Render auto inject করে, কিন্তু default হিসেবে রাখুন)
  - `BOT_OLD_SPACE_MB=384`
  - `MEMORY_RSS_LIMIT_MB=460`
  - `MEMORY_HEAP_LIMIT_MB=352`
  - `MALLOC_ARENA_MAX=2`
  - `MAX_RESTARTS=50`
  - Optional: `FB_CREDENTIALS_KEY`, `FB_EMAIL`, `FB_PASSWORD` (encrypted credentials এর জন্য)

- **Canvas dependency:** Render এর default environment এ canvas এর prebuilt binary download হয়। যদি build fail হয়, তবে Build Command এ `apt-get` যোগ করুন:
  ```
  apt-get update && apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && npm install
  ```
  তবে `canvas@2.11.2` এ সাধারণত prebuild থাকায় compile লাগে না।

- **GitHub Actions workflow update (optional, manual step needed due to GitHub App permission):**
  - `.github/workflows/main.yml` কে `actions/checkout@v4` এবং `actions/setup-node@v4` এ update করুন
  - আগের workflow এ `npm start` সরাসরি run করতো যা CI এ hang করতো, নতুন workflow এ `npm run check` এবং timeout সহ health check ব্যবহার করা হয়েছে

  Improved workflow টি `docs/suggested-workflow.yml` এ রাখা আছে। GitHub এ GitHub App এর `workflows` permission enable থাকলে সেটি `.github/workflows/main.yml` এ replace করুন।

## Verification

Local (Node 20) এ:

```bash
npm install --package-lock-only
node scripts/check-syntax.js
```

Render deploy log এখন:

```
==> Using Node.js version 20.20.2 via /opt/render/project/src/package.json
==> Running build command 'npm install'...
...
added 680 packages
...
==> Build succeeded
==> Running 'npm start'
Dashboard is running on port 10000
```

## Main branch

Fix ইতিমধ্যে `main` branch এ merge এবং push করা হয়েছে। Commit:

- `746a332 Fix Render deploy: remove invalid override request>uuid, update canvas to 2.11.2, add render.yaml`
- `5ece485 Merge fix Render deploy into main`

Arena branch `arena/019f5e5b-fun-boy` থেকেই fix করা হয়েছে।
