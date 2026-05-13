/* ArtPulse — app logic.
   Loads stories.json, renders the feed, handles language, saves, and the article sheet. */

(function () {
  'use strict';

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
      cats: ['Alle', 'Auktion', 'Ausstellung', 'K\u00FCnstler:innen', 'Markt', 'Museum', 'Biennale', 'Restitution']
    }
  };

  var CAT_KEYS = ['all', 'auction', 'exhibition', 'artists', 'market', 'museum', 'biennale', 'restitution'];

  var ICONS = {
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    bookmarkOn: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="m9 10 2 2 4-4"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
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
    saved: (function () {
      try {
        var raw = localStorage.getItem('kp-saved');
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    })(),
    currentIdx: 0,
    stories: [],
    hasMore: true,
    loadingMore: false,
    pendingDeepLink: null
  };

  function persistSaved() {
    try { localStorage.setItem('kp-saved', JSON.stringify(state.saved)); } catch (e) {}
  }

  // ---------- Helpers ----------
  function t(key) { return LABELS[state.lang][key]; }
  function catLabel(key) {
    var i = CAT_KEYS.indexOf(key);
    return i >= 0 ? LABELS[state.lang].cats[i] : key;
  }
  function getText(story, key) {
    return story[key + '_' + state.lang] || story[key + '_en'] || story[key] || '';
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
    if (state.cat === 'all') return state.stories;
    var out = [];
    for (var i = 0; i < state.stories.length; i++) {
      if (state.stories[i].isAd || state.stories[i].cat === state.cat) out.push(state.stories[i]);
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
        state.stories = injectAds(data.stories || []);
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
        // Append older stories (re-inject ads through the full list)
        var combined = state.stories.filter(function (s) { return !s.isAd; }).concat(older);
        state.stories = injectAds(combined);
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
    state.cat = e.currentTarget.getAttribute('data-cat');
    state.currentIdx = 0;
    renderCats();
    renderFeed();
    document.getElementById('feed').scrollTo({ top: 0 });
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
    var saved = !!state.saved[s.id];
    var iconBookmark = saved ? ICONS.bookmarkOn : ICONS.bookmark;
    var savedClass = saved ? ' on' : '';
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
          '<button class="rail-btn' + savedClass + '" data-save="' + escapeAttr(s.id) + '" aria-label="' + t('save') + '"><svg class="icon icon-lg" viewBox="0 0 24 24">' + iconBookmark + '</svg></button>' +
          '<button class="rail-btn" data-share="' + escapeAttr(s.id) + '" aria-label="' + t('share') + '"><svg class="icon icon-lg" viewBox="0 0 24 24">' + ICONS.share + '</svg></button>' +
          '<button class="rail-btn rail-ai" aria-label="AI summary"><svg class="icon icon-lg" viewBox="0 0 24 24">' + ICONS.sparkles + '</svg></button>' +
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
    var html = '';
    for (var i = 0; i < items.length; i++) {
      html += items[i].isAd ? adHTML(items[i], i) : storyHTML(items[i], i);
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

  function bindFeedEvents() {
    var saves = document.querySelectorAll('[data-save]');
    for (var i = 0; i < saves.length; i++) {
      saves[i].addEventListener('click', onSaveClick);
    }
    var expands = document.querySelectorAll('[data-expand]');
    for (var j = 0; j < expands.length; j++) {
      expands[j].addEventListener('click', onExpandClick);
    }
    var shares = document.querySelectorAll('[data-share]');
    for (var k = 0; k < shares.length; k++) {
      shares[k].addEventListener('click', onShareClick);
    }
  }

  function onSaveClick(e) {
    e.stopPropagation();
    var id = e.currentTarget.getAttribute('data-save');
    state.saved[id] = !state.saved[id];
    persistSaved();
    renderFeed();
    toast(state.saved[id] ? t('saved') : t('save'));
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
    var url = s.url || window.location.href;
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
    var saved = !!state.saved[s.id];
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
          '<button class="pill' + (saved ? ' on' : '') + '" id="sheetSave"><svg class="icon icon-sm" viewBox="0 0 24 24">' + (saved ? ICONS.bookmarkOn : ICONS.bookmark) + '</svg>' + (saved ? t('saved') : t('save')) + '</button>' +
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
    document.getElementById('sheetSave').addEventListener('click', function () {
      state.saved[s.id] = !state.saved[s.id];
      persistSaved();
      openSheet(s.id);
      renderFeed();
    });
    document.getElementById('sheetShare').addEventListener('click', function () {
      var url = s.url || window.location.href;
      var title = getText(s, 'headline');
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('Link copied'); });
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
    // Only re-render the feed if stories are already loaded.
    // On first setLang() during init, stories are still empty — re-rendering then
    // would replace the loading element and crash later code that references it.
    if (state.stories && state.stories.length > 0) renderFeed();
  }

  function init() {
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

    renderCats();
    loadStories().then(function () {
      renderFeed();
      // Resolve deep-link if present
      if (state.pendingDeepLink) {
        var id = state.pendingDeepLink;
        state.pendingDeepLink = null;
        var s = findStory(id);
        if (s) {
          openSheet(id);
        } else {
          // Story might be in archive but not in latest — fetch archive once
          fetch('/data/archive.json').then(function (r) { return r.json(); }).then(function (data) {
            if (!data || !data.stories) return;
            var found = data.stories.find(function (x) { return String(x.id) === String(id); });
            if (found) {
              state.stories = injectAds([found].concat(state.stories.filter(function (x) { return !x.isAd; })));
              renderFeed();
              openSheet(id);
            }
          }).catch(function () {});
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
