/* Gallery page: category filter + lightbox. Isolated component, reads
   everything it needs straight off the DOM (data-category/title/sub on
   each .gl-card), so the HTML stays the single source of truth. */
(function () {
  'use strict';

  var grid = document.getElementById('galleryGrid');
  var filterBar = document.getElementById('galleryFilters');
  if (!grid || !filterBar) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.gl-card'));
  var filterBtns = Array.prototype.slice.call(filterBar.querySelectorAll('.gl-filter'));

  var modal = document.getElementById('galleryModal');
  var modalImg = document.getElementById('galleryModalImg');
  var modalTitle = document.getElementById('galleryModalTitle');
  var modalSub = document.getElementById('galleryModalSub');
  var modalCounter = document.getElementById('galleryModalCounter');
  var prevBtn = document.getElementById('galleryModalPrev');
  var nextBtn = document.getElementById('galleryModalNext');
  var closeBtn = document.getElementById('galleryModalClose');

  var visible = cards.slice();
  var activeIndex = 0;

  function applyFilter(filter) {
    visible = [];
    cards.forEach(function (card) {
      var match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('gl-hidden', !match);
      if (match) visible.push(card);
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      applyFilter(btn.dataset.filter);
    });
  });

  function openModal(card) {
    activeIndex = visible.indexOf(card);
    if (activeIndex === -1) activeIndex = 0;
    render();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function render() {
    if (!visible.length) return;
    var card = visible[activeIndex];
    var full = card.dataset.full || card.querySelector('img').currentSrc || card.querySelector('img').src;
    modalImg.src = full;
    modalImg.alt = card.dataset.title || '';
    modalTitle.textContent = card.dataset.title || '';
    modalSub.textContent = card.dataset.sub || '';
    modalCounter.textContent = (activeIndex + 1) + ' / ' + visible.length;
  }

  function step(delta) {
    if (!visible.length) return;
    activeIndex = (activeIndex + delta + visible.length) % visible.length;
    render();
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () { openModal(card); });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(card); }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
})();
