/* ════════════════════════════════════════════════════════════════════
   LOW-POWER MODE — early synchronous device check. Runs from the same
   "first script after <body>" slot loading-bar.js used to occupy (see
   loading-bar.js's own comment) specifically so the `.low-power-mode`
   class lands on <html> before the rest of <body> is parsed/painted —
   any CSS keyed off it (styles.css, market-presence-map.css, etc.)
   then applies with no flash of the heavy version first. Split into
   its own file so the blocking script is just this device check, not
   the loading-bar UI logic too.

   A `?lowPowerTest=1` / `?lowPowerTest=0` query param forces that mode
   for this page load only (never written to localStorage) — a private,
   unlisted way to test either experience on any machine regardless of
   its real specs. A user's explicit Lite Mode choice (toggle lives in
   the footer, see site.js) is the next-highest priority and skips
   auto-detection entirely. Otherwise this only looks at static,
   synchronous signals (CPU cores, RAM, prefers-reduced-motion, Data
   Saver). site.js separately runs an actual frame-rate sample once the
   page is interactive — that can still *upgrade* a device that passes
   every check here but turns out janky in practice (thermal
   throttling, background load, weak iGPU), but it never downgrades one
   this already flagged, so there's no conflict between the two.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;

  var testParam = null;
  try {
    var params = new URLSearchParams(location.search);
    if (params.has('lowPowerTest')) testParam = params.get('lowPowerTest') === '1';
  } catch (e) { testParam = null; }

  if (testParam !== null) {
    if (testParam) root.classList.add('low-power-mode');
    window.__spLowPower = { source: 'test-param', value: testParam };
    return;
  }

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
