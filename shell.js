// Self-updating shell for the Home dashboard.
//
// The installed app only holds this shell plus a bundled copy of the UI (ui/). The UI itself
// is fetched from this GitHub repo, so changing the dashboard is a git push: no reinstall and
// no switching the TV's developer-mode IP.
//
//  - Start: run the last downloaded UI from localStorage, else the bundled copy.
//  - Every CHECK_MS, and whenever the app comes back to the front, ask GitHub for the newest
//    commit on main. If it differs, download ui/ at that exact commit (immutable URLs, so no
//    CDN staleness), store it, and reload while the dashboard is idle.
//  - A downloaded UI that fails to start (no window.__dashOk within BOOT_MS) is thrown away
//    and the bundled copy is used, so a bad push cannot brick the TV.
//
// Written for the Tizen 4 web engine (Chromium 56).
(function () {
  'use strict';

  var REPO = 'FrancisLaranjo/tv-dashboard';
  var BRANCH = 'main';
  var STORE = 'tvdash.bundle';
  var CHECK_MS = 10 * 60 * 1000;
  var BOOT_MS = 6000;
  var FILES = ['ui/body.html', 'ui/style.css', 'ui/app.js'];

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; }
  }
  function writeStore(b) {
    try { localStorage.setItem(STORE, JSON.stringify(b)); return true; } catch (e) { return false; }
  }

  function getText(url) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', url);
      x.onload = function () {
        // status 0 is what a file inside the installed package returns
        if (x.status === 200 || (x.status === 0 && x.responseText)) resolve(x.responseText);
        else reject(new Error(url + ' -> ' + x.status));
      };
      x.onerror = function () { reject(new Error(url + ' -> network error')); };
      x.send();
    });
  }

  function run(bundle) {
    window.__dashVersion = bundle.version;
    window.__dashOk = false;
    var st = document.createElement('style');
    st.textContent = bundle.css;
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('afterbegin', bundle.html);
    var s = document.createElement('script');
    s.textContent = bundle.js + '\n//# sourceURL=dashboard-app.js';
    document.body.appendChild(s);
  }

  function loadBundled() {
    return Promise.all(FILES.map(function (f) { return getText(f); })).then(function (t) {
      return { version: 'bundled', html: t[0], css: t[1], js: t[2] };
    });
  }

  function start() {
    var cached = readStore();
    if (cached && cached.js) {
      run(cached);
      setTimeout(function () {
        if (!window.__dashOk) {
          try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
          location.reload();
        }
      }, BOOT_MS);
    } else {
      loadBundled().then(run);
    }
  }

  // ---------- updates ----------
  var pendingReload = false;
  function idle() {
    // panel-open belonged to the first layout; dock-active is the dock look being used
    return !/panel-open|source-on|dock-active/.test(document.body.className);
  }
  function reloadWhenIdle() {
    pendingReload = true;
    if (idle()) location.reload();
  }
  function checkForUpdate() {
    getText('https://api.github.com/repos/' + REPO + '/commits/' + BRANCH + '?t=' + Date.now())
      .then(function (txt) {
        var sha = JSON.parse(txt).sha;
        if (!sha || sha === window.__dashVersion) return null;
        var base = 'https://raw.githubusercontent.com/' + REPO + '/' + sha + '/';
        return Promise.all(FILES.map(function (f) { return getText(base + f); })).then(function (t) {
          if (!t[0] || !t[1] || !t[2]) return;
          if (writeStore({ version: sha, html: t[0], css: t[1], js: t[2] })) reloadWhenIdle();
        });
      })
      .catch(function () { /* offline or rate limited: keep what we have */ });
  }

  start();
  setTimeout(checkForUpdate, 15000);
  setInterval(checkForUpdate, CHECK_MS);
  setInterval(function () { if (pendingReload && idle()) location.reload(); }, 5000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkForUpdate();
  });
})();
