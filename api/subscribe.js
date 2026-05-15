/**
 * ArtPulse — Newsletter subscribe endpoint.
 *
 * Receives { email, website? } from the client, validates, then submits to Beehiiv.
 * Secrets stay server-side. Returns JSON.
 *
 * Security layers:
 *   - Origin check: only artpulse.app and localhost
 *   - Honeypot field "website" — must be empty (bots fill all fields)
 *   - Soft in-memory rate limit per IP + per email
 *   - No internal error leakage to client
 *   - DOI-aware status handling
 *
 * Required environment variables (set in Vercel project settings):
 *   - BEEHIIV_API_KEY        (secret, format: bh_live_xxxxxxxx...)
 *   - BEEHIIV_PUBLICATION_ID (format: pub_xxxxxxxx-xxxx-...)
 */

export const config = { runtime: 'edge' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Allowed origins for cross-origin POSTs to this endpoint
const ALLOWED_ORIGINS = new Set([
  'https://artpulse.app',
  'https://www.artpulse.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000'
]);

// Soft rate limiting (per-instance memory, not cluster-wide).
// Vercel Edge instances may not share state — this is a defense layer,
// not a hard guarantee. For stronger guarantees use Vercel KV or Upstash.
const RATE_WINDOW_MS = 60 * 1000;        // 1 minute
const RATE_MAX_PER_IP = 5;                // max submissions per IP per minute
const EMAIL_BLOCK_MS = 24 * 60 * 60 * 1000;  // 24h block after subscribe attempt

const ipBucket = new Map();
const emailBucket = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function getClientIP(req) {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || 'unknown';
}

function checkRateLimit(ip, email) {
  const now = Date.now();

  // IP-based limit
  const ipEntry = ipBucket.get(ip);
  if (ipEntry && now < ipEntry.resetAt) {
    if (ipEntry.count >= RATE_MAX_PER_IP) return false;
    ipEntry.count++;
  } else {
    ipBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }

  // Email-based limit (block re-submit storms for same email)
  const emailReset = emailBucket.get(email);
  if (emailReset && now < emailReset) return false;
  emailBucket.set(email, now + EMAIL_BLOCK_MS);

  // Opportunistic cleanup
  if (ipBucket.size > 1000) {
    for (const [k, v] of ipBucket) if (now > v.resetAt) ipBucket.delete(k);
  }
  if (emailBucket.size > 5000) {
    for (const [k, v] of emailBucket) if (now > v) emailBucket.delete(k);
  }

  return true;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed' }, 405);
  }

  // Origin check — only same-site or localhost dev allowed.
  // Origin header is sent by browsers on POST; absence means non-browser caller.
  const origin = req.headers.get('origin') || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId  = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !pubId) {
    console.error('Missing BEEHIIV env vars');
    return json({ ok: false, error: 'server-misconfigured' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid-json' }, 400);
  }

  // Honeypot — bots fill all fields; real users never see this one.
  // Silently accept so bots don't learn the trick.
  if (body.website && String(body.website).length > 0) {
    return json({ ok: true, status: 'pending' });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: 'invalid-email' }, 400);
  }

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, email)) {
    return json({ ok: false, error: 'rate-limited' }, 429);
  }

  // Submit to Beehiiv.
  // When DOI is enabled in publication settings, Beehiiv returns status='pending'
  // and sends a confirmation email. The user must click the link to become 'active'.
  // Docs: https://developers.beehiiv.com/docs/v2/y2nrf9yjlsm6c-create-a-subscription
  try {
    const beehiivRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: false,         // DOI confirmation email replaces welcome
          double_opt_override: 'on',         // belt + suspenders: enforce DOI
          utm_source: 'artpulse-app',
          utm_medium: 'web',
          utm_campaign: 'in-feed-cta',
          referring_site: 'https://artpulse.app'
        })
      }
    );

    const beehiivData = await beehiivRes.json().catch(() => ({}));

    if (!beehiivRes.ok) {
      // Log details server-side; DO NOT leak Beehiiv internals to client.
      console.error('Beehiiv API error:', beehiivRes.status, beehiivData);
      return json({ ok: false, error: 'subscription-failed' }, 502);
    }

    // Status will typically be 'pending' (DOI confirmation needed) or 'active'.
    const status = beehiivData?.data?.status === 'active' ? 'active' : 'pending';
    return json({ ok: true, status });
  } catch (err) {
    console.error('Subscribe failed:', err);
    return json({ ok: false, error: 'network' }, 500);
  }
}
