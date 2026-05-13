# Kunstpuls

**The art world, in one breath.** A Shorts-style PWA for international art news — six sources, AI-compressed every 2 hours, served as a clean editorial feed with a growing archive.

---

## Architecture

A static PWA + one scheduled GitHub Action. No server, no database, no auth. Free-tier infrastructure end-to-end; the only paid component is roughly €15/month of Claude API calls for the editorial compression.

```
   RSS sources (6)                           Users
        │                                      │
        ▼                                      ▼
   GitHub Action (every 2h)              Vercel CDN
        │                                      │
   ┌────┴────┐                            ┌────┴────┐
   │ fetch   │                            │  PWA    │ ← swipe-snap feed
   │ dedup   │  ─── git commit ───►       │  shell  │ ← installable
   │ Claude  │                            │  + SW   │ ← offline-capable
   │ enrich  │                            └────┬────┘
   │ archive │                                 │ fetch
   │ derived │                                 ▼
   │ sitemap │                            data/latest.json   ← initial load
   └─────────┘                            data/archive.json  ← deep dive
                                          data/by-category/*  ← filtered views
                                          /s/:id              ← SEO permalinks
```

## File overview

```
kunstpuls/
├── index.html               # PWA shell
├── styles.css               # full editorial design
├── app.js                   # UI, language, sheet, save, load-older, deep-links
├── ads.js                   # AdSense placement logic with frequency capping
├── manifest.webmanifest     # PWA manifest
├── sw.js                    # service worker (offline, caching strategy)
├── vercel.json              # rewrites for /s/:id, headers, caching
├── robots.txt               # points to sitemap
├── sitemap.xml              # auto-generated from archive
├── icons/                   # PWA icons
├── data/                    # all news data lives here
│   ├── archive.json         # master archive (grows over time)
│   ├── latest.json          # last 72h, loaded on app open
│   ├── by-category/*.json   # per-category indices
│   └── by-month/*.json      # per-month indices
├── api/
│   └── s/[id].js            # Vercel Edge Function for /s/:id SEO permalinks
├── scripts/
│   └── fetch-news.mjs       # RSS → dedup → Claude → archive pipeline
├── .github/workflows/
│   └── news.yml             # every-2-hour cron
├── LAUNCH.md                # 4-phase launch strategy
├── MONETIZATION.md          # revenue stack & projections
├── package.json
├── .gitignore
└── README.md
```

---

## How the pipeline works

1. **Load existing archive** from `data/archive.json` (or start fresh if it's the first run)
2. **Fetch all 6 RSS feeds in parallel** with a reasonable timeout
3. **Deduplicate** candidate items against the archive (stable IDs derived from normalized URL hash)
4. **Send only genuinely new items** to Claude (Haiku 4.5) in batches of 6
   - System prompt is cached (ephemeral 5-minute cache) — saves ~90% on input cost across the batch calls
5. **Claude returns enriched cards**: category, kicker, headline, summary, body (all bilingual EN/DE), reading time
6. **Append new stories** to the archive
7. **Rebuild derived files** — `latest.json`, `by-category/*`, `by-month/*`, `sitemap.xml`
8. **Commit and push** — Vercel auto-redeploys

The frontend behavior mirrors this split:
- App opens → fetches `latest.json` (~50 KB) for instant first render
- User scrolls near the end → auto-loads archive or category-specific file
- User taps headline → article sheet opens, URL becomes `/s/:id` (pushState)
- User shares the URL → Edge Function renders proper OG tags and structured data for crawlers, full app shell for human users

---

## Run locally

```bash
npm install
npm run serve   # http://localhost:3000
```

To test the news pipeline locally:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run build:news
```

The script is idempotent — running it multiple times only processes genuinely new items.

---

## Deploy: GitHub → Vercel

### 1) Push to GitHub

Create a new repo at https://github.com/new (name it `kunstpuls`).

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/kunstpuls.git
git push -u origin main
```

### 2) Add the Anthropic API key as a secret

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `ANTHROPIC_API_KEY`
- Value: your `sk-ant-...` key

### 3) Run the news fetch once manually (optional but recommended)

**Actions → "Fetch news" → Run workflow**

You'll get a fresh archive populated within ~60 seconds. From there it runs every 2 hours automatically.

### 4) Deploy on Vercel

https://vercel.com → **Add New → Project** → import the `kunstpuls` repo. Settings stay at defaults. Click **Deploy**.

About 30 seconds later you have a live URL. Every push to `main` triggers a redeploy.

### 5) Custom domain (optional)

In the Vercel project: **Settings → Domains**. Add your domain and Vercel walks you through DNS.

---

## Customization

**Edit sources** in `scripts/fetch-news.mjs` — top of file, `SOURCES` array.

**Edit categories or accent colors** in the same file (`ACCENTS` constant) plus the corresponding labels in `app.js` (`LABELS.en.cats` and `LABELS.de.cats`).

**Adjust editorial voice** by editing `SYSTEM_PROMPT` in `fetch-news.mjs` — for example, ask for more critical tone, shorter summaries, or a different category set.

**Adjust update frequency** in `.github/workflows/news.yml` — change the cron expression. Currently `'7 */2 * * *'` (every 2 hours). Hourly is `'7 * * * *'`, every 4 hours is `'7 */4 * * *'`.

---

## Adding Google AdSense

The full ad logic lives in `ads.js`. Two slot types are designed-in: in-feed (every 5-7 stories) and in-article. Smart placement rules already handle: new vs returning users, session caps, sensitive-category exclusions.

When AdSense approves:

1. Open `ads.js`, set:
   ```js
   CONFIG.enabled = true;
   CONFIG.publisherId = 'ca-pub-XXXXXXXXXXXXXXXX';
   CONFIG.slots.inFeed = 'YYYYYYYYYY';
   CONFIG.slots.inArticle = 'ZZZZZZZZZZ';
   ```

2. Uncomment the AdSense loader in `index.html` `<head>` (and in the Edge Function `api/s/[id].js`) with the same publisher ID.

3. Commit and push. Ads start appearing immediately.

For the full revenue strategy beyond AdSense, see `MONETIZATION.md`.

---

## Cost expectation

- **Vercel free tier:** comfortably covers low-to-medium traffic. No cost until well past 100GB bandwidth/month or 30k+ DAU.
- **GitHub Actions:** ~6 minutes per run × 12 runs/day = ~72 min/day, well within the free tier even on private repos.
- **Claude API:** Haiku 4.5, deduplicated + cached. Realistic monthly cost: **~€15-20** at every-2-hour cadence with prompt caching active.

Domain ~€15/year. Optional Plausible analytics €9/month. Total monthly burn for a real, live system: **~€25-30**.

---

## What's intentionally not here yet

- Personalization / user accounts (no backend = no cross-device user state)
- Full-text search (could be added with a tiny client-side index when the archive grows)
- Push notifications (PWA supports it, needs a backend signal source)
- Image mirroring (uses source CDNs for now; can add Cloudflare R2 when needed)

When you want any of those, they migrate cleanly. Everything currently here stays as-is.
