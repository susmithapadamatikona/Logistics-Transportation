/* ==========================================================================
   NorthLane Logistics — Toasts, modals & notification center
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const ICONS = { success: 'check-circle', error: 'alert', warning: 'alert', info: 'info' };

  function stack() {
    let el = document.querySelector('.toast-stack');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-stack';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Notifications');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  /* LX.toast('Title', 'Message', 'success' | 'error' | 'warning' | 'info', ms) */
  LX.toast = function (title, text, type, ms) {
    type = type || 'info';
    ms = ms || 4200;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.innerHTML =
      '<span class="t-icon">' + LX.icon(ICONS[type] || 'info') + '</span>' +
      '<div><strong>' + LX.util.esc(title) + '</strong>' + (text ? '<p>' + LX.util.esc(text) + '</p>' : '') + '</div>' +
      '<button class="t-close" aria-label="Dismiss notification">' + LX.icon('x') + '</button>' +
      '<span class="t-bar" style="animation-duration:' + ms + 'ms"></span>';
    const s = stack();
    s.appendChild(t);
    const bt = document.querySelector('.back-to-top');
    if (bt) bt.style.bottom = s.offsetHeight + 32 + 'px';
    const remove = () => {
      t.classList.add('out');
      setTimeout(() => {
        t.remove();
        if (bt) bt.style.bottom = s.children.length ? s.offsetHeight + 32 + 'px' : '';
      }, 340);
    };
    t.querySelector('.t-close').addEventListener('click', remove);
    setTimeout(remove, ms);
    return t;
  };

  /* ---------------- Modal ---------------- */
  let lastFocus = null;
  LX.modal = {
    open(idOrEl) {
      const m = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
      if (!m) return;
      lastFocus = document.activeElement;
      m.classList.add('open');
      m.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const f = m.querySelector('input, select, textarea, button:not(.modal-close), [href]');
      setTimeout(() => (f || m.querySelector('.modal-close') || m).focus(), 60);
    },
    close(m) {
      m = m || document.querySelector('.modal.open');
      if (!m) return;
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (m.dataset.temp) setTimeout(() => m.remove(), 350);
      if (lastFocus) lastFocus.focus();
    },
    /* Build a one-off modal from HTML */
    show(html, opts) {
      opts = opts || {};
      const m = document.createElement('div');
      m.className = 'modal';
      m.dataset.temp = '1';
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      if (opts.label) m.setAttribute('aria-label', opts.label);
      m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-dialog ' + (opts.size || '') + '"><button class="icon-btn modal-close" data-close aria-label="Close dialog">' + LX.icon('x') + '</button>' + html + '</div>';
      document.body.appendChild(m);
      LX.hydrateIcons && LX.hydrateIcons(m);
      requestAnimationFrame(() => LX.modal.open(m));
      return m;
    },
    confirm(title, text, onYes, yesLabel) {
      const m = LX.modal.show('<h3>' + LX.util.esc(title) + '</h3><p>' + LX.util.esc(text) + '</p><div class="flex mt-3" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-close>Cancel</button><button class="btn btn-sm" data-yes>' + (yesLabel || 'Confirm') + '</button></div>', { label: title });
      m.querySelector('[data-yes]').addEventListener('click', () => { LX.modal.close(m); onYes && onYes(); });
    }
  };

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal]');
    if (opener) { e.preventDefault(); LX.modal.open(opener.getAttribute('data-modal')); return; }
    if (e.target.closest('[data-close]')) LX.modal.close(e.target.closest('.modal'));
  });
  document.addEventListener('keydown', (e) => {
    const m = document.querySelector('.modal.open');
    if (!m) return;
    if (e.key === 'Escape') LX.modal.close(m);
    if (e.key === 'Tab') {
      const f = Array.from(m.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- Notification store ---------------- */
  LX.notify = {
    list() { return LX.store.get('notifications', []); },
    unread() { return LX.notify.list().filter((n) => !n.read).length; },
    add(title, text, type) {
      const n = { id: Date.now(), type: type || 'info', title, text, time: Date.now(), read: false };
      LX.store.push('notifications', n, 40);
      document.dispatchEvent(new CustomEvent('lx:notifications'));
      return n;
    },
    markAll() {
      LX.store.set('notifications', LX.notify.list().map((n) => Object.assign(n, { read: true })));
      document.dispatchEvent(new CustomEvent('lx:notifications'));
    },
    render(container, limit) {
      if (!container) return;
      const items = LX.notify.list().slice(0, limit || 20);
      container.innerHTML = items.length ? items.map((n) =>
        '<div class="notif-item' + (n.read ? '' : ' unread') + '"><span class="icon-box sm ' + (n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : n.type === 'error' ? 'danger' : '') + '">' + LX.icon(n.type === 'success' ? 'check-circle' : n.type === 'warning' ? 'alert' : 'bell') + '</span>' +
        '<div><strong>' + LX.util.esc(n.title) + '</strong><p>' + LX.util.esc(n.text) + '</p><span class="xs muted">' + LX.util.ago(n.time) + '</span></div></div>'
      ).join('') : '<div class="empty-state">' + LX.icon('bell') + '<p>You are all caught up.</p></div>';
    }
  };
})();
