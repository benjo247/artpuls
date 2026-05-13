/* Vercel Edge Function — SEO permalink renderer.
 *
 * Path: /s/[id] (rewritten via vercel.json)
 *
 * What it does:
 *   1. Looks up the story in data/archive.json
 *   2. Returns HTML with proper OG tags, title, structured data
 *   3. The same app shell loads and resolves the deep-link client-side
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

function renderHTML(story, lang, siteUrl) {
  lang = lang === 'de' ? 'de' : 'en';
  const headline = story[`headline_${lang}`] || story.headline_en || '';
  const summary  = story[`summary_${lang}`]  || story.summary_en  || '';
  const body     = story[`body_${lang}`]     || story.body_en     || '';
  const kicker   = story[`kicker_${lang}`]   || story.kicker_en   || '';
  const image    = story.image || `${siteUrl}/icons/og-default.png`;
  const url      = `${siteUrl}/s/${story.id}`;
  const title    = `${headline} — ArtPulse`;
  const desc     = summary.slice(0, 200);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0e0d0b">
<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(desc)}">
<link rel="canonical" href="${url}">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHTML(headline)}">
<meta property="og:description" content="${escapeHTML(desc)}">
<meta property="og:image" content="${escapeHTML(image)}">
<meta property="og:site_name" content="ArtPulse">
<meta property="article:published_time" content="${story.publishedAt}">
<meta property="article:section" content="${story.cat}">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHTML(headline)}">
<meta name="twitter:description" content="${escapeHTML(desc)}">
<meta name="twitter:image" content="${escapeHTML(image)}">

<!-- Structured data for Google -->
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
</script>

<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">

<!--
  AdSense loader. Uncomment when AdSense is approved.
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
-->
</head>
<body>
<!-- Server-rendered article visible to crawlers and JS-disabled clients -->
<noscript>
<article style="max-width:680px;margin:40px auto;padding:24px;color:#f4f1ea">
  <p style="font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a8a094;margin-bottom:12px">${escapeHTML(kicker)} · ${escapeHTML(story.source)}</p>
  <h1 style="font-family:'Instrument Serif',serif;font-weight:400;font-size:36px;line-height:1.08;margin-bottom:16px">${escapeHTML(headline)}</h1>
  <p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:20px;line-height:1.45;margin-bottom:20px">${escapeHTML(summary)}</p>
  <p style="font-size:15px;line-height:1.65;margin-bottom:16px">${escapeHTML(body)}</p>
  ${story.url ? `<p><a href="${escapeHTML(story.url)}" style="color:#e8503a">Read at source \u2192</a></p>` : ''}
</article>
</noscript>

<!-- Full app shell -->
<div class="phone">
  <header class="header">
    <div class="header-top">
      <div class="logo"><span class="logo-mark">&bull;</span><span>Kunst<em>puls</em></span></div>
      <div class="header-actions">
        <div class="lang" id="lang">
          <button data-lang="en" class="${lang === 'en' ? 'on' : ''}">EN</button>
          <button data-lang="de" class="${lang === 'de' ? 'on' : ''}">DE</button>
        </div>
        <button class="icon-btn" aria-label="Search">
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
      <span class="loading-label" id="loadingLabel">Loading…</span>
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
</div>

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

    // Fetch the archive from the same deployment (uses Vercel's edge cache)
    const archiveRes = await fetch(new URL('/data/archive.json', url.origin).toString(), {
      cf: { cacheTtl: 300 }
    });
    if (!archiveRes.ok) {
      return new Response('Archive unavailable', { status: 503 });
    }
    const archive = await archiveRes.json();
    const story = (archive.stories || []).find(s => String(s.id) === String(id));
    if (!story) {
      return new Response('Story not found', { status: 404 });
    }

    return new Response(renderHTML(story, lang, url.origin), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400'
      }
    });
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 });
  }
}
