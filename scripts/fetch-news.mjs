/* Kunstpuls news aggregator — archive version.
 *
 * Pipeline:
 *   1. Load master archive (data/archive.json)
 *   2. Fetch RSS from 10 international art-news sources
 *   3. Deduplicate against archive (URL hash)
 *   4. Send only NEW items to Claude (Haiku 4.5) with prompt caching
 *   5. Append enriched stories to archive
 *   6. Rebuild derived files: latest.json, by-category/*, by-month/*, sitemap.xml
 *   7. Exit cleanly
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
const SITE_URL = (process.env.SITE_URL || 'https://kunstpuls.app').replace(/\/$/, '');

const MODEL = 'claude-haiku-4-5-20251001';
const ITEMS_PER_SOURCE = 6;
const LATEST_HOURS = 72;
const SITEMAP_LIMIT = 5000;

// Browser-like User-Agent — many art magazines block generic bot UAs.
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 10 international sources
const SOURCES = [
  { name: 'The Art Newspaper', url: 'https://www.theartnewspaper.com/rss.xml',         defaultCat: 'museum' },
  { name: 'Artnet News',       url: 'https://news.artnet.com/feed',                    defaultCat: 'market'  },
  { name: 'Hyperallergic',     url: 'https://hyperallergic.com/feed/',                 defaultCat: 'exhibition' },
  { name: 'Frieze',            url: 'ht
