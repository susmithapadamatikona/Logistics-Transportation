/* ==========================================================================
   NorthLane Logistics — Motion
   AOS (with IntersectionObserver fallback), counters, progress bars,
   3D tilt, button ripple and parallax.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onVisible(els, cb, opts) {
    if (!('IntersectionObserver' in window)) { els.forEach(cb); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { cb(en.target); io.unobserve(en.target); } });
    }, Object.assign({ threshold: 0.25 }, opts || {}));
    els.forEach((el) => io.observe(el));
  }
  LX.onVisible = onVisible;

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    if (window.AOS && !reduce) {
      window.AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 60 });
      return;
    }
    const els = document.querySelectorAll('[data-aos]');
    els.forEach((el) => el.classList.add('reveal'));
    onVisible(Array.from(els), (el) => {
      const d = parseInt(el.getAttribute('data-aos-delay') || '0', 10);
      setTimeout(() => el.classList.add('in'), d);
    }, { threshold: 0.12 });
  }

  /* ---------- Counters: <span data-count="98.7" data-decimals="1" data-suffix="%"> ---------- */
  LX.countUp = function (el, to, opts) {
    opts = opts || {};
    const target = to !== undefined ? to : parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || opts.decimals || 0, 10);
    const pre = el.dataset.prefix || opts.prefix || '';
    const suf = el.dataset.suffix || opts.suffix || '';
    const from = opts.from !== undefined ? opts.from : 0;
    const dur = reduce ? 0 : opts.duration || 1800;
    const start = performance.now();
    const fmt = (v) => pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    if (!dur) { el.textContent = fmt(target); return; }
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(from + (target - from) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  function initCounters(root) {
    const els = Array.from((root || document).querySelectorAll('[data-count]:not([data-counted])'));
    els.forEach((el) => el.setAttribute('data-counted', ''));
    onVisible(els, (el) => LX.countUp(el), { threshold: 0.4 });
  }

  /* ---------- Progress bars: <div class="progress"><span data-progress="72"></span></div> ---------- */
  function initProgress(root) {
    const els = Array.from((root || document).querySelectorAll('[data-progress]:not([data-progressed])'));
    els.forEach((el) => el.setAttribute('data-progressed', ''));
    onVisible(els, (el) => { el.style.width = el.dataset.progress + '%'; }, { threshold: 0.2 });
  }

  /* ---------- 3D tilt ---------- */
  function initTilt(root) {
    if (reduce || window.matchMedia('(hover: none)').matches) return;
    (root || document).querySelectorAll('[data-tilt]:not([data-tilted])').forEach((el) => {
      el.setAttribute('data-tilted', '');
      el.classList.add('tilt');
      const max = parseFloat(el.dataset.tilt) || 8;
      if (!el.querySelector('.tilt-glare')) el.insertAdjacentHTML('beforeend', '<span class="tilt-glare" aria-hidden="true"></span>');
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * max) + 'deg) rotateY(' + ((x - 0.5) * max) + 'deg) translateY(-4px)';
        el.style.setProperty('--gx', x * 100 + '%');
        el.style.setProperty('--gy', y * 100 + '%');
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Button ripple ---------- */
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || reduce) return;
    const r = btn.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    btn.appendChild(span);
    setTimeout(() => span.remove(), 700);
  });

  /* ---------- Parallax: data-parallax="0.2" ---------- */
  function initParallax() {
    const els = Array.from(document.querySelectorAll('[data-parallax]'));
    if (!els.length || reduce) return;
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      els.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const speed = parseFloat(el.dataset.parallax) || 0.2;
        el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -speed).toFixed(1) + 'px,0) scale(1.12)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    update();
  }

  LX.animate = function (root) {
    initCounters(root);
    initProgress(root);
    initTilt(root);
    if (root && window.AOS) window.AOS.refreshHard && window.AOS.refreshHard();
  };

  LX.initMotion = function () {
    initReveal();
    initParallax();
    LX.animate();
  };
})();
