/* MERCHANT VISIT ACTIVITY - LAUNCHER
   1. Opens the Apps Script form (config.js) inside this page with Telegram's verified sign-in data.
   2. Watches the loading: a slow or lost connection shows "Try again" instead of a blank screen.
   3. "Use my location" (POS & Sound Box): the form runs inside Google's frames and cannot hear Telegram,
      so it asks this page; this page asks Telegram (8.0 or later) and passes the answer back. */
(function () {
  'use strict';
  var cfg = window.MV_CONFIG || {}, start = window.MV_START || { search: '', hash: '' };
  var APP_URL = String(cfg.APP_URL || '').trim();
  var frame = document.getElementById('app');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^\/]+\/|macros\/)s\/[\w-]+\/exec$/.test(APP_URL)) {
    frame.parentNode.removeChild(frame);
    document.getElementById('ld').className = 'hidden';
    var d = document.createElement('div'); d.className = 'msg';
    var b = document.createElement('b'); b.textContent = 'Setup needed';
    d.appendChild(b); d.appendChild(document.createElement('br'));
    d.appendChild(document.createTextNode('Open config.js and paste your Web app link (ending with /exec) into APP_URL.'));
    document.body.appendChild(d);
    return;
  }
  // only the parts of the address the form needs: ?t=… (one-time link) and Telegram's data
  var search = '';
  try {
    var q = new URLSearchParams(start.search), keep = new URLSearchParams();
    ['t', 'tgWebAppStartParam'].forEach(function (k) { var v = q.get(k); if (v && v.length <= 800) keep.set(k, v); });
    search = keep.toString() ? '?' + keep.toString() : '';
  } catch (e) { search = ''; }
  var hash = /^#tgWebApp/.test(start.hash) ? start.hash : '';
  var tg = window.Telegram && window.Telegram.WebApp;
  try {
    if (tg && tg.initData) {                                             // signed by Telegram; checked again by the server
      hash = '#tgWebAppData=' + encodeURIComponent(tg.initData) +
        '&tgWebAppVersion=' + encodeURIComponent(tg.version || '') +
        '&tgWebAppPlatform=' + encodeURIComponent(tg.platform || '');
    }
    if (tg) { tg.ready(); tg.expand(); }
  } catch (e) { /* not opened inside Telegram - the form still works with Staff ID + PIN */ }
  var SRC = APP_URL + search + hash;

  // ---- loading watch: no blank screen when the connection is slow or lost
  var loaded = false, timer = 0, SLOW_MS = Number(cfg.SLOW_MS) || 20000;
  var nt = document.getElementById('nt'), ntT = document.getElementById('ntT'), ntS = document.getElementById('ntS');
  function notice(kind) {
    if (!kind) { nt.className = 'nt hidden'; return; }
    ntT.textContent = kind === 'offline' ? 'No internet connection' : 'Taking longer than usual';
    ntS.textContent = kind === 'offline' ? 'Connect to Wi-Fi or mobile data. The form opens by itself when you are back online.'
      : 'The form is still loading. Check the internet connection, then try again.';
    nt.className = 'nt';
  }
  function open() {
    loaded = false; clearTimeout(timer);
    timer = setTimeout(function () { if (!loaded) notice(navigator.onLine === false ? 'offline' : 'slow'); }, SLOW_MS);
    frame.src = SRC;
  }
  frame.addEventListener('load', function () {
    if (!frame.src || frame.src === 'about:blank') return;
    loaded = true; clearTimeout(timer); notice(null);
    document.getElementById('ld').className = 'hidden';
  });
  document.getElementById('ntBtn').addEventListener('click', function () { notice(null); open(); });
  window.addEventListener('offline', function () { if (!loaded) notice('offline'); });
  window.addEventListener('online', function () { if (!loaded) { notice(null); open(); } });
  if (navigator.onLine === false) notice('offline');
  open();

  // ---- Telegram location for the form
  var FORM_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*(googleusercontent\.com|script\.google\.com)$/;
  var lm = tg && tg.LocationManager;
  var canTg = false;
  try { canTg = !!(lm && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')); } catch (e) { canTg = false; }
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || typeof m !== 'object' || m.mva !== 1 || !ev.source || !FORM_ORIGIN.test(ev.origin)) return;   // only Google's frames of the form
    var sent = false;
    var reply = function (o) {
      if (sent) return;
      sent = true; o.mva = 1; o.id = m.id; o.type = m.type;
      try { ev.source.postMessage(o, ev.origin); } catch (e) { /* form closed */ }
    };
    if (m.type === 'hello') return reply({ location: canTg, launcher: 4 });
    if (m.type === 'location') {
      if (!canTg) return reply({ error: 'NO_TG' });
      var ask = function () {
        if (sent) return;
        try {
          if (!lm.isLocationAvailable) return reply({ error: 'NO_TG' });      // e.g. Telegram Desktop
          lm.getLocation(function (d) {                                       // Telegram asks the user the first time
            if (d && typeof d.latitude === 'number') return reply({ lat: d.latitude, lng: d.longitude, acc: d.horizontal_accuracy });
            reply({ error: lm.isAccessRequested && !lm.isAccessGranted ? 'DENIED' : 'NO_FIX' });
          });
        } catch (e) { reply({ error: 'NO_TG' }); }
      };
      try {
        if (lm.isInited) ask();
        else { setTimeout(function () { if (!lm.isInited) reply({ error: 'NO_TG' }); }, 8000); lm.init(ask); }   // no answer: the phone's GPS is used
      } catch (e) { reply({ error: 'NO_TG' }); }
      return;
    }
    if (m.type === 'location_settings') {                                   // "Open settings" in the form
      try { lm.openSettings(); }
      catch (e) { try { window.Telegram.WebView.postEvent('web_app_open_location_settings', false); } catch (e2) { /* not available */ } }
    }
  });
})();
