/* ArtPulse news aggregator — archive version.
 *
 * What it does:
 *   1. Loads the existing master archive (data/archive.json)
 *   2. Fetches RSS from all sources
 *   3. Deduplicates new items against the archive
 *   4. Sends ONLY genuinely new items through Claude (Haiku 4.5)
 *      with prompt caching for the static system instructions
 *   5. Appends new items to the master archive
 *   6. Rebuilds derived files:
 *      - data/latest.json        (last 72h, what the app loads on open)
 *      - data/by-category/*.json (per-category indices)
 *      - data/by-month/*.json    (per-month indices)
 *      - sitemap.xml             (for SEO)
 *
 * Required env: ANTHROPIC_API_KEY
 * Optional env: SITE_URL (defaults to https://artpulse.app)
 */

import Parser from 'rss-parser';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const ARCHIVE_PATH = join(DATA_DIR, 'archive.json');
const LATEST_PATH = join(DATA_DIR, 'latest.json');
const BY_CAT_DIR = join(DATA_DIR, 'by-category');
const BY_MONTH_DIR = join(DATA_DIR, 'by-month');
const SITEMAP_PATH = join(ROOT, 'sitemap.xml');

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}
const SITE_URL = (process.env.SITE_URL || 'https://artpulse.app').replace(/\/$/, '');

const MODEL = 'claude-haiku-4-5-20251001';
const ITEMS_PER_SOURCE = 6;
const LATEST_HOURS = 72;
const SITEMAP_LIMIT = 5000;

// 10 international sources — verified working or strong best-guess URLs.
// Failed feeds are logged as warnings and the run continues with the others.
const SOURCES = [
  { name: 'The Art Newspaper', url: 'https://www.theartnewspaper.com/rss.xml',  defaultCat: 'museum' },
  { name: 'Artnet News',       url: 'https://news.artnet.com/feed',             defaultCat: 'market'  },
  { name: 'Hyperallergic',     url: 'https://hyperallergic.com/feed/',          defaultCat: 'exhibition' },
  { name: 'ArtAsiaPacific',    url: 'https://artasiapacific.com/feed',          defaultCat: 'exhibition' },
  { name: 'Ocula',             url: 'https://ocula.com/magazine/feed/',         defaultCat: 'exhibition' },
  { name: 'ArtReview',         url: 'https://artreview.com/rss.xml',            defaultCat: 'exhibition' },
  { name: 'ARTnews',           url: 'https://www.artnews.com/feed/',            defaultCat: 'market' },
  { name: 'Mousse Magazine',   url: 'https://www.moussemagazine.it/feed/',      defaultCat: 'exhibition' },
  { name: 'Monopol',           url: 'https://www.monopol-magazin.de/rss.xml',   defaultCat: 'exhibition' },
  { name: 'Wallpaper',         url: 'https://www.wallpaper.com/rss',            defaultCat: 'exhibition' }
];

const ACCENTS = {
  auction:     '#e8503a',
  exhibition:  '#d4a574',
  artists:     '#8b6f47',
  market:      '#c8553d',
  museum:      '#7a9e9f',
  biennale:    '#a8b89f',
  restitution: '#9b8579'
};
const CATEGORIES = Object.keys(ACCENTS);

