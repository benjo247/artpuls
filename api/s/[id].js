/* Vercel Edge Function — SEO permalink renderer.
 *
 * Path: /s/[id] (rewritten via vercel.json)
 *
 * What it does:
 *   1. Looks up the story in data/archive.json (or latest.json as fallback)
 *   2. Returns HTML with proper OG tags, title, structured data
 *   3. The same app shell loads and resolves the deep-link client-side
 *
 * If the data files are unavailable for any reason, this NEVER fails the user —
 * it always returns a working app shell. Client-side JS will fetch the data
 * itself and resolve the deep-link. We only lose rich OG meta tags in that case.
 *
 * For social media crawlers (Twitter, LinkedIn, Slack, Discord, Facebook)
 * and search engines (Google, Bing), this gives a proper preview.
 * For users, JS takes over and shows the full app experience.
 */

export const config = { runtime: 'edge' };

function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHTML(story, lang, siteUrl, id) {
  lang = lang === 'de' ? 'de' : 'en';
  const hasStory = !!story;
  const headline = hasStory ? (story[`headline_${lang}`] || story.headline_en || '') : '';
  const summary  = hasStory ? (story[`summary_${lang}`]  || story.summary_en  || '') : '';
  const body     = hasStory ? (story[`body_${lang}`]     || story.body_en     || '') : '';
  const kicker   = hasStory ? (story[`kicker_${lang}`]   || story.kicker_en   || '') : '';
  const image    = hasStory && story.image ? story.image : `${siteUrl}/icons/og-default.png`;
  const url      = `${siteUrl}/s/${id}`;
  const title    = hasStory ? `${headline} — ArtPulse` : 'ArtPulse — International art news, in one breath';
  const descRaw  = hasStory ? summary : 'International art news, condensed three times daily. Read the story on ArtPulse.';
  const desc     = descRaw.slice(0, 200);

  const ogTags = hasStory ? `
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHTML(headline)}">
<meta property="og:description" content="${escapeHTML(desc)}">
<meta property="og:image" content="${escapeHTML(image)}">
<meta property="og:site_name" content="ArtPulse">
<meta property="article:published_time" content="${story.publishedAt || ''}">
<meta property="article:section" content="${story.cat || ''}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHTML(headline)}">
<meta name="twitter:description" content="${escapeHTML(desc)}">
<meta name="twitter:image" content="${escapeHTML(image)}">

<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'NewsArticle',
  headline,
  description: desc,
  image: [image],
  datePublished: story.publishedAt,
  author: { '@type': 'Organization', name: story.source },
  publisher: { '@type': 'Organization', name: 'ArtPulse' },
  mainEntityOfPage: url
})}
</script>` : `
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="ArtPulse">
<meta property="og:description" content="${escapeHTML(desc)}">
<meta property="og:image" content="${siteUrl}/icons/og-default.png">
<meta property="og:site_name" content="ArtPulse">`;

  const noscriptArticle = hasStory ? `
<noscript>
<article style="max-width:680px;margin:40px auto;padding:24px;color:#f4f1ea">
  <p style="font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a8a094;margin-bottom:12px">${escapeHTML(kicker)} · ${escapeHTML(story.source || '')}</p>
  <h1 style="font-family:'Instrument Serif',serif;font-weight:400;font-size:36px;line-height:1.08;margin-bottom:16px">${escapeHTML(headline)}</h1>
  <p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:20px;line-height:1.45;margin-bottom:20px">${escapeHTML(summary)}</p>
  <p style="font-size:15px;line-height:1.65;margin-bottom:16px">${escapeHTML(body)}</p>
  ${story.url ? `<p><a href="${escapeHTML(story.url)}" style="color:#e8503a">Read at source \u2192</a></p>` : ''}
</article>
</noscript>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0e0d0b">
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(desc)}">
<link rel="canonical" href="${url}">
${ogTags}

<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
${noscriptArticle}

<!-- Full app shell (same as index.html — JS takes over and resolves the deep-link) -->
<div class="phone">
  <header class="header">
    <div class="header-top">
      <div class="header-left">
        <button class="icon-btn icon-burger" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">
          <svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <a class="logo" id="logo" href="/" aria-label="ArtPulse home">
          <span class="logo-mark">&bull;</span>
          <span>Art<em>Pulse</em></span>
        </a>
      </div>
      <div class="header-actions">
        <div class="lang" id="lang">
          <button data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button>
          <button data-lang="de" class="${lang === 'de' ? 'on' : ''}">DE</button>
        </div>
        <button class="icon-btn" id="searchBtn" aria-label="Search">
          <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      </div>
    </div>
    <div class="cats" id="cats"></div>
    <div class="progress" id="progress"></div>
  </header>
  <main class="feed" id="feed">
    <div class="loading" id="loading">
      <div class="loading-pulse"></div>
      <span class="loading-label" id="loadingLabel">Loading\u2026</span>
    </div>
  </main>
  <div class="hint" id="hint" hidden>
    <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>
    <span id="hintText">swipe up</span>
  </div>
  <div class="sheet" id="sheet">
    <div class="sheet-inner" id="sheetInner"></div>
  </div>
  <div class="toast" id="toast" hidden></div>
  <div class="drawer-backdrop" id="drawerBackdrop" hidden></div>
  <aside class="drawer" id="drawer" aria-hidden="true">
    <div class="drawer-head">
      <span class="drawer-title"><span class="art">art</span><span class="pulse">pulse</span><span class="dot" aria-hidden="true"></span></span>
      <button class="icon-btn" id="drawerClose" aria-label="Close"><svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <nav class="drawer-nav">
      <a href="/subscribe" class="drawer-link drawer-link-primary">
        <span class="drawer-link-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg></span>
        <span><span class="drawer-link-label">Subscribe to the digest</span></span>
      </a>
      <div class="drawer-divider"></div>
      <a href="/impressum" class="drawer-link"><span class="drawer-link-label">Impressum</span></a>
      <a href="/datenschutz" class="drawer-link"><span class="drawer-link-label">Datenschutz</span></a>
    </nav>
  </aside>
</div>

<div class="search-overlay" id="searchOverlay" aria-hidden="true">
  <div class="search-bar">
    <button class="icon-btn" id="searchClose" aria-label="Close"><svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <input class="search-input" id="searchInput" type="search" placeholder="Search\u2026" autocomplete="off">
    <button class="icon-btn search-clear" id="searchClear" aria-label="Clear" hidden><svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
  </div>
  <div class="search-results" id="searchResults"></div>
</div>

<div class="desktop" id="desktop" hidden></div>

<script src="/ads.js" defer></script>
<script src="/app.js" defer></script>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
</script>
</body>
</html>`;
}

