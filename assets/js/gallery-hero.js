/* ════════════════════════════════════════════════════════════════════
   GALLERY HERO — vanilla JS, no animation library. Owns: entrance
   reveal (single .glh-loaded class flip, CSS does the animating), a
   drifting ember-particle field biased toward the text side, and a
   very subtle mouse parallax across the background layer, the artwork
   and the text column. Mirrors steel-strip-hero.js / nails-hardware-
   hero.js. Particles and parallax are desktop/no-reduced-motion only.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const hero = document.querySelector('.glh');
  if (!hero) return;

  const bg = hero.querySelector('.glh-bg');
  const frame = hero.querySelector('.glh-visual-frame');
  const content = hero.querySelector('.glh-content');
  const particleHost = hero.querySelector('#glhParticles');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;

  requestAnimationFrame(() => {
    hero.classList.add('glh-loaded');
  });

  // ── drifting ember particles biased toward the left/content side
  // (5%-55%) — the artwork already has its own baked-in sparks and
  // glowing edges, so this reads as ambient atmosphere behind the text
  // rather than a duplicate spark layer ──
  if (particleHost && !reduceMotion) {
    const COUNT = 10;
    const hues = ['#FF5A00', '#FF7A18'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < COUNT; i++) {
      const span = document.createElement('span');
      span.className = 'glh-particle';
      const dur = 14 + Math.random() * 10;
      span.style.setProperty('--x', (5 + Math.random() * 50) + '%');
      span.style.setProperty('--size', (2 + Math.random() * 2) + 'px');
      span.style.setProperty('--dur', dur + 's');
      span.style.setProperty('--delay', (-Math.random() * dur) + 's');
      span.style.setProperty('--drift', (Math.random() * 32 - 16) + 'px');
      span.style.setProperty('--hue', hues[i % 2]);
      frag.appendChild(span);
    }
    particleHost.appendChild(frag);
  }

  // ── subtle mouse parallax: background layer (2-3px), artwork
  // (opposite direction, slightly stronger for depth), text column
  // (1-2px). The artwork stays a single unified composition — nothing
  // separates or tilts independently. ──
  if (canHover && !reduceMotion) {
    let raf = null;
    hero.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - .5;
        const py = (e.clientY - rect.top) / rect.height - .5;

        if (bg) bg.style.transform = `translate3d(${px * 3}px, ${py * 3}px, 0)`;
        if (frame) frame.style.transform = `translate3d(${px * -4}px, ${py * -4}px, 0)`;
        if (content) content.style.transform = `translate3d(${px * 1.5}px, ${py * 1.5}px, 0)`;

        raf = null;
      });
    });

    hero.addEventListener('pointerleave', () => {
      if (bg) bg.style.transform = '';
      if (frame) frame.style.transform = '';
      if (content) content.style.transform = '';
    });
  }
})();
