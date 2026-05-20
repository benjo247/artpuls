/* artpulse — app logic.
   Loads stories.json, renders the feed, handles language, saves, and the article sheet. */

(function () {
  'use strict';

  // ====== Viewport mode ======
  // Threshold: >=1024px is desktop magazine layout, else mobile swipe feed.
  // Updated on resize; the UI re-renders if the user crosses the breakpoint.
  var DESKTOP_MQ = window.matchMedia('(min-width: 1024px)');
  var isDesktop = DESKTOP_MQ.matches;

  // ---------- UI strings ----------
  var LABELS = {
    en: {
      hint: 'swipe up',
      readingTime: 'min read',
      cta: 'Read more',
      save: 'Save',
      saved: 'Saved',
      share: 'Share',
      ad: 'Advertisement',
      adHead: 'Ad space',
      adSub: 'In-feed slot \u00B7 AdSense-ready',
      adNote: 'Ads appear in the same editorial frame as stories \u2014 clearly labeled, never breaking the reading flow.',
      inArticleAd: 'In-article slot \u00B7 728 \u00D7 90 or responsive',
      loading: 'Fetching the latest\u2026',
      empty: 'Nothing here yet. Pull to refresh.',
      offline: 'Offline \u2014 showing cached stories.',
      readSource: 'Read at source',
      // Desktop-only
      subscribe: 'Subscribe',
      featured: 'Featured',
      readStory: 'Read the story',
      thisWeekHeadline: 'This week',
      emptyDesktop: 'Check back soon.',
      flagTrending: 'Trending',
      flagEditorial: 'Editor\u2019s Pick',
      nlEyebrow: 'artpulse monthly',
      nlTitle1: 'The first of the month,',
      nlTitle2: 'delivered.',
      nlBody: 'Once a month. The stories that mattered, condensed in one read.',
      // Story-detail newsletter prompt (engagement-triggered)
      detailNlEyebrow: 'artpulse monthly',
      detailNlTitle: 'The art press, condensed.',
      detailNlBody: 'Once a month \u2014 the stories that mattered, bilingual, free.',
      detailNlPlaceholder: 'your@email.com',
      detailNlFine: 'Free \u00B7 Bilingual \u00B7 Unsubscribe anytime',
      footerTagline: 'The international art press, condensed. In English and German.',
      sectionsLabel: 'Sections',
      aboutLabel: 'About',
      legalLabel: 'Legal',
      subscribeNewsletter: 'Subscribe to newsletter',
      aboutPage: 'About artpulse',
      reportBug: 'Report a bug',
      readFullStory: 'Read full story',
      stories: 'stories',
      story: 'story',
      cats: ['All', 'Auction', 'Exhibition', 'Artists', 'Market', 'Museum', 'Biennale', 'Restitution']
    },
    de: {
      hint: 'weiterwischen',
      readingTime: 'Min Lesezeit',
      cta: 'Lesen',
      save: 'Speichern',
      saved: 'Gespeichert',
      share: 'Teilen',
      ad: 'Anzeige',
      adHead: 'Werbeplatz',
      adSub: 'In-Feed-Slot \u00B7 AdSense-ready',
      adNote: 'Anzeigen erscheinen im selben Editorial-Frame wie Beitr\u00E4ge \u2014 klar gekennzeichnet, ohne den Lesefluss zu brechen.',
      inArticleAd: 'In-Article-Slot \u00B7 728 \u00D7 90 oder responsiv',
      loading: 'Lade die neuesten News\u2026',
      empty: 'Noch nichts. Zum Aktualisieren ziehen.',
      offline: 'Offline \u2014 gespeicherte Stories.',
      readSource: 'Bei der Quelle lesen',
      // Desktop-only
      subscribe: 'Abonnieren',
      featured: 'Ausgew\u00E4hlt',
      readStory: 'Story lesen',
      thisWeekHeadline: 'Diese Woche',
      emptyDesktop: 'Schau später wieder vorbei.',
      flagTrending: 'Trending',
      flagEditorial: 'Empfehlung',
      nlEyebrow: 'artpulse monthly',
      nlTitle1: 'Den Ersten jeden Monats,',
      nlTitle2: 'frei Haus.',
      nlBody: 'Einmal im Monat. Stories, die zählten — in einem Atemzug.',
      // Story-detail newsletter prompt (engagement-triggered)
      detailNlEyebrow: 'artpulse monthly',
      detailNlTitle: 'Die Kunstpresse, kondensiert.',
      detailNlBody: 'Einmal im Monat \u2014 die Stories, die zählten. Zweisprachig, kostenlos.',
      detailNlPlaceholder: 'deine@email.de',
      detailNlFine: 'Kostenlos \u00B7 Zweisprachig \u00B7 Jederzeit abbestellbar',
      footerTagline: 'Die internationale Kunstpresse, kondensiert. In Englisch und Deutsch.',
      sectionsLabel: 'Rubriken',
      aboutLabel: 'Information',
      legalLabel: 'Rechtliches',
      subscribeNewsletter: 'Newsletter abonnieren',
      aboutPage: 'Über artpulse',
      reportBug: 'Bug melden',
      readFullStory: 'Story lesen',
      stories: 'Stories',
      story: 'Story',
      cats: ['Alle', 'Auktion', 'Ausstellung', 'K\u00FCnstler:innen', 'Markt', 'Museum', 'Biennale', 'Restitution']
    }
  };

  var CAT_KEYS = ['all', 'auction', 'exhibition', 'artists', 'market', 'museum', 'biennale', 'restitution'];

  var ICONS = {
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    chev: '<path d="m18 15-6-6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>'
  };

  // ---------- State (with localStorage persistence) ----------
  var state = {
    lang: (function () {
      var saved = localStorage.getItem('kp-lang');
      if (saved === 'de' || saved === 'en') return saved;
      var browserLang = (navigator.language || 'en').toLowerCase();
      return browserLang.indexOf('de') === 0 ? 'de' : 'en';
    })(),
    cat: 'all',
    currentIdx: 0,
    stories: [],
    hasMore: true,
    loadingMore: false,
    pendingDeepLink: null,
    // Desktop view state — 'magazine' (home grid) or 'article' (deep-link reader)
    // Used to prevent race-conditions where async loaders overwrite the article view.
    currentView: null,
    archiveLoaded: false
  };

  // ---------- Helpers ----------
  function t(key) { return LABELS[state.lang][key]; }
  function catLabel(key) {
    var i = CAT_KEYS.indexOf(key);
    return i >= 0 ? LABELS[state.lang].cats[i] : key;
  }
  function getText(story, key) {
    // Defensive: skip whitespace-only strings, fall back through language chain
    var primary = story[key + '_' + state.lang];
    if (primary && String(primary).trim()) return primary;
    var fallback = story[key + '_en'];
    if (fallback && String(fallback).trim()) return fallback;
    var legacy = story[key];
    if (legacy && String(legacy).trim()) return legacy;
    return '';
  }
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

  // ----- Semantic dedup: catch the same news story syndicated by multiple sources -----
  // Compares normalized headline token sets via Jaccard similarity.
  // Stories above the similarity threshold AND within the time window are treated as duplicates;
  // the FIRST occurrence (by array order, which is already newest-first) is kept.
  var _STOPWORDS = {
    the:1, that:1, this:1, with:1, from:1, into:1, over:1, under:1,
    after:1, before:1, about:1, where:1, when:1, while:1, than:1, then:1,
    have:1, been:1, will:1, would:1, could:1, should:1, just:1, also:1,
    more:1, other:1, their:1, there:1, these:1, those:1, what:1, which:1,
    been:1, were:1, your:1
  };
  function _tokenize(s) {
    if (!s) return [];
    var raw = String(s).toLowerCase().replace(/[^a-z0-9äöüß\s]/g, ' ').split(/\s+/);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var w = raw[i];
      if (w.length >= 4 && !_STOPWORDS[w]) out.push(w);
    }
    return out;
  }
  function _jaccard(a, b) {
    if (!a.length || !b.length) return 0;
    var sA = {}, sB = {};
    for (var i = 0; i < a.length; i++) sA[a[i]] = true;
    for (var j = 0; j < b.length; j++) sB[b[j]] = true;
    var inter = 0, uni = {};
    for (var k in sA) { uni[k] = true; if (sB[k]) inter++; }
    for (var l in sB) uni[l] = true;
    var u = 0;
    for (var m in uni) u++;
    return u === 0 ? 0 : inter / u;
  }
  function dedupStories(stories) {
    if (!stories || stories.length < 2) return stories || [];
    var THRESHOLD = 0.55;
    var WINDOW_MS = 48 * 3600 * 1000;
    var kept = [], keptTokens = [], keptTs = [];
    for (var i = 0; i < stories.length; i++) {
      var s = stories[i];
      var headline = s.headline_en || s.headline_de || s.title || '';
      var tokens = _tokenize(headline);
      var ts = s.publishedAt ? new Date(s.publishedAt).getTime() : 0;
      var isDup = false;
      for (var j = 0; j < kept.length; j++) {
        if (Math.abs(ts - keptTs[j]) > WINDOW_MS) continue;
        if (_jaccard(tokens, keptTokens[j]) >= THRESHOLD) { isDup = true; break; }
      }
      if (!isDup) {
        kept.push(s);
        keptTokens.push(tokens);
        keptTs.push(ts);
      }
    }
    return kept;
  }

  /**
   * Reorder stories to break up source-clusters in the feed.
   * Goal: prevent more than MAX_CONSECUTIVE stories from the same source
   * appearing in a row. Searches up to LOOKAHEAD positions forward for an
   * alternative source and pulls it up. Preserves chronological order
   * where possible. If no alternative is within reach, accepts the cluster
   * (better to keep order than to scramble).
   */
  function diversifyBySource(stories) {
    var MAX_CONSECUTIVE = 2;   // After 2 in a row, force a different source
    var LOOKAHEAD = 8;         // Search up to 8 positions ahead for alternative
    if (!stories || stories.length <= MAX_CONSECUTIVE + 1) return stories || [];

    var result = [];
    var queue = stories.slice();

    while (queue.length > 0) {
      // Count consecutive trailing stories with the same source as queue head
      var headSource = queue[0].source || '';
      var consecutive = 0;
      for (var i = result.length - 1; i >= 0; i--) {
        if ((result[i].source || '') === headSource) consecutive++;
        else break;
      }

      if (consecutive >= MAX_CONSECUTIVE) {
        // Need a different source — scan lookahead window
        var swapIdx = -1;
        var limit = Math.min(LOOKAHEAD + 1, queue.length);
        for (var k = 1; k < limit; k++) {
          if ((queue[k].source || '') !== headSource) { swapIdx = k; break; }
        }
        if (swapIdx !== -1) {
          // Pull diverse story to the front
          result.push(queue.splice(swapIdx, 1)[0]);
          continue;
        }
        // No alternative within reach — fall through and accept the cluster
      }
      result.push(queue.shift());
    }
    return result;
  }

  function filteredStories() {
    if (state.cat === 'all') return state.stories.slice();
    var out = [];
    for (var i = 0; i < state.stories.length; i++) {
      if (state.stories[i].cat === state.cat) out.push(state.stories[i]);
    }
    return out;
  }

  // ---------- Story flags ----------
  // Returns the HTML for a flag pill if the story is trending or editorial.
  // Trending is prioritized over editorial (when both are set, only trending shows).
  // Trending is set automatically by fetch-news.mjs (multi-source clustering).
  // Editorial is set manually via `editorial: true` in archive.json.
  function flagPillHTML(s) {
    if (!s) return '';
    if (s.trending) {
      return '<span class="flag-pill flag-trending">' + escapeHTML(t('flagTrending')) + '</span>';
    }
    if (s.editorial) {
      return '<span class="flag-pill flag-editorial">' + escapeHTML(t('flagEditorial')) + '</span>';
    }
    return '';
  }

  // ---------- Bug report ----------
  // Opens user's mail client with subject + diagnostic info pre-filled.
  // No backend required; reports land directly in Ben's inbox.
  function reportBug() {
    var lang = state.lang || 'en';
    var subject = lang === 'de' ? 'artpulse bug-report' : 'artpulse bug report';
    var heading = lang === 'de'
      ? 'Was ist passiert (kurz):\n\n\nWas hättest du erwartet?\n\n\nWie reproduzieren (Schritte):\n1.\n2.\n3.'
      : 'What happened (briefly):\n\n\nWhat did you expect to happen?\n\n\nHow to reproduce (steps):\n1.\n2.\n3.';
    var footerLabel = lang === 'de'
      ? '— Diagnose-Daten (bitte nicht bearbeiten):'
      : '— Diagnostic info (please leave intact):';
    var diag = [
      footerLabel,
      'URL: ' + window.location.href,
      'User-Agent: ' + navigator.userAgent,
      'Language: ' + lang,
      'Screen: ' + window.screen.width + 'x' + window.screen.height,
      'Time: ' + new Date().toISOString()
    ].join('\n');
    var body = heading + '\n\n\n' + diag;
    var href = 'mailto:hello@artpulse.app?subject=' +
      encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    window.location.href = href;
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2200);
  }

  // ---------- Data loading ----------
  function loadStories() {
    var loadingEl = document.getElementById('loadingLabel');
    if (loadingEl) loadingEl.textContent = t('loading');
    return fetch('/data/latest.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.stories = diversifyBySource(dedupStories(data.stories || []));  // raw, ads injected at render time
        state.hasMore = (data.stories || []).length >= 24;  // assume archive has more
      })
      .catch(function (err) {
        console.warn('Failed to load latest.json:', err);
        state.stories = [];
        toast(t('offline'));
      });
  }

  function loadOlder() {
    if (state.loadingMore || !state.hasMore) return;
    state.loadingMore = true;
    // Pull the relevant pool — by-category if filtered, archive otherwise
    var path = state.cat === 'all' ? '/data/archive.json' : '/data/by-category/' + state.cat + '.json';
    fetch(path, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        state.loadingMore = false;
        if (!data || !data.stories) { state.hasMore = false; return; }
        // Skip stories already shown (in latest) and append the rest
        var seen = {};
        for (var i = 0; i < state.stories.length; i++) {
          if (state.stories[i].id) seen[state.stories[i].id] = true;
        }
        var older = data.stories.filter(function (s) { return !seen[s.id]; });
        if (older.length === 0) { state.hasMore = false; return; }
        // Append older stories. Ads are injected at render time on the filtered list,
        // so we keep state.stories pure (no ad markers).
        state.stories = diversifyBySource(dedupStories(state.stories.concat(older)));
        renderFeed(true);  // preserve scroll position
      })
      .catch(function () { state.loadingMore = false; });
  }

  function injectAds(stories) {
    // Delegate to ads.js if loaded, otherwise simple fallback
    if (window.ArtPulseAds && window.ArtPulseAds.injectInto) {
      return window.ArtPulseAds.injectInto(stories);
    }
    return stories;
  }

  function injectNewsletter(items) {
    /* Insert a Newsletter CTA card after the 5th story (counting non-ad items).
       Skip if user already subscribed or if we've shown it in this session. */
    var subscribed = false;
    var shownThisSession = false;
    try {
      subscribed = localStorage.getItem('ap-nl-state') === 'subscribed';
      shownThisSession = sessionStorage.getItem('ap-nl-shown') === '1';
    } catch (e) {}
    if (subscribed || shownThisSession) return items;

    var storyCount = 0;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].isAd && !items[i].isNewsletter) storyCount++;
      if (storyCount === 5) {
        // Mark as shown so we don't re-inject on every render this session
        try { sessionStorage.setItem('ap-nl-shown', '1'); } catch (e) {}
        return items.slice(0, i + 1)
          .concat([{ isNewsletter: true, id: 'nl-cta' }])
          .concat(items.slice(i + 1));
      }
    }
    return items;
  }

  function nlHTML(item, idx) {
    return '' +
      '<article class="card card-nl" data-idx="' + idx + '">' +
        '<div class="nl-shell">' +
          '<div>' +
            '<div class="nl-eyebrow">From the editors</div>' +
            '<h3 class="nl-headline">The first<br>of the month,<br><em>delivered.</em></h3>' +
            '<p class="nl-body">Once a month. The stories that mattered, condensed in one read.</p>' +
            '<ul class="nl-bullets">' +
              '<li>Auctions, market &amp; galleries</li>' +
              '<li>Exhibitions &amp; museum news</li>' +
              '<li>Restitution, biennials, the rest</li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<a class="nl-cta" href="/subscribe" data-nl-go>' +
              '<span>Subscribe to the digest</span>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
            '</a>' +
            '<div class="nl-fine">Free \u00B7 Monthly \u00B7 Unsubscribe anytime</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // ---------- Rendering ----------
  function renderCats() {
    var html = '';
    for (var i = 0; i < CAT_KEYS.length; i++) {
      var key = CAT_KEYS[i];
      var label = LABELS[state.lang].cats[i];
      var cls = state.cat === key ? ' on' : '';
      html += '<button class="cat' + cls + '" data-cat="' + key + '">' + escapeHTML(label) + '</button>';
    }
    var el = document.getElementById('cats');
    el.innerHTML = html;
    var btns = el.querySelectorAll('.cat');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', onCatClick);
    }
  }

  function onCatClick(e) {
    var nextCat = e.currentTarget.getAttribute('data-cat');
    var feed = document.getElementById('feed');
    if (nextCat === state.cat) {
      // Same category re-tapped — treat as "scroll to top" shortcut
      feed.scrollTo({ top: 0, behavior: 'smooth' });
      state.currentIdx = 0;
      renderProgress();
      return;
    }
    state.cat = nextCat;
    state.currentIdx = 0;
    renderCats();
    renderFeed();
    feed.scrollTo({ top: 0 });
  }

  function onLogoClick(e) {
    // On the feed page: scroll to top instead of full page nav.
    // On any other page (e.g. /subscribe): let the default link nav happen.
    if (window.location.pathname === '/' || window.location.pathname === '') {
      e.preventDefault();
      // Close article sheet if open
      if (document.getElementById('sheet').classList.contains('on')) {
        closeSheet();
      }
      var feed = document.getElementById('feed');
      feed.scrollTo({ top: 0, behavior: 'smooth' });
      state.currentIdx = 0;
      renderProgress();
    }
  }

  function renderProgress() {
    var items = filteredStories();
    var html = '';
    var max = Math.min(items.length, 30);  // cap visible dots
    for (var i = 0; i < max; i++) {
      html += '<span' + (i === state.currentIdx ? ' class="on"' : '') + '></span>';
    }
    document.getElementById('progress').innerHTML = html;
  }

  function storyHTML(s, idx) {
    var accent = s.accent || '#e8503a';
    var hasImage = !!s.image;
    var catKey = s.cat || 'all';
    var classes = 'card' + (hasImage ? '' : ' no-image cat-' + catKey);
    var visual;
    if (hasImage) {
      visual =
        '<div class="card-img" style="background-image:url(\'' + escapeAttr(s.image) + '\')"></div>' +
        '<div class="card-grad" style="background:linear-gradient(135deg,' + escapeAttr(accent) + ' 0%,transparent 60%)"></div>' +
        '<div class="card-shade"></div>';
    } else {
      visual =
        '<div class="card-noimg-bg"></div>' +
        '<div class="card-noimg-mark">a<span class="card-noimg-dot"></span></div>';
    }

    return '' +
      '<article class="' + classes + '" data-idx="' + idx + '" data-id="' + escapeAttr(s.id) + '">' +
        visual +
        '<div class="card-top">' +
          '<div class="card-top-left">' +
            flagPillHTML(s) +
            '<span class="badge"><span class="badge-dot" style="background:' + escapeAttr(accent) + '"></span>' + escapeHTML(catLabel(s.cat)) + '</span>' +
          '</div>' +
          '<span class="meta-time">' + escapeHTML(getText(s, 'time')) + '</span>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="kicker">' + escapeHTML(getText(s, 'kicker')) + '</div>' +
          '<h2 class="headline" data-expand="' + escapeAttr(s.id) + '">' + escapeHTML(getText(s, 'headline')) + '</h2>' +
          '<p class="summary">' + escapeHTML(getText(s, 'summary')) + '</p>' +
          '<div class="card-foot">' +
            '<div class="meta"><span class="source">' + escapeHTML(s.source || '') + '</span><span class="sep">\u00B7</span><span>' + (s.read || 3) + ' ' + t('readingTime') + '</span></div>' +
            '<button class="cta" data-expand="' + escapeAttr(s.id) + '"><span>' + t('cta') + '</span><svg class="icon icon-sm" viewBox="0 0 24 24">' + ICONS.chev + '</svg></button>' +
          '</div>' +
        '</div>' +
        '<div class="rail">' +
          '<button class="rail-btn" data-share="' + escapeAttr(s.id) + '" aria-label="' + t('share') + '"><svg class="icon icon-lg" viewBox="0 0 24 24">' + ICONS.share + '</svg></button>' +
        '</div>' +
      '</article>';
  }

  function adHTML(adMarker, idx) {
    if (window.ArtPulseAds && window.ArtPulseAds.renderInFeed) {
      // Inject data-idx for progress tracking
      return window.ArtPulseAds.renderInFeed(adMarker).replace(
        '<article class="card card-ad"',
        '<article class="card card-ad" data-idx="' + idx + '"'
      );
    }
    // Fallback if ads.js didn't load — render nothing (no placeholders)
    return '';
  }

  function renderFeed(preserveScroll) {
    var items = filteredStories();
    var feed = document.getElementById('feed');
    var prevScroll = preserveScroll ? feed.scrollTop : 0;
    if (!items.length) {
      feed.innerHTML = '<div class="loading"><span class="loading-label">' + t('empty') + '</span></div>';
      return;
    }
    // Inject ads on the FILTERED list so per-category views obey all placement
    // rules (first-ad-position, intervals, sensitive-categories, never-last).
    items = injectAds(items);
    // Inject the Newsletter CTA after the 5th story (once per session).
    items = injectNewsletter(items);
    var html = '';
    for (var i = 0; i < items.length; i++) {
      if (items[i].isAd) html += adHTML(items[i], i);
      else if (items[i].isNewsletter) html += nlHTML(items[i], i);
      else html += storyHTML(items[i], i);
    }
    feed.innerHTML = html;
    bindFeedEvents();
    if (preserveScroll) {
      feed.scrollTop = prevScroll;
    } else {
      state.currentIdx = 0;
      renderProgress();
    }
    document.getElementById('hint').hidden = false;
    // Trigger AdSense rendering for any new <ins> tags
    if (window.ArtPulseAds && window.ArtPulseAds.activate) {
      window.ArtPulseAds.activate(feed);
    }
  }

  // ====================================================
  // Desktop magazine renderer
  // Builds the entire desktop view into #desktop. Called from
  // renderActive(); state.stories and state.cat are shared with mobile.
  // ====================================================
  function renderActive() {
    if (isDesktop) renderDesktop();
    else renderFeed();
  }

  function renderDesktop() {
    var root = document.getElementById('desktop');
    if (!root) return;
    state.currentView = 'magazine';
    var stories = filteredStories();

    // Hero is always the newest story (stories[0]) to keep ordering consistent
    // with mobile. The hero template handles both image and typo styles.
    var hero = stories.length > 0 ? stories[0] : null;
    var heroIndex = 0;
    // Build the rest excluding the hero (preserving newest-first order)
    var rest = stories.slice(1);

    var html = '';

    // ========= Masthead =========
    html += '<header class="d-masthead"><div class="d-masthead-row">';
    html += '<a href="/" class="d-logo" id="dLogo"><span class="art">art</span><span class="pulse">pulse</span><span class="dot" aria-hidden="true"></span></a>';
    html += '<div class="d-actions">';
    html += '<a href="/about" class="d-nav-link">' + escapeHTML(t('aboutPage')) + '</a>';
    html += '<button class="d-icon-btn" id="dSearchBtn" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button>';
    html += '<div class="lang" id="dLang">' +
            '<button data-lang="en"' + (state.lang === 'en' ? ' class="on"' : '') + '>EN</button>' +
            '<button data-lang="de"' + (state.lang === 'de' ? ' class="on"' : '') + '>DE</button>' +
            '</div>';
    html += '<a href="/subscribe" class="d-subscribe-pill">' + escapeHTML(t('subscribe')) + '</a>';
    html += '</div></div></header>';

    // ========= Category bar (separate row) =========
    html += '<div class="d-catbar"><div class="d-catbar-row">';
    for (var c = 0; c < CAT_KEYS.length; c++) {
      var k = CAT_KEYS[c];
      html += '<button type="button" class="d-catlink' + (state.cat === k ? ' on' : '') + '" data-d-cat="' + k + '">' + escapeHTML(catLabel(k)) + '</button>';
    }
    html += '<span class="d-cattime">' + escapeHTML(latestUpdateText()) + '</span>';
    html += '</div></div>';

    // ========= Main content =========
    html += '<main class="d-main">';

    // Hero (or empty state)
    if (!hero) {
      html += '<div class="d-empty"><p class="d-empty-title">' + escapeHTML(t('empty')) + '</p><p class="d-empty-sub">' + escapeHTML(t('emptyDesktop')) + '</p></div>';
    } else {
      html += desktopHeroHTML(hero);
    }

    // Section title + grid
    if (rest.length > 0) {
      var count = rest.length;
      html += '<div class="d-section">';
      html += '<h2 class="d-section-title">' + escapeHTML(t('thisWeekHeadline')) + '</h2>';
      html += '<span class="d-section-count">' + count + ' ' + escapeHTML(count === 1 ? t('story') : t('stories')) + '</span>';
      html += '</div>';
      html += '<div class="d-grid">';
      // Split grid: first 6 cards, then newsletter strip, then more cards
      var firstBatch = Math.min(count, 6);
      for (var i = 0; i < firstBatch; i++) html += desktopCardHTML(rest[i]);
      html += '</div>';

      // Newsletter strip mid-grid (unless subscribed)
      var subscribed = false;
      try { subscribed = localStorage.getItem('ap-nl-state') === 'subscribed'; } catch (e) {}
      if (!subscribed && count > firstBatch) {
        html += desktopNewsletterHTML();
        html += '<div class="d-grid">';
        for (var j = firstBatch; j < count; j++) html += desktopCardHTML(rest[j]);
        html += '</div>';
      } else if (count > firstBatch) {
        // Continue grid without break if already subscribed
        html += '<div class="d-grid" style="margin-top:48px">';
        for (var j2 = firstBatch; j2 < count; j2++) html += desktopCardHTML(rest[j2]);
        html += '</div>';
        // Still show subscribe strip if there are only few stories
      }
      if (subscribed === false && count <= firstBatch) {
        // Fallback: show newsletter strip after main grid if no second batch
        html += desktopNewsletterHTML();
      }
    }

    html += '</main>';

    // ========= Footer =========
    html += desktopFooterHTML();

    // ========= Sticky bottom mini-bar (always reachable navigation) =========
    html += desktopStickyFootHTML();

    root.innerHTML = html;
    bindDesktopEvents();
  }

  // "Latest · timestamp" line for the category bar — no frequency claims
  function latestUpdateText() {
    var base = (state.lang === 'de') ? 'Aktualisiert' : 'Updated';
    // Try to find the newest publication time
    var newest = null;
    for (var i = 0; i < state.stories.length; i++) {
      var p = state.stories[i].publishedAt || state.stories[i].time_iso;
      if (p) {
        var d = new Date(p);
        if (!isNaN(d.getTime()) && (!newest || d > newest)) newest = d;
      }
    }
    if (!newest) return base;
    // Format: "14 May 11:07 UTC" / "14. Mai 11:07 UTC"
    var months = (state.lang === 'de')
      ? ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var stamp = newest.getUTCDate() + ' ' + months[newest.getUTCMonth()] + ' ' +
                pad(newest.getUTCHours()) + ':' + pad(newest.getUTCMinutes()) + ' UTC';
    return base + ' · ' + stamp;
  }

  // Relative time formatter for card/hero meta lines
  // ("just now", "5h ago", "yesterday", "14 May")
  function formatRelTime(iso, lang) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var diff = Date.now() - d.getTime();
    var sec = Math.floor(diff / 1000);
    var min = Math.floor(sec / 60);
    var hr = Math.floor(min / 60);
    var day = Math.floor(hr / 24);
    if (lang === 'de') {
      if (sec < 60) return 'gerade eben';
      if (min < 60) return 'vor ' + min + ' Min';
      if (hr < 24) return 'vor ' + hr + ' Std';
      if (day === 1) return 'gestern';
      if (day < 7) return 'vor ' + day + ' Tagen';
      var deMonths = ['Jan', 'Feb', 'M\u00E4r', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      return d.getDate() + '. ' + deMonths[d.getMonth()];
    }
    if (sec < 60) return 'just now';
    if (min < 60) return min + 'm ago';
    if (hr < 24) return hr + 'h ago';
    if (day === 1) return 'yesterday';
    if (day < 7) return day + 'd ago';
    var enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + enMonths[d.getMonth()];
  }

  function desktopHeroHTML(s) {
    var hasImage = !!s.image;
    var headline = escapeHTML(getText(s, 'headline'));
    var summary = escapeHTML(getText(s, 'summary') || '');
    var source = escapeHTML(s.source || '');
    var timeStr = escapeHTML(formatRelTime(s.publishedAt, state.lang));
    var catKey = s.cat || 'all';
    var cat = escapeHTML(catLabel(catKey));
    var catClass = 'cat-' + catKey;
    var url = '/s/' + encodeURIComponent(s.id);

    var visual;
    if (hasImage) {
      visual = '<div class="d-hero-image" style="background-image:url(' + JSON.stringify(s.image).replace(/^"|"$/g, '') + ')"></div>';
    } else {
      var kicker = escapeHTML(getText(s, 'kicker') || '');
      visual =
        '<div class="d-hero-noimg cat-' + escapeAttr(catKey) + '">' +
          '<div class="d-hero-noimg-top">' +
            '<span class="d-hero-noimg-cat"><span class="dot"></span>' + cat + '</span>' +
            (timeStr ? '<span class="d-hero-noimg-time">' + timeStr + '</span>' : '') +
          '</div>' +
          '<div class="d-hero-noimg-mark">a<span class="dot"></span></div>' +
          '<div class="d-hero-noimg-attr">' +
            '<span class="d-hero-noimg-attr-line"></span>' +
            '<span class="d-hero-noimg-attr-text">' +
              (source ? source : '') +
              (source && kicker ? '<span class="sep">·</span>' : '') +
              (kicker ? kicker : '') +
            '</span>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<a href="' + url + '" class="d-hero">' +
        visual +
        '<div class="d-hero-content">' +
          '<div class="d-hero-meta">' +
            flagPillHTML(s) +
            '<span class="d-badge ' + catClass + '">' + cat + '</span>' +
            (timeStr ? '<span class="d-meta-sep">·</span><span class="d-meta-dim">' + timeStr + '</span>' : '') +
          '</div>' +
          '<h1 class="d-hero-headline">' + headline + '</h1>' +
          (summary ? '<p class="d-hero-summary">' + summary + '</p>' : '') +
          '<div class="d-hero-source">' +
            (source ? '<span>' + source + '</span>' : '') +
            '<span class="d-readlink">' + escapeHTML(t('readFullStory')) +
              ' <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</a>';
  }

  function desktopCardHTML(s) {
    var hasImage = !!s.image;
    var headline = escapeHTML(getText(s, 'headline'));
    var summary = escapeHTML(getText(s, 'summary') || '');
    var source = escapeHTML(s.source || '');
    var timeStr = escapeHTML(formatRelTime(s.publishedAt, state.lang));
    var catKey = s.cat || 'all';
    var cat = escapeHTML(catLabel(catKey));
    var catClass = 'cat-' + catKey;
    var url = '/s/' + encodeURIComponent(s.id);

    var visual;
    if (hasImage) {
      visual = '<div class="d-card-image" style="background-image:url(' + JSON.stringify(s.image).replace(/^"|"$/g, '') + ')"></div>';
    } else {
      // No-image card: a.-mark on category-themed gradient background
      var kicker = escapeHTML(getText(s, 'kicker') || '');
      visual =
        '<div class="d-card-noimg cat-' + escapeAttr(catKey) + '">' +
          '<div class="d-card-noimg-top">' +
            '<span class="d-card-noimg-cat"><span class="dot"></span>' + cat + '</span>' +
            (timeStr ? '<span class="d-card-noimg-time">' + timeStr + '</span>' : '') +
          '</div>' +
          '<div class="d-card-noimg-mark">a<span class="dot"></span></div>' +
          '<div class="d-card-noimg-attr">' +
            '<span class="d-card-noimg-attr-line"></span>' +
            '<span class="d-card-noimg-attr-text">' +
              (source ? source : '') +
              (source && kicker ? '<span class="sep">·</span>' : '') +
              (kicker ? kicker : '') +
            '</span>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<a href="' + url + '" class="d-card">' +
        visual +
        '<div class="d-card-meta">' +
          flagPillHTML(s) +
          '<span class="d-badge ' + catClass + '">' + cat + '</span>' +
          (timeStr ? '<span class="d-meta-sep">·</span><span class="d-meta-dim">' + timeStr + '</span>' : '') +
        '</div>' +
        '<h3 class="d-card-headline">' + headline + '</h3>' +
        (summary ? '<p class="d-card-summary">' + summary + '</p>' : '') +
        '<div class="d-card-bottom">' +
          (source ? '<span class="d-card-source">' + source + '</span>' : '<span></span>') +
          '<span class="d-readlink">' + escapeHTML(t('readStory')) +
            ' <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
          '</span>' +
        '</div>' +
      '</a>';
  }

  function desktopNewsletterHTML() {
    return '' +
      '<div class="d-nl-strip"><div class="d-nl-card">' +
        '<div>' +
          '<div class="d-nl-eyebrow">' + escapeHTML(t('nlEyebrow')) + '</div>' +
          '<h2 class="d-nl-title">' + escapeHTML(t('nlTitle1')) + '<br><em>' + escapeHTML(t('nlTitle2')) + '</em></h2>' +
          '<p class="d-nl-body">' + escapeHTML(t('nlBody')) + '</p>' +
        '</div>' +
        '<form class="d-nl-form" id="dNlForm" novalidate>' +
          '<div class="d-nl-form-col">' +
            '<input class="d-nl-input" id="dNlInput" type="email" placeholder="your@email.com" autocomplete="email" required>' +
            '<div class="d-nl-status" id="dNlStatus" role="alert" aria-live="polite"></div>' +
          '</div>' +
          '<button type="submit" class="d-nl-submit" id="dNlSubmit">' + escapeHTML(t('subscribe')) +
            '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
          '</button>' +
        '</form>' +
      '</div></div>';
  }

  function desktopFooterHTML() {
    // Build category counts from current state
    var counts = {};
    for (var i = 0; i < state.stories.length; i++) {
      var k = state.stories[i].cat || 'all';
      counts[k] = (counts[k] || 0) + 1;
    }
    var sectionsLis = '';
    var sectionCats = ['auction', 'exhibition', 'artists', 'market', 'museum', 'biennale', 'restitution'];
    for (var c = 0; c < sectionCats.length; c++) {
      var sk = sectionCats[c];
      sectionsLis += '<li><a href="#" data-d-cat="' + sk + '">' + escapeHTML(catLabel(sk)) + '</a>' +
                     (counts[sk] ? '<span class="count">' + counts[sk] + '</span>' : '') + '</li>';
    }

    return '' +
      '<footer class="d-footer">' +
        '<div class="d-footer-inner">' +
          '<div class="d-footer-brand">' +
            '<h2><span class="art">art</span><span class="pulse">pulse</span><span class="dot" aria-hidden="true"></span></h2>' +
            '<p>' + escapeHTML(t('footerTagline')) + '</p>' +
          '</div>' +
          '<div class="d-footer-col">' +
            '<h4>' + escapeHTML(t('sectionsLabel')) + '</h4>' +
            '<ul>' + sectionsLis + '</ul>' +
          '</div>' +
          '<div class="d-footer-col">' +
            '<h4>' + escapeHTML(t('aboutLabel')) + '</h4>' +
            '<ul>' +
              '<li><a href="/about">' + escapeHTML(t('aboutPage')) + '</a></li>' +
              '<li><a href="/subscribe">' + escapeHTML(t('subscribeNewsletter')) + '</a></li>' +
              '<li><a href="#" class="d-footer-bug" id="dFooterBug">' + escapeHTML(t('reportBug')) + '</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="d-footer-col">' +
            '<h4>' + escapeHTML(t('legalLabel')) + '</h4>' +
            '<ul>' +
              '<li><a href="/impressum">Impressum</a></li>' +
              '<li><a href="/datenschutz">Datenschutz</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="d-footer-meta">' +
          '<span>© 2026 artpulse · Made in Berlin</span>' +
          '<span>artpulse.app</span>' +
        '</div>' +
      '</footer>';
  }

  // ====================================================
  // Persistent sticky bottom mini-bar for desktop.
  // Always-reachable nav so users don't have to scroll past
  // an infinite story grid to find Impressum/Datenschutz/About/Bug.
  // ====================================================
  function desktopStickyFootHTML() {
    return '' +
      '<div class="d-sticky-foot">' +
        '<div class="d-sticky-foot-inner">' +
          '<span class="d-sticky-foot-brand">© 2026 artpulse</span>' +
          '<nav class="d-sticky-foot-nav">' +
            '<a href="/about">' + escapeHTML(t('aboutPage')) + '</a>' +
            '<a href="#" class="d-sticky-bug">' + escapeHTML(t('reportBug')) + '</a>' +
            '<a href="/impressum">Impressum</a>' +
            '<a href="/datenschutz">Datenschutz</a>' +
          '</nav>' +
        '</div>' +
      '</div>';
  }

  // ====================================================
  // Desktop ARTICLE view — when user lands on /s/:id deep-link
  // Replaces the magazine layout with a focused reader.
  // ====================================================
  function renderDesktopArticle(s) {
    var root = document.getElementById('desktop');
    if (!root || !s) return;
    state.currentView = 'article';

    var headline = escapeHTML(getText(s, 'headline'));
    var summary = escapeHTML(getText(s, 'summary') || '');
    var body = escapeHTML(getText(s, 'body') || '').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
    var kicker = escapeHTML(getText(s, 'kicker') || '');
    var source = escapeHTML(s.source || '');
    var sourceUrl = s.url || '';
    var timeStr = escapeHTML(formatRelTime(s.publishedAt, state.lang));
    var catKey = s.cat || 'all';
    var cat = escapeHTML(catLabel(catKey));
    var catClass = 'cat-' + catKey;
    var image = s.image;

    var html = '';

    // Reuse masthead from magazine view, but logo navigates home
    html += '<header class="d-masthead"><div class="d-masthead-row">';
    html += '<a href="/" class="d-logo"><span class="art">art</span><span class="pulse">pulse</span><span class="dot" aria-hidden="true"></span></a>';
    html += '<div class="d-actions">';
    html += '<a href="/" class="d-back-home" id="dBackHome">' +
              '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>' +
              '<span>' + escapeHTML(state.lang === 'de' ? 'Zur \u00DCbersicht' : 'Back to feed') + '</span>' +
            '</a>';
    html += '<a href="/about" class="d-nav-link">' + escapeHTML(t('aboutPage')) + '</a>';
    html += '<div class="lang" id="dLang">' +
            '<button data-lang="en"' + (state.lang === 'en' ? ' class="on"' : '') + '>EN</button>' +
            '<button data-lang="de"' + (state.lang === 'de' ? ' class="on"' : '') + '>DE</button>' +
            '</div>';
    html += '<a href="/subscribe" class="d-subscribe-pill">' + escapeHTML(t('subscribe')) + '</a>';
    html += '</div></div></header>';

    // Article
    html += '<article class="d-article">';
    if (image) {
      html += '<div class="d-article-hero" style="background-image:url(' + JSON.stringify(image).replace(/^"|"$/g, '') + ')"></div>';
    }
    html += '<div class="d-article-body">';
    html += '<div class="d-article-meta">';
    html += flagPillHTML(s);
    html += '<span class="d-badge ' + catClass + '">' + cat + '</span>';
    if (source) html += '<span class="d-meta-sep">\u00B7</span><span class="d-meta-dim">' + source + '</span>';
    if (timeStr) html += '<span class="d-meta-sep">\u00B7</span><span class="d-meta-dim">' + timeStr + '</span>';
    html += '</div>';
    if (kicker) html += '<p class="d-article-kicker">' + kicker + '</p>';
    html += '<h1 class="d-article-headline">' + headline + '</h1>';
    if (summary) html += '<p class="d-article-summary">' + summary + '</p>';
    if (body) html += '<div class="d-article-content"><p>' + body + '</p></div>';
    if (sourceUrl) {
      html += '<div class="d-article-source">' +
        '<a href="' + escapeAttr(sourceUrl) + '" target="_blank" rel="noopener" class="d-readlink">' +
          escapeHTML(state.lang === 'de' ? 'Bei ' + (source || 'der Quelle') + ' weiterlesen' : 'Read full story at ' + (source || 'source')) +
          ' <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
        '</a>' +
      '</div>';
    }
    html += '</div></article>';

    // Footer
    html += desktopFooterHTML();

    // Sticky bottom mini-bar
    html += desktopStickyFootHTML();

    root.innerHTML = html;
    bindDesktopArticleEvents();
    // Scroll to top on render
    window.scrollTo({ top: 0 });
  }

  function bindDesktopArticleEvents() {
    // Language toggle re-renders the same article in the new language
    var langBtns = document.querySelectorAll('#dLang button');
    for (var j = 0; j < langBtns.length; j++) {
      langBtns[j].addEventListener('click', function (e) {
        setLang(e.currentTarget.getAttribute('data-lang'));
        // setLang triggers renderActive(); we need to re-render the article view
        var path = location.pathname.match(/^\/s\/([\w-]+)$/);
        if (path) {
          var s = findStory(path[1]);
          if (s) renderDesktopArticle(s);
        }
      });
    }
    // Footer category links navigate back to home filtered by category
    var navBtns = document.querySelectorAll('[data-d-cat]');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener('click', function (e) {
        e.preventDefault();
        var cat = e.currentTarget.getAttribute('data-d-cat');
        state.cat = cat || 'all';
        // Navigate to home with cat set
        location.href = '/';
      });
    }
    // Sticky-foot bug-report link
    var stickyBug = document.querySelector('.d-sticky-bug');
    if (stickyBug) stickyBug.addEventListener('click', function (e) {
      e.preventDefault();
      reportBug();
    });
  }

  function bindDesktopEvents() {
    // Category nav (top bar + footer links share data-d-cat)
    var navBtns = document.querySelectorAll('[data-d-cat]');
    for (var i = 0; i < navBtns.length; i++) {
      navBtns[i].addEventListener('click', onDesktopCatClick);
    }
    // Language toggle
    var langBtns = document.querySelectorAll('#dLang button');
    for (var j = 0; j < langBtns.length; j++) {
      langBtns[j].addEventListener('click', function (e) {
        setLang(e.currentTarget.getAttribute('data-lang'));
      });
    }
    // Logo: scroll-to-top
    var dLogo = document.getElementById('dLogo');
    if (dLogo) dLogo.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // Search button (reuses existing search overlay)
    var dSearch = document.getElementById('dSearchBtn');
    if (dSearch) dSearch.addEventListener('click', openSearch);
    // Footer: Report a bug — mailto with diagnostics
    var dFooterBug = document.getElementById('dFooterBug');
    if (dFooterBug) dFooterBug.addEventListener('click', function (e) {
      e.preventDefault();
      reportBug();
    });
    // Sticky-foot bug-report link
    var stickyBug = document.querySelector('.d-sticky-bug');
    if (stickyBug) stickyBug.addEventListener('click', function (e) {
      e.preventDefault();
      reportBug();
    });
    // Newsletter form
    var nlForm = document.getElementById('dNlForm');
    if (nlForm) nlForm.addEventListener('submit', onDesktopNewsletterSubmit);
  }

  function onDesktopCatClick(e) {
    e.preventDefault();
    var nextCat = e.currentTarget.getAttribute('data-d-cat');
    if (!nextCat) return;
    if (nextCat === state.cat) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    state.cat = nextCat;
    state.currentIdx = 0;
    renderActive();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onDesktopNewsletterSubmit(e) {
    e.preventDefault();
    var input = document.getElementById('dNlInput');
    var submit = document.getElementById('dNlSubmit');
    var status = document.getElementById('dNlStatus');
    if (!input || !submit || !status) return;
    var email = (input.value || '').trim().toLowerCase();
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      status.textContent = (state.lang === 'de') ? 'Bitte gib eine g\u00FCltige E-Mail-Adresse ein.' : 'Please enter a valid email address.';
      status.classList.remove('success');
      input.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = (state.lang === 'de') ? 'Wird abonniert\u2026' : 'Subscribing\u2026';
    status.classList.remove('success');
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        submit.disabled = false;
        if (res.ok && res.data && res.data.ok) {
          status.textContent = (state.lang === 'de') ? 'Schau in dein Postfach zur Best\u00E4tigung.' : 'Check your inbox to confirm.';
          status.classList.add('success');
          input.value = '';
          try { localStorage.setItem('ap-nl-state', 'subscribed'); } catch (e) {}
          setTimeout(function () { renderActive(); }, 2500);
        } else {
          var msg = (state.lang === 'de') ? 'Etwas lief schief. Bitte erneut versuchen.' : 'Something went wrong. Please try again.';
          if (res.data && res.data.error === 'invalid-email') {
            msg = (state.lang === 'de') ? 'Diese E-Mail-Adresse scheint ung\u00FCltig.' : 'That email looks invalid.';
          }
          status.textContent = msg;
        }
      })
      .catch(function () {
        submit.disabled = false;
        status.textContent = (state.lang === 'de') ? 'Netzwerkfehler. Bitte erneut versuchen.' : 'Network error. Please try again.';
      });
  }


  function bindFeedEvents() {
    var expands = document.querySelectorAll('[data-expand]');
    for (var j = 0; j < expands.length; j++) {
      expands[j].addEventListener('click', onExpandClick);
    }
    var shares = document.querySelectorAll('[data-share]');
    for (var k = 0; k < shares.length; k++) {
      shares[k].addEventListener('click', onShareClick);
    }
  }

  function onExpandClick(e) {
    var id = e.currentTarget.getAttribute('data-expand');
    openSheet(id);
  }

  // === Sharepic generation (Canvas-based, client-side) ===
  // Renders a 1080x1350 (4:5 IG Feed) PNG with category gradient,
  // pill, kicker, headline, source, read time, and brand block.
  // No third-party images embedded. Layout: per Ben's mockup spec.
  // Colors match the --cat-bg-* CSS variables (no-image card scheme).

  var CAT_GRADIENTS = {
    auction:     ['#3a1f1a', '#1a0e0a'],
    exhibition:  ['#1f3329', '#0e1b14'],
    museum:      ['#1f2a3a', '#0e141f'],
    market:      ['#3a2f1a', '#1f1a0e'],
    artists:     ['#2f1f3a', '#1a0e1f'],
    biennale:    ['#1f1a3a', '#0e0a1f'],
    restitution: ['#2a2a2a', '#161616'],
    all:         ['#2a2520', '#161310']
  };

  // Category-specific accent for pill dot (matches --cat-bg-*-accent)
  var CAT_ACCENTS = {
    auction:     '#e8503a',
    exhibition:  '#5ea88a',
    museum:      '#6a8bb8',
    market:      '#c89b4c',
    artists:     '#a373b8',
    biennale:    '#8a73e8',
    restitution: '#a8a094',
    all:         '#e8503a'
  };

  // The artpulse brand dot (next to "a.") is ALWAYS warm-red — brand identity
  var BRAND_DOT_COLOR = '#e8503a';

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/).filter(function (w) { return w.length > 0; });
    var lines = [];
    var current = '';
    for (var i = 0; i < words.length; i++) {
      var tryLine = current ? current + ' ' + words[i] : words[i];
      if (ctx.measureText(tryLine).width <= maxWidth) {
        current = tryLine;
      } else {
        if (current) lines.push(current);
        current = words[i];
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function generateSharepic(s, format) {
    format = format || 'feed';
    return new Promise(function (resolve, reject) {
      var fontsReady = (document.fonts && document.fonts.ready)
        ? document.fonts.ready
        : Promise.resolve();
      fontsReady.then(function () {
        try {
          var W = 1080;
          var H = format === 'story' ? 1920 : 1350;
          var canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          var ctx = canvas.getContext('2d');

          var catKey = s.cat || 'all';
          var pillDotColor = CAT_ACCENTS[catKey] || CAT_ACCENTS.all;
          var padding = 80;

          // Diagonal gradient (top-right deeper to bottom-left)
          var grad = ctx.createLinearGradient(W * 0.78, H * 0.05, W * 0.2, H * 0.95);
          var colors = CAT_GRADIENTS[catKey] || CAT_GRADIENTS.all;
          grad.addColorStop(0, colors[0]);
          grad.addColorStop(1, colors[1]);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          // Subtle radial highlight upper-right for depth
          var rad = ctx.createRadialGradient(W * 0.82, H * 0.15, 60, W * 0.82, H * 0.15, W * 0.7);
          rad.addColorStop(0, 'rgba(255,255,255,0.06)');
          rad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = rad;
          ctx.fillRect(0, 0, W, H);

          // === Category Pill (top-left) ===
          ctx.font = '500 28px "Geist Mono", ui-monospace, monospace';
          var catText = (catLabel(catKey) || catKey).toUpperCase();
          var catW = ctx.measureText(catText).width;
          var dotSize = 12;
          var pillH = 64;
          var pillPadX = 26;
          var dotGap = 14;
          var pillW = pillPadX * 2 + dotSize + dotGap + catW;
          var pillX = padding;
          var pillY = padding;

          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = pillDotColor;
          ctx.beginPath();
          ctx.arc(pillX + pillPadX + dotSize / 2, pillY + pillH / 2, dotSize / 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'white';
          ctx.font = '500 28px "Geist Mono", ui-monospace, monospace';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(catText, pillX + pillPadX + dotSize + dotGap, pillY + pillH / 2 + 1);

          // === Time (top-right) ===
          var timeText = '';
          try { timeText = getText(s, 'time') || formatRelTime(s.publishedAt, state.lang) || ''; } catch (e) {}
          if (timeText) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '400 32px "Geist", system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(timeText, W - padding, pillY + pillH / 2 + 1);
            ctx.textAlign = 'left';
          }

          // === Kicker ===
          var yCursor = pillY + pillH + 180;
          var kicker = (getText(s, 'kicker') || '').toUpperCase();
          if (kicker) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '500 30px "Geist Mono", ui-monospace, monospace';
            ctx.textBaseline = 'top';
            ctx.fillText(kicker, padding, yCursor);
            yCursor += 75;
          }

          // === Headline (responsive sizing) ===
          var headline = getText(s, 'headline') || '';
          var maxHW = W - padding * 2;
          var sizes = [92, 84, 78, 72, 66];
          var maxLines = format === 'story' ? 6 : 4;
          var chosenSize = sizes[0];
          var chosenLines = [];
          for (var si = 0; si < sizes.length; si++) {
            ctx.font = 'italic 400 ' + sizes[si] + 'px "Instrument Serif", "Times New Roman", serif';
            var lns = wrapCanvasText(ctx, headline, maxHW);
            if (lns.length <= maxLines || si === sizes.length - 1) {
              chosenSize = sizes[si];
              chosenLines = lns;
              break;
            }
          }
          ctx.font = 'italic 400 ' + chosenSize + 'px "Instrument Serif", "Times New Roman", serif';
          ctx.fillStyle = 'white';
          ctx.textBaseline = 'top';
          var lineHeight = chosenSize * 1.05;
          for (var li = 0; li < chosenLines.length; li++) {
            ctx.fillText(chosenLines[li], padding, yCursor + li * lineHeight);
          }

          // === Source + read (bottom-left) ===
          var source = s.source || '';
          var readMin = s.read || 2;
          var sourceLabel = (state.lang === 'de' ? 'Quelle: ' : 'source: ') + source;
          var readLabel = readMin + (state.lang === 'de' ? ' Min Lesezeit' : ' min read');

          ctx.fillStyle = 'white';
          ctx.font = '500 32px "Geist", system-ui, sans-serif';
          ctx.textBaseline = 'top';
          ctx.fillText(sourceLabel, padding, H - padding - 90);

          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = '400 28px "Geist", system-ui, sans-serif';
          ctx.fillText(readLabel, padding, H - padding - 42);

          // === Brand mark "a." (bottom-right, no background block) ===
          ctx.font = '900 180px "Inter", system-ui, sans-serif';
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
          var aWidth = ctx.measureText('a').width;
          var dotR = 16;
          var rightMargin = padding;
          var bottomMargin = padding;

          // x position: right edge - margin - dot diameter - 6px gap - a width
          var aX = W - rightMargin - dotR * 2 - 6 - aWidth;
          var aY = H - bottomMargin; // baseline at bottom margin

          ctx.fillStyle = 'white';
          ctx.fillText('a', aX, aY);

          // Brand dot (always warm-red)
          var brandDotCX = aX + aWidth + 6 + dotR;
          var brandDotCY = aY - dotR; // sits roughly at baseline
          ctx.fillStyle = BRAND_DOT_COLOR;
          ctx.beginPath();
          ctx.arc(brandDotCX, brandDotCY, dotR, 0, Math.PI * 2);
          ctx.fill();

          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null'));
          }, 'image/png', 0.95);
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    });
  }

  function downloadBlob(blob, filename) {
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
  }

  function shareStoryWithImage(s) {
    toast(state.lang === 'de' ? 'Sharepic wird erstellt…' : 'Generating sharepic…');
    generateSharepic(s, 'feed').then(function (blob) {
      openSharepicModal(s, blob, 'feed');
    }).catch(function (err) {
      console.error('Sharepic generation failed:', err);
      // Fallback: URL-only share if canvas fails
      var shareUrl = window.location.origin + '/s/' + encodeURIComponent(s.id);
      var title = getText(s, 'headline');
      if (navigator.share) {
        navigator.share({ title: title, url: shareUrl }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(function () {
          toast(state.lang === 'de' ? 'Link kopiert' : 'Link copied');
        });
      }
    });
  }

  function openSharepicModal(s, initialBlob, initialFormat) {
    var currentFormat = initialFormat || 'feed';
    var currentBlob = initialBlob;
    var currentObjUrl = URL.createObjectURL(initialBlob);
    var shareUrl = window.location.origin + '/s/' + encodeURIComponent(s.id);
    var title = getText(s, 'headline');
    var isDe = state.lang === 'de';

    function getFilename() {
      return 'artpulse-' + s.id + '-' + currentFormat + '.png';
    }

    // Check if device supports file sharing
    var canShareFile = false;
    try {
      if (navigator.canShare) {
        var probeFile = new File([currentBlob], getFilename(), { type: 'image/png' });
        canShareFile = navigator.canShare({ files: [probeFile] });
      }
    } catch (e) { canShareFile = false; }

    var modal = document.createElement('div');
    modal.className = 'sharepic-modal';
    modal.innerHTML = (
      '<div class="sharepic-backdrop"></div>' +
      '<div class="sharepic-card" role="dialog" aria-modal="true">' +
        '<button class="sharepic-close" aria-label="' + (isDe ? 'Schließen' : 'Close') + '">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
            '<path d="M6 6 L18 18 M6 18 L18 6"/>' +
          '</svg>' +
        '</button>' +
        '<div class="sharepic-header">' +
          '<span>' + (isDe ? 'Vorschau' : 'Preview') + '</span>' +
        '</div>' +
        '<div class="sharepic-format-switch">' +
          '<button data-format="feed" class="' + (currentFormat === 'feed' ? 'active' : '') + '">Feed · 4:5</button>' +
          '<button data-format="story" class="' + (currentFormat === 'story' ? 'active' : '') + '">Story · 9:16</button>' +
        '</div>' +
        '<div class="sharepic-preview">' +
          '<img src="' + currentObjUrl + '" alt="" />' +
        '</div>' +
        '<div class="sharepic-actions">' +
          (canShareFile ?
            '<button class="sharepic-btn sharepic-btn-primary" data-act="share">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>' +
              '</svg>' +
              (isDe ? 'Teilen' : 'Share') +
            '</button>' : '') +
          '<button class="sharepic-btn sharepic-btn-secondary" data-act="download">' +
            (isDe ? 'Herunterladen' : 'Download') +
          '</button>' +
        '</div>' +
      '</div>'
    );

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      modal.classList.add('on');
    });

    function closeModal() {
      modal.classList.remove('on');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        URL.revokeObjectURL(currentObjUrl);
        document.body.style.overflow = '';
      }, 240);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') closeModal();
    }

    function switchFormat(newFormat) {
      if (newFormat === currentFormat) return;
      var formatBtns = modal.querySelectorAll('[data-format]');
      var actionBtns = modal.querySelectorAll('.sharepic-btn');
      for (var i = 0; i < formatBtns.length; i++) formatBtns[i].disabled = true;
      for (var j = 0; j < actionBtns.length; j++) actionBtns[j].disabled = true;
      modal.querySelector('.sharepic-preview').classList.add('loading');

      generateSharepic(s, newFormat).then(function (newBlob) {
        URL.revokeObjectURL(currentObjUrl);
        currentObjUrl = URL.createObjectURL(newBlob);
        currentBlob = newBlob;
        currentFormat = newFormat;

        modal.querySelector('.sharepic-preview img').src = currentObjUrl;
        modal.querySelector('.sharepic-preview').classList.remove('loading');
        for (var i = 0; i < formatBtns.length; i++) {
          formatBtns[i].classList.toggle('active', formatBtns[i].getAttribute('data-format') === newFormat);
          formatBtns[i].disabled = false;
        }
        for (var j = 0; j < actionBtns.length; j++) actionBtns[j].disabled = false;
      }).catch(function (err) {
        console.error('Format switch failed:', err);
        modal.querySelector('.sharepic-preview').classList.remove('loading');
        for (var i = 0; i < formatBtns.length; i++) formatBtns[i].disabled = false;
        for (var j = 0; j < actionBtns.length; j++) actionBtns[j].disabled = false;
      });
    }

    document.addEventListener('keydown', onKey);
    modal.querySelector('.sharepic-close').addEventListener('click', closeModal);
    modal.querySelector('.sharepic-backdrop').addEventListener('click', closeModal);

    var formatButtons = modal.querySelectorAll('[data-format]');
    for (var k = 0; k < formatButtons.length; k++) {
      formatButtons[k].addEventListener('click', function () {
        switchFormat(this.getAttribute('data-format'));
      });
    }

    var shareBtn = modal.querySelector('[data-act="share"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        try {
          var file = new File([currentBlob], getFilename(), { type: 'image/png' });
          var shareData = { files: [file], title: title, text: title, url: shareUrl };
          navigator.share(shareData).then(closeModal).catch(function (err) {
            if (err && err.name !== 'AbortError') closeModal();
          });
        } catch (e) {
          closeModal();
        }
      });
    }

    modal.querySelector('[data-act="download"]').addEventListener('click', function () {
      downloadBlob(currentBlob, getFilename());
      toast(isDe ? 'Bild gespeichert' : 'Image saved');
      closeModal();
    });
  }

  function onShareClick(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-share');
    var s = findStory(id);
    if (!s) return;
    shareStoryWithImage(s);
  }

  function findStory(id) {
    for (var i = 0; i < state.stories.length; i++) {
      if (String(state.stories[i].id) === String(id)) return state.stories[i];
    }
    return null;
  }

  function onScroll() {
    var feed = document.getElementById('feed');
    var idx = Math.round(feed.scrollTop / feed.clientHeight);
    if (idx !== state.currentIdx) {
      state.currentIdx = idx;
      renderProgress();
      var hint = document.getElementById('hint');
      hint.hidden = idx !== 0;
    }
    // Auto-load older when user is 3 cards from the end
    var items = filteredStories();
    if (state.hasMore && !state.loadingMore && idx >= items.length - 3) {
      loadOlder();
    }
  }

  // ---------- Article sheet ----------
  // Threshold of stories opened before showing the subscribe prompt at the
  // bottom of the story-detail sheet. NYT-style: never on first touch, only
  // after the user has shown sustained engagement.
  var SHEET_NL_THRESHOLD = 3;

  function shouldShowSheetNlPrompt() {
    try {
      if (localStorage.getItem('ap-nl-state') === 'subscribed') return false;
      if (localStorage.getItem('ap-nl-detail-dismissed') === '1') return false;
      var opened = parseInt(localStorage.getItem('ap-stories-opened') || '0', 10);
      return opened >= SHEET_NL_THRESHOLD;
    } catch (e) { return false; }
  }

  function sheetNlPromptHTML() {
    return '' +
      '<div class="sheet-nl-prompt" id="sheetNlPrompt">' +
        '<div class="sheet-nl-head">' +
          '<span class="sheet-nl-eyebrow">' + escapeHTML(t('detailNlEyebrow')) + '</span>' +
          '<button class="sheet-nl-dismiss" id="sheetNlDismiss" aria-label="Dismiss" type="button">' +
            '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<h3 class="sheet-nl-title">' + escapeHTML(t('detailNlTitle')) + '</h3>' +
        '<p class="sheet-nl-body">' + escapeHTML(t('detailNlBody')) + '</p>' +
        '<form class="sheet-nl-form" id="sheetNlForm" novalidate>' +
          '<div class="sheet-nl-field">' +
            '<input class="sheet-nl-input" id="sheetNlInput" type="email" ' +
              'placeholder="' + escapeAttr(t('detailNlPlaceholder')) + '" ' +
              'autocomplete="email" inputmode="email" autocapitalize="off" ' +
              'autocorrect="off" spellcheck="false" required>' +
            '<button type="submit" class="sheet-nl-submit" id="sheetNlSubmit" ' +
              'aria-label="' + escapeAttr(t('subscribe')) + '">' +
              '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="sheet-nl-status" id="sheetNlStatus" role="alert" aria-live="polite"></div>' +
        '</form>' +
        '<p class="sheet-nl-fine">' + escapeHTML(t('detailNlFine')) + '</p>' +
      '</div>';
  }

  function openSheet(id) {
    var s = findStory(id);
    if (!s || s.isAd) return;

    // Engagement counter: how many stories has this user opened in their lifetime?
    // Used to trigger the subscribe prompt at the bottom of the sheet.
    try {
      var opened = parseInt(localStorage.getItem('ap-stories-opened') || '0', 10);
      localStorage.setItem('ap-stories-opened', String(opened + 1));
    } catch (e) {}

    var accent = s.accent || '#e8503a';
    var hasImage = !!s.image;
    var catKey = s.cat || 'all';
    var sourceLink = s.url ? (
      '<a class="sheet-source-link" href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        t('readSource') +
        '<svg class="icon icon-sm" viewBox="0 0 24 24">' + ICONS.external + '</svg>' +
      '</a>'
    ) : '';

    var heroBlock = hasImage
      ? '<div class="sheet-hero" style="background-image:url(\'' + escapeAttr(s.image) + '\')">' +
          '<div class="sheet-hero-shade"></div>' +
          '<div class="sheet-hero-tags">' +
            flagPillHTML(s) +
            '<span class="badge"><span class="badge-dot" style="background:' + escapeAttr(accent) + '"></span>' + escapeHTML(catLabel(s.cat)) + '</span>' +
          '</div>' +
        '</div>'
      : '<div class="sheet-hero sheet-hero-noimg cat-' + escapeAttr(catKey) + '">' +
          '<div class="sheet-hero-noimg-bg"></div>' +
          '<div class="sheet-hero-shade"></div>' +
          '<div class="sheet-hero-noimg-mark">a<span class="sheet-hero-noimg-dot"></span></div>' +
          '<div class="sheet-hero-tags">' +
            flagPillHTML(s) +
            '<span class="badge"><span class="badge-dot" style="background:' + escapeAttr(accent) + '"></span>' + escapeHTML(catLabel(s.cat)) + '</span>' +
          '</div>' +
        '</div>';

    var html = '' +
      '<button class="sheet-close" id="sheetClose" aria-label="Close"><svg class="icon" viewBox="0 0 24 24">' + ICONS.close + '</svg></button>' +
      heroBlock +
      '<div class="sheet-body">' +
        '<div class="kicker">' + escapeHTML(getText(s, 'kicker')) + '</div>' +
        '<h1 class="sheet-headline">' + escapeHTML(getText(s, 'headline')) + '</h1>' +
        '<div class="meta meta-row"><span class="source">' + escapeHTML(s.source || '') + '</span><span class="sep">\u00B7</span><span>' + escapeHTML(getText(s, 'time')) + '</span><span class="sep">\u00B7</span><span>' + (s.read || 3) + ' ' + t('readingTime') + '</span></div>' +
        '<p class="sheet-lead">' + escapeHTML(getText(s, 'summary')) + '</p>' +
        '<p class="sheet-text">' + escapeHTML(getText(s, 'body')) + '</p>' +
        (window.ArtPulseAds && window.ArtPulseAds.renderInArticle
          ? window.ArtPulseAds.renderInArticle()
          : '') +
        sourceLink +
        '<div class="sheet-actions">' +
          '<button class="pill" id="sheetShare"><svg class="icon icon-sm" viewBox="0 0 24 24">' + ICONS.share + '</svg>' + t('share') + '</button>' +
        '</div>' +
        (shouldShowSheetNlPrompt() ? sheetNlPromptHTML() : '') +
      '</div>';

    document.getElementById('sheetInner').innerHTML = html;
    document.getElementById('sheet').classList.add('on');
    // Push URL state for deep-linkable / shareable article
    try {
      var url = '/s/' + encodeURIComponent(s.id);
      if (window.location.pathname !== url) {
        window.history.pushState({ storyId: s.id }, '', url);
      }
    } catch (e) {}
    // Update document title and meta description for in-app navigation
    document.title = getText(s, 'headline') + ' — artpulse';
    // Trigger AdSense rendering for in-article slot
    if (window.ArtPulseAds && window.ArtPulseAds.activate) {
      window.ArtPulseAds.activate(document.getElementById('sheetInner'));
    }
    document.getElementById('sheetClose').addEventListener('click', function () { closeSheet(); });
    document.getElementById('sheetShare').addEventListener('click', function () {
      shareStoryWithImage(s);
    });
    document.getElementById('sheet').addEventListener('click', function (e) {
      if (e.target.id === 'sheet') closeSheet();
    });

    // Story-detail newsletter prompt handlers (only present if rendered)
    var nlDismiss = document.getElementById('sheetNlDismiss');
    if (nlDismiss) nlDismiss.addEventListener('click', function () {
      try { localStorage.setItem('ap-nl-detail-dismissed', '1'); } catch (e) {}
      var prompt = document.getElementById('sheetNlPrompt');
      if (prompt) {
        prompt.style.opacity = '0';
        prompt.style.transition = 'opacity 0.3s ease';
        setTimeout(function () { prompt.remove(); }, 300);
      }
    });
    var nlForm = document.getElementById('sheetNlForm');
    if (nlForm) nlForm.addEventListener('submit', onSheetNewsletterSubmit);
  }

  function onSheetNewsletterSubmit(e) {
    e.preventDefault();
    var input = document.getElementById('sheetNlInput');
    var submit = document.getElementById('sheetNlSubmit');
    var status = document.getElementById('sheetNlStatus');
    if (!input || !submit || !status) return;
    var email = (input.value || '').trim().toLowerCase();
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(email)) {
      status.textContent = (state.lang === 'de')
        ? 'Bitte gib eine g\u00FCltige E-Mail-Adresse ein.'
        : 'Please enter a valid email address.';
      status.classList.remove('success');
      input.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = (state.lang === 'de') ? 'Wird abonniert\u2026' : 'Subscribing\u2026';
    status.classList.remove('success');
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        submit.disabled = false;
        if (res.ok && res.data && res.data.ok) {
          status.textContent = (state.lang === 'de')
            ? 'Schau in dein Postfach zur Best\u00E4tigung.'
            : 'Check your inbox to confirm.';
          status.classList.add('success');
          input.value = '';
          input.disabled = true;
          try { localStorage.setItem('ap-nl-state', 'subscribed'); } catch (e2) {}
        } else {
          var msg = (state.lang === 'de')
            ? 'Etwas lief schief. Bitte erneut versuchen.'
            : 'Something went wrong. Please try again.';
          if (res.data && res.data.error === 'invalid-email') {
            msg = (state.lang === 'de')
              ? 'Diese E-Mail-Adresse scheint ung\u00FCltig.'
              : 'That email looks invalid.';
          }
          status.textContent = msg;
        }
      })
      .catch(function () {
        submit.disabled = false;
        status.textContent = (state.lang === 'de')
          ? 'Netzwerkfehler. Bitte erneut versuchen.'
          : 'Network error. Please try again.';
      });
  }

  function closeSheet(fromPopstate) {
    document.getElementById('sheet').classList.remove('on');
    document.title = 'artpulse — Art world, in one breath';
    if (!fromPopstate && window.location.pathname.indexOf('/s/') === 0) {
      try { window.history.pushState({}, '', '/'); } catch (e) {}
    }
  }

  // ---------- Init ----------
  function setLang(lang) {
    state.lang = lang;
    try { localStorage.setItem('kp-lang', lang); } catch (e) {}
    var btns = document.querySelectorAll('#lang button');
    for (var k = 0; k < btns.length; k++) {
      btns[k].classList.toggle('on', btns[k].getAttribute('data-lang') === lang);
    }
    document.documentElement.lang = lang;
    var hintTextEl = document.getElementById('hintText');
    var loadingLabelEl = document.getElementById('loadingLabel');
    if (hintTextEl) hintTextEl.textContent = t('hint');
    if (loadingLabelEl) loadingLabelEl.textContent = t('loading');
    renderCats();
    // Only re-render if stories are already loaded.
    // On first setLang() during init, stories are still empty — re-rendering then
    // would replace the loading element and crash later code that references it.
    // Also skip on article view — the article-view click handler re-renders itself.
    if (state.stories && state.stories.length > 0 && state.currentView !== 'article') {
      renderActive();
    }
  }

  // ====================================================
  // Drawer (left slide-in menu)
  // ====================================================
  function openDrawer() {
    var d = document.getElementById('drawer');
    var bd = document.getElementById('drawerBackdrop');
    var burger = document.getElementById('burger');
    if (!d || !bd) return;
    bd.hidden = false;
    // Force reflow so transition triggers
    void bd.offsetHeight;
    d.classList.add('on');
    bd.classList.add('on');
    d.setAttribute('aria-hidden', 'false');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  }
  function closeDrawer() {
    var d = document.getElementById('drawer');
    var bd = document.getElementById('drawerBackdrop');
    var burger = document.getElementById('burger');
    if (!d || !bd) return;
    d.classList.remove('on');
    bd.classList.remove('on');
    d.setAttribute('aria-hidden', 'true');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');
    // Hide backdrop after transition (250ms in CSS)
    setTimeout(function () { if (!bd.classList.contains('on')) bd.hidden = true; }, 300);
  }

  // ====================================================
  // Search overlay
  // ====================================================
  var searchState = {
    archive: null,        // cached archive.json on first open
    debounceTimer: null,
    lastQuery: ''
  };

  function openSearch() {
    var ov = document.getElementById('searchOverlay');
    var input = document.getElementById('searchInput');
    if (!ov || !input) return;
    ov.classList.add('on');
    ov.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    // Focus after the transition starts so iOS keyboard appears reliably
    setTimeout(function () { input.focus(); }, 60);
    // Lazy-load full archive on first open (we already have latest in state)
    if (!searchState.archive) {
      fetch('/data/archive.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.stories) searchState.archive = data.stories;
        })
        .catch(function () { /* fall back to state.stories on error */ });
    }
  }
  function closeSearch() {
    var ov = document.getElementById('searchOverlay');
    var input = document.getElementById('searchInput');
    var clear = document.getElementById('searchClear');
    if (!ov) return;
    ov.classList.remove('on');
    ov.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (input) {
      input.value = '';
      input.blur();
    }
    if (clear) clear.hidden = true;
    searchState.lastQuery = '';
    renderSearchEmpty();
  }

  function onSearchInput() {
    var input = document.getElementById('searchInput');
    var clear = document.getElementById('searchClear');
    if (!input) return;
    var q = (input.value || '').trim();
    if (clear) clear.hidden = !q;
    clearTimeout(searchState.debounceTimer);
    searchState.debounceTimer = setTimeout(function () {
      if (q === searchState.lastQuery) return;
      searchState.lastQuery = q;
      runSearch(q);
    }, 180);
  }

  function runSearch(q) {
    if (!q) { renderSearchEmpty(); return; }
    var corpus = searchState.archive || state.stories || [];
    var qLower = q.toLowerCase();
    var hits = [];
    for (var i = 0; i < corpus.length; i++) {
      var s = corpus[i];
      if (!s) continue;
      var hay = [
        s.headline_en, s.headline_de,
        s.summary_en, s.summary_de,
        s.body_en, s.body_de,
        s.kicker_en, s.kicker_de,
        s.source, s.cat
      ].filter(Boolean).join(' \u0000 ').toLowerCase();
      if (hay.indexOf(qLower) !== -1) hits.push(s);
      if (hits.length >= 50) break;  // cap visible results
    }
    renderSearchResults(hits, q);
  }

  function renderSearchEmpty() {
    var results = document.getElementById('searchResults');
    if (!results) return;
    results.innerHTML =
      '<div class="search-empty">' +
        '<p class="search-empty-title">Search the archive</p>' +
        '<p class="search-empty-sub">Find artists, exhibitions, auction news and more across every story.</p>' +
      '</div>';
  }

  function renderSearchResults(hits, q) {
    var results = document.getElementById('searchResults');
    if (!results) return;
    if (!hits.length) {
      results.innerHTML =
        '<div class="search-empty">' +
          '<p class="search-empty-title">No matches for &ldquo;' + escapeHTML(q) + '&rdquo;</p>' +
          '<p class="search-empty-sub">Try a different artist name, museum, or topic.</p>' +
        '</div>';
      return;
    }
    var html = '<div class="search-meta">' + hits.length + ' result' + (hits.length === 1 ? '' : 's') + '</div>';
    for (var i = 0; i < hits.length; i++) {
      html += searchResultHTML(hits[i]);
    }
    results.innerHTML = html;
    var nodes = results.querySelectorAll('[data-search-id]');
    for (var j = 0; j < nodes.length; j++) {
      nodes[j].addEventListener('click', onSearchResultClick);
    }
  }

  function searchResultHTML(s) {
    var image = s.image
      ? '<div class="sr-img" style="background-image:url(' + JSON.stringify(s.image).replace(/^"|"$/g, '') + ')"></div>'
      : '<div class="sr-img sr-img-empty"></div>';
    var headline = escapeHTML(getText(s, 'headline'));
    var summary = escapeHTML(getText(s, 'summary') || '').slice(0, 120);
    var cat = catLabel(s.cat || 'all');
    var source = escapeHTML(s.source || '');
    return '' +
      '<a class="sr-item" href="/s/' + encodeURIComponent(s.id) + '" data-search-id="' + escapeAttr(s.id) + '">' +
        image +
        '<div class="sr-body">' +
          '<div class="sr-meta">' + cat + (source ? ' &middot; ' + source : '') + '</div>' +
          '<div class="sr-headline">' + headline + '</div>' +
          (summary ? '<div class="sr-summary">' + summary + (summary.length === 120 ? '\u2026' : '') + '</div>' : '') +
        '</div>' +
      '</a>';
  }

  function onSearchResultClick(e) {
    // On desktop, let the default link nav to /s/:id happen — the Edge Function
    // serves a proper page. Just close the search overlay first.
    if (isDesktop) {
      closeSearch();
      return;  // do not preventDefault — link navigates normally
    }
    var id = e.currentTarget.getAttribute('data-search-id');
    var s = findStory(id);
    if (s) {
      // Story is loaded in feed — open sheet directly
      e.preventDefault();
      closeSearch();
      openSheet(id);
    } else if (searchState.archive) {
      // Pull from archive into state.stories, then open sheet
      var found = null;
      for (var i = 0; i < searchState.archive.length; i++) {
        if (String(searchState.archive[i].id) === String(id)) { found = searchState.archive[i]; break; }
      }
      if (found) {
        e.preventDefault();
        state.stories = [found].concat(state.stories);
        renderActive();
        closeSearch();
        openSheet(id);
      }
      // else: fall through to default link nav to /s/:id
    }
  }

  function init() {
    // Logo: scroll-to-top on home, navigate-home elsewhere
    var logo = document.getElementById('logo');
    if (logo) logo.addEventListener('click', onLogoClick);

    // Burger menu
    var burger = document.getElementById('burger');
    var drawerClose = document.getElementById('drawerClose');
    var drawerBackdrop = document.getElementById('drawerBackdrop');
    if (burger) burger.addEventListener('click', openDrawer);
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
    // Close drawer when any link inside is clicked (so it shuts before nav)
    var drawerLinks = document.querySelectorAll('.drawer-link');
    for (var di = 0; di < drawerLinks.length; di++) {
      drawerLinks[di].addEventListener('click', function () { closeDrawer(); });
    }
    // Bug report — opens mailto with diagnostic info pre-filled
    var bugLink = document.getElementById('drawerReportBug');
    if (bugLink) {
      bugLink.addEventListener('click', function (e) {
        e.preventDefault();
        reportBug();
      });
    }

    // Search
    var searchBtn = document.getElementById('searchBtn');
    var searchClose = document.getElementById('searchClose');
    var searchClear = document.getElementById('searchClear');
    var searchInput = document.getElementById('searchInput');
    if (searchBtn) searchBtn.addEventListener('click', openSearch);
    if (searchClose) searchClose.addEventListener('click', closeSearch);
    if (searchClear) searchClear.addEventListener('click', function () {
      var input = document.getElementById('searchInput');
      if (input) { input.value = ''; input.focus(); }
      searchClear.hidden = true;
      searchState.lastQuery = '';
      renderSearchEmpty();
    });
    if (searchInput) {
      searchInput.addEventListener('input', onSearchInput);
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
      });
    }

    // Global ESC closes drawer, search, or sheet (in that order of precedence)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var drawer = document.getElementById('drawer');
      var search = document.getElementById('searchOverlay');
      var sheet = document.getElementById('sheet');
      if (drawer && drawer.classList.contains('on')) { closeDrawer(); return; }
      if (search && search.classList.contains('on')) { closeSearch(); return; }
      if (sheet && sheet.classList.contains('on')) { closeSheet(); }
    });

    // Language buttons
    var langButtons = document.querySelectorAll('#lang button');
    for (var i = 0; i < langButtons.length; i++) {
      langButtons[i].addEventListener('click', function (e) {
        setLang(e.currentTarget.getAttribute('data-lang'));
      });
    }
    setLang(state.lang);

    // Detect deep-link to /s/<id> — open that story after load
    var m = window.location.pathname.match(/^\/s\/([\w-]+)$/);
    if (m) state.pendingDeepLink = m[1];

    // Handle back-button while sheet is open
    window.addEventListener('popstate', function () {
      if (document.getElementById('sheet').classList.contains('on')) {
        closeSheet(true);
      }
    });

    document.getElementById('feed').addEventListener('scroll', onScroll, { passive: true });

    // Reflect viewport mode in DOM (so CSS shows the right tree)
    applyViewportMode();
    // Listen for breakpoint crossing
    if (DESKTOP_MQ.addEventListener) {
      DESKTOP_MQ.addEventListener('change', onViewportChange);
    } else if (DESKTOP_MQ.addListener) {
      DESKTOP_MQ.addListener(onViewportChange);  // Safari < 14 fallback
    }

    renderCats();
    // Splash screen: track minimum display time so the splash doesn't flash too
    // quickly on a fast network. We aim for ~900ms minimum so the brand mark
    // registers.
    var splashStart = Date.now();
    function hideSplash() {
      var splash = document.getElementById('apSplash');
      if (!splash) return;
      var elapsed = Date.now() - splashStart;
      var wait = Math.max(0, 900 - elapsed);
      setTimeout(function () {
        splash.classList.add('ap-splash-hide');
        setTimeout(function () {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 450);
      }, wait);
    }
    // Safety: kill splash after 3s no matter what (network errors, etc.)
    setTimeout(hideSplash, 3000);

    loadStories().then(function () {
      var deepLinkId = state.pendingDeepLink;
      state.pendingDeepLink = null;

      if (deepLinkId) {
        // On mobile, render the feed underneath FIRST so that closing the
        // sheet reveals populated content (not the initial loading screen).
        // On desktop, renderDesktopArticle() replaces the magazine view anyway,
        // so we skip the magazine pre-render to avoid a flash.
        if (!isDesktop) renderActive();
        // We landed on a /s/:id URL — render the right view for that ID
        resolveDeepLink(deepLinkId);
      } else {
        // Normal landing — magazine view (or mobile feed)
        renderActive();
        // Desktop: pull full archive in background to fill the grid
        if (isDesktop && !state.archiveLoaded) {
          loadFullArchive().then(function () {
            // Only re-render if we're still on the magazine view
            // (user may have navigated to an article view in the meantime)
            if (isDesktop && state.currentView !== 'article') renderActive();
          });
        }
      }
      // First render complete — hide splash
      hideSplash();
    });
  }

  function resolveDeepLink(id) {
    var s = findStory(id);
    if (s) {
      // Story is already in state.stories — render immediately
      if (isDesktop) renderDesktopArticle(s);
      else openSheet(id);
      // On desktop also lazy-load full archive for footer category counts
      if (isDesktop && !state.archiveLoaded) loadFullArchive();
      return;
    }
    // Story not in latest — fetch archive
    fetch('/data/archive.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      if (!data || !data.stories) {
        // Archive unavailable — fall back to home view (better than blank page)
        renderActive();
        return;
      }
      var found = data.stories.find(function (x) { return String(x.id) === String(id); });
      // Merge archive into state.stories (dedup by id) so the rest of the app sees it
      var existingIds = {};
      for (var i = 0; i < state.stories.length; i++) existingIds[String(state.stories[i].id)] = true;
      for (var j = 0; j < data.stories.length; j++) {
        var sx = data.stories[j];
        if (sx && !existingIds[String(sx.id)]) state.stories.push(sx);
      }
      state.archiveLoaded = true;
      if (!found) {
        // Story doesn't exist in any data file — show home view
        renderActive();
        return;
      }
      if (isDesktop) {
        renderDesktopArticle(found);
      } else {
        renderActive();
        openSheet(id);
      }
    }).catch(function () {
      renderActive();
    });
  }

  function applyViewportMode() {
    var phone = document.querySelector('.phone');
    var desktop = document.getElementById('desktop');
    if (isDesktop) {
      if (phone) phone.setAttribute('aria-hidden', 'true');
      if (desktop) desktop.removeAttribute('hidden');
    } else {
      if (phone) phone.removeAttribute('aria-hidden');
      if (desktop) desktop.setAttribute('hidden', '');
    }
  }

  // Load the full archive (all stories ever) and merge into state.stories.
  // Desktop renders many more cards than the mobile feed, so it needs the
  // full corpus, not just the latest 72h window from latest.json.
  function loadFullArchive() {
    if (state.archiveLoaded) return Promise.resolve();
    return fetch('/data/archive.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.stories || !data.stories.length) return;
        var existingIds = {};
        for (var i = 0; i < state.stories.length; i++) {
          existingIds[String(state.stories[i].id)] = true;
        }
        var additional = [];
        for (var j = 0; j < data.stories.length; j++) {
          var s = data.stories[j];
          if (s && !existingIds[String(s.id)]) additional.push(s);
        }
        // Append archive entries after the latest ones (preserves newest-first order)
        state.stories = state.stories.concat(additional);
        state.archiveLoaded = true;
      })
      .catch(function () { /* fall through with latest only */ });
  }

  function onViewportChange(e) {
    var nextDesktop = e.matches;
    if (nextDesktop === isDesktop) return;
    isDesktop = nextDesktop;
    applyViewportMode();
    // When entering desktop for the first time mid-session, pull full archive
    if (isDesktop && !state.archiveLoaded) {
      loadFullArchive().then(function () { if (isDesktop) renderActive(); });
    } else if (state.stories && state.stories.length > 0) {
      renderActive();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
