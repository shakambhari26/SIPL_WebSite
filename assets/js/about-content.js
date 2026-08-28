/* ════════════════════════════════════════════════════════════════════
   ABOUT US — Content Sections behavior
   Isolated component. Animates the stat-band counters once scrolled
   into view (same easing/contract as the homepage's inline counter
   script). Global .reveal fade-ins are already handled by site.js.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const counters = document.querySelectorAll('.au-stats .counter');
  if (!counters.length) return;

  const duration = 1800;
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const decimals = parseInt(el.dataset.decimal || '0', 10);
    const start = performance.now();

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const value = target * eased;
      el.textContent = prefix + value.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { obs.observe(c); });
  } else {
    counters.forEach(function (el) {
      const target = parseFloat(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const decimals = parseInt(el.dataset.decimal || '0', 10);
      el.textContent = prefix + target.toFixed(decimals) + suffix;
    });
  }
})();
