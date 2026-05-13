/* Kunstpuls — app logic.
   Loads latest news, renders the feed, handles language, saves, and the article sheet. */

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
        return raw ? JSON.parse(raw) : {}
