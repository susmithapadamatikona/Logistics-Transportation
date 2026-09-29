/* ==========================================================================
   NorthLane Logistics — Core bootstrap & shared widgets
   Load order on every page:
     icons.js → data.js → notifications.js → navbar.js → animations.js
     → charts.js (optional) → page scripts → main.js
   Page scripts register work with LX.ready(fn); main.js mounts the chrome,
   runs those callbacks, hydrates icons and starts motion.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util;
  const queue = LX._ready || [];
  LX.ready = function (fn) { if (LX._booted) fn(); else queue.push(fn); };

  /* Render HTML into a container and wire up icons + motion for new nodes */
  LX.render = function (el, html) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return;
    el.innerHTML = html;
    LX.hydrateIcons(el);
    LX.animate(el);
    return el;
  };

  /* ---------- Form validation ----------
     Supports: required, type=email, type=tel, data-minlength, data-match="#id",
     data-password (strength >= 3). Each input sits inside .field with a .field-error. */
  LX.validate = function (form) {
    let ok = true, firstBad = null;
    form.querySelectorAll('input, select, textarea').forEach((inp) => {
      const field = inp.closest('.field');
      if (!field || inp.disabled || inp.type === 'hidden' || inp.offsetParent === null) return;
      const v = inp.type === 'checkbox' ? inp.checked : String(inp.value).trim();
      let msg = '';
      if (inp.required && !v) msg = inp.dataset.msg || 'This field is required.';
      else if (v && inp.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Enter a valid email address.';
      else if (v && inp.type === 'tel' && !/^[+()\d\s-]{7,20}$/.test(v)) msg = 'Enter a valid phone number.';
      else if (v && inp.dataset.minlength && v.length < +inp.dataset.minlength) msg = 'Use at least ' + inp.dataset.minlength + ' characters.';
      else if (v && inp.dataset.password !== undefined && LX.passwordScore(v) < 3) msg = 'Use 8+ characters with upper-case, a number and a symbol.';
      else if (inp.dataset.match) { const o = form.querySelector(inp.dataset.match); if (o && o.value !== inp.value) msg = 'Passwords do not match.'; }
      else if (v && inp.type === 'number' && inp.min !== '' && +v < +inp.min) msg = 'Minimum value is ' + inp.min + '.';
      const err = field.querySelector('.field-error');
      if (err && msg) err.textContent = msg;
      field.classList.toggle('invalid', !!msg);
      field.classList.toggle('valid', !msg && !!v && inp.type !== 'checkbox');
      inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) { ok = false; if (!firstBad) firstBad = inp; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  };
  document.addEventListener('input', (e) => {
    const f = e.target.closest('.field.invalid');
    if (f) { f.classList.remove('invalid'); e.target.setAttribute('aria-invalid', 'false'); }
  });

  LX.passwordScore = function (p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    if (p.length >= 12) s = Math.min(4, s + 1);
    return s;
  };

  /* ---------- List controller: search + filter + sort + pagination ----------
     LX.list({ items, container, render(item), empty, pageSize, pager, count,
               search: inputEl, searchKeys: [], filters: [{el, key}], sort: selectEl, sorters: {} }) */
  LX.list = function (cfg) {
    const state = { page: 1 };
    const pageSize = cfg.pageSize || 9;
    const apply = () => {
      let rows = (typeof cfg.items === 'function' ? cfg.items() : cfg.items).slice();
      const q = cfg.search ? cfg.search.value.trim().toLowerCase() : '';
      if (q) rows = rows.filter((r) => (cfg.searchKeys || Object.keys(r)).some((k) => String(r[k] || '').toLowerCase().includes(q)));
      (cfg.filters || []).forEach((f) => {
        const val = f.el.dataset.value !== undefined ? f.el.dataset.value : f.el.value;
        if (val && val !== 'all') rows = rows.filter((r) => (f.test ? f.test(r, val) : String(r[f.key]) === val));
      });
      if (cfg.sort && cfg.sorters && cfg.sorters[cfg.sort.value]) rows.sort(cfg.sorters[cfg.sort.value]);
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      state.page = Math.min(state.page, pages);
      const slice = rows.slice((state.page - 1) * pageSize, state.page * pageSize);
      LX.render(cfg.container, slice.length ? slice.map(cfg.render).join('') : (cfg.emptyHTML || '<div class="empty-state">' + LX.icon('search') + '<p>' + (cfg.empty || 'No results match your filters.') + '</p></div>'));
      if (cfg.count) cfg.count.textContent = rows.length + ' result' + (rows.length === 1 ? '' : 's');
      if (cfg.pager) renderPager(cfg.pager, pages);
      if (cfg.after) cfg.after(slice, rows);
    };
    const renderPager = (el, pages) => {
      if (pages <= 1) { el.innerHTML = ''; return; }
      let h = '<button data-p="prev" aria-label="Previous page"' + (state.page === 1 ? ' disabled' : '') + '>' + LX.icon('chevron-left') + '</button>';
      for (let i = 1; i <= pages; i++) {
        if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - state.page) > 1) { if (!h.endsWith('…</button>')) h += '<button disabled>…</button>'; continue; }
        h += '<button data-p="' + i + '"' + (i === state.page ? ' class="active" aria-current="page"' : '') + '>' + i + '</button>';
      }
      h += '<button data-p="next" aria-label="Next page"' + (state.page === pages ? ' disabled' : '') + '>' + LX.icon('chevron-right') + '</button>';
      el.innerHTML = h;
      el.onclick = (e) => {
        const b = e.target.closest('button[data-p]');
        if (!b || b.disabled) return;
        const p = b.dataset.p;
        state.page = p === 'prev' ? state.page - 1 : p === 'next' ? state.page + 1 : +p;
        apply();
        const top = cfg.container.getBoundingClientRect().top + window.scrollY - 140;
        if (cfg.scroll !== false) window.scrollTo({ top, behavior: 'smooth' });
      };
    };
    const reset = () => { state.page = 1; apply(); };
    if (cfg.search) cfg.search.addEventListener('input', U.debounce(reset, 180));
    (cfg.filters || []).forEach((f) => {
      if (f.el.tagName === 'SELECT' || f.el.tagName === 'INPUT') f.el.addEventListener('change', reset);
      else f.el.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-value]:not([data-filter-group])');
        if (!chip) return;
        f.el.querySelectorAll('[data-value]').forEach((c) => { c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
        f.el.dataset.value = chip.dataset.value;
        reset();
      });
    });
    if (cfg.sort) cfg.sort.addEventListener('change', reset);
    apply();
    return { refresh: apply, reset, state };
  };

  /* ---------- Sortable static tables: <table data-sortable> ---------- */
  function initSortableTables(root) {
    (root || document).querySelectorAll('table[data-sortable]:not([data-sort-ready])').forEach((table) => {
      table.setAttribute('data-sort-ready', '');
      table.querySelectorAll('th[data-sort]').forEach((th, idx) => {
        th.setAttribute('tabindex', '0');
        const go = () => {
          const col = Array.from(th.parentElement.children).indexOf(th);
          const dir = th.classList.contains('asc') ? -1 : 1;
          table.querySelectorAll('th').forEach((x) => x.classList.remove('asc', 'desc'));
          th.classList.add(dir === 1 ? 'asc' : 'desc');
          const body = table.tBodies[0];
          Array.from(body.rows).sort((a, b) => {
            const A = a.cells[col].dataset.v || a.cells[col].textContent.trim();
            const B = b.cells[col].dataset.v || b.cells[col].textContent.trim();
            const nA = parseFloat(String(A).replace(/[^\d.-]/g, '')), nB = parseFloat(String(B).replace(/[^\d.-]/g, ''));
            return (!isNaN(nA) && !isNaN(nB) && th.dataset.sort === 'num' ? nA - nB : String(A).localeCompare(String(B))) * dir;
          }).forEach((r) => body.appendChild(r));
        };
        th.addEventListener('click', go);
        th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    });
  }
  LX.initSortableTables = initSortableTables;

  /* ---------- Accordion ---------- */
  function initAccordions() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.acc-btn');
      if (!btn) return;
      const item = btn.closest('.acc-item');
      const group = btn.closest('.accordion');
      const open = !item.classList.contains('open');
      if (group && group.dataset.single !== undefined) group.querySelectorAll('.acc-item.open').forEach((x) => { if (x !== item) { x.classList.remove('open'); x.querySelector('.acc-btn').setAttribute('aria-expanded', 'false'); } });
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- Tabs: <div data-tabs><button class="tab" data-tab="panelId"> ---------- */
  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach((list) => {
      list.setAttribute('role', 'tablist');
      const tabs = Array.from(list.querySelectorAll('[data-tab]'));
      tabs.forEach((t) => {
        t.setAttribute('role', 'tab');
        t.setAttribute('aria-controls', t.dataset.tab);
        t.setAttribute('aria-selected', String(t.classList.contains('active')));
        const panel = document.getElementById(t.dataset.tab);
        if (panel) panel.setAttribute('role', 'tabpanel');
        t.addEventListener('click', () => {
          tabs.forEach((x) => {
            const on = x === t;
            x.classList.toggle('active', on);
            x.setAttribute('aria-selected', String(on));
            const p = document.getElementById(x.dataset.tab);
            if (p) p.classList.toggle('active', on);
          });
          document.dispatchEvent(new CustomEvent('lx:tab', { detail: { id: t.dataset.tab } }));
        });
        t.addEventListener('keydown', (e) => {
          const i = tabs.indexOf(t);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            n.focus(); n.click();
          }
        });
      });
    });
  }

  /* ---------- Newsletter ---------- */
  function initNewsletter() {
    document.querySelectorAll('.js-newsletter').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = form.querySelector('input[type="email"]');
        const v = inp.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { LX.toast('Check your email', 'Please enter a valid email address.', 'error'); inp.focus(); return; }
        const list = LX.store.get('newsletter', []);
        if (list.includes(v)) { LX.toast('Already subscribed', v + ' is already on the NorthLane Freight Brief.', 'info'); return; }
        list.push(v); LX.store.set('newsletter', list);
        inp.value = '';
        LX.toast('Subscribed', 'The weekly NorthLane Freight Brief will arrive every Tuesday.', 'success');
      });
    });
  }

  /* ---------- City datalist + date minimums ---------- */
  function initInputs() {
    if (document.querySelector('[list="cityList"]') && !document.getElementById('cityList')) {
      const dl = document.createElement('datalist');
      dl.id = 'cityList';
      dl.innerHTML = LX.geo.cityNames.map((c) => '<option value="' + c + ', ' + LX.geo.cities[c][2] + '">').join('');
      document.body.appendChild(dl);
    }
    const today = U.iso(new Date());
    document.querySelectorAll('input[type="date"][data-min-today]').forEach((i) => { i.min = today; });
    document.querySelectorAll('input[type="date"][data-default-offset]').forEach((i) => { if (!i.value) i.value = U.iso(U.addDays(new Date(), +i.dataset.defaultOffset)); });
    /* Password visibility toggles */
    document.querySelectorAll('.toggle-pass').forEach((b) => {
      b.innerHTML = LX.icon('eye');
      b.addEventListener('click', () => {
        const inp = b.parentElement.querySelector('input');
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.innerHTML = LX.icon(show ? 'eye-off' : 'eye');
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ---------- Generic contact-style forms: <form class="js-demo-form" data-success="..."> ---------- */
  function initDemoForms() {
    document.querySelectorAll('form.js-demo-form').forEach((form) => {
      form.setAttribute('novalidate', '');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!LX.validate(form)) { LX.toast('Please check the form', 'Some required fields need your attention.', 'error'); return; }
        const btn = form.querySelector('[type="submit"]');
        btn && btn.classList.add('is-loading');
        setTimeout(() => {
          btn && btn.classList.remove('is-loading');
          const data = Object.fromEntries(new FormData(form).entries());
          LX.store.push(form.dataset.store || 'enquiries', Object.assign({ at: Date.now() }, data), 50);
          LX.toast(form.dataset.successTitle || 'Request received', form.dataset.success || 'Our team will respond within one business hour.', 'success');
          form.reset();
          form.querySelectorAll('.field').forEach((f) => f.classList.remove('valid'));
        }, 900);
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    LX.mountChrome();
    LX._booted = true;
    queue.splice(0).forEach((fn) => { try { fn(); } catch (err) { console.error('[NorthLane]', err); } });
    document.querySelectorAll('[data-brand]').forEach((el) => { el.outerHTML = LX.brandLogo(); });
    LX.hydrateIcons();
    initInputs();
    initTabs();
    initAccordions();
    initNewsletter();
    initDemoForms();
    initSortableTables();
    LX.initMotion();
    document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
