/* ArtPulse — AdSense integration & placement logic.
 *
 * Kept separate from app.js so you can tune frequency, slots, and rules
 * without touching the main app. To go live:
 *   1. Set CONFIG.enabled = true
 *   2. Fill CONFIG.publisherId with your AdSense ca-pub-XXX ID
 *   3. Fill CONFIG.slots with your ad unit slot IDs
 *   4. Uncomment the AdSense <script> tag in index.html
 */

(function () {
  'use strict';

  // ====== CONFIG — edit these when AdSense is approved ======
  var CONFIG = {
    enabled: false,                       // master switch
    publisherId: 'ca-pub-XXXXXXXXXXXXXXXX',
    slots: {
      inFeed: 'XXXXXXXXXX',               // in-feed full-card slot ID
      inArticle: 'YYYYYYYYYY'             // in-article rectangle slot ID
    },

    // ---- Placement rules ----
    rules: {
      // First ad never before the Nth story — let the user get hooked
      firstAdPosition: 4,

      // Cadence afterwards (new vs returning users get different intervals)
      intervalNewUser: 7,                 // first session: lower density
      intervalReturning: 5,               // returning: standard density

      // Hard caps
      maxPerSession: 8,                   // never more than N ads per session
      sessionMinutes: 30,                 // a session expires after N min of inactivity

      // Topic guard — never show ads adjacent to these categories
      // (e.g. restitution stories are sensitive; many advertisers don't fit)
      sensitiveCategories: ['restitution']
    },

    // ---- Format choices ----
    // 'fluid' = native-styled card, 'auto' = standard responsive
    formats: {
      inFeed: 'fluid',
      inArticle: 'auto'
    }
  };

  // ====== Session tracking ======
  function getSession() {
    try {
      var raw = localStorage.getItem('kp-session');
      if (raw) {
        var s = JSON.parse(raw);
        var ageMin = (Date.now() - s.start) / 60000;
        if (ageMin < CONFIG.rules.sessionMinutes) return s;
      }
    } catch (e) {}
    var fresh = { start: Date.now(), isNew: !localStorage.getItem('kp-visited'), adsShown: 0 };
    try {
      localStorage.setItem('kp-session', JSON.stringify(fresh));
      localStorage.setItem('kp-visited', '1');
    } catch (e) {}
    return fresh;
  }

  function persistSession(s) {
    try { localStorage.setItem('kp-session', JSON.stringify(s)); } catch (e) {}
  }

  // ====== Placement decision ======
  function injectInto(stories) {
    /* Takes a list of stories, returns a list with ad markers inserted
       at intelligent positions. Each ad marker has { isAd: true, slot: 'inFeed', id: 'ad-N' }.
       PURE function — does not mutate session counter, so it's safe to call
       on every render (e.g. when user switches category). When AdSense is live,
       actual impressions are frequency-capped server-side by Google. */
    // Master switch — no ad markers injected when disabled (no placeholders shown).
    if (!CONFIG.enabled) return stories || [];

    var session = getSession();
    var interval = session.isNew ? CONFIG.rules.intervalNewUser : CONFIG.rules.intervalReturning;
    var first = CONFIG.rules.firstAdPosition;
    var maxAds = CONFIG.rules.maxPerSession;
    if (maxAds <= 0 || !stories || !stories.length) return stories || [];

    var out = [];
    var adsInserted = 0;
    var sensitiveAhead = false;

    for (var i = 0; i < stories.length; i++) {
      var s = stories[i];
      out.push(s);

      // Check: is the next story sensitive?
      var next = stories[i + 1];
      sensitiveAhead = !!(next && CONFIG.rules.sensitiveCategories.indexOf(next.cat) !== -1);

      var position = i + 1;  // 1-indexed
      var afterFirst = position >= first;
      var atInterval = (position - first) % interval === 0;
      var notLast = (i < stories.length - 1);  // never as final card

      if (afterFirst && atInterval && !sensitiveAhead && notLast && adsInserted < maxAds) {
        out.push({
          isAd: true,
          slot: 'inFeed',
          id: 'ad-feed-' + position
        });
        adsInserted++;
      }
    }

    return out;
  }

  // ====== Rendering ======
  function renderInFeed(adMarker) {
    /* Returns the HTML for a full-screen in-feed ad card. */
    // No placeholders when ads are disabled (injectInto already won't emit markers,
    // but be defensive in case this is called directly).
    if (!CONFIG.enabled) return '';
    if (CONFIG.publisherId && CONFIG.slots.inFeed) {
      // Real AdSense markup
      return '' +
        '<article class="card card-ad" data-ad-id="' + adMarker.id + '">' +
          '<div class="ad-shell">' +
            '<div class="ad-label"><span class="ad-dot"></span>Advertisement</div>' +
            '<ins class="adsbygoogle"' +
              ' style="display:block;width:100%;max-width:336px;margin:0 auto"' +
              ' data-ad-client="' + CONFIG.publisherId + '"' +
              ' data-ad-slot="' + CONFIG.slots.inFeed + '"' +
              ' data-ad-format="' + CONFIG.formats.inFeed + '"' +
              ' data-full-width-responsive="true"></ins>' +
          '</div>' +
        '</article>';
    }
    // Placeholder (pre-AdSense or development)
    return '' +
      '<article class="card card-ad" data-ad-id="' + adMarker.id + '">' +
        '<div class="ad-shell">' +
          '<div class="ad-label"><span class="ad-dot"></span>Advertisement</div>' +
          '<div class="ad-frame">' +
            '<div class="ad-mark">336 \u00D7 280</div>' +
            '<div class="ad-headline">Ad space</div>' +
            '<div class="ad-sub">In-feed slot \u00B7 AdSense-ready</div>' +
          '</div>' +
          '<div class="ad-note">Ads appear in the same editorial frame as stories \u2014 clearly labeled, never breaking the reading flow.</div>' +
        '</div>' +
      '</article>';
  }

  function renderInArticle() {
    /* Returns the HTML for an in-article ad slot. */
    if (!CONFIG.enabled) return '';
    if (CONFIG.publisherId && CONFIG.slots.inArticle) {
      return '' +
        '<div class="inline-ad">' +
          '<span class="ad-label-small">Advertisement</span>' +
          '<ins class="adsbygoogle"' +
            ' style="display:block"' +
            ' data-ad-client="' + CONFIG.publisherId + '"' +
            ' data-ad-slot="' + CONFIG.slots.inArticle + '"' +
            ' data-ad-format="' + CONFIG.formats.inArticle + '"' +
            ' data-full-width-responsive="true"></ins>' +
        '</div>';
    }
    return '' +
      '<div class="inline-ad">' +
        '<span class="ad-label-small">Advertisement</span>' +
        '<div class="inline-ad-box">In-article slot \u00B7 728 \u00D7 90 or responsive</div>' +
      '</div>';
  }

  // ====== Activation after render ======
  function activateNewAds(root) {
    /* Tells AdSense to fill any unfilled <ins> tags inside the given root.
       Must be called after the ad HTML is in the DOM. */
    if (!CONFIG.enabled || !window.adsbygoogle) return;
    var ads = (root || document).querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])');
    for (var i = 0; i < ads.length; i++) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  // ====== Public API ======
  window.ArtPulseAds = {
    config: CONFIG,
    injectInto: injectInto,
    renderInFeed: renderInFeed,
    renderInArticle: renderInArticle,
    activate: activateNewAds,
    isEnabled: function () { return CONFIG.enabled; }
  };
})();