function ensureDirs() {
  for (const d of [DATA_DIR, BY_CAT_DIR, BY_MONTH_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function loadArchive() {
  if (!existsSync(ARCHIVE_PATH)) return { stories: [], byId: {} };
  try {
    const raw = JSON.parse(readFileSync(ARCHIVE_PATH, 'utf-8'));
    const stories = Array.isArray(raw.stories) ? raw.stories : [];
    const byId = {};
    for (const s of stories) byId[s.id] = s;
    return { stories, byId };
  } catch (e) {
    console.warn('Could not parse archive, starting fresh:', e.message);
    return { stories: [], byId: {} };
  }
}

function stripHTML(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeURL(u) {
  if (!u) return '';
  try {
    const url = new URL(u);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(p => url.searchParams.delete(p));
    return (url.origin + url.pathname).toLowerCase().replace(/\/$/, '') + (url.search || '');
  } catch {
    return String(u).toLowerCase().trim();
  }
}

function storyIdFor(url, title) {
  const seed = url ? normalizeURL(url) : (title || '').toLowerCase().trim();
  return 's-' + createHash('sha256').update(seed).digest('base64url').slice(0, 14);
}

function timeAgo(date, lang) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return lang === 'de' ? 'gerade eben' : 'just now';
  const diff = (Date.now() - d.getTime()) / 1000;
  const h = Math.floor(diff / 3600);
  const day = Math.floor(diff / 86400);
  if (lang === 'de') {
    if (diff < 3600) return 'gerade eben';
    if (h < 24) return `vor ${h} Std`;
    if (day === 1) return 'gestern';
    if (day < 7) return `vor ${day} Tagen`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  }
  if (diff < 3600) return 'just now';
  if (h < 24) return `${h}h ago`;
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

/**
 * Extract an image URL from an RSS item, trying many sources in order:
 * 1. <enclosure> (RSS 2.0)
 * 2. <media:content> — handles arrays, picks the highest-resolution variant
 * 3. <media:thumbnail> — fallback if no media:content
 * 4. <itunes:image> — occasionally used by news publishers
 * 5. <description> HTML — separate field from content:encoded
 * 6. content:encoded / content / summary HTML — last resort
 *
 * For HTML sources, tries <img src>, <img data-src>, and <picture><source srcset>.
 * Resolves relative URLs against the item link. Filters tracking pixels.
 */
function extractImage(item) {
  // 1. <enclosure>
  if (item.enclosure && item.enclosure.url && isUsableImage(item.enclosure.url)) {
    return resolveUrl(item.enclosure.url, item.link);
  }

  // 2. <media:content> — can be a single object or an array of variants
  const mc = item['media:content'];
  if (mc) {
    const variants = Array.isArray(mc) ? mc : [mc];
    let best = null;
    let bestArea = 0;
    for (const v of variants) {
      if (!v || !v.$ || !v.$.url) continue;
      const url = v.$.url;
      if (!isUsableImage(url)) continue;
      // Prefer largest resolution if width/height are specified
      const w = parseInt(v.$.width, 10) || 0;
      const h = parseInt(v.$.height, 10) || 0;
      const area = w * h;
      if (area > bestArea || best === null) {
        best = url;
        bestArea = area;
      }
    }
    if (best) return resolveUrl(best, item.link);
  }

  // 3. <media:thumbnail>
  const mt = item['media:thumbnail'];
  if (mt) {
    const variants = Array.isArray(mt) ? mt : [mt];
    for (const v of variants) {
      if (v && v.$ && v.$.url && isUsableImage(v.$.url)) {
        return resolveUrl(v.$.url, item.link);
      }
    }
  }

  // 4. <itunes:image>
  const itu = item['itunes:image'];
  if (itu) {
    const href = (itu.$ && itu.$.href) || itu.href || (typeof itu === 'string' ? itu : null);
    if (href && isUsableImage(href)) return resolveUrl(href, item.link);
  }

  // 5/6. HTML fields — try description separately first, then content fallbacks
  const htmlSources = [
    item.description,
    item['content:encoded'],
    item.content,
    item.summary
  ].filter(Boolean);

  for (const html of htmlSources) {
    const found = extractImageFromHtml(String(html));
    if (found && isUsableImage(found)) {
      return resolveUrl(found, item.link);
    }
  }

  return null;
}

/**
 * Try multiple HTML img extraction patterns. Returns first valid URL.
 * Patterns checked: <img src>, <img data-src>, <img data-lazy>,
 * <picture><source srcset>, plain <source srcset>.
 */
function extractImageFromHtml(html) {
  // 1. <img src> — most common
  const imgSrc = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgSrc) return imgSrc[1];

  // 2. <img data-src> — common for lazy-loaded images
  const imgDataSrc = html.match(/<img[^>]+data-src=["']([^"']+)["']/i);
  if (imgDataSrc) return imgDataSrc[1];

  // 3. <img data-lazy-src> — WordPress plugin pattern
  const imgDataLazy = html.match(/<img[^>]+data-lazy[^=]*=["']([^"']+)["']/i);
  if (imgDataLazy) return imgDataLazy[1];

  // 4. <source srcset> — pick first URL before any descriptor like "1x" or "640w"
  const srcset = html.match(/<source[^>]+srcset=["']([^"']+)["']/i);
  if (srcset) {
    const first = srcset[1].split(',')[0].trim().split(/\s+/)[0];
    if (first) return first;
  }

  return null;
}

/**
 * Filter out URLs that are clearly not usable as story images:
 * - Tracking pixels (1×1, "pixel", "beacon", "track" in URL)
 * - Ad/analytics domains
 * - SVG icons (often UI chrome, not real images)
 * - Data URIs (typically tiny placeholders)
 */
function isUsableImage(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:')) return false;
  const lower = url.toLowerCase();
  // Tracking pixel patterns
  if (/[/_-](pixel|beacon|track|stat|analytics|counter)[/_.-]/.test(lower)) return false;
  if (/[?&](w|width|h|height)=1(&|$)/.test(lower)) return false;
  // 1x1 spacer GIFs
  if (/\b1x1\b/.test(lower) || /\bspacer\b/.test(lower) || /\bblank\.gif\b/.test(lower)) return false;
  // SVG icons (usually UI chrome)
  if (lower.endsWith('.svg')) return false;
  // Avatars / share buttons often have these names
  if (/\b(avatar|gravatar|icon|sprite|logo-only)\b/.test(lower) && !/\b(article|story|hero|featured)\b/.test(lower)) {
    return false;
  }
  return true;
}

/**
 * Resolve a possibly-relative image URL against the article's base URL.
 * If `imageUrl` is already absolute (http/https/protocol-relative), return as-is.
 */
function resolveUrl(imageUrl, baseUrl) {
  if (!imageUrl) return null;
  // Already absolute
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  // Protocol-relative — assume https
  if (imageUrl.startsWith('//')) return 'https:' + imageUrl;
  // Need a base to resolve against
  if (!baseUrl) return imageUrl;
  try {
    return new URL(imageUrl, baseUrl).href;
  } catch {
    return imageUrl;
  }
}

const SYSTEM_PROMPT = `You are the news editor for ArtPulse, an international art-news app with a Shorts-style feed.

For each news item you receive, output a JSON object with these fields:
- "i": the index number provided
- "cat": one of: auction, exhibition, artists, market, museum, biennale, restitution. Pick the BEST fit.
- "kicker_en": 2-5 word location or context (e.g. "Tate Modern, London", "Market analysis", "Venice 2026")
- "kicker_de": German equivalent
- "headline_en": tight, clear English headline, max 70 chars, no clickbait
- "headline_de": same in German
- "summary_en": exactly 2 sentences, max 220 chars total, capture the news
- "summary_de": same in German
- "body_en": 3-5 sentences expanding the summary with concrete detail from the content
- "body_de": same in German
- "read": estimated reading time in minutes (integer 2-8)

Use the typographic style of serious art press: factual, neutral, precise. No hyperbole. Real names and institutions.

Output ONLY a JSON array, no commentary, no markdown fences.`;

async function classifyAndSummarize(items) {
  const numbered = items.map((it, i) => (
    `[${i + 1}] SOURCE: ${it.source}\nTITLE: ${it.title}\nCONTENT: ${it.snippet}\n---`
  )).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      // Prompt caching saves ~90% on input cost for the system prompt across multiple
      // batch calls within the same run (5-minute ephemeral cache).
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: 'ITEMS:\n' + numbered }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const data = await res.json();

  if (data.usage) {
    const u = data.usage;
    if (u.cache_read_input_tokens || u.cache_creation_input_tokens) {
      console.log(`    cache: read=${u.cache_read_input_tokens || 0}, created=${u.cache_creation_input_tokens || 0}, fresh=${u.input_tokens}`);
    }
  }

  const raw = data.content?.[0]?.text || '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Could not parse Claude response: ' + cleaned.slice(0, 200));
  }
}

