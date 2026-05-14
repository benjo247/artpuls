#!/usr/bin/env node
/**
 * ArtPulse Monthly Newsletter Builder
 *
 * Reads data/archive.json, picks 6-8 top stories from the last 30 days,
 * generates an editorial intro + subject line via Claude Haiku, and writes:
 *   - newsletter-draft.html  (the rendered email HTML, ready to paste in Beehiiv)
 *   - newsletter-meta.json   (subject line + story count for the GitHub Issue)
 *
 * Triggered monthly by .github/workflows/newsletter.yml.
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY — already set as GitHub secret for the news pipeline
 *
 * The output is bilingual (DE primary, EN section below) so Ben can pick at
 * send-time in Beehiiv. First version: send DE only.
 */

import fs from 'node:fs/promises';

const ARCHIVE_PATH = 'data/archive.json';
const OUTPUT_HTML = 'newsletter-draft.html';
const OUTPUT_META = 'newsletter-meta.json';

const MODEL = 'claude-haiku-4-5-20251001';
const DAYS_BACK = 32;
const STORY_TARGET = 7;
const MAX_PER_CATEGORY = 2;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set');
  process.exit(1);
}

// ===== Helpers =====

function escapeHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function pickText(story, key, lang) {
  const v = story[`${key}_${lang}`] || story[`${key}_en`] || story[key];
  return v && String(v).trim() ? String(v).trim() : '';
}

function catLabelDE(cat) {
  const map = {
    auction: 'Auktion',
    exhibition: 'Ausstellung',
    artists: 'Künstler:innen',
    market: 'Markt',
    museum: 'Museum',
    biennale: 'Biennale',
    restitution: 'Restitution',
  };
  return map[cat] || cat || 'News';
}

