// Ambient TV dashboard for a Samsung Tizen 4 TV.
// Written for the Tizen 4 web engine (Chromium 56): ES2015, no optional chaining, no CSS grid.
// Off the TV (a desktop browser) it runs against a small mock of the tizen API so it can be previewed.
(function () {
  'use strict';

  // Apps in the order they appear, most used first. Only installed ones are shown.
  // mark: what the dock icon shows ('play' draws YouTube's triangle with CSS).
  var APPS = [
    { id: 'xvvl3S1bvH.TizenBrewStandalone', name: 'YouTube', mark: 'play', bg: '#FF0000', fg: '#fff' },
    { id: 'RN1MCdNq8t.Netflix', name: 'Netflix', mark: 'N', size: 58, bg: '#000000', fg: '#E50914' },
    { id: 'cj37Ni3qXM.HBONow', name: 'HBO Max', mark: 'max', size: 30, bg: '#002BE7', fg: '#fff' },
    { id: 'evKhCgZelL.AmazonIgnitionLauncher2', name: 'Prime Video', mark: 'prime', size: 24, bg: '#00A8E1', fg: '#fff' },
    { id: 'MCmYXNxgcu.DisneyPlus', name: 'Disney+', mark: 'D+', size: 34, bg: '#0E1B4D', fg: '#fff' },
    { id: 'com.samsung.tv.aria-video', name: 'Apple TV', mark: 'tv', size: 34, bg: '#1C1C1E', fg: '#fff' },
    { id: 'rJeHak5zRg.Spotify', name: 'Spotify', mark: 'Spotify', size: 20, bg: '#1DB954', fg: '#000' },
    { id: 'pNutxbX589.RTPPlay', name: 'RTP Play', mark: 'RTP', size: 28, bg: '#0B2A4A', fg: '#fff' },
    { id: 'org.tizen.browser', name: 'Internet', mark: 'www', size: 26, bg: '#2A3140', fg: '#fff' }
  ];

  // Free landscape photos (Unsplash licence, served by picsum.photos).
  var PHOTOS = [
    [10, 'Paul Jarvis'], [11, 'Paul Jarvis'], [13, 'Paul Jarvis'], [14, 'Paul Jarvis'],
    [15, 'Paul Jarvis'], [16, 'Paul Jarvis'], [17, 'Paul Jarvis'], [28, 'Jerry Adney'],
    [29, 'Go Wild'], [37, 'Austin Neill'], [43, 'Oleg Chursin'], [46, 'Jeffrey Kam'],
    [49, 'Margaret Barley'], [54, 'Nicholas Swanson'], [62, 'Daniel Genser'], [66, 'Nicholas Swanson'],
    [74, 'Isaak Dury'], [77, 'May Pamintuan'], [83, 'Julie Geiger'], [85, 'Gozha Net'],
    [103, 'Ilham Rahmansyah'], [110, 'Kenneth Thewissen'], [116, 'Anton Sulsky'], [118, 'Rick Waalders'],
    [122, 'Vadim Sherbakov'], [124, 'Anton Sulsky'], [128, 'Matteo Minelli'], [132, 'Peter Besser']
  ];
  var PHOTO_MS = 60 * 1000;
  var WEATHER_MS = 30 * 60 * 1000;
  var DIM_MS = 30 * 1000; // dock fades back after this long without a key press
  var LAT = 40.1508, LON = -8.8618; // Figueira da Foz
  var PLACE = 'Figueira da Foz';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8 };

  var onTV = typeof window.tizen !== 'undefined';
  var tz = onTV ? window.tizen : mockTizen();
  var $ = function (id) { return document.getElementById(id); };

  // ---------- diagnostic log ----------
  // Events are kept in localStorage and sent to a small log receiver on the home PC when it is
  // running (tools/log-server.js). Nothing is lost while the PC is off; the list is capped.
  var LOG_URL = 'http://192.168.1.26:8914/log';
  var LOG_KEY = 'tvdash.log';
  var LOG_MAX = 400;
  var flushing = false;
  function readLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; } }
  function log(ev, data) {
    if (!onTV) return;
    var list = readLog();
    list.push({ t: new Date().toISOString(), v: String(window.__dashVersion || '').slice(0, 7), ev: ev, d: data });
    if (list.length > LOG_MAX) list = list.slice(list.length - LOG_MAX);
    try { localStorage.setItem(LOG_KEY, JSON.stringify(list)); } catch (e) { /* full: drop it */ }
    setTimeout(flushLog, 500);
  }
  function flushLog() {
    if (flushing) return;
    var list = readLog();
    if (!list.length) return;
    flushing = true;
    var x = new XMLHttpRequest();
    x.open('POST', LOG_URL);
    x.timeout = 4000;
    x.onload = function () {
      flushing = false;
      if (x.status !== 200) return;
      var now = readLog();
      try { localStorage.setItem(LOG_KEY, JSON.stringify(now.slice(list.length))); } catch (e) { /* ignore */ }
    };
    x.onerror = x.ontimeout = function () { flushing = false; };
    x.send(JSON.stringify(list));
  }
  setInterval(flushLog, 30000);

  // ---------- clock ----------
  var DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tickClock() {
    var d = new Date();
    $('time').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    $('date').textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
  }

  // ---------- weather (Open-Meteo, no key) ----------
  function weatherText(code) {
    if (code === 0) return 'Céu limpo';
    if (code <= 2) return 'Pouco nublado';
    if (code === 3) return 'Céu encoberto';
    if (code <= 48) return 'Nevoeiro';
    if (code <= 57) return 'Chuvisco';
    if (code <= 67) return 'Chuva';
    if (code <= 77) return 'Neve';
    if (code <= 82) return 'Aguaceiros';
    if (code <= 86) return 'Aguaceiros de neve';
    return 'Trovoada';
  }
  function loadWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FLisbon&forecast_days=1';
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var now = Math.round(j.current.temperature_2m);
      var hi = Math.round(j.daily.temperature_2m_max[0]);
      var lo = Math.round(j.daily.temperature_2m_min[0]);
      $('weather').innerHTML = '<span class="temp">' + now + '°</span>' + PLACE + ' · ' + weatherText(j.current.weather_code) +
        '<span class="range">Máx. ' + hi + '°  Mín. ' + lo + '°</span>';
    }).catch(function () { /* keep the last reading */ });
  }

  // ---------- photo backgrounds ----------
  var layers = [$('bg-a'), $('bg-b')];
  var front = 0;
  var order = shuffle(PHOTOS.slice());
  var photoIdx = 0;
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function nextPhoto() {
    var p = order[photoIdx % order.length];
    photoIdx++;
    var url = 'https://picsum.photos/id/' + p[0] + '/1920/1080';
    var img = new Image();
    img.onload = function () {
      var back = layers[1 - front];
      back.style.backgroundImage = 'url("' + url + '")';
      // restart the slow zoom on the incoming layer
      back.classList.remove('on');
      void back.offsetWidth;
      back.classList.add('on');
      layers[front].classList.remove('on');
      front = 1 - front;
      $('credit').textContent = 'Fotografia: ' + p[1] + ' / Unsplash  ·  ' + String(window.__dashVersion || 'dev').slice(0, 7);
    };
    img.onerror = function () { setTimeout(nextPhoto, 15000); };
    img.src = url;
  }

  // ---------- dock ----------
  var items = []; // { el, name, act }
  var focus = 0;

  function addIcon(el, name, act) {
    el.onclick = act;
    $('dock').appendChild(el);
    items.push({ el: el, name: name, act: act });
  }

  function buildApps(installed) {
    APPS.forEach(function (a) {
      if (installed && !installed[a.id]) return;
      var el = document.createElement('div');
      el.className = 'ic';
      el.style.background = a.bg;
      el.style.color = a.fg;
      if (a.mark === 'play') {
        var tri = document.createElement('div');
        tri.className = 'play';
        el.appendChild(tri);
      } else {
        el.textContent = a.mark;
        if (a.size) el.style.fontSize = a.size + 'px';
      }
      addIcon(el, a.name, function () { launchApp(a); });
    });
  }

  function buildInputs(sources) {
    if (!sources.length) return;
    var sep = document.createElement('div');
    sep.className = 'sep';
    $('dock').appendChild(sep);
    sources.forEach(function (s) {
      var tv = s.type === 'TV';
      var name = tv ? 'TV em direto' : s.type + (s.number ? ' ' + s.number : '');
      var el = document.createElement('div');
      el.className = 'ic input';
      el.innerHTML = tv ? 'TV' : s.type + '<br>' + (s.number || '');
      addIcon(el, s.name && !tv ? name + ' · ' + s.name : name, function () { showSource(s); });
    });
  }

  // Samsung's own settings menu, at the end of the dock, because Home now comes back here
  // instead of opening Samsung's bar. Known ids are tried first, then any app named like it.
  // org.tizen.menu is the settings menu on this 2018 TV (seen in its app list, 2026-11-07).
  var SETTINGS_IDS = ['org.tizen.menu', 'org.tizen.setting', 'com.samsung.tv.setting'];
  function findSettings(list) {
    var byId = {};
    (list || []).forEach(function (a) { byId[a.id] = a; });
    for (var i = 0; i < SETTINGS_IDS.length; i++) if (byId[SETTINGS_IDS[i]]) return SETTINGS_IDS[i];
    var hit = (list || []).filter(function (a) { return /setting|defini/i.test(a.id + ' ' + (a.name || '')); })[0];
    return hit ? hit.id : null;
  }
  function buildSettings(list) {
    var id = findSettings(list) || (onTV ? null : 'preview.settings');
    log('settings-app', { id: id });
    if (!id) return;
    var sep = document.createElement('div');
    sep.className = 'sep';
    $('dock').appendChild(sep);
    var el = document.createElement('div');
    el.className = 'ic input';
    var g = document.createElement('div');
    g.className = 'gear';
    el.appendChild(g);
    addIcon(el, 'Definições', function () { launchApp({ id: id, name: 'Definições' }); });
  }

  var ownLeaveAt = 0; // when this app last sent itself to the background on purpose
  function launchApp(a) {
    ownLeaveAt = Date.now();
    log('launch', { id: a.id });
    try {
      tz.application.launch(a.id, function () {}, function (e) {
        log('launch-failed', { id: a.id, err: e.name + ': ' + e.message });
        toast('Não foi possível abrir ' + a.name + ': ' + e.message);
      });
    } catch (e) {
      log('launch-failed', { id: a.id, err: e.name + ': ' + e.message });
      toast('Não foi possível abrir ' + a.name + ': ' + e.message);
    }
  }

  // ---------- TV inputs via tvwindow ----------
  var sourceOn = false;
  function showSource(s) {
    if (!tz.tvwindow) { toast('Esta TV não permite mudar de fonte a partir desta aplicação'); return; }
    try {
      tz.tvwindow.setSource({ type: s.type, number: s.number }, function () {
        tz.tvwindow.show(function () {
          sourceOn = true;
          document.body.classList.add('source-on');
        }, function (e) { toast('Não foi possível mostrar ' + s.type + ': ' + e.message); },
        ['0px', '0px', '1920px', '1080px'], 'MAIN');
      }, function (e) { toast('Não foi possível mudar para ' + s.type + ': ' + e.message); });
    } catch (e) { toast('Falha ao mudar de fonte: ' + e.message); }
  }
  function closeSource() {
    try { tz.tvwindow.hide(function () {}, function () {}, 'MAIN'); } catch (e) { /* ignore */ }
    sourceOn = false;
    document.body.classList.remove('source-on');
  }

  function loadSources(cb) {
    try {
      tz.systeminfo.getPropertyValue('VIDEOSOURCE', function (vs) {
        var list = [{ type: 'TV', number: 1 }];
        (vs.connected || []).forEach(function (s) { if (s.type !== 'TV') list.push(s); });
        cb(list);
      }, function () { cb([{ type: 'TV', number: 1 }]); });
    } catch (e) { cb(tz.tvwindow ? [{ type: 'TV', number: 1 }] : []); }
  }

  // ---------- focus, name label, dimming ----------
  var dimTimer = null;
  function paintFocus() {
    if (!items.length) return;
    focus = Math.max(0, Math.min(items.length - 1, focus));
    items.forEach(function (it, i) { it.el.classList.toggle('focus', i === focus); });
    var it = items[focus], dock = $('dock'), tip = $('tip');
    tip.textContent = it.name;
    // the dock is centred with translateX(-50%), so its offsetLeft is its centre line
    setTimeout(function () {
      tip.style.left = (dock.offsetLeft - dock.offsetWidth / 2 + it.el.offsetLeft + it.el.offsetWidth / 2) + 'px';
    }, 200);
  }
  function wake() {
    document.body.classList.remove('dim');
    document.body.classList.add('dock-active');
    clearTimeout(dimTimer);
    dimTimer = setTimeout(rest, DIM_MS);
  }
  function rest() {
    clearTimeout(dimTimer);
    document.body.classList.add('dim');
    document.body.classList.remove('dock-active');
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    setTimeout(function () { t.classList.remove('on'); }, 4000);
  }

  // every key the app receives, including ones it ignores, so new remote keys can be identified
  document.addEventListener('keydown', function (e) { log('key', { code: e.keyCode, key: e.key }); }, true);

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (sourceOn) {
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) { closeSource(); e.preventDefault(); }
      return;
    }
    var resting = document.body.classList.contains('dim');
    if (k === KEY.BACK || k === KEY.ESC) {
      if (resting) { ownLeaveAt = Date.now(); try { tz.application.getCurrentApplication().hide(); } catch (err) { /* ignore */ } }
      else rest();
      e.preventDefault();
      return;
    }
    wake();
    if (resting) { paintFocus(); e.preventDefault(); return; } // the first press only wakes the dock
    switch (k) {
      case KEY.LEFT: focus--; paintFocus(); break;
      case KEY.RIGHT: focus++; paintFocus(); break;
      case KEY.ENTER: if (items[focus]) items[focus].act(); break;
      default: return;
    }
    e.preventDefault();
  });

  // Coming back to the app (from another app, or when the wake service relaunches it)
  // starts again from the calm view with the first icon selected.
  document.addEventListener('visibilitychange', function () {
    log('visibility', { hidden: document.hidden, ownLeaveMsAgo: Date.now() - ownLeaveAt });
    if (document.hidden) { maybeTakeBack('hidden'); return; }
    if (sourceOn) closeSource();
    focus = 0;
    paintFocus();
    rest();
    tickClock();
    loadWeather();
  });

  // ---------- start ----------
  function installedMap(cb) {
    try {
      tz.application.getAppsInfo(function (list) {
        var m = {};
        list.forEach(function (a) { m[a.id] = true; });
        log('apps', list.map(function (a) { return a.id + ' | ' + a.name + (a.show === false ? ' (hidden)' : ''); }));
        cb(m, list);
      }, function () { cb(null, []); });
    } catch (e) { cb(null, []); }
  }

  // Scale the 1920x1080 stage to whatever size the page really is (cover, centred).
  function fitStage() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    var s = Math.min(w / 1920, h / 1080);
    var x = (w - 1920 * s) / 2, y = (h - 1080 * s) / 2;
    $('stage').style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
  }
  fitStage();
  window.addEventListener('resize', fitStage);

  tickClock();
  setInterval(tickClock, 1000);
  loadWeather();
  setInterval(loadWeather, WEATHER_MS);
  nextPhoto();
  setInterval(nextPhoto, PHOTO_MS);

  // ---------- come to the front when the TV wakes ----------
  // The app keeps running in the background (background-support in config.xml). Samsung's
  // "Instant On" standby freezes it, so after a wake the wall clock has jumped far past this
  // timer's period. That jump is the power-on signal: bring the dashboard to the front, over
  // Samsung's home bar or whatever app was open before standby. Ordinary background
  // throttling never stalls a timer for minutes, so 2 minutes keeps false wakes out.
  var WAKE_GAP_MS = 2 * 60 * 1000;
  var lastTick = Date.now();
  setInterval(function () {
    var now = Date.now();
    var gap = now - lastTick;
    if (gap > 20000) log('timer-gap', { s: Math.round(gap / 1000), hidden: document.hidden });
    if (onTV && gap > WAKE_GAP_MS) setTimeout(function () { bringToFront('wake'); }, 3000);
    lastTick = now;
  }, 5000);

  function bringToFront(reason) {
    if (!onTV) return;
    try {
      var me = tz.application.getCurrentApplication().appInfo.id;
      tz.application.launch(me, function () { log('front-ok', { why: reason }); },
        function (e) { log('front-failed', { why: reason, err: e.name + ': ' + e.message }); });
    } catch (e) { log('front-failed', { why: reason, err: e.name + ': ' + e.message }); }
  }

  // ---------- Home button comes back here ----------
  // Apps cannot take the Home key itself on a Samsung TV. What the dashboard sees instead is
  // that it loses the front (the app is hidden, or Samsung's bar takes focus over it) without
  // having asked to. Unless another app started in that moment (a cast from a phone, say),
  // the dashboard puts itself back in front, which closes Samsung's bar.
  var HOME_TAKEOVER = true;
  var TAKE_BACK_MS = 1200;
  function runningIds(cb) {
    try {
      tz.application.getAppsContext(function (list) { cb(list.map(function (c) { return c.appId; })); }, function () { cb([]); });
    } catch (e) { cb([]); }
  }
  function maybeTakeBack(why) {
    if (!HOME_TAKEOVER || !onTV || sourceOn) return;
    if (Date.now() - ownLeaveAt < 5000) return; // we opened an app or hid ourselves on purpose
    runningIds(function (before) {
      setTimeout(function () {
        runningIds(function (after) {
          var fresh = after.filter(function (id) { return before.indexOf(id) < 0; });
          var stillAway = document.hidden || !document.hasFocus();
          log('takeback-check', { why: why, fresh: fresh, stillAway: stillAway, running: after });
          if (stillAway && !fresh.length && Date.now() - ownLeaveAt > 5000) bringToFront('takeback-' + why);
        });
      }, TAKE_BACK_MS);
    });
  }
  window.addEventListener('blur', function () {
    log('blur', { hidden: document.hidden });
    if (!document.hidden) maybeTakeBack('blur');
  });
  window.addEventListener('focus', function () { log('focus', {}); });

  // ---------- what this TV allows (logged once per start) ----------
  if (onTV) {
    log('start', { hidden: document.hidden, w: window.innerWidth, h: window.innerHeight });
    try {
      var keys = tz.tvinputdevice.getSupportedKeys();
      // Home is not in this list on this TV, so it cannot be registered (measured 2026-11-07).
      log('supported-keys', keys.map(function (k) { return k.name + '=' + k.code; }));
    } catch (e) { log('keys-error', e.message); }
    log('apis', {
      statusListener: typeof tz.application.addAppStatusChangeListener,
      appsContext: typeof tz.application.getAppsContext,
      power: typeof (tz.power && tz.power.setScreenStateChangeListener)
    });
    try {
      tz.application.addAppStatusChangeListener(function (id, active) { log('app-status', { id: id, active: active }); });
    } catch (e) { log('status-listener-error', e.message); }
    try {
      tz.power.setScreenStateChangeListener(function (prev, next) { log('screen', { from: prev, to: next }); });
    } catch (e) { log('screen-listener-error', e.message); }
  }

  // tells shell.js this UI version started cleanly
  window.__dashOk = true;

  installedMap(function (m, apps) {
    buildApps(m);
    loadSources(function (list) {
      buildInputs(list);
      buildSettings(apps);
      paintFocus();
      var q = /focus=(\d+)/.exec(location.search);
      if (!onTV && q) { focus = Number(q[1]); paintFocus(); wake(); } else rest();
    });
  });

  // ---------- desktop preview mock ----------
  function mockTizen() {
    return {
      application: {
        launch: function (id, ok) { toast('(preview) would open ' + id); ok(); },
        getAppsInfo: function (ok) { ok(APPS.map(function (a) { return { id: a.id }; })); },
        getCurrentApplication: function () { return { hide: function () { toast('(preview) app hidden'); } }; }
      },
      systeminfo: {
        getPropertyValue: function (p, ok) { ok({ connected: [{ type: 'HDMI', number: 1 }, { type: 'HDMI', number: 2, name: 'PlayStation' }] }); }
      },
      tvwindow: {
        setSource: function (s, ok) { ok(); },
        show: function (ok) { toast('(preview) showing input; press Back to return'); ok(); },
        hide: function (ok) { ok(); }
      }
    };
  }
})();
