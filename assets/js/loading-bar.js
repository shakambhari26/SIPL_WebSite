/* ════════════════════════════════════════════════════════════════════
   LOW-POWER MODE — early synchronous device check. Runs from this same
   "first script after <body>" slot (see loading-bar's own comment
   below) specifically so the `.low-power-mode` class lands on <html>
   before the rest of <body> is parsed/painted — any CSS keyed off it
   (styles.css, market-presence-map.css, etc.) then applies with no
   flash of the heavy version first.

   A user's explicit Lite Mode choice (toggle lives in the footer, see
   site.js) always wins and skips auto-detection entirely. Otherwise
   this only looks at static, synchronous signals (CPU cores, RAM,
   prefers-reduced-motion, Data Saver). site.js separately runs an
   actual frame-rate sample once the page is interactive — that can
   still *upgrade* a device that passes every check here but turns out
   janky in practice (thermal throttling, background load, weak iGPU),
   but it never downgrades one this already flagged, so there's no
   conflict between the two.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var override;
  try { override = localStorage.getItem('lite-mode'); } catch (e) { override = null; }

  if (override === 'on') {
    root.classList.add('low-power-mode');
    window.__spLowPower = { source: 'override', value: true };
  } else if (override === 'off') {
    window.__spLowPower = { source: 'override', value: false };
  } else {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var lowEnd =
      (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
      (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      !!(conn && (conn.saveData || /2g/.test(conn.effectiveType || '')));
    if (lowEnd) root.classList.add('low-power-mode');
    window.__spLowPower = { source: 'auto', value: lowEnd };
  }
})();

/* ════════════════════════════════════════════════════════════════════
   SITE LOADING BAR — thin fixed bar across the top of the viewport,
   visible only while the page is actively loading. Self-contained
   (inline styles, no stylesheet dependency) so it paints instantly,
   even before styles.css arrives. Progress tracks real page-load
   signals (resource completions via PerformanceObserver, then
   DOMContentLoaded, then window 'load') rather than a fixed fake
   timer, so a slow page visibly lingers and a fast one snaps through.
   Include as the FIRST script tag right after <body> on every page.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (document.getElementById('pageLoadBar')) return;

  var bar = document.createElement('div');
  bar.id = 'pageLoadBar';
  bar.setAttribute('aria-hidden', 'true');
  bar.style.cssText =
    'position:fixed;top:0;left:0;height:3px;width:0%;z-index:99999;' +
    'pointer-events:none;' +
    'background:linear-gradient(90deg,#ED660A 0%,#185DAA 100%);' +
    'box-shadow:0 0 10px 1px rgba(237,102,10,.5),0 0 5px rgba(24,93,170,.55);' +
    'transition:width .25s ease-out,opacity .4s ease .1s;' +
    'opacity:1;';

  var mount = document.body || document.documentElement;
  mount.insertBefore(bar, mount.firstChild);

  var pct = 0;
  var done = false;

  function setPct(p) {
    if (p <= pct) return;
    pct = Math.min(p, 100);
    bar.style.width = pct + '%';
  }

  setPct(12);

  var expected = Math.max(
    document.querySelectorAll('script[src],link[rel="stylesheet"],img,link[rel="preload"]').length,
    1
  );
  var finished = 0;

  function onResource() {
    finished++;
    setPct(12 + Math.min(finished / expected, 1) * 63);
  }

  if (window.PerformanceObserver) {
    try {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(onResource);
      });
      po.observe({ type: 'resource', buffered: true });
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    setPct(Math.max(pct, 80));
  });

  function finish() {
    if (done) return;
    done = true;
    setPct(100);
    setTimeout(function () {
      bar.style.opacity = '0';
      setTimeout(function () {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }, 500);
    }, 200);
  }

  window.addEventListener('load', finish);
  setTimeout(finish, 6000);
})();