function formatIssueDate(d) {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ===== Story selection =====

function selectStories(stories) {
  const cutoff = Date.now() - DAYS_BACK * 24 * 3600 * 1000;
  const recent = stories.filter(s => {
    if (!s.publishedAt) return false;
    const ts = new Date(s.publishedAt).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });

  // Sort newest first
  recent.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Pass 1: prefer image-bearing stories, max 2 per category
  const selected = [];
  const seenIds = new Set();
  const byCat = {};
  const withImage = recent.filter(s => s.image);
  const withoutImage = recent.filter(s => !s.image);

  for (const s of withImage) {
    if (selected.length >= STORY_TARGET) break;
    const cat = s.cat || 'misc';
    byCat[cat] = byCat[cat] || 0;
    if (byCat[cat] >= MAX_PER_CATEGORY) continue;
    selected.push(s);
    seenIds.add(s.id);
    byCat[cat]++;
  }

  // Pass 2: relax category limit, still prefer images
  if (selected.length < STORY_TARGET) {
    for (const s of withImage) {
      if (selected.length >= STORY_TARGET) break;
      if (seenIds.has(s.id)) continue;
      selected.push(s);
      seenIds.add(s.id);
    }
  }

  // Pass 3: fill remaining with image-less stories
  if (selected.length < STORY_TARGET) {
    for (const s of withoutImage) {
      if (selected.length >= STORY_TARGET) break;
      if (seenIds.has(s.id)) continue;
      selected.push(s);
      seenIds.add(s.id);
    }
  }

  return selected;
}

// ===== Claude API =====

async function callClaude(prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.content[0].text.trim();
}

async function generateIntro(stories, lang = 'de') {
  const lines = stories.map((s, i) => {
    const h = pickText(s, 'headline', lang);
    const sum = pickText(s, 'summary', lang);
    return `${i + 1}. [${s.cat}] ${h} — ${sum}`;
  }).join('\n');

  const prompt = lang === 'de' ? `Du bist Ben, abstrakter Maler und Herausgeber von ArtPulse, einem monatlichen Newsletter über die internationale Kunstwelt.

Folgende Stories erscheinen in der aktuellen Ausgabe:

${lines}

Schreibe eine 3-4 sätzige Editorial-Note als Einleitung. Beobachte 1-2 Themen oder Verbindungen zwischen den Stories. Voice: editorial mit persönlicher Note — du als Künstler, der die Kunstwelt von der Seite beobachtet. Kein Marketing-Speak, keine generischen Floskeln. Schreibe NUR den Editorial-Text. Keine Anrede ("Hi!" etc.) und keine Signatur. Plain Text, keine Markdown-Formatierung.` : `You are Ben, an abstract painter and editor of ArtPulse, a monthly newsletter on the international art world.

These stories appear in this issue:

${lines}

Write a 3-4 sentence editorial intro. Note 1-2 themes or connections between the stories. Voice: editorial with a personal note — you as an artist observing the art world from the side. No marketing speak, no generic phrases. Write ONLY the editorial text. No greeting ("Hi!" etc.) and no signature. Plain text, no markdown.`;

  return await callClaude(prompt, 400);
}

async function generateSubject(stories) {
  const topHeadlines = stories.slice(0, 3).map(s =>
    pickText(s, 'headline', 'de')
  ).filter(Boolean).join(' | ');

  const prompt = `Generiere eine Email-Subject-Line für einen monatlichen Kunstnachrichten-Newsletter. Maximal 55 Zeichen. Konkret, nicht reißerisch, kein Clickbait. Bezugnahme auf 1-2 Themen aus den Stories ist gut. Sprache: Deutsch.

Hauptstories dieser Ausgabe:
${topHeadlines}

Antwort: NUR die Subject-Line. Keine Anführungszeichen. Keine Erklärung.`;

  let subject = await callClaude(prompt, 80);
  subject = subject.replace(/^["'„]|["'"]$/g, '').trim();
  // Hard cap at 65 chars to be safe
  if (subject.length > 65) subject = subject.slice(0, 62) + '...';
  return subject;
}

// ===== HTML rendering =====
// Email-safe: table-based, inline styles, system fonts, 600px max width.
// Tested with Gmail, Apple Mail, Outlook in mind.

function renderStoryRow(s, lang) {
  const headline = escapeHTML(pickText(s, 'headline', lang));
  const summary = escapeHTML(pickText(s, 'summary', lang));
  const source = escapeHTML(s.source || '');
  const cat = escapeHTML(catLabelDE(s.cat));
  const permalink = `https://artpulse.app/s/${encodeURIComponent(s.id)}`;
  const sourceUrl = s.url || permalink;
  const readMore = lang === 'de' ? 'Weiterlesen →' : 'Read more →';

  let imageHTML = '';
  if (s.image) {
    imageHTML = `
        <tr>
          <td style="padding:0 0 18px 0;">
            <a href="${escapeAttr(permalink)}" style="text-decoration:none;display:block;">
              <img src="${escapeAttr(s.image)}" alt="${escapeAttr(headline)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;border-radius:2px;">
            </a>
          </td>
        </tr>`;
  }

  return `
  <tr>
    <td style="padding:28px 40px 28px 40px;border-bottom:1px solid #e5e1d8;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${imageHTML}
        <tr>
          <td>
            <div style="font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#c43d29;margin-bottom:8px;">
              ${cat}${source ? ` &middot; ${source}` : ''}
            </div>
            <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.15;font-weight:normal;letter-spacing:-0.01em;color:#1a1a1a;">
              <a href="${escapeAttr(permalink)}" style="color:#1a1a1a;text-decoration:none;">${headline}</a>
            </h2>
            <p style="margin:0 0 16px 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#3a3528;">
              ${summary}
            </p>
            <a href="${escapeAttr(permalink)}" style="font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#c43d29;text-decoration:none;border-bottom:1px solid #c43d29;padding-bottom:1px;">${readMore}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderNewsletter({ intro, stories, issueDate, lang = 'de' }) {
  const storiesHTML = stories.map(s => renderStoryRow(s, lang)).join('\n');
  const issueLabel = lang === 'de' ? `Ausgabe ${formatIssueDate(issueDate)}` : `Issue ${formatIssueDate(issueDate)}`;
  const thisMonth = lang === 'de' ? 'Diesen Monat' : 'This month';
  const storyCount = lang === 'de' ? `${stories.length} Stories` : `${stories.length} stories`;
  const tagline = lang === 'de'
    ? 'Internationale Kunstwelt, monatlich kondensiert.'
    : 'International art world, condensed monthly.';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ArtPulse — ${escapeHTML(issueLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0e8;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f0e8;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fffdf7;">

        <!-- Header -->
        <tr>
          <td style="padding:36px 40px 24px 40px;border-bottom:1px solid #e5e1d8;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:-0.01em;color:#1a1a1a;">
                    <span style="color:#c43d29;">&bull;</span> Art<em>Pulse</em>
                  </div>
                </td>
                <td align="right" valign="bottom">
                  <div style="font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#6b6458;">
                    ${escapeHTML(issueLabel)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Editorial note -->
        <tr>
          <td style="padding:40px 40px 32px 40px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;line-height:1.55;color:#3a3528;">
              ${escapeHTML(intro)}
            </div>
            <div style="margin-top:20px;font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:11px;color:#6b6458;letter-spacing:0.06em;">
              — Ben
            </div>
          </td>
        </tr>

        <!-- Section divider -->
        <tr>
          <td style="padding:0 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e5e1d8;border-bottom:1px solid #e5e1d8;">
              <tr>
                <td style="padding:16px 0;">
                  <span style="font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#c43d29;">${escapeHTML(thisMonth)}</span>
                </td>
                <td align="right" style="padding:16px 0;">
                  <span style="font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:11px;color:#6b6458;letter-spacing:0.06em;">${escapeHTML(storyCount)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Stories -->
        ${storiesHTML}

        <!-- Footer -->
        <tr>
          <td style="padding:32px 40px;background:#f4f0e8;">
            <p style="margin:0 0 8px 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#3a3528;line-height:1.5;">
              ${escapeHTML(tagline)}
            </p>
            <p style="margin:0;font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:10px;color:#6b6458;text-transform:uppercase;letter-spacing:0.12em;">
              <a href="https://artpulse.app" style="color:#c43d29;text-decoration:none;">artpulse.app</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ===== Main =====

async function main() {
  console.log('Loading archive...');
  const archive = JSON.parse(await fs.readFile(ARCHIVE_PATH, 'utf-8'));
  const allStories = archive.stories || [];
  console.log(`Archive contains ${allStories.length} stories.`);

  const selected = selectStories(allStories);
  console.log(`Selected ${selected.length} stories.`);

  if (selected.length === 0) {
    console.error('No stories selected — archive may be empty or all too old.');
    process.exit(1);
  }

  console.log('Generating editorial intro (German)...');
  const introDE = await generateIntro(selected, 'de');
  console.log('Intro DE:', introDE);

  console.log('Generating subject line...');
  const subject = await generateSubject(selected);
  console.log('Subject:', subject);

  console.log('Rendering DE newsletter HTML...');
  const htmlDE = renderNewsletter({
    intro: introDE,
    stories: selected,
    issueDate: new Date(),
    lang: 'de',
  });

  await fs.writeFile(OUTPUT_HTML, htmlDE);
  await fs.writeFile(OUTPUT_META, JSON.stringify({
    subject,
    count: selected.length,
    categories: [...new Set(selected.map(s => s.cat))],
    generatedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`Wrote ${OUTPUT_HTML} (${htmlDE.length} chars) and ${OUTPUT_META}.`);
}

main().catch(err => {
  console.error('Newsletter build failed:', err);
  process.exit(1);
});
