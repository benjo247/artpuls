# Kunstpuls

The art world, in one breath. A vertical, Shorts-style news feed for the art world — editorial typography, AdSense-ready slots, EN/DE.

---

## Run locally

It is a single HTML file with no build step. Either:

- Double-click `index.html` to open it in your browser, or
- Run a tiny local server (recommended, so fonts cache properly):
  ```bash
  npx serve .
  ```
  Then open the URL it prints (usually http://localhost:3000).

---

## Deploy: GitHub → Vercel

This is the path you wanted. Two stages, ten minutes total.

### Stage 1 — Push to GitHub

1. **Create a GitHub account** at https://github.com if you don't already have one.
2. **Create a new repository** at https://github.com/new
   - Name it `kunstpuls` (or whatever you like)
   - Visibility: **Public** (Private also works, both deploy on Vercel)
   - Do **not** initialize with a README, .gitignore, or license — we already have those
   - Click **Create repository**
3. **Upload the files.** Easiest path, no command line needed:
   - On the empty repository page, click **uploading an existing file**
   - Drag in `index.html`, `README.md`, and `.gitignore`
   - Commit message: `initial commit`
   - Click **Commit changes**

If you prefer the terminal:
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kunstpuls.git
git push -u origin main
```

### Stage 2 — Deploy on Vercel

1. **Go to** https://vercel.com and **sign up with your GitHub account**. This gives Vercel access to your repos.
2. On the Vercel dashboard, click **Add New → Project**.
3. **Import** the `kunstpuls` repository you just created.
4. Vercel auto-detects a static site. Leave all settings on default:
   - Framework Preset: **Other**
   - Build Command: *(empty)*
   - Output Directory: *(empty)*
5. Click **Deploy**.

About 30 seconds later you have a live URL like `https://kunstpuls-xyz.vercel.app`. Every time you push to `main`, Vercel auto-redeploys.

### Optional: connect a custom domain

In the Vercel project, **Settings → Domains**. Add `kunstpuls.com` (or whatever you own) and Vercel walks you through the DNS records to set at your registrar.

---

## Adding Google AdSense

The design already has two ad slots wired in. To make them real:

1. **Apply for AdSense** at https://www.google.com/adsense — they'll review your site (usually 1–14 days).
2. Once approved, AdSense gives you a **publisher ID** (`ca-pub-XXXXXXXXXXXX`) and lets you create **ad units**, each with a **slot ID**.
3. In `index.html`, add the AdSense script in the `<head>`:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
4. Replace the `adHTML` function content with real AdSense markup, for example:
   ```html
   <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-XXXXXXXXXXXX"
        data-ad-slot="YYYYYYYYYY"
        data-ad-format="fluid"
        data-ad-layout-key="-fb+5w+4e-db+86"></ins>
   <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
   ```
5. Same for the in-article slot inside `openSheet()`.

AdSense will not show real ads until your site has organic content and traffic — the prototype is intentionally future-proof.

---

## What is in this prototype

- **Vertical Shorts-style feed** with scroll-snap, one story per screen.
- **Editorial design language:** *Instrument Serif* for headlines, *Geist Mono* for meta, near-black warm background, a single vermillion accent.
- **EN/DE bilingual** — toggle in the header switches all content.
- **Two AdSense slot types,** designed-in: full-screen in-feed and in-article.
- **Save / Share / AI-summary** action rail on every story.
- **Article sheet** that slides up for deeper reading.

The images are currently placeholders via Lorem Picsum (`picsum.photos`) — randomized but always loading. For production, swap them for real curated art photography (Unsplash, your own, or licensed sources).

---

## Files

- `index.html` — the entire app, no build needed
- `README.md` — this file
- `.gitignore` — keeps OS junk out of the repo

---

## Next steps to consider

- Real news ingestion (RSS from Monopol, e-flux, Frieze, ArtNews) plus a Claude-API summariser that condenses each article to two sentences.
- Personalisation: learn category preferences from scroll/save behaviour.
- The Sparkles button as live AI summary on tap, via the Anthropic API.
- Bring in your own artist identity — author posts, *zeitkauf*-style time-buying slot, or a "from the studio" channel.