function buildDerivedFiles(stories) {
  const sorted = [...stories].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // latest.json — last 72h with refreshed time strings
  const cutoff = Date.now() - LATEST_HOURS * 3600 * 1000;
  const latest = sorted.filter(s => new Date(s.publishedAt).getTime() > cutoff)
    .map(s => ({
      ...s,
      time_en: timeAgo(s.publishedAt, 'en'),
      time_de: timeAgo(s.publishedAt, 'de')
    }));
  writeFileSync(LATEST_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: latest.length,
    stories: latest
  }, null, 2));
  console.log(`  latest.json: ${latest.length} stories (last ${LATEST_HOURS}h)`);

  // by-category
  for (const cat of CATEGORIES) {
    const items = sorted.filter(s => s.cat === cat).map(s => ({
      ...s,
      time_en: timeAgo(s.publishedAt, 'en'),
      time_de: timeAgo(s.publishedAt, 'de')
    }));
    writeFileSync(join(BY_CAT_DIR, `${cat}.json`), JSON.stringify({
      generatedAt: new Date().toISOString(),
      category: cat,
      count: items.length,
      stories: items
    }, null, 2));
  }
  console.log(`  by-category/: ${CATEGORIES.length} files`);

  // by-month
  const byMonth = {};
  for (const s of sorted) {
    const d = new Date(s.publishedAt);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    (byMonth[key] = byMonth[key] || []).push(s);
  }
  for (const [month, items] of Object.entries(byMonth)) {
    writeFileSync(join(BY_MONTH_DIR, `${month}.json`), JSON.stringify({
      generatedAt: new Date().toISOString(),
      month,
      count: items.length,
      stories: items
    }, null, 2));
  }
  console.log(`  by-month/: ${Object.keys(byMonth).length} files`);
}

