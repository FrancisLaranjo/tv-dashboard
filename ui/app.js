// Ambient TV dashboard for a Samsung Tizen 4 TV.
// Written for the Tizen 4 web engine (Chromium 56): ES2015, no optional chaining, no CSS grid.
// Off the TV (a desktop browser) it runs against a small mock of the tizen API so it can be previewed.
(function () {
  'use strict';

  // Apps in the order they appear, most used first. Only installed ones are shown.
  var APPS = [
    { id: 'xvvl3S1bvH.TizenBrewStandalone', name: 'YouTube', bg: '#FF0000', fg: '#fff' },
    { id: 'RN1MCdNq8t.Netflix', name: 'NETFLIX', bg: '#000000', fg: '#E50914' },
    { id: 'cj37Ni3qXM.HBONow', name: 'HBO Max', bg: '#002BE7', fg: '#fff' },
    { id: 'evKhCgZelL.AmazonIgnitionLauncher2', name: 'prime video', bg: '#00A8E1', fg: '#fff' },
    { id: 'MCmYXNxgcu.DisneyPlus', name: 'Disney+', bg: '#0E1B4D', fg: '#fff' },
    { id: 'com.samsung.tv.aria-video', name: 'Apple TV', bg: '#1C1C1E', fg: '#fff' },
    { id: 'rJeHak5zRg.Spotify', name: 'Spotify', bg: '#1DB954', fg: '#000' },
    { id: 'pNutxbX589.RTPPlay', name: 'RTP Play', bg: '#0B2A4A', fg: '#fff' },
    { id: 'org.tizen.browser', name: 'Internet', bg: '#2A3140', fg: '#fff' }
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
  var PANEL_IDLE_MS = 25 * 1000;
  var LAT = 40.1508, LON = -8.8618; // Figueira da Foz
  var PLACE = 'Figueira da Foz';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8 };

  var onTV = typeof window.tizen !== 'undefined';
  var tz = onTV ? window.tizen : mockTizen();
  var $ = function (id) { return document.getElementById(id); };

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

  // ---------- tiles ----------
  var rows = [[], []]; // [apps, inputs]
  var focus = { row: 0, col: 0 };

  function makeTile(label, cls) {
    var el = document.createElement('div');
    el.className = 'tile' + (cls ? ' ' + cls : '');
    var span = document.createElement('div');
    span.className = 'label';
    span.textContent = label;
    el.appendChild(span);
    return el;
  }

  function buildApps(installed) {
    var host = $('apps');
    APPS.forEach(function (a) {
      if (installed && !installed[a.id]) return;
      var el = makeTile(a.name);
      el.style.background = a.bg;
      el.style.color = a.fg;
      el.onclick = function () { launchApp(a); };
      host.appendChild(el);
      rows[0].push({ el: el, act: function () { launchApp(a); } });
    });
  }

  function buildInputs(sources) {
    var host = $('inputs');
    sources.forEach(function (s) {
      var label = s.type === 'TV' ? 'TV em direto' : s.type + (s.number ? ' ' + s.number : '');
      var el = makeTile(label, 'input');
      if (s.name && s.name !== label) {
        var sub = document.createElement('div');
        sub.className = 'sub';
        sub.textContent = s.name;
        el.appendChild(sub);
      }
      el.onclick = function () { showSource(s); };
      host.appendChild(el);
      rows[1].push({ el: el, act: function () { showSource(s); } });
    });
    if (!rows[1].length) { $('inputs-label').style.display = 'none'; $('inputs').style.display = 'none'; }
  }

  function launchApp(a) {
    hidePanel();
    try {
      tz.application.launch(a.id, function () {}, function (e) { toast('Não foi possível abrir ' + a.name + ': ' + e.message); });
    } catch (e) { toast('Não foi possível abrir ' + a.name + ': ' + e.message); }
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
          hidePanel();
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

  // ---------- panel + focus ----------
  var idleTimer = null;
  function panelOpen() { return document.body.classList.contains('panel-open'); }
  function showPanel() {
    document.body.classList.add('panel-open');
    paintFocus();
    bumpIdle();
  }
  function hidePanel() {
    document.body.classList.remove('panel-open');
    clearTimeout(idleTimer);
  }
  function bumpIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(hidePanel, PANEL_IDLE_MS);
  }
  function paintFocus() {
    rows.forEach(function (r) { r.forEach(function (t) { t.el.classList.remove('focus'); }); });
    var r = rows[focus.row];
    if (!r || !r.length) { focus.row = 0; r = rows[0]; }
    if (!r.length) return;
    if (focus.col >= r.length) focus.col = r.length - 1;
    var el = r[focus.col].el;
    el.classList.add('focus');
    // scroll the row so the focused tile stays on screen (panel content is 1680px wide)
    var visible = 1920 - 2 * 120;
    var shift = Math.max(0, el.offsetLeft - 120 + el.offsetWidth + 60 - visible);
    el.parentNode.style.transform = 'translateX(' + (-shift) + 'px)';
  }
  function move(dRow, dCol) {
    var row = focus.row + dRow;
    if (row < 0 || row >= rows.length || !rows[row].length) row = focus.row;
    focus.row = row;
    focus.col = Math.max(0, Math.min(rows[row].length - 1, focus.col + dCol));
    paintFocus();
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    setTimeout(function () { t.classList.remove('on'); }, 4000);
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (sourceOn) {
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) { closeSource(); e.preventDefault(); }
      return;
    }
    if (!panelOpen()) {
      if (k === KEY.BACK || k === KEY.ESC) {
        try { tz.application.getCurrentApplication().hide(); } catch (err) { /* ignore */ }
      } else {
        showPanel();
      }
      e.preventDefault();
      return;
    }
    bumpIdle();
    switch (k) {
      case KEY.LEFT: move(0, -1); break;
      case KEY.RIGHT: move(0, 1); break;
      case KEY.UP: if (focus.row === 0) hidePanel(); else move(-1, 0); break;
      case KEY.DOWN: move(1, 0); break;
      case KEY.ENTER: { var t = rows[focus.row][focus.col]; if (t) t.act(); break; }
      case KEY.BACK: case KEY.ESC: case KEY.BACKSPACE: hidePanel(); break;
      default: return;
    }
    e.preventDefault();
  });

  // Coming back to the app (from another app, or when the wake service relaunches it)
  // starts again from the calm ambient view.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (sourceOn) closeSource();
    hidePanel();
    tickClock();
    loadWeather();
  });

  // ---------- start ----------
  function installedMap(cb) {
    try {
      tz.application.getAppsInfo(function (list) {
        var m = {};
        list.forEach(function (a) { m[a.id] = true; });
        cb(m);
      }, function () { cb(null); });
    } catch (e) { cb(null); }
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
  // tells shell.js this UI version started cleanly
  window.__dashOk = true;

  installedMap(function (m) {
    buildApps(m);
    loadSources(function (list) {
      buildInputs(list);
      paintFocus();
      var m = /panel=?(\d*)/.exec(location.search);
      if (!onTV && m) { focus.col = Number(m[1] || 1); showPanel(); }
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