// Try to fetch a single data file, returning the matching story or null.
async function findStoryIn(siteUrl, file, id) {
  try {
    const res = await fetch(new URL(file, siteUrl).toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.stories)) return null;
    return data.stories.find(s => String(s.id) === String(id)) || null;
  } catch (_) {
    return null;
  }
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/s\/([\w-]+)$/);
    const id = m ? m[1] : null;
    if (!id) {
      return new Response('Not found', { status: 404 });
    }

    // Detect language from Accept-Language
    const al = (req.headers.get('accept-language') || '').toLowerCase();
    const lang = al.startsWith('de') ? 'de' : 'en';

    // Try archive first, then latest as fallback. NEVER fail the user — if both
    // fetches fail or story isn't in either, still render the app shell so the
    // client can resolve the deep-link itself.
    let story = await findStoryIn(url.origin, '/data/archive.json', id);
    if (!story) {
      story = await findStoryIn(url.origin, '/data/latest.json', id);
    }

    return new Response(renderHTML(story, lang, url.origin, id), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': story
          ? 'public, s-maxage=300, stale-while-revalidate=86400'
          : 'public, s-maxage=60, stale-while-revalidate=600'
      }
    });
  } catch (err) {
    // Even on unexpected errors, return a generic working page rather than a hard 500.
    return new Response(renderHTML(null, 'en', new URL(req.url).origin, 'unknown'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}
