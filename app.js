/* ArtPulse — app logic.
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
      latestUpdated: 'Latest \u00B7 Updated three times daily',
      thisWeekHeadline: 'This week',
      nlEyebrow: 'ArtPulse Monthly',
      nlTitle1: 'The first of the month,',
      nlTitle2: 'delivered.',
      nlBody: 'Once a month. The stories that mattered, condensed in one read.',
      // Hero welcome (first-visit)
      heroEyebrow: 'ArtPulse',
      heroHeadline1: 'The art world,',
      heroHeadline2: 'in one breath.',
      heroBody: 'International art press, condensed. Free, no ads, no algorithm.',
      heroCtaPrimary: 'Read today\u2019s stories',
      heroCtaSecondary: 'Get it monthly',
      heroFine: 'Free \u00B7 Monthly \u00B7 Unsubscribe anytime',
      footerTagline: 'International art news, in one breath. Three times daily, edited by us.',
      sectionsLabel: 'Sections',
      aboutLabel: 'About',
      legalLabel: 'Legal',
      subscribeNewsletter: 'Subscribe to newsletter',
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
      latestUpdated: 'Aktuell \u00B7 Dreimal t\u00E4glich aktualisiert',
      thisWeekHeadline: 'Diese Woche',
      nlEyebrow: 'ArtPulse Monthly',
      nlTitle1: 'Den Ersten jeden Monats,',
      nlTitle2: 'frei Haus.',
      nlBody: 'Einmal im Monat. Stories, die zählten — in einem Atemzug.',
      // Hero welcome (first-visit)
      heroEyebrow: 'ArtPulse',
      heroHeadline1: 'Die Kunstwelt,',
      heroHeadline2: 'in einem Atemzug.',
      heroBody: 'Internationale Kunstpresse, kondensiert. Kostenlos, ohne Werbung, ohne Algorithmus.',
      heroCtaPrimary: 'Heutige Stories lesen',
      heroCtaSecondary: 'Monatlich per Mail',
      heroFine: 'Kostenlos \u00B7 Monatlich \u00B7 Jederzeit abbestellbar',
      footerTagline: 'Internationale Kunst-News, in einem Atemzug. Dreimal t\u00E4glich, redigiert von uns.',
      sectionsLabel: 'Rubriken',
      aboutLabel: 'Information',
      legalLabel: 'Rechtliches',
      subscribeNewsletter: 'Newsletter abonnieren',
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

  function filteredStories() {
    if (state.cat === 'all') return state.stories.slice();
    var out = [];
    for (var i = 0; i < state.stories.length; i++) {
      if (state.stories[i].cat === state.cat) out.push(state.stories[i]);
    }
    return out;
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
        state.stories = data.stories || [];  // raw, ads injected at render time
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
        state.stories = state.stories.concat(older);
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
              '<li>Auction results &amp; market moves</li>' +
              '<li>Major openings worldwide</li>' +
              '<li>One artist worth knowing</li>' +
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

  function injectHero(items) {
    /* Prepend the welcome hero on first visit (until dismissed via X or CTA). */
    var dismissed = false;
    try { dismissed = localStorage.getItem('ap-hero-dismissed') === '1'; } catch (e) {}
    if (dismissed) return items;
    return [{ isHero: true, id: 'hero-welcome' }].concat(items);
  }

  function heroHTML(item, idx) {
    return '' +
      '<article class="card card-hero" data-idx="' + idx + '">' +
        '<div class="hero-shell">' +
          '<button class="hero-dismiss" data-hero-dismiss aria-label="Dismiss welcome">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
          '<div class="hero-top">' +
            '<div class="hero-eyebrow">' + escapeHTML(t('heroEyebrow')) + '</div>' +
            '<h1 class="hero-headline">' + escapeHTML(t('heroHeadline1')) + '<br><em>' + escapeHTML(t('heroHeadline2')) + '</em></h1>' +
            '<p class="hero-body">' + escapeHTML(t('heroBody')) + '</p>' +
          '</div>' +
          '<div class="hero-bottom">' +
            '<div class="hero-ctas">' +
              '<button class="hero-cta hero-cta-primary" data-hero-read type="button">' +
                '<span>' + escapeHTML(t('heroCtaPrimary')) + '</span>' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>' +
              '</button>' +
              '<a class="hero-cta hero-cta-secondary" href="/subscribe" data-hero-subscribe>' +
                '<span>' + escapeHTML(t('heroCtaSecondary')) + '</span>' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>' +
              '</a>' +
            '</div>' +
            '<div class="hero-fine">' + escapeHTML(t('heroFine')) + '</div>' +
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
    var image = s.image || ('https://picsum.photos/seed/' + encodeURIComponent(s.id) + '/800/1200');

    return '' +
      '<article class="card" data-idx="' + idx + '" data-id="' + escapeAttr(s.id) + '">' +
        '<div class="card-img" style="background-image:url(\'' + escapeAttr(image) + '\')"></div>' +
        '<div class="card-grad" style="background:linear-gradient(135deg,' + escapeAttr(accent) + ' 0%,transparent 60%)"></div>' +
        '<div class="card-shade"></div>' +
        '<div class="card-top">' +
          '<span class="badge"><span class="badge-dot" style="background:' + escapeAttr(accent) + '"></span>' + escapeHTML(catLabel(s.cat)) + '</span>' +
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
    // Fallback if ads.js didn't load
    return '<article class="card card-ad" data-idx="' + idx + '"><div class="ad-shell"><div class="ad-label">Advertisement</div></div></article>';
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
    // Prepend the welcome hero on first visit (LocalStorage flag dismisses it).
    items = injectHero(items);
    var html = '';
    for (var i = 0; i < items.length; i++) {
      if (items[i].isAd) html += adHTML(items[i], i);
      else if (items[i].isNewsletter) html += nlHTML(items[i], i);
      else if (items[i].isHero) html += heroHTML(items[i], i);
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

    // Pick a hero with visual impact: first story with an image.
    // Falls back to first story if none have images (typo hero).
    var hero = null;
    var heroIndex = -1;
    for (var k = 0; k < stories.length; k++) {
      if (stories[k] && stories[k].image) {
        hero = stories[k];
        heroIndex = k;
        break;
      }
    }
    if (!hero && stories.length > 0) {
      hero = stories[0];
      heroIndex = 0;
    }
    // Build the rest excluding the hero (preserving newest-first order)
    var rest = [];
    for (var k2 = 0; k2 < stories.length; k2++) {
      if (k2 !== heroIndex) rest.push(stories[k2]);
    }

    var html = '';

    // ========= Masthead =========
    html += '<header class="d-masthead"><div class="d-masthead-row">';
    html += '<a href="/" class="d-logo" id="dLogo"><span class="art">art</span><span class="pulse">pulse</span><span class="dot" aria-hidden="true"></span></a>';
    html += '<div class="d-actions">';
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
      html += '<div class="d-empty"><p class="d-empty-title">' + escapeHTML(t('empty')) + '</p><p class="d-empty-sub">Check back soon — new stories arrive three times daily.</p></div>';
    } else {
      html += desktopHeroHTML(hero);
    }

    // Section title + grid
    if (rest.length > 0) {
      var count = Math.min(rest.length, 15);
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

    root.innerHTML = html;
    bindDesktopEvents();
  }

  // Friendly "Updated 3× daily · timestamp" line for the category bar
  function latestUpdateText() {
    var base = (state.lang === 'de') ? 'Aktualisiert 3× täglich' : 'Updated 3× daily';
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
      visual = '<div class="d-hero-typo d-typo-' + escapeAttr(catKey) + '">' +
        '<span class="d-typo-mark">&ldquo;</span>' +
        '<span class="d-hero-typo-headline">' + headline + '</span>' +
      '</div>';
    }

    return '' +
      '<a href="' + url + '" class="d-hero">' +
        visual +
        '<div class="d-hero-content">' +
          '<div class="d-hero-meta">' +
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
      visual = '<div class="d-card-typo d-typo-' + escapeAttr(catKey) + '">' +
        '<span class="d-typo-mark">&ldquo;</span>' +
        '<span class="d-card-typo-headline">' + headline + '</span>' +
      '</div>';
    }

    return '' +
      '<a href="' + url + '" class="d-card">' +
        visual +
        '<div class="d-card-meta">' +
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
              '<li><a href="/subscribe">' + escapeHTML(t('subscribeNewsletter')) + '</a></li>' +
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
          '<span>© 2026 ArtPulse · Made in Berlin</span>' +
          '<span>artpulse.app</span>' +
        '</div>' +
      '</footer>';
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
    // Hero welcome (first-visit) handlers
    var heroDismiss = document.querySelector('[data-hero-dismiss]');
    if (heroDismiss) heroDismiss.addEventListener('click', onHeroDismiss);
    var heroRead = document.querySelector('[data-hero-read]');
    if (heroRead) heroRead.addEventListener('click', onHeroDismiss);
    var heroSubscribe = document.querySelector('[data-hero-subscribe]');
    if (heroSubscribe) heroSubscribe.addEventListener('click', function () {
      try { localStorage.setItem('ap-hero-dismissed', '1'); } catch (e) {}
      // Default <a> navigation proceeds.
    });
  }

  function onHeroDismiss() {
    try { localStorage.setItem('ap-hero-dismissed', '1'); } catch (e) {}
    var heroEl = document.querySelector('.card-hero');
    if (!heroEl) return;
    heroEl.classList.add('hero-dismissing');
    setTimeout(function () {
      heroEl.remove();
      var feed = document.getElementById('feed');
      if (feed) feed.scrollTo({ top: 0, behavior: 'auto' });
      renderProgress();
    }, 380);
  }

  function onExpandClick(e) {
    var id = e.currentTarget.getAttribute('data-expand');
    openSheet(id);
  }

  function onShareClick(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-share');
    var s = findStory(id);
    if (!s) return;
    var url = window.location.origin + '/s/' + encodeURIComponent(s.id);
    var title = getText(s, 'headline');
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Link copied'); });
    }
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
  function openSheet(id) {
    var s = findStory(id);
    if (!s || s.isAd) return;
    var accent = s.accent || '#e8503a';
    var image = s.image || ('https://picsum.photos/seed/' + encodeURIComponent(s.id) + '/800/1200');
    var sourceLink = s.url ? (
      '<a class="sheet-source-link" href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener noreferrer">' +
        t('readSource') +
        '<svg class="icon icon-sm" viewBox="0 0 24 24">' + ICONS.external + '</svg>' +
      '</a>'
    ) : '';

    var html = '' +
      '<button class="sheet-close" id="sheetClose" aria-label="Close"><svg class="icon" viewBox="0 0 24 24">' + ICONS.close + '</svg></button>' +
      '<div class="sheet-hero" style="background-image:url(\'' + escapeAttr(image) + '\')">' +
        '<div class="sheet-hero-shade"></div>' +
        '<span class="badge"><span class="badge-dot" style="background:' + escapeAttr(accent) + '"></span>' + escapeHTML(catLabel(s.cat)) + '</span>' +
      '</div>' +
      '<div class="sheet-body">' +
        '<div class="kicker">' + escapeHTML(getText(s, 'kicker')) + '</div>' +
        '<h1 class="sheet-headline">' + escapeHTML(getText(s, 'headline')) + '</h1>' +
        '<div class="meta meta-row"><span class="source">' + escapeHTML(s.source || '') + '</span><span class="sep">\u00B7</span><span>' + escapeHTML(getText(s, 'time')) + '</span><span class="sep">\u00B7</span><span>' + (s.read || 3) + ' ' + t('readingTime') + '</span></div>' +
        '<p class="sheet-lead">' + escapeHTML(getText(s, 'summary')) + '</p>' +
        '<p class="sheet-text">' + escapeHTML(getText(s, 'body')) + '</p>' +
        (window.ArtPulseAds && window.ArtPulseAds.renderInArticle
          ? window.ArtPulseAds.renderInArticle()
          : '<div class="inline-ad"><span class="ad-label-small">' + t('ad') + '</span><div class="inline-ad-box">' + t('inArticleAd') + '</div></div>') +
        sourceLink +
        '<div class="sheet-actions">' +
          '<button class="pill" id="sheetShare"><svg class="icon icon-sm" viewBox="0 0 24 24">' + ICONS.share + '</svg>' + t('share') + '</button>' +
        '</div>' +
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
    document.title = getText(s, 'headline') + ' — ArtPulse';
    // Trigger AdSense rendering for in-article slot
    if (window.ArtPulseAds && window.ArtPulseAds.activate) {
      window.ArtPulseAds.activate(document.getElementById('sheetInner'));
    }
    document.getElementById('sheetClose').addEventListener('click', function () { closeSheet(); });
    document.getElementById('sheetShare').addEventListener('click', function () {
      var shareUrl = window.location.origin + '/s/' + encodeURIComponent(s.id);
      var title = getText(s, 'headline');
      if (navigator.share) {
        navigator.share({ title: title, url: shareUrl }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(function () { toast('Link copied'); });
      }
    });
    document.getElementById('sheet').addEventListener('click', function (e) {
      if (e.target.id === 'sheet') closeSheet();
    });
  }

  function closeSheet(fromPopstate) {
    document.getElementById('sheet').classList.remove('on');
    document.title = 'ArtPulse — Art world, in one breath';
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

  // ---------- Welcome screen (first-visit overlay) ----------
  function initWelcome() {
    var FLAG = 'kp-welcome-seen';
    try {
      if (localStorage.getItem(FLAG) === '1') return;
    } catch (e) { return; }

    var welcome = document.getElementById('welcome');
    if (!welcome) return;

    var WLABELS = {
      en: {
        line1: 'The art world,',
        line2: 'in one breath.',
        body: 'International art press, daily. Two sentences per story. Bilingual. No login.',
        read: 'Read today',
        monthly: 'Get it monthly'
      },
      de: {
        line1: 'Die Kunstwelt,',
        line2: 'in einem Atemzug.',
        body: 'Internationale Kunstpresse, t\u00E4glich. Zwei S\u00E4tze pro Story. Zweisprachig. Kein Login.',
        read: 'Heute lesen',
        monthly: 'Per Mail bekommen'
      }
    };

    var initialLang = state.lang;

    function applyLang(lang) {
      var L = WLABELS[lang] || WLABELS.en;
      welcome.querySelector('.welcome-line-1').textContent = L.line1;
      welcome.querySelector('.welcome-line-2 em').textContent = L.line2;
      document.getElementById('welcomeBody').textContent = L.body;
      document.getElementById('welcomeReadLabel').textContent = L.read;
      document.getElementById('welcomeSubscribeLabel').textContent = L.monthly;
      var btns = welcome.querySelectorAll('.welcome-lang-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('on', btns[i].getAttribute('data-lang') === lang);
      }
      state.lang = lang;
      try { localStorage.setItem('kp-lang', lang); } catch (e) {}
      document.documentElement.lang = lang;
    }

    // Render initial lang from existing state (browser or persisted)
    applyLang(state.lang);

    // Show welcome
    welcome.classList.add('on');
    welcome.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    function dismiss(navigateUrl) {
      try { localStorage.setItem(FLAG, '1'); } catch (e) {}
      if (navigateUrl) {
        window.location.href = navigateUrl;
        return;
      }
      // If lang changed during welcome, reload so main app picks it up cleanly
      if (state.lang !== initialLang) {
        window.location.reload();
        return;
      }
      welcome.classList.remove('on');
      welcome.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    document.getElementById('welcomeClose').addEventListener('click', function () { dismiss(null); });
    document.getElementById('welcomeRead').addEventListener('click', function () { dismiss(null); });
    document.getElementById('welcomeSubscribe').addEventListener('click', function (e) {
      e.preventDefault();
      dismiss('/subscribe');
    });

    var langBtns = welcome.querySelectorAll('.welcome-lang-btn');
    for (var i = 0; i < langBtns.length; i++) {
      langBtns[i].addEventListener('click', function () {
        applyLang(this.getAttribute('data-lang'));
      });
    }
  }

  function init() {
    // Welcome screen (first visit only) — runs early so it overlays the loading state
    initWelcome();

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
    loadStories().then(function () {
      var deepLinkId = state.pendingDeepLink;
      state.pendingDeepLink = null;

      if (deepLinkId) {
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
