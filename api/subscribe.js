/**
 * ArtPulse — Newsletter subscribe endpoint.
 *
 * Receives { email } from the client, validates it, then submits to Beehiiv.
 * Secrets stay server-side. Returns JSON.
 *
 * Required environment variables (set in Vercel project settings):
 *   - BEEHIIV_API_KEY        (secret, format: bh_live_xxxxxxxx...)
 *   - BEEHIIV_PUBLICATION_ID (format: pub_xxxxxxxx-xxxx-...)
 */

export const config = { runtime: 'edge' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export default async function handler(req) {
  // CORS: same-origin only; the form on /subscribe is on the same domain.
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed' }, 405);
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId  = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !pubId) {
    console.error('Missing BEEHIIV env vars');
    return json({ ok: false, error: 'server-misconfigured' }, 500);
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid-json' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: 'invalid-email' }, 400);
  }

  // Submit to Beehiiv
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
          reactivate_existing: true,        // welcome back returning unsubs
          send_welcome_email: true,
          utm_source: 'artpulse-app',
          utm_medium: 'web',
          utm_campaign: 'in-feed-cta',
          referring_site: 'https://artpulse.app'
        })
      }
    );

    const beehiivData = await beehiivRes.json().catch(() => ({}));

    if (!beehiivRes.ok) {
      console.error('Beehiiv API error:', beehiivRes.status, beehiivData);
      return json(
        { ok: false, error: 'beehiiv-error', detail: beehiivData?.errors?.[0]?.message || 'subscription failed' },
        502
      );
    }

    return json({ ok: true, status: beehiivData?.data?.status || 'pending' });
  } catch (err) {
    console.error('Subscribe failed:', err);
    return json({ ok: false, error: 'network' }, 500);
  }
}