function buildSitemap(stories) {
  const sorted = [...stories]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, SITEMAP_LIMIT);
  const urls = [
    `  <url>\n    <loc>${SITE_URL}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>`
  ];
  for (const s of sorted) {
    urls.push(`  <url>\n    <loc>${SITE_URL}/s/${s.id}</loc>\n    <lastmod>${s.publishedAt}</lastmod>\n    <changefreq>never</changefreq>\n    <priority>0.7</priority>\n  </url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  writeFileSync(SITEMAP_PATH, xml);
  console.log(`  sitemap.xml: ${sorted.length} URLs`);
}

async function run() {
  ensureDirs();
  const archive = loadArchive();
  console.log(`Loaded archive: ${archive.stories.length} stories.`);

  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
  });

  console.log(`\nFetching ${SOURCES.length} sources...`);
  const candidates = [];
  for (const src of SOURCES) {
    try {
      const feed = await parser.parseURL(src.url);
      const items = (feed.items || []).slice(0, ITEMS_PER_SOURCE);
      console.log(`  ${src.name}: ${items.length} items`);
      for (const it of items) {
        const url = it.link || '';
        const id = storyIdFor(url, it.title);
        if (archive.byId[id]) continue;
        candidates.push({
          id,
          source: src.name,
          defaultCat: src.defaultCat,
          title: stripHTML(it.title || ''),
          snippet: stripHTML(it.contentSnippet || it.content || it.summary || '').slice(0, 1200),
          url,
          publishedAt: it.isoDate || it.pubDate || new Date().toISOString(),
          image: extractImage(it)
        });
      }
    } catch (err) {
      console.warn(`  ${src.name}: FAILED (${err.message})`);
    }
  }

  console.log(`\n${candidates.length} new items after dedup against ${archive.stories.length} archived.`);

  if (candidates.length === 0) {
    console.log('Nothing new to process. Rebuilding derived files only.');
    buildDerivedFiles(archive.stories);
    buildSitemap(archive.stories);
    return;
  }

  console.log(`\nProcessing ${candidates.length} new items with Claude (${MODEL})...`);
  const BATCH = 6;
  const enriched = {};
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    console.log(`  batch ${batchNum}: items ${i + 1}-${i + batch.length}`);
    try {
      const results = await classifyAndSummarize(batch);
      for (const r of results) {
        const localIdx = (r.i || 0) - 1;
        if (localIdx >= 0 && localIdx < batch.length) {
          enriched[batch[localIdx].id] = r;
        }
      }
    } catch (err) {
      console.warn(`    batch ${batchNum} failed: ${err.message}`);
    }
  }

  let added = 0;
  for (const c of candidates) {
    const e = enriched[c.id];
    if (!e) continue;
    const cat = (e.cat || c.defaultCat || 'exhibition').toLowerCase();
    const story = {
      id: c.id,
      cat,
      accent: ACCENTS[cat] || '#e8503a',
      image: c.image,
      source: c.source,
      url: c.url,
      publishedAt: c.publishedAt,
      time_en: timeAgo(c.publishedAt, 'en'),
      time_de: timeAgo(c.publishedAt, 'de'),
      read: typeof e.read === 'number' ? Math.max(2, Math.min(8, Math.round(e.read))) : 3,
      kicker_en: e.kicker_en || '',
      kicker_de: e.kicker_de || e.kicker_en || '',
      headline_en: e.headline_en || c.title,
      headline_de: e.headline_de || e.headline_en || c.title,
      summary_en: e.summary_en || '',
      summary_de: e.summary_de || e.summary_en || '',
      body_en: e.body_en || '',
      body_de: e.body_de || e.body_en || ''
    };
    archive.stories.push(story);
    archive.byId[story.id] = story;
    added++;
  }

  archive.stories.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  writeFileSync(ARCHIVE_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: archive.stories.length,
    stories: archive.stories
  }, null, 2));
  console.log(`\n\u2713 Added ${added} new stories. Archive now contains ${archive.stories.length}.`);

  console.log('\nRebuilding derived files:');
  buildDerivedFiles(archive.stories);
  buildSitemap(archive.stories);
}

run()
  .then(() => {
    console.log('\nDone. Exiting cleanly.');
    process.exit(0);
  })
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
