/* ==========================================================================
   NorthLane Logistics — Dashboard framework + Customer, Driver & Fleet dashboards
   Each role registers { nav, panels } with LX.dash.register(). Panels render
   lazily the first time they are opened; navigation is hash based (#invoices).
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);
  const roles = {};

  const ROLE_EMAIL = { customer: 'customer@northlane.io', driver: 'driver@northlane.io', fleet: 'fleet@northlane.io', admin: 'admin@northlane.io' };

  /* ====================================================================== */
  /* Helpers                                                                 */
  /* ====================================================================== */
  const H = {
    kpi(icon, cls, label, value, foot, attrs) {
      return '<div class="kpi"' + (attrs || '') + '><div class="kpi-top"><span class="kpi-label">' + label + '</span><span class="icon-box ' + (cls || '') + '">' + I(icon) + '</span></div><div class="kpi-value">' + value + '</div><div class="kpi-foot">' + (foot || '') + '</div></div>';
    },
    card(title, body, extra, cls) {
      return '<div class="card ' + (cls || '') + '"><div class="card-head"><h3 class="h3">' + title + '</h3>' + (extra || '') + '</div>' + body + '</div>';
    },
    head(title, text, actions) {
      return '<div class="panel-head"><div><h2>' + title + '</h2>' + (text ? '<p>' + text + '</p>' : '') + '</div>' + (actions ? '<div class="flex flex-wrap">' + actions + '</div>' : '') + '</div>';
    },
    badge(s) { return '<span class="badge badge-' + U.slug(s === 'In Transit' ? 'transit' : s) + '">' + s + '</span>'; },
    trend(up, text) { return '<span class="trend ' + (up ? 'up' : 'down') + '">' + I(up ? 'trending-up' : 'trending-down') + text + '</span>'; },
    /* Generic searchable / filterable / sortable / paginated table */
    table(el, cfg) {
      const id = 't' + Math.random().toString(36).slice(2, 7);
      const filters = cfg.filters || [];
      el.innerHTML =
        (cfg.noToolbar ? '' : '<div class="panel-toolbar"><div class="input-icon">' + I('search') + '<label class="sr-only" for="' + id + 's">Search</label><input id="' + id + 's" class="input" placeholder="' + (cfg.placeholder || 'Search…') + '"></div>' +
          filters.map((f, i) => '<label class="sr-only" for="' + id + 'f' + i + '">' + f.label + '</label><select id="' + id + 'f' + i + '" class="select"><option value="all">' + f.label + ': All</option>' + f.options.map((o) => '<option>' + o + '</option>').join('') + '</select>').join('') +
          (cfg.toolbarExtra || '') + '<span class="result-count" id="' + id + 'c"></span></div>') +
        '<div class="table-wrap"><table class="table"><caption class="sr-only">' + (cfg.caption || 'Data table') + '</caption><thead><tr>' + cfg.cols.map((c, i) => '<th scope="col"' + (c.sort ? ' data-col="' + i + '" tabindex="0" data-sort' : '') + '>' + c.label + '</th>').join('') + '</tr></thead><tbody id="' + id + 'b"></tbody></table></div>' +
        '<div class="pagination" id="' + id + 'p"></div>';
      const state = { col: null, dir: 1 };
      const items = () => {
        const rows = (typeof cfg.rows === 'function' ? cfg.rows() : cfg.rows).slice();
        if (state.col !== null) { const c = cfg.cols[state.col]; rows.sort((a, b) => { const A = c.sort(a), B = c.sort(b); return (typeof A === 'number' ? A - B : String(A).localeCompare(String(B))) * state.dir; }); }
        return rows;
      };
      const list = LX.list({
        items, container: el.querySelector('#' + id + 'b'), pageSize: cfg.pageSize || 8, scroll: false,
        render: (r) => '<tr>' + cfg.cols.map((c) => '<td>' + c.render(r) + '</td>').join('') + '</tr>',
        emptyHTML: '<tr><td colspan="' + cfg.cols.length + '"><div class="empty-state">' + I('search') + '<p>No matching records.</p></div></td></tr>',
        pager: el.querySelector('#' + id + 'p'), count: el.querySelector('#' + id + 'c'),
        search: el.querySelector('#' + id + 's'), searchKeys: cfg.searchKeys,
        filters: filters.map((f, i) => ({ el: el.querySelector('#' + id + 'f' + i), key: f.key, test: f.test }))
      });
      el.querySelectorAll('th[data-col]').forEach((th) => {
        const go = () => {
          const i = +th.dataset.col;
          state.dir = state.col === i ? -state.dir : 1; state.col = i;
          el.querySelectorAll('th').forEach((x) => x.classList.remove('asc', 'desc'));
          th.classList.add(state.dir === 1 ? 'asc' : 'desc');
          list.refresh();
        };
        th.addEventListener('click', go);
        th.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      });
      return list;
    },
    /* Download rows as CSV */
    csv(filename, cols, rows) {
      const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const text = [cols.map((c) => esc(c[0])).join(',')].concat(rows.map((r) => cols.map((c) => esc(typeof c[1] === 'function' ? c[1](r) : r[c[1]])).join(','))).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      LX.toast('Export ready', filename + ' (' + rows.length + ' rows) downloaded.', 'success');
    },
    /* Place a marker for every active shipment and keep them moving */
    liveShipmentMap(el, list, opts) {
      opts = opts || {};
      const map = LX.maps.create(el, { center: [38, -95], zoom: 4 });
      if (!map) return;
      const markers = {};
      const group = L.featureGroup().addTo(map);
      list.forEach((s) => {
        LX.maps.line(s.route, '#36C5FF', { weight: 2, opacity: 0.35, dashArray: '5 8' }).addTo(group);
        markers[s.id] = LX.maps.vehicle(s.position, LX.maps.modeIcon(s.mode), 'sm' + (s.status === 'Delayed' ? ' red' : '')).addTo(group).bindPopup('<strong>' + s.id + '</strong><br>' + s.from + ' → ' + s.to + '<br>' + s.status + ' · ' + U.num(s.remaining) + ' km left<br><a href="tracking.html?id=' + s.id + '">Open live tracking →</a>');
      });
      if (list.length) map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 6 });
      setInterval(() => list.forEach((s) => {
        const x = LX.sim.advance(s.id, opts.delta || 0.0015);
        if (x && markers[s.id]) LX.maps.glide(markers[s.id], x.position, 2500);
      }), 3000);
      return map;
    }
  };

  /* ====================================================================== */
  /* Common panels                                                           */
  /* ====================================================================== */
  const common = {
    notifications(el) {
      el.innerHTML = H.head('Notifications', 'Shipment events, invoices and system messages.', '<button class="btn btn-ghost btn-sm" data-mark-all>' + I('check') + 'Mark all as read</button>') + '<div class="card"><div id="notifFull"></div></div>';
      const draw = () => LX.notify.render(el.querySelector('#notifFull'), 40);
      draw();
      el.querySelector('[data-mark-all]').onclick = () => { LX.notify.markAll(); draw(); LX.toast('All caught up', 'Notifications marked as read.', 'success'); };
      document.addEventListener('lx:notifications', draw);
    },
    profile(el, ctx) {
      const u = ctx.user;
      el.innerHTML = H.head('Profile', 'Your personal and company details.') +
        '<div class="dgrid g-1-2"><div class="card text-center"><span class="avatar avatar-initials" style="width:96px;height:96px;font-size:1.8rem;margin:0 auto">' + U.initials(u.name) + '</span><h3 class="mt-2">' + U.esc(u.name) + '</h3><p class="small">' + U.esc(u.company || '') + '</p><span class="badge badge-primary no-dot mt-2">' + ctx.cfg.roleLabel + '</span><div class="kv mt-3" style="text-align:left"><div><span>Member since</span><strong>' + U.date(u.since || Date.now() - 400 * 86400000) + '</strong></div><div><span>Account ID</span><strong class="mono">NL-' + (U.hash(u.email) % 900000 + 100000) + '</strong></div></div></div>' +
        '<form class="card" id="profileForm" novalidate><div class="form-grid">' +
        '<div class="field"><label for="pfName">Full name</label><input id="pfName" class="input" name="name" value="' + U.esc(u.name) + '" required><span class="field-error"></span></div>' +
        '<div class="field"><label for="pfCompany">Company</label><input id="pfCompany" class="input" name="company" value="' + U.esc(u.company || '') + '"></div>' +
        '<div class="field"><label for="pfEmail">Email</label><input id="pfEmail" class="input" type="email" name="email" value="' + U.esc(u.email) + '" required><span class="field-error"></span></div>' +
        '<div class="field"><label for="pfPhone">Phone</label><input id="pfPhone" class="input" type="tel" name="phone" value="' + U.esc(u.phone || '') + '"><span class="field-error"></span></div>' +
        '<div class="field full"><label for="pfBio">Delivery instructions / notes</label><textarea id="pfBio" class="textarea" name="notes" style="min-height:90px">' + U.esc(LX.store.get('profileNotes', '')) + '</textarea></div>' +
        '</div><button class="btn mt-3" type="submit">' + I('check') + 'Save profile</button></form></div>';
      el.querySelector('#profileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        if (!LX.validate(f)) return;
        const patch = { name: f.name.value.trim(), company: f.company.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() };
        const users = LX.store.get('users', []);
        const rec = users.find((x) => x.email === u.email);
        if (rec) Object.assign(rec, patch);
        LX.store.set('users', users);
        Object.assign(u, patch);
        if (!ctx.demo) LX.session.login(u, !!LX.store.get('session'));
        LX.store.set('profileNotes', f.notes.value);
        document.querySelectorAll('[data-user-name]').forEach((x) => (x.textContent = u.name));
        LX.toast('Profile saved', 'Your details have been updated.', 'success');
      });
    },
    settings(el) {
      const p = LX.store.get('prefs', {});
      const row = (key, title, text, on) => '<div class="toggle-row"><div><strong>' + title + '</strong><span>' + text + '</span></div><label class="switch"><input type="checkbox" data-pref="' + key + '"' + ((p[key] !== undefined ? p[key] : on) ? ' checked' : '') + ' aria-label="' + title + '"><span class="track"></span></label></div>';
      el.innerHTML = H.head('Settings', 'Preferences are saved to this browser.') +
        '<div class="settings-grid"><div class="card"><h3 class="h3 mb-2">Appearance</h3>' +
        '<div class="toggle-row"><div><strong>Dark mode</strong><span>Navy interface optimised for control rooms.</span></div><label class="switch"><input type="checkbox" id="darkPref"' + (document.documentElement.getAttribute('data-theme') !== 'light' ? ' checked' : '') + ' aria-label="Dark mode"><span class="track"></span></label></div>' +
        row('compact', 'Collapsed sidebar', 'Show icons only in the navigation.', false) +
        '<div class="field mt-2"><label for="unitsPref">Distance units</label><select id="unitsPref" class="select"><option value="km">Kilometres</option><option value="mi"' + (p.units === 'mi' ? ' selected' : '') + '>Miles</option></select></div></div>' +
        '<div class="card"><h3 class="h3 mb-2">Notifications</h3>' +
        row('nEmail', 'Email updates', 'Status changes and delivery confirmations.', true) +
        row('nSms', 'SMS alerts', 'Delays and exceptions only.', true) +
        row('nWeekly', 'Weekly report', 'Performance summary every Monday.', false) +
        row('nMarketing', 'Product news', 'New features and service launches.', false) + '</div>' +
        '<div class="card"><h3 class="h3 mb-2">Security</h3><div class="toggle-row"><div><strong>Two-factor authentication</strong><span>Protect your account with an authenticator app.</span></div><label class="switch"><input type="checkbox" data-pref="twofa"' + (p.twofa ? ' checked' : '') + ' aria-label="Two-factor authentication"><span class="track"></span></label></div><a class="btn btn-ghost btn-sm mt-2" href="forgot-password.html">' + I('lock') + 'Change password</a></div>' +
        '<div class="card"><h3 class="h3 mb-2">Data</h3><p class="small">Demo data is stored locally in your browser. Resetting restores the original shipments, fleet and bookings.</p><button class="btn btn-danger btn-sm mt-2" data-reset>' + I('refresh') + 'Reset demo data</button></div></div>';
      el.querySelectorAll('[data-pref]').forEach((inp) => inp.addEventListener('change', () => {
        const pr = LX.store.get('prefs', {}); pr[inp.dataset.pref] = inp.checked; LX.store.set('prefs', pr);
        if (inp.dataset.pref === 'compact') document.body.classList.toggle('sidebar-collapsed', inp.checked);
        LX.toast('Preference saved', inp.closest('.toggle-row').querySelector('strong').textContent + (inp.checked ? ' enabled.' : ' disabled.'), 'success', 2000);
      }));
      el.querySelector('#darkPref').addEventListener('change', (e) => { if ((document.documentElement.getAttribute('data-theme') !== 'light') !== e.target.checked) LX.toggleTheme(); });
      el.querySelector('#unitsPref').addEventListener('change', (e) => { const pr = LX.store.get('prefs', {}); pr.units = e.target.value; LX.store.set('prefs', pr); LX.toast('Units updated', 'Distances will display in ' + (e.target.value === 'km' ? 'kilometres' : 'miles') + '.', 'success', 2000); });
      el.querySelector('[data-reset]').addEventListener('click', () => LX.modal.confirm('Reset demo data?', 'This clears bookings, simulation progress, fleet changes and saved items in this browser.', () => {
        ['sim', 'simTs', 'bookings', 'fleetState', 'driverState', 'quotes', 'invoicesCustom', 'driverRun', 'tickets', 'adminState', 'version'].forEach((k) => LX.store.remove(k));
        LX.toast('Demo data reset', 'Reloading…', 'success');
        setTimeout(() => location.reload(), 900);
      }, 'Reset data'));
    },
    support(el) {
      const tickets = () => LX.store.get('tickets', [{ id: 'SUP-40218', subject: 'Update delivery window for TRK-2026-51207', status: 'Resolved', at: Date.now() - 4 * 86400000 }]);
      el.innerHTML = H.head('Support', 'Our desk replies within one business hour — critical issues within 5 minutes.') +
        '<div class="dgrid g-1-1"><form class="card" id="ticketForm" novalidate><h3 class="h3 mb-2">Open a ticket</h3><div class="form-grid">' +
        '<div class="field full"><label for="tkSubject">Subject</label><input id="tkSubject" class="input" name="subject" required><span class="field-error"></span></div>' +
        '<div class="field"><label for="tkCat">Category</label><select id="tkCat" class="select" name="category"><option>Shipment issue</option><option>Billing</option><option>Damage claim</option><option>Account &amp; access</option><option>Technical / API</option></select></div>' +
        '<div class="field"><label for="tkPri">Priority</label><select id="tkPri" class="select" name="priority"><option>Normal</option><option>High</option><option>Critical</option></select></div>' +
        '<div class="field full"><label for="tkMsg">Describe the issue</label><textarea id="tkMsg" class="textarea" name="message" required data-minlength="10"></textarea><span class="field-error"></span></div></div>' +
        '<button class="btn mt-3" type="submit">' + I('send') + 'Submit ticket</button></form>' +
        '<div class="stack"><div class="card"><h3 class="h3 mb-2">Your tickets</h3><div class="list-rows" id="ticketList"></div></div>' +
        '<div class="card"><h3 class="h3 mb-2">Contact the desk</h3><ul class="icon-list"><li><span class="icon-box sm">' + I('phone') + '</span><div><h4>24/7 dispatch</h4><p><a href="tel:+18005550148">+1 (800) 555-0148</a></p></div></li><li><span class="icon-box sm accent">' + I('mail') + '</span><div><h4>Email</h4><p><a href="mailto:dispatch@northlane.io">dispatch@northlane.io</a></p></div></li><li><span class="icon-box sm success">' + I('help') + '</span><div><h4>Help center</h4><p><a href="faq.html">Browse answers →</a></p></div></li></ul></div></div></div>';
      const draw = () => { el.querySelector('#ticketList').innerHTML = tickets().map((t) => '<div><span class="icon-box sm">' + I('message') + '</span><div class="grow"><strong>' + U.esc(t.subject) + '</strong><span class="cell-sub">' + t.id + ' · ' + U.ago(t.at) + '</span></div>' + H.badge(t.status) + '</div>').join(''); };
      draw();
      el.querySelector('#ticketForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!LX.validate(e.target)) return;
        const list = tickets();
        list.unshift({ id: 'SUP-' + (40219 + list.length), subject: e.target.subject.value, status: 'Pending', at: Date.now() });
        LX.store.set('tickets', list);
        e.target.reset(); draw();
        LX.toast('Ticket submitted', 'A support specialist will reply shortly.', 'success');
      });
    },
    documents(el) {
      const docs = [['Master Service Agreement', 'Contract', 'PDF', 842], ['Certificate of Insurance 2026', 'Insurance', 'PDF', 214], ['Rate Card — Q4 2026', 'Pricing', 'XLSX', 96], ['W-9 Tax Form', 'Compliance', 'PDF', 118], ['Proof of Delivery — TRK-2026-24590', 'POD', 'PDF', 402], ['Bill of Lading — TRK-2026-45821', 'Shipping', 'PDF', 188], ['Customs Entry — TRK-2026-38210', 'Customs', 'PDF', 256]];
      el.innerHTML = H.head('Documents', 'Contracts, certificates and shipment paperwork.', '<button class="btn btn-sm" data-upload>' + I('upload') + 'Upload</button>') + '<div class="card"><div class="list-rows">' + docs.map((d, i) => '<div><span class="icon-box sm">' + I('file') + '</span><div class="grow"><strong>' + d[0] + '</strong><span class="cell-sub">' + d[1] + ' · ' + d[2] + ' · ' + d[3] + ' KB · updated ' + U.dateShort(U.addDays(new Date(), -i * 9 - 2)) + '</span></div><button class="btn btn-ghost btn-xs" data-dl="' + U.esc(d[0]) + '">' + I('download') + 'Download</button></div>').join('') + '</div></div>';
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-dl]');
        if (b) LX.toast('Download started', b.dataset.dl + ' is downloading.', 'success');
        if (e.target.closest('[data-upload]')) LX.toast('Upload', 'Choose a PDF, image or spreadsheet up to 25 MB (demo).', 'info');
      });
    }
  };

  /* ====================================================================== */
  /* Shell                                                                   */
  /* ====================================================================== */
  LX.dash = {
    H, common,
    register(role, cfg) { roles[role] = cfg; },
    get(role) { return roles[role]; },
    boot() {
      const role = document.body.dataset.role;
      const cfg = roles[role];
      if (!cfg) return;
      let user = LX.session.current();
      const accepted = cfg.accept || [role];
      let demo = false;
      if (!user || !accepted.includes(user.role)) {
        demo = true;
        const du = LX.store.get('users', []).find((u) => u.email === ROLE_EMAIL[role]) || { name: 'Demo User', email: ROLE_EMAIL[role], company: 'NorthLane Logistics', role };
        user = Object.assign({}, du, { since: Date.now() - 520 * 86400000 });
      }
      const ctx = { user, demo, cfg, role, H };
      const app = document.getElementById('app');
      const nav = cfg.nav.map((n) => n.group ? '<div class="group">' + n.group + '</div>' : '<a class="dash-link' + (n.key === 'logout' ? ' logout' : '') + '" href="#' + n.key + '" data-key="' + n.key + '">' + I(n.icon) + '<span>' + n.label + '</span>' + (n.count ? '<em class="count" data-count-key="' + n.key + '">' + n.count() + '</em>' : '') + '</a>').join('');
      app.innerHTML =
        '<div class="dash">' +
        '<aside class="dash-sidebar" id="dashSidebar" aria-label="Dashboard navigation"><div class="dash-brand"><a class="brand" href="index.html" aria-label="Stackly home">' + LX.brandLogo() + '</a><button class="icon-btn collapse-btn" id="collapseBtn" aria-label="Collapse sidebar">' + I('chevron-left') + '</button></div>' +
        '<div class="dash-role">' + I(cfg.icon) + '<span>' + cfg.roleLabel + '</span></div>' +
        '<nav class="dash-nav">' + nav + '</nav>' +
        '<div class="dash-user"><span class="avatar avatar-initials avatar-sm">' + U.initials(user.name) + '</span><div><strong data-user-name>' + U.esc(user.name) + '</strong><span>' + U.esc(user.email) + '</span></div></div></aside>' +
        '<div class="dash-overlay" id="dashOverlay"></div>' +
        '<div class="dash-main"><header class="dash-topbar">' +
        '<button class="icon-btn mobile-sidebar-toggle" id="sidebarToggle" aria-label="Open navigation" aria-expanded="false">' + I('menu') + '</button>' +
        '<div><span class="crumb">' + cfg.roleLabel + ' / <span id="crumbPanel"></span></span><h1 id="panelTitle">' + cfg.title + '</h1></div>' +
        '<div class="dash-search input-icon">' + I('search') + '<label for="dashSearch" class="sr-only">Track a shipment</label><input id="dashSearch" class="input" placeholder="Track ID e.g. TRK-2026-45821"></div>' +
        '<div class="dash-tools"><span class="dash-clock"><span class="live-dot"></span><span id="dashClock"></span></span>' +
        '<div style="position:relative"><button class="icon-btn" id="bellBtn" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">' + I('bell') + '<span class="dot-badge" id="bellCount"></span></button><div class="notif-pop" id="notifPop" role="dialog" aria-label="Recent notifications"><div class="flex-between mb-2"><strong>Notifications</strong><button class="link-arrow xs" data-open="notifications">View all ' + I('arrow-right') + '</button></div><div id="notifMini"></div></div></div>' +
        '<a class="icon-btn" href="index.html" aria-label="Back to website">' + I('home') + '</a></div></header>' +
        '<main id="main" class="dash-content">' + (demo ? '<div class="notice demo-banner">' + I('info') + '<span style="flex:1">You are viewing a <strong>demo ' + cfg.roleLabel.toLowerCase() + '</strong> account. Sign in to use your own data.</span><a class="btn btn-sm" href="login.html">' + I('login') + 'Sign in</a></div>' : '') +
        cfg.nav.filter((n) => n.key && n.key !== 'logout').map((n) => '<section class="dash-panel" id="panel-' + n.key + '" aria-label="' + n.label + '"></section>').join('') + '</main></div></div>';

      // Sidebar behaviour
      const prefs = LX.store.get('prefs', {});
      if (prefs.compact) document.body.classList.add('sidebar-collapsed');
      document.getElementById('collapseBtn').onclick = () => { const c = !document.body.classList.contains('sidebar-collapsed'); document.body.classList.toggle('sidebar-collapsed', c); const p = LX.store.get('prefs', {}); p.compact = c; LX.store.set('prefs', p); };
      const tgl = document.getElementById('sidebarToggle');
      const setOpen = (o) => { document.body.classList.toggle('sidebar-open', o); tgl.setAttribute('aria-expanded', String(o)); };
      tgl.onclick = () => setOpen(!document.body.classList.contains('sidebar-open'));
      document.getElementById('dashOverlay').onclick = () => setOpen(false);

      // Clock
      const clock = document.getElementById('dashClock');
      const tick = () => { clock.textContent = new Date().toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
      tick(); setInterval(tick, 1000);

      // Notifications popover
      const bell = document.getElementById('bellBtn'), pop = document.getElementById('notifPop');
      const drawBell = () => { const n = LX.notify.unread(); const b = document.getElementById('bellCount'); b.textContent = n; b.style.display = n ? '' : 'none'; LX.notify.render(document.getElementById('notifMini'), 5); };
      drawBell();
      document.addEventListener('lx:notifications', drawBell);
      bell.onclick = (e) => { e.stopPropagation(); const o = !pop.classList.contains('open'); pop.classList.toggle('open', o); bell.setAttribute('aria-expanded', String(o)); };
      document.addEventListener('click', (e) => { if (!e.target.closest('#notifPop')) { pop.classList.remove('open'); bell.setAttribute('aria-expanded', 'false'); } });

      // Topbar tracking search
      document.getElementById('dashSearch').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const id = LX.sim.normalize(e.target.value);
        if (LX.sim.valid(id)) location.href = 'tracking.html?id=' + id;
        else LX.toast('Invalid tracking ID', 'Use the format TRK-2026-45821.', 'error');
      });

      // Panels
      const rendered = {};
      const labelOf = (k) => (cfg.nav.find((n) => n.key === k) || {}).label || '';
      const open = (key) => {
        if (key === 'logout') {
          LX.modal.confirm('Log out?', 'You will be signed out of the NorthLane portal on this device.', () => { LX.session.logout(); LX.toast('Signed out', 'See you soon.', 'success'); setTimeout(() => (location.href = 'login.html'), 700); }, 'Log out');
          return;
        }
        const panel = document.getElementById('panel-' + key);
        if (!panel) return;
        document.querySelectorAll('.dash-panel').forEach((p) => p.classList.toggle('active', p === panel));
        document.querySelectorAll('.dash-link').forEach((a) => { const on = a.dataset.key === key; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        document.getElementById('panelTitle').textContent = key === cfg.nav.find((n) => n.key).key ? cfg.title : labelOf(key);
        document.getElementById('crumbPanel').textContent = labelOf(key);
        if (!rendered[key]) {
          rendered[key] = true;
          const fn = (cfg.panels && cfg.panels[key]) || common[key] || common[cfg.alias && cfg.alias[key]];
          if (fn) fn(panel, ctx); else panel.innerHTML = H.head(labelOf(key), '') + '<div class="card empty-state">' + I('layers') + '<p>This module is coming soon.</p></div>';
          LX.hydrateIcons(panel);
          LX.animate(panel);
          LX.initSortableTables && LX.initSortableTables(panel);
        }
        setOpen(false);
        window.scrollTo({ top: 0 });
      };
      LX.dash.open = open;
      document.addEventListener('click', (e) => {
        const a = e.target.closest('.dash-link, [data-open]');
        if (!a) return;
        e.preventDefault();
        const key = a.dataset.key || a.dataset.open;
        if (key !== 'logout') history.replaceState(null, '', '#' + key);
        open(key);
      });
      window.addEventListener('hashchange', () => open(location.hash.slice(1)));
      const first = cfg.nav.find((n) => n.key).key;
      open(location.hash && document.getElementById('panel-' + location.hash.slice(1)) ? location.hash.slice(1) : first);
    }
  };

  /* ====================================================================== */
  /* CUSTOMER DASHBOARD                                                      */
  /* ====================================================================== */
  function customerShipments(ctx) {
    const all = LX.sim.all();
    const mine = all.filter((s) => s.booked || s.customer === ctx.user.company);
    return mine.length >= 6 ? mine : all.slice(0, 14).concat(all.filter((s) => s.booked && !all.slice(0, 14).includes(s)));
  }
  function customerInvoices(ctx) {
    const all = LX.store.get('invoicesCustom', []).concat(LX.data.invoices);
    const paid = LX.store.get('paidInvoices', []);
    const ids = customerShipments(ctx).map((s) => s.id);
    return all.filter((i) => ids.includes(i.shipment)).map((i) => (paid.includes(i.id) ? Object.assign({}, i, { status: 'Paid' }) : i));
  }
  const shipRow = (s) => '<tr><td><a class="cell-main mono" href="shipment-details.html?id=' + s.id + '">' + s.id + '</a><div class="cell-sub">' + U.esc(s.service) + '</div></td><td>' + s.from + ' → ' + s.to + '</td><td>' + H.badge(s.status) + '</td><td>' + (s.progress >= 1 ? U.dateShort(s.eta) : U.dateTime(s.etaLive)) + '</td><td>' + U.money(s.cost, 0) + '</td></tr>';

  LX.dash.register('customer', {
    title: 'Dashboard', roleLabel: 'Customer Portal', icon: 'user', accept: ['customer', 'business', 'admin'],
    nav: [
      { group: 'Overview' }, { key: 'dashboard', label: 'Dashboard', icon: 'grid' }, { key: 'shipments', label: 'My Shipments', icon: 'package' },
      { key: 'book', label: 'Book Shipment', icon: 'plus' }, { key: 'track', label: 'Track Shipment', icon: 'navigation' }, { key: 'quotes', label: 'Quotes', icon: 'percent' },
      { group: 'Billing & records' }, { key: 'invoices', label: 'Invoices', icon: 'receipt' }, { key: 'addresses', label: 'Addresses', icon: 'map-pin' }, { key: 'locations', label: 'Saved Locations', icon: 'bookmark' }, { key: 'documents', label: 'Documents', icon: 'file' },
      { group: 'Account' }, { key: 'notifications', label: 'Notifications', icon: 'bell', count: () => LX.notify.unread() || '' }, { key: 'support', label: 'Support', icon: 'headset' }, { key: 'profile', label: 'Profile', icon: 'user' }, { key: 'settings', label: 'Settings', icon: 'settings' }, { key: 'logout', label: 'Logout', icon: 'logout' }
    ],
    panels: {
      dashboard(el, ctx) {
        const sh = customerShipments(ctx);
        const active = sh.filter((s) => s.progress < 1 && s.progress >= 0.05);
        const pending = sh.filter((s) => s.progress < 0.05);
        const delivered = sh.filter((s) => s.progress >= 1);
        const spend = customerInvoices(ctx).reduce((a, i) => a + i.total, 0);
        const focus = active.find((s) => s.id === 'TRK-2026-45821') || active[0] || sh[0];
        el.innerHTML = H.head('Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening') + ', ' + U.esc(ctx.user.name.split(' ')[0]), 'Here is what is moving for ' + U.esc(ctx.user.company || 'your account') + ' right now.', '<a class="btn btn-accent btn-sm" href="book-shipment.html">' + I('plus') + 'New shipment</a>') +
          '<div class="kpis">' +
          H.kpi('truck', '', 'Active Shipments', '<span data-count="' + active.length + '">0</span>', '<span class="live-dot blue"></span> Live tracking') +
          H.kpi('check-circle', 'success', 'Delivered Shipments', '<span data-count="' + delivered.length + '">0</span>', H.trend(true, '12% vs last month')) +
          H.kpi('clock', 'accent', 'Pending Shipments', '<span data-count="' + pending.length + '">0</span>', 'Awaiting pickup') +
          H.kpi('wallet', '', 'Total Spending', '<span data-count="' + Math.round(spend) + '" data-prefix="$">0</span>', 'Year to date') + '</div>' +
          '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><h3 class="h3">Live Shipment Map</h3><span class="live-pill"><span class="live-dot"></span>Live</span></div><div class="dash-map"><div class="leaflet-holder" id="custMap"></div></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Delivery Timeline</h3><a class="link-arrow xs" href="shipment-details.html?id=' + focus.id + '">Details ' + I('arrow-right') + '</a></div><p class="small mb-2"><strong class="mono">' + focus.id + '</strong> · ' + focus.from + ' → ' + focus.to + '</p><ol class="timeline compact" id="custTimeline"></ol></div></div>' +
          '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><h3 class="h3">Recent Shipments</h3><button class="link-arrow xs" data-open="shipments">View all ' + I('arrow-right') + '</button></div><div class="table-wrap" style="border:0"><table class="table"><caption class="sr-only">Recent shipments</caption><thead><tr><th>Tracking ID</th><th>Route</th><th>Status</th><th>ETA / Delivered</th><th>Cost</th></tr></thead><tbody>' + sh.slice(0, 6).map(shipRow).join('') + '</tbody></table></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Upcoming Deliveries</h3></div><div class="list-rows">' + sh.filter((s) => s.progress < 1).sort((a, b) => a.hoursLeft - b.hoursLeft).slice(0, 5).map((s) => '<div><span class="icon-box sm">' + I(LX.maps.modeIcon(s.mode)) + '</span><div class="grow"><strong class="mono">' + s.id + '</strong><span class="cell-sub">' + s.to + ' · in ' + U.duration(s.hoursLeft) + '</span></div>' + H.badge(s.status) + '</div>').join('') + '</div></div></div>' +
          '<div class="dgrid g-3"><div class="card"><div class="card-head"><div><h3 class="h3">Shipment Analytics</h3><span class="xs muted">Shipments per month</span></div></div><div class="chart-box sm"><canvas id="custVol" role="img" aria-label="Bar chart of shipments per month"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><div><h3 class="h3">Spend by mode</h3><span class="xs muted">Year to date</span></div></div><div class="chart-box sm"><canvas id="custMode" role="img" aria-label="Doughnut chart of spend by transport mode"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Recent Invoices</h3><button class="link-arrow xs" data-open="invoices">All ' + I('arrow-right') + '</button></div><div class="list-rows">' + customerInvoices(ctx).slice(0, 4).map((i) => '<div><div class="grow"><a href="invoice.html?id=' + i.id + '"><strong class="mono">' + i.id + '</strong></a><span class="cell-sub">' + U.dateShort(i.date) + ' · ' + i.route + '</span></div><div style="text-align:right"><strong>' + U.money(i.total, 0) + '</strong>' + H.badge(i.status) + '</div></div>').join('') + '</div></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Notifications</h3><button class="link-arrow xs" data-open="notifications">View all ' + I('arrow-right') + '</button></div><div id="custNotif"></div></div>';
        LX.notify.render(el.querySelector('#custNotif'), 3);
        const tl = () => { const x = LX.sim.find(focus.id); el.querySelector('#custTimeline').innerHTML = LX.sim.STEPS.map((st, i) => { const s = i < x.stepIndex || x.progress >= 1 ? 'done' : i === x.stepIndex ? 'current' : ''; return '<li class="' + s + '"><span class="tl-dot">' + I(s === 'done' ? 'check' : st.icon) + '</span><div><strong>' + st.label + '</strong><span class="xs muted">' + LX.tracking.stepTime(x, i, s) + '</span></div></li>'; }).join(''); };
        tl(); setInterval(tl, 6000);
        H.liveShipmentMap(el.querySelector('#custMap'), active.slice(0, 10));
        LX.charts.bar('custVol', LX.charts.lastMonths(6), [{ label: 'Shipments', data: [14, 18, 16, 22, 25, sh.length + 9] }], { format: (v) => v + ' shipments' });
        const byMode = ['road', 'air', 'ocean', 'rail'].map((m) => customerInvoices(ctx).filter((i) => i.mode === m).reduce((a, i) => a + i.total, 0));
        LX.charts.doughnut('custMode', ['Road', 'Air', 'Ocean', 'Rail'], [{ data: byMode.map((v) => Math.round(v)), colors: [0, 1, 2, 3].map((i) => LX.charts.palette().series[i]) }], { format: (v) => U.money(v, 0) });
      },
      shipments(el, ctx) {
        el.innerHTML = H.head('My Shipments', 'Every shipment on your account, with live status.', '<button class="btn btn-ghost btn-sm" data-export>' + I('download') + 'Export CSV</button><a class="btn btn-sm" href="book-shipment.html">' + I('plus') + 'Book shipment</a>') + '<div class="card" id="custShipTable"></div>';
        H.table(el.querySelector('#custShipTable'), {
          rows: () => customerShipments(ctx), placeholder: 'Search ID, city, cargo…', searchKeys: ['id', 'from', 'to', 'cargo', 'service', 'status'], caption: 'My shipments',
          filters: [{ label: 'Status', key: 'status', options: ['Booked', 'Picked Up', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Delayed'] }, { label: 'Mode', key: 'mode', options: ['road', 'air', 'ocean', 'rail'] }],
          cols: [
            { label: 'Tracking ID', render: (s) => '<a class="cell-main mono" href="shipment-details.html?id=' + s.id + '">' + s.id + '</a><div class="cell-sub">' + U.esc(s.cargo) + '</div>', sort: (s) => s.id },
            { label: 'Route', render: (s) => s.from + ' → ' + s.to, sort: (s) => s.from },
            { label: 'Mode', render: (s) => '<span class="flex">' + I(LX.maps.modeIcon(s.mode)) + s.mode + '</span>', sort: (s) => s.mode },
            { label: 'Status', render: (s) => H.badge(s.status), sort: (s) => s.progress },
            { label: 'Progress', render: (s) => '<div class="progress" style="min-width:90px"><span style="width:' + Math.round(s.progress * 100) + '%"></span></div>', sort: (s) => s.progress },
            { label: 'ETA', render: (s) => (s.progress >= 1 ? 'Delivered' : U.dateTime(s.etaLive)), sort: (s) => s.hoursLeft },
            { label: 'Cost', render: (s) => U.money(s.cost, 0), sort: (s) => s.cost },
            { label: '<span class="sr-only">Actions</span>', render: (s) => '<div class="table-actions"><a class="btn btn-ghost btn-xs" href="tracking.html?id=' + s.id + '">' + I('map') + 'Track</a></div>' }
          ]
        });
        el.querySelector('[data-export]').onclick = () => H.csv('northlane-shipments.csv', [['Tracking ID', 'id'], ['From', 'from'], ['To', 'to'], ['Mode', 'mode'], ['Status', 'status'], ['Weight kg', 'weight'], ['Cost USD', 'cost']], customerShipments(ctx));
      },
      book(el) {
        const bk = LX.store.get('bookings', []);
        el.innerHTML = H.head('Book Shipment', 'Start a new booking or repeat a recent one.') +
          '<div class="dgrid g-1-1"><a class="card card-hover" href="book-shipment.html"><span class="icon-box accent">' + I('package') + '</span><h3 class="mt-2">New shipment</h3><p class="small mt-1">Six guided steps with a live price and instant confirmation.</p><span class="link-arrow mt-2">Start booking ' + I('arrow-right') + '</span></a>' +
          '<a class="card card-hover" href="shipping-calculator.html"><span class="icon-box">' + I('percent') + '</span><h3 class="mt-2">Get a quote first</h3><p class="small mt-1">Compare road, air, ocean and rail for any lane.</p><span class="link-arrow mt-2">Open calculator ' + I('arrow-right') + '</span></a></div>' +
          H.card('Your recent bookings', bk.length ? '<div class="list-rows">' + bk.map((b) => '<div><span class="icon-box sm">' + I('clipboard') + '</span><div class="grow"><strong class="mono">' + b.bookingId + ' · ' + b.shipmentId + '</strong><span class="cell-sub">' + U.esc(b.details.pickupCity) + ' → ' + U.esc(b.details.deliveryCity) + ' · ' + U.ago(b.createdAt) + '</span></div><strong>' + U.money(b.quote.total, 0) + '</strong><a class="btn btn-ghost btn-xs" href="tracking.html?id=' + b.shipmentId + '">Track</a></div>').join('') + '</div>' : '<div class="empty-state">' + I('package') + '<p>No bookings yet — your confirmed bookings will appear here.</p></div>');
      },
      track(el) {
        el.innerHTML = H.head('Track Shipment', 'Live status, location and ETA for any tracking ID.') + '<div class="card"><form class="track-form" id="dashTrack" role="search"><label class="sr-only" for="dtInput">Tracking ID</label><div class="input-icon">' + I('package') + '<input id="dtInput" class="input" placeholder="Enter Tracking ID e.g. TRK-2026-45821"></div><button class="btn btn-lg" type="submit">' + I('search') + 'Track</button></form><div class="track-samples"><span>Try:</span><button type="button" data-sample="TRK-2026-45821">TRK-2026-45821</button><button type="button" data-sample="TRK-2026-60318">TRK-2026-60318</button><button type="button" data-sample="TRK-2026-73942">TRK-2026-73942</button></div><div id="dashTrackOut" aria-live="polite"></div></div>';
        LX.tracking.bindForm(el.querySelector('#dashTrack'), el.querySelector('#dashTrackOut'), { compact: true });
      },
      quotes(el) {
        const draw = () => {
          const q = LX.store.get('quotes', []);
          el.innerHTML = H.head('Quotes', 'Quotes you saved from the shipping calculator.', '<a class="btn btn-sm" href="shipping-calculator.html">' + I('plus') + 'New quote</a>') +
            '<div class="card">' + (q.length ? '<div class="table-wrap" style="border:0"><table class="table" data-sortable><caption class="sr-only">Saved quotes</caption><thead><tr><th data-sort="text">Quote</th><th data-sort="text">Route</th><th data-sort="text">Mode</th><th data-sort="num">Weight</th><th data-sort="text">Transit</th><th data-sort="num">Total</th><th></th></tr></thead><tbody>' + q.map((x) => '<tr><td class="mono cell-main">' + x.id + '<div class="cell-sub">' + U.ago(x.at) + '</div></td><td>' + U.esc(x.from) + ' → ' + U.esc(x.to) + '</td><td>' + x.mode + '</td><td data-v="' + x.weight + '">' + U.num(x.weight) + ' kg</td><td>' + x.time + '</td><td data-v="' + x.total + '"><strong>' + U.money(x.total) + '</strong></td><td><div class="table-actions"><a class="btn btn-xs" href="book-shipment.html" data-bookq="' + x.id + '">Book</a><button class="btn btn-ghost btn-xs" data-delq="' + x.id + '" aria-label="Delete quote">' + I('trash') + '</button></div></td></tr>').join('') + '</tbody></table></div>' : '<div class="empty-state">' + I('percent') + '<p>No saved quotes yet. Use “Save Quote” in the <a class="text-primary" href="shipping-calculator.html">shipping calculator</a>.</p></div>') + '</div>';
          LX.initSortableTables(el);
        };
        draw();
        el.addEventListener('click', (e) => {
          const d = e.target.closest('[data-delq]');
          if (d) { LX.store.set('quotes', LX.store.get('quotes', []).filter((x) => x.id !== d.dataset.delq)); draw(); LX.toast('Quote deleted', '', 'success', 1800); }
          const b = e.target.closest('[data-bookq]');
          if (b) { const x = LX.store.get('quotes', []).find((q) => q.id === b.dataset.bookq); if (x) LX.store.set('bookingDraft', { from: x.from, to: x.to, weight: x.weight, qty: 1, mode: x.mode }); }
        });
      },
      invoices(el, ctx) {
        const inv = customerInvoices(ctx);
        const due = inv.filter((i) => i.status !== 'Paid').reduce((a, i) => a + i.total, 0);
        el.innerHTML = H.head('Invoices', 'Download, print or pay your invoices.') +
          '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + H.kpi('receipt', '', 'Total invoiced', U.money(inv.reduce((a, i) => a + i.total, 0), 0), inv.length + ' invoices') + H.kpi('clock', 'accent', 'Outstanding', U.money(due, 0), inv.filter((i) => i.status !== 'Paid').length + ' unpaid') + H.kpi('alert', 'danger', 'Overdue', U.money(inv.filter((i) => i.status === 'Overdue').reduce((a, i) => a + i.total, 0), 0), 'Pay now to avoid late fees') + '</div>' +
          '<div class="card" id="custInvTable"></div>';
        H.table(el.querySelector('#custInvTable'), {
          rows: () => customerInvoices(ctx), searchKeys: ['id', 'shipment', 'service', 'route'], placeholder: 'Search invoice or shipment…', caption: 'Invoices',
          filters: [{ label: 'Status', key: 'status', options: ['Paid', 'Pending', 'Overdue'] }],
          cols: [
            { label: 'Invoice', render: (i) => '<a class="mono cell-main" href="invoice.html?id=' + i.id + '">' + i.id + '</a>', sort: (i) => i.id },
            { label: 'Shipment', render: (i) => '<span class="mono">' + i.shipment + '</span>', sort: (i) => i.shipment },
            { label: 'Date', render: (i) => U.dateShort(i.date), sort: (i) => new Date(i.date).getTime() },
            { label: 'Due', render: (i) => U.dateShort(i.due), sort: (i) => new Date(i.due).getTime() },
            { label: 'Total', render: (i) => '<strong>' + U.money(i.total) + '</strong>', sort: (i) => i.total },
            { label: 'Status', render: (i) => H.badge(i.status), sort: (i) => i.status },
            { label: '<span class="sr-only">Actions</span>', render: (i) => '<div class="table-actions"><a class="btn btn-ghost btn-xs" href="invoice.html?id=' + i.id + '">' + I('eye') + 'View</a>' + (i.status !== 'Paid' ? '<a class="btn btn-xs" href="invoice.html?id=' + i.id + '#pay">Pay</a>' : '') + '</div>' }
          ]
        });
      },
      addresses(el) {
        const draw = () => {
          const list = LX.store.get('addresses', []);
          el.innerHTML = H.head('Addresses', 'Pickup and delivery addresses you use often.', '<button class="btn btn-sm" data-add-addr>' + I('plus') + 'Add address</button>') +
            '<div class="dgrid g-3">' + list.map((a, i) => '<div class="card address-card"><span class="icon-box sm">' + I('map-pin') + '</span><div><strong>' + U.esc(a.label) + '</strong><p class="small">' + U.esc(a.line) + '</p><span class="xs muted">' + U.esc(a.contact || '') + '</span></div><button class="icon-btn" data-del-addr="' + i + '" aria-label="Delete ' + U.esc(a.label) + '">' + I('trash') + '</button></div>').join('') + '</div>';
        };
        draw();
        el.addEventListener('click', (e) => {
          const d = e.target.closest('[data-del-addr]');
          if (d) { const l = LX.store.get('addresses', []); l.splice(+d.dataset.delAddr, 1); LX.store.set('addresses', l); draw(); LX.toast('Address removed', '', 'success', 1800); }
          if (e.target.closest('[data-add-addr]')) {
            const m = LX.modal.show('<h3>Add address</h3><form id="addrForm" novalidate class="stack mt-2"><div class="field"><label for="aLabel">Label</label><input id="aLabel" class="input" name="label" required placeholder="e.g. Houston Warehouse"><span class="field-error"></span></div><div class="field"><label for="aLine">Full address</label><input id="aLine" class="input" name="line" required><span class="field-error"></span></div><div class="field"><label for="aContact">Receiving notes</label><input id="aContact" class="input" name="contact" placeholder="Dock hours, gate code…"></div><button class="btn" type="submit">' + I('check') + 'Save address</button></form>', { label: 'Add address' });
            m.querySelector('#addrForm').addEventListener('submit', (ev) => {
              ev.preventDefault();
              if (!LX.validate(ev.target)) return;
              const l = LX.store.get('addresses', []); l.push({ label: ev.target.label.value, line: ev.target.line.value, contact: ev.target.contact.value }); LX.store.set('addresses', l);
              LX.modal.close(m); draw(); LX.toast('Address saved', ev.target.label.value + ' added to your address book.', 'success');
            });
          }
        });
      },
      locations(el) {
        const draw = () => {
          const list = LX.store.get('savedLocations', ['Chicago', 'Dallas', 'Atlanta', 'Rotterdam']);
          el.innerHTML = H.head('Saved Locations', 'Favourite cities appear first in booking and quote forms.') +
            '<div class="card"><form class="flex flex-wrap" id="locForm"><label class="sr-only" for="locInput">City</label><div class="input-icon" style="flex:1 1 260px">' + I('map-pin') + '<input id="locInput" class="input" list="dashCities" placeholder="Add a city…"></div><datalist id="dashCities">' + LX.geo.cityNames.map((c) => '<option value="' + c + '">').join('') + '</datalist><button class="btn" type="submit">' + I('plus') + 'Save</button></form>' +
            '<div class="flex flex-wrap mt-3">' + list.map((c) => { const g = LX.geo.find(c); return '<span class="chip">' + I('bookmark') + c + (g ? ', ' + g.country : '') + '<button type="button" data-del-loc="' + c + '" aria-label="Remove ' + c + '" style="margin-left:4px">' + I('x') + '</button></span>'; }).join('') + '</div></div>';
          el.querySelector('#locForm').onsubmit = (e) => {
            e.preventDefault();
            const v = el.querySelector('#locInput').value.trim();
            const g = LX.geo.find(v);
            if (!g) { LX.toast('Unknown city', 'Pick a city from the suggestions.', 'error'); return; }
            const l = LX.store.get('savedLocations', ['Chicago', 'Dallas', 'Atlanta', 'Rotterdam']);
            if (!l.includes(g.name)) l.push(g.name);
            LX.store.set('savedLocations', l); draw(); LX.hydrateIcons(el);
          };
        };
        draw();
        el.addEventListener('click', (e) => {
          const d = e.target.closest('[data-del-loc]');
          if (!d) return;
          LX.store.set('savedLocations', LX.store.get('savedLocations', ['Chicago', 'Dallas', 'Atlanta', 'Rotterdam']).filter((c) => c !== d.dataset.delLoc));
          draw(); LX.hydrateIcons(el);
        });
      }
    }
  });

  /* ====================================================================== */
  /* DRIVER DASHBOARD                                                        */
  /* ====================================================================== */
  const DEPOT = [32.6947, -96.8837];
  const RUN = [
    { name: 'Brightline Retail #214', addr: '8687 N Central Expy, Dallas, TX', ll: [32.8686, -96.7732], pkg: 12, phone: '+1 (214) 555-0121', window: '08:30–09:30' },
    { name: 'Vantage Health Clinic', addr: '5323 Harry Hines Blvd, Dallas, TX', ll: [32.8127, -96.8401], pkg: 4, phone: '+1 (214) 555-0167', window: '09:30–10:30' },
    { name: 'Orbit Commerce Returns', addr: '4300 Lemmon Ave, Dallas, TX', ll: [32.8156, -96.8154], pkg: 18, phone: '+1 (214) 555-0133', window: '10:00–11:00' },
    { name: 'Nimbus Tech Office', addr: '2323 Ross Ave, Dallas, TX', ll: [32.7890, -96.7990], pkg: 3, phone: '+1 (214) 555-0188', window: '11:00–12:00' },
    { name: 'Summit Foods Market', addr: '3000 Commerce St, Dallas, TX', ll: [32.7837, -96.7844], pkg: 22, phone: '+1 (214) 555-0104', window: '12:30–13:30' },
    { name: 'Arcadia Electronics', addr: '1601 Elm St, Dallas, TX', ll: [32.7818, -96.7980], pkg: 6, phone: '+1 (214) 555-0149', window: '13:30–14:30' },
    { name: 'Bishop Arts Boutique', addr: '408 N Bishop Ave, Dallas, TX', ll: [32.7490, -96.8279], pkg: 2, phone: '+1 (214) 555-0172', window: '15:00–16:00' },
    { name: 'Helix Pharma Lab', addr: '6001 Forest Park Rd, Dallas, TX', ll: [32.8185, -96.8500], pkg: 5, phone: '+1 (214) 555-0115', window: '16:00–17:00' }
  ];
  const runState = () => {
    const key = 'driverRun';
    let s = LX.store.get(key, null);
    if (!s || s.day !== U.iso(new Date())) { s = { day: U.iso(new Date()), stops: RUN.map((_, i) => (i < 2 ? 'delivered' : 'pending')), stage: 'idle', pods: {} }; LX.store.set(key, s); }
    return s;
  };
  const saveRun = (s) => { LX.store.set('driverRun', s); document.dispatchEvent(new CustomEvent('lx:run')); };
  const legKm = (i) => LX.geo.haversine(i === 0 ? DEPOT : RUN[i - 1].ll, RUN[i].ll) * 1.3;
  const runStats = (s) => {
    const done = s.stops.filter((x) => x === 'delivered').length;
    const km = 38 + s.stops.reduce((a, x, i) => a + (x === 'delivered' || x === 'issue' ? legKm(i) : 0), 0);
    return { total: RUN.length, done, pending: s.stops.filter((x) => x === 'pending').length, km, earnings: 86 + done * 14.5 + km * 0.42, current: s.stops.findIndex((x) => x === 'pending') };
  };
  function runMap(el) {
    const map = LX.maps.create(el, { center: [32.8, -96.81], zoom: 11 });
    if (!map) return null;
    const pts = [DEPOT].concat(RUN.map((r) => r.ll));
    LX.maps.line(pts, '#36C5FF', { weight: 3, opacity: 0.5, dashArray: '6 10', className: 'route-anim' }).addTo(map);
    L.marker(DEPOT, { icon: L.divIcon({ className: '', html: '<div class="map-pin warehouse"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map).bindPopup('<strong>Dallas Regional Hub</strong><br>4801 Wright Blvd');
    const pins = RUN.map((r, i) => L.marker(r.ll, { icon: L.divIcon({ className: '', html: '<div class="map-pin stop"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map).bindPopup('<strong>' + (i + 1) + '. ' + r.name + '</strong><br>' + r.addr + '<br>Window ' + r.window));
    const s = runState();
    const st = runStats(s);
    const at = st.current <= 0 ? DEPOT : RUN[st.current - 1].ll;
    const van = LX.maps.vehicle(at, 'van').addTo(map);
    map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
    const paint = () => {
      const x = runState();
      x.stops.forEach((v, i) => pins[i].setIcon(L.divIcon({ className: '', html: '<div class="map-pin stop' + (v === 'delivered' ? ' done' : '') + '"' + (v === 'issue' ? ' style="filter:hue-rotate(140deg)"' : '') + '><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] })));
    };
    paint();
    document.addEventListener('lx:run', paint);
    return { map, van, go(i) { if (RUN[i]) LX.maps.glide(van, RUN[i].ll, 5000); }, at(i) { van.setLatLng(i < 0 ? DEPOT : RUN[i].ll); } };
  }
  function podModal(i, done) {
    const r = RUN[i];
    const m = LX.modal.show('<h3>Delivery confirmation</h3><p class="small">' + r.name + ' · ' + r.pkg + ' packages</p><form id="podForm" novalidate class="stack mt-2">' +
      '<div class="field"><label for="podName">Received by</label><input id="podName" class="input" name="receiver" required placeholder="Recipient full name"><span class="field-error"></span></div>' +
      '<div class="field"><label>Signature</label><canvas class="sig-pad" id="sigPad" aria-label="Signature pad — draw the recipient signature"></canvas><div class="flex-between"><span class="xs muted">Sign inside the box</span><button type="button" class="link-arrow xs" id="sigClear">Clear</button></div></div>' +
      '<div class="field"><label class="check"><input type="checkbox" name="photo" checked>Photo of delivered freight captured</label></div>' +
      '<div class="field"><label for="podCount">Packages delivered</label><input id="podCount" class="input" type="number" name="count" min="0" value="' + r.pkg + '"></div>' +
      '<button class="btn btn-block" type="submit">' + I('check-circle') + 'Confirm Delivery</button></form>', { label: 'Delivery confirmation' });
    const c = m.querySelector('#sigPad');
    const ctx = c.getContext('2d');
    const fit = () => { const r2 = c.getBoundingClientRect(); c.width = r2.width * devicePixelRatio; c.height = r2.height * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--heading').trim() || '#fff'; };
    setTimeout(fit, 80);
    let drawing = false, signed = false;
    const pos = (e) => { const r2 = c.getBoundingClientRect(); return [e.clientX - r2.left, e.clientY - r2.top]; };
    c.addEventListener('pointerdown', (e) => { drawing = true; signed = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
    c.addEventListener('pointermove', (e) => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); });
    c.addEventListener('pointerup', () => { drawing = false; });
    m.querySelector('#sigClear').onclick = () => { ctx.clearRect(0, 0, c.width, c.height); signed = false; };
    m.querySelector('#podForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!LX.validate(e.target)) return;
      if (!signed) { LX.toast('Signature required', 'Ask the recipient to sign in the box.', 'warning'); return; }
      LX.modal.close(m);
      done({ receiver: e.target.receiver.value, count: +e.target.count.value, at: Date.now(), signature: c.toDataURL('image/png').length });
    });
  }

  LX.dash.register('driver', {
    title: 'Driver Dashboard', roleLabel: 'Driver App', icon: 'steering', accept: ['driver', 'admin'],
    nav: [
      { group: 'Today' }, { key: 'dashboard', label: 'Dashboard', icon: 'grid' }, { key: 'deliveries', label: 'My Deliveries', icon: 'package', count: () => runStats(runState()).pending || '' }, { key: 'route', label: 'Route', icon: 'route' }, { key: 'navigation', label: 'Navigation', icon: 'navigation' },
      { group: 'Work' }, { key: 'history', label: 'Delivery History', icon: 'clock' }, { key: 'earnings', label: 'Earnings', icon: 'wallet' }, { key: 'vehicle', label: 'Vehicle', icon: 'truck' }, { key: 'documents', label: 'Documents', icon: 'file' },
      { group: 'Account' }, { key: 'notifications', label: 'Notifications', icon: 'bell' }, { key: 'support', label: 'Support', icon: 'headset' }, { key: 'profile', label: 'Profile', icon: 'user' }, { key: 'logout', label: 'Logout', icon: 'logout' }
    ],
    panels: {
      dashboard(el) {
        el.innerHTML = H.head('Today\'s run · Dallas Metro', 'Route DAL-RD-07 · ' + RUN.length + ' stops · Vehicle ' + (LX.fleet.get(LX.data.drivers[0].vehicle) || {}).id, '<span class="live-pill"><span class="live-dot"></span>On shift</span>') +
          '<div class="kpis k5" id="drvKpis"></div>' +
          '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><h3 class="h3">Next Delivery</h3><span id="nsBadge"></span></div><div id="nextStop"></div>' +
          '<div class="driver-actions" role="group" aria-label="Delivery actions"><button class="btn" data-act="start">' + I('play') + 'Start Delivery</button><button class="btn btn-ghost" data-act="arrived">' + I('map-pin') + 'Arrived</button><button class="btn btn-success" data-act="delivered">' + I('check-circle') + 'Delivered</button><button class="btn btn-danger" data-act="issue">' + I('alert') + 'Report Issue</button></div>' +
          '<div class="stage-track" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Delivery Stops</h3><span class="xs muted" id="stopCount"></span></div><div class="stop-list" id="drvStops" style="max-height:360px"></div></div></div>' +
          '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><h3 class="h3">Today\'s Route</h3><span class="live-pill"><span class="live-dot"></span>GPS</span></div><div class="dash-map tall"><div class="leaflet-holder" id="drvMap"></div></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Customer Information</h3></div><div id="custInfo"></div></div></div>';
        const rm = runMap(el.querySelector('#drvMap'));
        const draw = () => {
          const s = runState(), st = runStats(s), i = st.current;
          el.querySelector('#drvKpis').innerHTML = H.kpi('package', '', "Today's Deliveries", st.total, RUN.reduce((a, r) => a + r.pkg, 0) + ' packages') + H.kpi('check-circle', 'success', 'Completed', st.done, Math.round(st.done / st.total * 100) + '% of route') + H.kpi('clock', 'accent', 'Pending', st.pending, i >= 0 ? 'Next window ' + RUN[i].window : 'Route complete') + H.kpi('route', '', 'Distance Driven', U.num(st.km, 1) + ' km', 'Since shift start') + H.kpi('wallet', 'success', 'Earnings', U.money(st.earnings), 'Today, before tips');
          const stage = { idle: 0, enroute: 1, arrived: 2 }[s.stage] || 0;
          el.querySelectorAll('.stage-track span').forEach((x, k) => x.classList.toggle('on', k <= stage));
          const btn = (a, on) => { const b = el.querySelector('[data-act="' + a + '"]'); b.setAttribute('aria-disabled', String(!on)); b.tabIndex = on ? 0 : -1; };
          if (i < 0) {
            el.querySelector('#nextStop').innerHTML = '<div class="bk-success"><div class="bk-check" style="width:64px;height:64px">' + I('check') + '</div><h3>Route complete</h3><p class="small">All stops handled. Return to Dallas Regional Hub.</p><button class="btn btn-ghost btn-sm mt-2" data-act="reset">' + I('refresh') + 'Restart demo route</button></div>';
            el.querySelector('#nsBadge').innerHTML = H.badge('Delivered');
            ['start', 'arrived', 'delivered', 'issue'].forEach((a) => btn(a, false));
            el.querySelector('#custInfo').innerHTML = '<p class="small">No customer assigned.</p>';
          } else {
            const r = RUN[i];
            el.querySelector('#nsBadge').innerHTML = H.badge(s.stage === 'idle' ? 'Pending' : s.stage === 'enroute' ? 'On Delivery' : 'Arrived');
            el.querySelector('#nextStop').innerHTML = '<div class="next-stop"><div><span class="xs muted">Stop ' + (i + 1) + ' of ' + RUN.length + ' · Window ' + r.window + '</span><div class="ns-addr mt-1">' + r.addr + '</div><p class="small mt-1">' + r.pkg + ' packages · ' + U.num(legKm(i), 1) + ' km from last stop · ETA ' + Math.round(legKm(i) / 32 * 60 + 4) + ' min</p></div><a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/dir/?api=1&destination=' + r.ll.join(',') + '" target="_blank" rel="noopener">' + I('navigation') + 'Open in Maps</a></div>';
            btn('start', s.stage === 'idle'); btn('arrived', s.stage === 'enroute'); btn('delivered', s.stage === 'arrived'); btn('issue', true);
            el.querySelector('#custInfo').innerHTML = '<div class="kv"><div><span>Customer</span><strong>' + r.name + '</strong></div><div><span>Phone</span><strong>' + r.phone + '</strong></div><div><span>Delivery window</span><strong>' + r.window + '</strong></div><div><span>Packages</span><strong>' + r.pkg + '</strong></div></div><p class="small mt-2">' + I('info') + ' Use the loading dock at the rear. Ask for receiving desk.</p><div class="flex mt-2"><a class="btn btn-ghost btn-xs" href="tel:' + r.phone.replace(/[^\d+]/g, '') + '">' + I('phone') + 'Call customer</a><button class="btn btn-ghost btn-xs" data-msgcust>' + I('message') + 'Text ETA</button></div>';
          }
          el.querySelector('#stopCount').textContent = st.done + ' / ' + st.total + ' delivered';
          el.querySelector('#drvStops').innerHTML = RUN.map((r, k) => { const v = s.stops[k]; const cls = v === 'delivered' ? 'done' : k === i ? 'current' : ''; return '<div class="stop ' + cls + '"><span class="s-num">' + (v === 'delivered' ? '✓' : v === 'issue' ? '!' : k + 1) + '</span><div><strong>' + r.name + '</strong><span class="xs muted">' + r.addr.split(',')[0] + ' · ' + r.window + '</span></div><span class="xs ' + (v === 'delivered' ? 'text-success' : v === 'issue' ? 'text-danger' : k === i ? 'text-accent' : 'muted') + '">' + (v === 'delivered' ? 'Delivered' : v === 'issue' ? 'Issue' : k === i ? 'Next' : r.pkg + ' pkg') + '</span></div>'; }).join('');
          document.querySelectorAll('[data-count-key="deliveries"]').forEach((c) => (c.textContent = st.pending || ''));
          LX.hydrateIcons(el);
        };
        draw();
        document.addEventListener('lx:run', draw);
        el.addEventListener('click', (e) => {
          const a = e.target.closest('[data-act]');
          if (e.target.closest('[data-msgcust]')) LX.toast('ETA sent', 'Customer notified by SMS with your live ETA link.', 'success');
          if (!a || a.getAttribute('aria-disabled') === 'true') return;
          const s = runState(), i = runStats(s).current;
          if (a.dataset.act === 'reset') { LX.store.remove('driverRun'); runState(); rm && rm.at(1); saveRun(runState()); return; }
          if (i < 0) return;
          if (a.dataset.act === 'start') { s.stage = 'enroute'; saveRun(s); rm && rm.go(i); LX.toast('Delivery started', 'Navigating to ' + RUN[i].name + '. Customer notified of your ETA.', 'info'); }
          if (a.dataset.act === 'arrived') { s.stage = 'arrived'; saveRun(s); rm && rm.at(i); LX.toast('Arrived', 'Geofence confirmed at ' + RUN[i].addr.split(',')[0] + '.', 'success'); }
          if (a.dataset.act === 'delivered') podModal(i, (pod) => { s.stops[i] = 'delivered'; s.stage = 'idle'; s.pods[i] = pod; saveRun(s); LX.notify.add('Delivery confirmed', RUN[i].name + ' — signed by ' + pod.receiver + '.', 'success'); LX.toast('Delivered', 'Proof of delivery uploaded for ' + RUN[i].name + '.', 'success'); });
          if (a.dataset.act === 'issue') {
            const m = LX.modal.show('<h3>Report an issue</h3><p class="small">' + RUN[i].name + '</p><form id="issueForm" class="stack mt-2" novalidate><div class="field"><label for="issType">Issue type</label><select id="issType" class="select" name="type"><option>Customer not available</option><option>Address incorrect</option><option>Damaged package</option><option>Access / security refused</option><option>Vehicle problem</option><option>Traffic / road closure</option></select></div><div class="field"><label for="issNote">Details</label><textarea id="issNote" class="textarea" name="note" required style="min-height:90px"></textarea><span class="field-error"></span></div><label class="check"><input type="checkbox" name="skip" checked>Skip this stop and continue route</label><button class="btn btn-danger" type="submit">' + I('alert') + 'Submit report</button></form>', { label: 'Report issue' });
            m.querySelector('#issueForm').addEventListener('submit', (ev) => {
              ev.preventDefault();
              if (!LX.validate(ev.target)) return;
              if (ev.target.skip.checked) { s.stops[i] = 'issue'; s.stage = 'idle'; saveRun(s); }
              LX.modal.close(m);
              LX.notify.add('Issue reported', RUN[i].name + ': ' + ev.target.type.value + '.', 'warning');
              LX.toast('Issue reported', 'Dispatch has been alerted and will contact you shortly.', 'warning');
            });
          }
        });
      },
      deliveries(el) {
        const draw = () => {
          const s = runState();
          el.innerHTML = H.head('My Deliveries', 'Today\'s assigned stops and proof-of-delivery status.') + '<div class="card"><div class="table-wrap" style="border:0"><table class="table"><caption class="sr-only">Today\'s deliveries</caption><thead><tr><th>#</th><th>Customer</th><th>Address</th><th>Window</th><th>Packages</th><th>Status</th><th>POD</th></tr></thead><tbody>' +
            RUN.map((r, i) => '<tr><td>' + (i + 1) + '</td><td class="cell-main">' + r.name + '</td><td>' + r.addr + '</td><td>' + r.window + '</td><td>' + r.pkg + '</td><td>' + H.badge(s.stops[i] === 'delivered' ? 'Delivered' : s.stops[i] === 'issue' ? 'Exception' : 'Pending') + '</td><td>' + (s.pods[i] ? 'Signed · ' + U.esc(s.pods[i].receiver) : s.stops[i] === 'delivered' ? 'Signed at dock' : '—') + '</td></tr>').join('') + '</tbody></table></div></div>';
        };
        draw(); document.addEventListener('lx:run', draw);
      },
      route(el) {
        el.innerHTML = H.head('Route', 'Optimised sequence · 8 stops · est. 64 km') + '<div class="dgrid g-2-1"><div class="card"><div class="dash-map tall"><div class="leaflet-holder" id="routeMap"></div></div></div><div class="card"><h3 class="h3 mb-2">Stop sequence</h3><ol class="timeline compact">' + RUN.map((r, i) => '<li class="' + (runState().stops[i] === 'delivered' ? 'done' : '') + '"><span class="tl-dot">' + (i + 1) + '</span><div><strong>' + r.name + '</strong><span class="xs muted">' + r.window + ' · ' + U.num(legKm(i), 1) + ' km leg</span></div></li>').join('') + '</ol></div></div>';
        runMap(el.querySelector('#routeMap'));
      },
      navigation(el) {
        const st = runStats(runState()), r = RUN[st.current] || RUN[RUN.length - 1];
        el.innerHTML = H.head('Navigation', 'Turn-by-turn guidance to your next stop.') +
          '<div class="dgrid g-2-1"><div class="stack"><div class="nav-instruction"><span class="icon-box">' + I('arrow-up-right') + '</span><div><strong id="navDist">450 m</strong><span>Turn right onto ' + r.addr.split(',')[0].replace(/^\d+\s/, '') + '</span></div></div><div class="card"><div class="dash-map tall"><div class="leaflet-holder" id="navMap"></div></div></div></div>' +
          '<div class="stack"><div class="card"><h3 class="h3">' + r.name + '</h3><p class="small">' + r.addr + '</p><div class="kv mt-2"><div><span>Arrival</span><strong id="navEta">' + U.time(Date.now() + 14 * 60000) + '</strong></div><div><span>Remaining</span><strong id="navKm">' + U.num(legKm(Math.max(0, st.current)), 1) + ' km</strong></div><div><span>Speed limit</span><strong>45 mph</strong></div><div><span>Traffic</span><strong class="text-warning">Moderate</strong></div></div></div>' +
          '<div class="card"><h3 class="h3 mb-2">Upcoming</h3><div class="list-rows"><div>' + I('arrow-right') + '<div class="grow">Continue on I-35E N</div><span class="xs muted">2.1 km</span></div><div>' + I('arrow-up-right') + '<div class="grow">Take exit 429 toward Downtown</div><span class="xs muted">0.8 km</span></div><div>' + I('map-pin') + '<div class="grow">Arrive at destination, dock on right</div><span class="xs muted">0.4 km</span></div></div></div></div></div>';
        const m = runMap(el.querySelector('#navMap'));
        if (m) m.map.setView(r.ll, 13);
        let d = 450;
        setInterval(() => { d = d > 60 ? d - 30 : 450; const x = el.querySelector('#navDist'); if (x) x.textContent = d + ' m'; }, 1500);
      },
      history(el) {
        const r = U.rng(99);
        const rows = Array.from({ length: 36 }, (_, i) => { const c = LX.data.customers[Math.floor(r() * LX.data.customers.length)]; const city = ['Dallas', 'Plano', 'Irving', 'Garland', 'Arlington', 'Mesquite'][Math.floor(r() * 6)]; return { id: 'DLV-' + (88420 - i * 3), date: U.addDays(new Date(), -Math.floor(i / 4) - 1).toISOString(), customer: c, city, pkg: 1 + Math.floor(r() * 20), status: r() > 0.94 ? 'Exception' : 'Delivered', rating: r() > 0.3 ? 5 : 4 }; });
        el.innerHTML = H.head('Delivery History', 'Your completed deliveries over the last 9 days.', '<button class="btn btn-ghost btn-sm" data-exp>' + I('download') + 'Export</button>') + '<div class="card" id="histTable"></div>';
        H.table(el.querySelector('#histTable'), { rows, searchKeys: ['id', 'customer', 'city'], placeholder: 'Search deliveries…', filters: [{ label: 'Status', key: 'status', options: ['Delivered', 'Exception'] }], cols: [
          { label: 'Delivery', render: (x) => '<span class="mono cell-main">' + x.id + '</span>', sort: (x) => x.id }, { label: 'Date', render: (x) => U.dateShort(x.date), sort: (x) => x.date }, { label: 'Customer', render: (x) => x.customer, sort: (x) => x.customer }, { label: 'City', render: (x) => x.city, sort: (x) => x.city }, { label: 'Packages', render: (x) => x.pkg, sort: (x) => x.pkg }, { label: 'Rating', render: (x) => '★'.repeat(x.rating), sort: (x) => x.rating }, { label: 'Status', render: (x) => H.badge(x.status), sort: (x) => x.status }] });
        el.querySelector('[data-exp]').onclick = () => H.csv('delivery-history.csv', [['Delivery', 'id'], ['Date', (x) => U.date(x.date)], ['Customer', 'customer'], ['City', 'city'], ['Packages', 'pkg'], ['Status', 'status']], rows);
      },
      earnings(el) {
        const st = runStats(runState());
        el.innerHTML = H.head('Earnings', 'Pay period Sep 22 – Oct 5 · paid every other Friday.') +
          '<div class="kpis">' + H.kpi('wallet', 'success', 'Today', U.money(st.earnings), 'Live') + H.kpi('calendar', '', 'This week', U.money(1284.6 + st.earnings), H.trend(true, '8% vs last week')) + H.kpi('star', 'accent', 'Safety bonus', '$120.00', 'Zero incidents this month') + H.kpi('receipt', '', 'Next payout', 'Oct 3', 'Direct deposit') + '</div>' +
          '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><div><h3 class="h3">Daily earnings</h3><span class="xs muted">Last 14 days</span></div></div><div class="chart-box"><canvas id="earnChart" role="img" aria-label="Bar chart of daily earnings for the last 14 days"></canvas></div></div>' +
          '<div class="card"><h3 class="h3 mb-2">Payouts</h3><div class="list-rows">' + [['Sep 19', 2418.4], ['Sep 5', 2296.1], ['Aug 22', 2507.85], ['Aug 8', 2331.2]].map((p) => '<div><span class="icon-box sm success">' + I('dollar') + '</span><div class="grow"><strong>' + U.money(p[1]) + '</strong><span class="cell-sub">Paid ' + p[0] + ' · Direct deposit</span></div>' + H.badge('Paid') + '</div>').join('') + '</div></div></div>';
        const labels = Array.from({ length: 14 }, (_, i) => U.dateShort(U.addDays(new Date(), i - 13)));
        LX.charts.bar('earnChart', labels, [{ label: 'Earnings', data: [212, 198, 0, 224, 241, 206, 188, 230, 0, 219, 246, 233, 208, Math.round(st.earnings)] }], { format: (v) => U.money(v), axisFormat: (v) => '$' + v });
      },
      vehicle(el) {
        const v = LX.fleet.get(LX.data.drivers[0].vehicle) || LX.fleet.all()[0];
        const saved = LX.store.get('inspection', {});
        const items = ['Tyres & wheel nuts', 'Brakes & air lines', 'Lights & indicators', 'Mirrors & windscreen', 'Fluid levels', 'Load secured', 'Fire extinguisher & triangles', 'Dash-cam recording'];
        el.innerHTML = H.head('Vehicle', 'Assigned vehicle and pre-trip inspection.') +
          '<div class="dgrid g-1-1"><div class="card"><div class="veh-id"><span class="icon-box">' + I('van') + '</span><div><strong class="mono" style="font-size:1.2rem">' + v.id + '</strong><span class="xs muted" style="display:block">' + v.type + ' · ' + v.year + '</span></div></div>' +
          '<div class="kv mt-3"><div><span>' + (v.type.includes('Electric') ? 'Battery' : 'Fuel') + '</span><strong>' + v.fuel + '%</strong></div><div><span>Mileage</span><strong>' + U.num(v.mileage) + ' km</strong></div><div><span>Next service</span><strong>' + U.date(v.nextService) + '</strong></div><div><span>Capacity</span><strong>' + v.capacity + '</strong></div></div>' +
          '<div class="mt-3"><div class="progress-label"><span>' + (v.type.includes('Electric') ? 'Battery' : 'Fuel level') + '</span><strong>' + v.fuel + '%</strong></div><div class="progress ' + (v.fuel < 25 ? 'danger' : v.fuel < 50 ? 'warning' : 'success') + '"><span data-progress="' + v.fuel + '"></span></div></div></div>' +
          '<form class="card" id="inspForm"><div class="card-head"><h3 class="h3">Pre-trip inspection</h3><span class="xs muted" id="inspCount"></span></div><div class="checklist">' + items.map((it, i) => '<label><input type="checkbox" class="check-input" name="i' + i + '"' + (saved['i' + i] ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#00AEEF">' + it + '</label>').join('') + '</div><button class="btn mt-3" type="submit">' + I('clipboard') + 'Submit inspection</button></form></div>';
        const f = el.querySelector('#inspForm');
        const count = () => { el.querySelector('#inspCount').textContent = f.querySelectorAll('input:checked').length + ' / ' + items.length + ' checked'; };
        count();
        f.addEventListener('change', () => { const o = {}; f.querySelectorAll('input').forEach((x) => (o[x.name] = x.checked)); LX.store.set('inspection', o); count(); });
        f.addEventListener('submit', (e) => { e.preventDefault(); const n = f.querySelectorAll('input:checked').length; if (n < items.length) { LX.toast('Inspection incomplete', (items.length - n) + ' items still unchecked.', 'warning'); return; } LX.toast('Inspection submitted', 'Vehicle cleared for today\'s route.', 'success'); });
      }
    }
  });

  /* ====================================================================== */
  /* FLEET MANAGER DASHBOARD                                                 */
  /* ====================================================================== */
  function fleetMap(el, filter) {
    const map = LX.maps.create(el, { center: [38, -95], zoom: 4 });
    if (!map) return;
    const vs = LX.fleet.all().filter(filter || (() => true));
    const cities = Object.keys(LX.geo.cities).filter((c) => LX.geo.cities[c][2] === 'USA' || LX.geo.cities[c][2] === 'Canada');
    const items = vs.map((v, i) => {
      let c = LX.geo.find(v.location);
      if (!c || !['USA', 'Canada'].includes(c.country)) c = LX.geo.find(cities[i % cities.length]);
      const r = U.rng(U.hash(v.id));
      const start = [c.lat + (r() - 0.5) * 0.6, c.lng + (r() - 0.5) * 0.6];
      const dest = LX.geo.find(cities[(i * 5 + 3) % cities.length]);
      const pts = LX.geo.route(start, [dest.lat, dest.lng], { mode: 'road', points: 40 });
      const color = { 'On Route': 'blue', 'Maintenance': 'red', 'Offline': 'gray', 'Loading': '', 'Available': 'blue' }[v.status];
      const m = LX.maps.vehicle(start, LX.fleet.icon(v.type), 'sm ' + color).addTo(map).bindPopup('<strong>' + v.id + '</strong><br>' + v.type + '<br>' + v.driverName + '<br>' + v.status + ' · fuel ' + v.fuel + '%');
      return { v, pts, t: 0, m };
    });
    setInterval(() => items.filter((x) => x.v.status === 'On Route').forEach((x) => { x.t = Math.min(1, x.t + 0.01); LX.maps.glide(x.m, LX.geo.pointAt(x.pts, x.t).latlng, 2500); }), 3000);
    return map;
  }
  const LANES = [['Chicago', 'New York', 98.9, 14, 1270], ['Dallas', 'Atlanta', 98.6, 11, 1250], ['Los Angeles', 'Phoenix', 99.1, 18, 600], ['Memphis', 'Chicago', 96.8, 9, 850], ['Atlanta', 'Miami', 98.2, 8, 1060], ['Denver', 'Kansas City', 97.4, 6, 970], ['Seattle', 'Los Angeles', 95.9, 5, 1830], ['Houston', 'Dallas', 99.3, 16, 385]];

  LX.dash.register('fleet', {
    title: 'Fleet Control Center', roleLabel: 'Fleet Manager', icon: 'truck', accept: ['fleet', 'admin'],
    nav: [
      { group: 'Operations' }, { key: 'dashboard', label: 'Dashboard', icon: 'grid' }, { key: 'vehicles', label: 'Vehicles', icon: 'truck' }, { key: 'drivers', label: 'Drivers', icon: 'steering' }, { key: 'routes', label: 'Routes', icon: 'route' }, { key: 'shipments', label: 'Shipments', icon: 'package' },
      { group: 'Assets' }, { key: 'maintenance', label: 'Maintenance', icon: 'wrench', count: () => LX.fleet.all().filter((v) => v.status === 'Maintenance').length }, { key: 'fuel', label: 'Fuel', icon: 'fuel' },
      { group: 'Insights' }, { key: 'reports', label: 'Reports', icon: 'file' }, { key: 'analytics', label: 'Analytics', icon: 'chart' }, { key: 'notifications', label: 'Notifications', icon: 'bell' }, { key: 'settings', label: 'Settings', icon: 'settings' }, { key: 'logout', label: 'Logout', icon: 'logout' }
    ],
    panels: {
      dashboard(el) {
        const vs = LX.fleet.all(), ds = LX.drivers ? LX.drivers.all() : LX.data.drivers;
        const cnt = (s) => vs.filter((v) => v.status === s).length;
        el.innerHTML = H.head('Fleet overview', 'Live status of every vehicle, driver and lane.', '<button class="btn btn-ghost btn-sm" data-open="reports">' + I('download') + 'Reports</button><button class="btn btn-sm" data-open="maintenance">' + I('wrench') + 'Schedule service</button>') +
          '<div class="kpis k6">' + H.kpi('truck', '', 'Total Vehicles', vs.length, 'Demo sample of 1,200') + H.kpi('navigation', '', 'Active Vehicles', cnt('On Route') + cnt('Loading'), cnt('On Route') + ' on route') + H.kpi('wrench', 'danger', 'In Maintenance', cnt('Maintenance'), vs.filter((v) => LX.fleet.serviceSoon(v)).length + ' due in 14 days') + H.kpi('steering', 'success', 'Drivers Online', ds.filter((d) => d.status !== 'Offline').length, ds.filter((d) => d.status === 'On Delivery').length + ' on delivery') + H.kpi('route', 'accent', 'Active Routes', LANES.length + 9, '412 departures / day') + H.kpi('package', '', 'Deliveries Today', '<span data-count="1486">0</span>', H.trend(true, '6% vs avg')) + '</div>' +
          '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><h3 class="h3">Fleet Map</h3><span class="live-pill"><span class="live-dot"></span>Live</span></div><div class="dash-map tall"><div class="leaflet-holder" id="fleetMapEl"></div><div class="map-legend"><span><i style="background:#00AEEF"></i>Active / available</span><span><i style="background:#FFB000"></i>Loading</span><span><i style="background:#EF4444"></i>Maintenance</span><span><i style="background:#475569"></i>Offline</span></div></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Vehicle Status</h3></div><div class="chart-box sm"><canvas id="fdStatus" role="img" aria-label="Doughnut chart of vehicle status"></canvas></div><h3 class="h3 mt-3 mb-2">Driver Activity</h3><div class="list-rows">' + ds.slice(0, 5).map((d) => '<div>' + LX.fleet.avatar(d, 'avatar-sm') + '<div class="grow"><strong>' + d.name + '</strong><span class="cell-sub">' + d.location + ' · ' + d.hours + ' h this week</span></div>' + H.badge(d.status) + '</div>').join('') + '</div></div></div>' +
          '<div class="dgrid g-1-1"><div class="card"><div class="card-head"><div><h3 class="h3">Fuel Analytics</h3><span class="xs muted">Litres consumed per week, whole fleet</span></div></div><div class="chart-box"><canvas id="fdFuel" role="img" aria-label="Line chart of weekly fuel consumption"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Maintenance Schedule</h3><button class="link-arrow xs" data-open="maintenance">All ' + I('arrow-right') + '</button></div><div class="list-rows">' + vs.slice().sort((a, b) => new Date(a.nextService) - new Date(b.nextService)).slice(0, 6).map((v) => '<div><span class="icon-box sm ' + (LX.fleet.serviceSoon(v) ? 'warning' : '') + '">' + I('wrench') + '</span><div class="grow"><strong class="mono">' + v.id + '</strong><span class="cell-sub">' + v.type + ' · ' + U.num(v.mileage) + ' km</span></div><span class="small ' + (LX.fleet.serviceSoon(v) ? 'service-due' : '') + '">' + U.dateShort(v.nextService) + '</span></div>').join('') + '</div></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Route Performance</h3><button class="link-arrow xs" data-open="routes">All routes ' + I('arrow-right') + '</button></div><div class="table-wrap" style="border:0"><table class="table" data-sortable><caption class="sr-only">Route performance</caption><thead><tr><th data-sort="text">Lane</th><th data-sort="num">Distance</th><th data-sort="num">Departures / day</th><th data-sort="num">On-time</th><th></th></tr></thead><tbody>' + LANES.map((l) => '<tr><td class="cell-main">' + l[0] + ' → ' + l[1] + '</td><td data-v="' + l[4] + '">' + U.num(l[4]) + ' km</td><td>' + l[3] + '</td><td data-v="' + l[2] + '"><strong>' + l[2] + '%</strong></td><td style="min-width:140px"><div class="progress ' + (l[2] >= 98 ? 'success' : l[2] >= 97 ? '' : 'warning') + '"><span data-progress="' + l[2] + '"></span></div></td></tr>').join('') + '</tbody></table></div></div>';
        fleetMap(el.querySelector('#fleetMapEl'));
        LX.charts.doughnut('fdStatus', LX.fleet.STATUS, [{ data: LX.fleet.STATUS.map(cnt), colors: ['#22C55E', '#00AEEF', '#F59E0B', '#EF4444', '#64748B'] }], { format: (v) => v + ' vehicles' });
        LX.charts.line('fdFuel', ['W31', 'W32', 'W33', 'W34', 'W35', 'W36', 'W37', 'W38', 'W39'], [{ label: 'Fuel (litres)', data: [182400, 179800, 184100, 176300, 171900, 173200, 168400, 166900, 164200], fill: true }], { format: (v) => U.num(v) + ' L', axisFormat: (v) => U.compact(v), extend: (o) => { o.scales.y.beginAtZero = false; } });
      },
      vehicles(el) {
        el.innerHTML = H.head('Vehicles', 'Click a vehicle to update status or book service.', '<button class="btn btn-ghost btn-sm" data-exp>' + I('download') + 'Export CSV</button>') + '<div class="card" id="fvTable"></div>';
        const t = H.table(el.querySelector('#fvTable'), {
          rows: () => LX.fleet.all(), searchKeys: ['id', 'type', 'driverName', 'location'], placeholder: 'Search vehicles…', pageSize: 10,
          filters: [{ label: 'Status', key: 'status', options: LX.fleet.STATUS }, { label: 'Type', key: 'type', options: Object.keys(LX.data.VTYPES) }],
          cols: [
            { label: 'Vehicle', render: (v) => '<div class="table-user"><span class="icon-box sm">' + I(LX.fleet.icon(v.type)) + '</span><div><div class="cell-main mono">' + v.id + '</div><div class="cell-sub">' + v.type + '</div></div></div>', sort: (v) => v.id },
            { label: 'Driver', render: (v) => v.driverName, sort: (v) => v.driverName }, { label: 'Location', render: (v) => v.location, sort: (v) => v.location },
            { label: 'Fuel', render: (v) => '<div class="fuel"><div class="progress ' + LX.fleet.fuelClass(v.fuel) + '" style="min-width:60px"><span style="width:' + v.fuel + '%"></span></div>' + v.fuel + '%</div>', sort: (v) => v.fuel },
            { label: 'Mileage', render: (v) => U.num(v.mileage), sort: (v) => v.mileage }, { label: 'Status', render: (v) => H.badge(v.status), sort: (v) => v.status },
            { label: 'Next service', render: (v) => '<span class="' + (LX.fleet.serviceSoon(v) ? 'service-due' : '') + '">' + U.dateShort(v.nextService) + '</span>', sort: (v) => new Date(v.nextService).getTime() },
            { label: '', render: (v) => '<button class="btn btn-ghost btn-xs" data-vehicle="' + v.id + '">Manage</button>' }
          ]
        });
        document.addEventListener('lx:fleet', () => t.refresh());
        el.querySelector('[data-exp]').onclick = () => H.csv('fleet-vehicles.csv', [['Vehicle', 'id'], ['Type', 'type'], ['Driver', 'driverName'], ['Location', 'location'], ['Fuel %', 'fuel'], ['Mileage km', 'mileage'], ['Status', 'status'], ['Next service', 'nextService']], LX.fleet.all());
      },
      drivers(el) {
        el.innerHTML = H.head('Drivers', 'Change driver status or open a profile.') + '<div class="card" id="fdDrivers"></div>';
        const t = H.table(el.querySelector('#fdDrivers'), {
          rows: () => LX.drivers.all(), searchKeys: ['name', 'id', 'location', 'vehicle'], placeholder: 'Search drivers…', pageSize: 10,
          filters: [{ label: 'Status', key: 'status', options: LX.drivers.STATUS }],
          cols: [
            { label: 'Driver', render: (d) => '<div class="table-user">' + LX.fleet.avatar(d, 'avatar-sm') + '<div><div class="cell-main">' + d.name + '</div><div class="cell-sub">' + d.id + '</div></div></div>', sort: (d) => d.name },
            { label: 'Vehicle', render: (d) => d.vehicle || '—', sort: (d) => d.vehicle || '' }, { label: 'Location', render: (d) => d.location, sort: (d) => d.location },
            { label: 'Hours (wk)', render: (d) => '<span class="' + (d.hours > 42 ? 'text-warning' : '') + '">' + d.hours + ' / 60</span>', sort: (d) => d.hours },
            { label: 'On-time', render: (d) => d.onTime + '%', sort: (d) => d.onTime }, { label: 'Rating', render: (d) => '★ ' + d.rating, sort: (d) => d.rating },
            { label: 'Status', render: (d) => '<label class="sr-only" for="ds' + d.id + '">Status for ' + d.name + '</label><select class="select" id="ds' + d.id + '" data-dstatus="' + d.id + '" style="min-height:36px;padding:6px 34px 6px 10px;font-size:.8rem">' + LX.drivers.STATUS.map((s) => '<option' + (s === d.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>', sort: (d) => d.status },
            { label: '', render: (d) => '<button class="btn btn-ghost btn-xs" data-driver="' + d.id + '">Profile</button>' }
          ]
        });
        el.addEventListener('change', (e) => { const s = e.target.closest('[data-dstatus]'); if (s) { LX.drivers.update(s.dataset.dstatus, { status: s.value }); LX.toast('Driver status updated', s.value, 'success', 1800); } });
        document.addEventListener('lx:drivers', () => t.refresh());
      },
      routes(el) {
        el.innerHTML = H.head('Routes', 'Scheduled line-haul lanes and live performance.') + '<div class="dgrid g-1-2"><div class="card"><div class="list-rows">' + LANES.map((l) => '<div><span class="icon-box sm">' + I('route') + '</span><div class="grow"><strong>' + l[0] + ' → ' + l[1] + '</strong><span class="cell-sub">' + U.num(l[4]) + ' km · ' + l[3] + ' departures / day</span></div><span class="badge ' + (l[2] >= 98 ? 'badge-success' : 'badge-warning') + '">' + l[2] + '%</span></div>').join('') + '</div></div><div class="card"><div class="dash-map tall"><div class="leaflet-holder" id="laneMap"></div></div></div></div>';
        const map = LX.maps.create(el.querySelector('#laneMap'), { center: [38, -95], zoom: 4 });
        if (map) LANES.forEach((l, i) => { const a = LX.geo.find(l[0]), b = LX.geo.find(l[1]); const pts = LX.geo.route([a.lat, a.lng], [b.lat, b.lng], { mode: 'road' }); LX.maps.line(pts, l[2] >= 98 ? '#00AEEF' : '#F59E0B', { weight: 3 }).addTo(map).bindPopup('<strong>' + l[0] + ' → ' + l[1] + '</strong><br>On-time ' + l[2] + '%'); LX.maps.pin([a.lat, a.lng], 'hub', l[0]).addTo(map); LX.maps.pin([b.lat, b.lng], 'hub', l[1]).addTo(map); });
      },
      shipments(el) {
        el.innerHTML = H.head('Shipments', 'Road shipments assigned to fleet vehicles.') + '<div class="card" id="fsTable"></div>';
        H.table(el.querySelector('#fsTable'), {
          rows: () => LX.sim.all().filter((s) => s.mode === 'road'), searchKeys: ['id', 'from', 'to', 'driverName', 'vehicle'],
          filters: [{ label: 'Status', key: 'status', options: ['Booked', 'Picked Up', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Delayed'] }],
          cols: [{ label: 'Tracking ID', render: (s) => '<a class="mono cell-main" href="tracking.html?id=' + s.id + '">' + s.id + '</a>', sort: (s) => s.id }, { label: 'Route', render: (s) => s.from + ' → ' + s.to, sort: (s) => s.from }, { label: 'Driver', render: (s) => s.driverName, sort: (s) => s.driverName }, { label: 'Vehicle', render: (s) => s.vehicle.split(' · ')[0], sort: (s) => s.vehicle }, { label: 'Status', render: (s) => H.badge(s.status), sort: (s) => s.progress }, { label: 'Remaining', render: (s) => U.num(s.remaining) + ' km', sort: (s) => s.remaining }, { label: 'ETA', render: (s) => (s.progress >= 1 ? '—' : U.dateTime(s.etaLive)), sort: (s) => s.hoursLeft }]
        });
      },
      maintenance(el) {
        const draw = () => {
          const vs = LX.fleet.all().sort((a, b) => new Date(a.nextService) - new Date(b.nextService));
          el.querySelector('#mtList').innerHTML = vs.slice(0, 12).map((v) => '<div><span class="icon-box sm ' + (v.status === 'Maintenance' ? 'danger' : LX.fleet.serviceSoon(v) ? 'warning' : '') + '">' + I('wrench') + '</span><div class="grow"><strong class="mono">' + v.id + '</strong><span class="cell-sub">' + v.type + ' · ' + U.num(v.mileage) + ' km · ' + (v.status === 'Maintenance' ? 'In workshop' : 'Service ' + U.date(v.nextService)) + '</span></div>' + (v.status === 'Maintenance' ? '<button class="btn btn-success btn-xs" data-release="' + v.id + '">Release</button>' : '<button class="btn btn-ghost btn-xs" data-vehicle="' + v.id + '">Manage</button>') + '</div>').join('');
        };
        const busy = {};
        LX.fleet.all().forEach((v) => (busy[v.nextService] = true));
        el.innerHTML = H.head('Maintenance', 'Service calendar and workshop queue.') + '<div class="dgrid g-1-2"><div class="card"><h3 class="h3 mb-2">Service calendar</h3><div id="mtCal"></div><p class="xs muted mt-2">Dots mark days with scheduled services. Select a date to see bookings.</p><div id="mtDay" class="mt-2"></div></div><div class="card"><div class="card-head"><h3 class="h3">Upcoming services</h3></div><div class="list-rows" id="mtList"></div></div></div>';
        LX.calendar(el.querySelector('#mtCal'), { busy, onSelect: (d) => { const on = LX.fleet.all().filter((v) => v.nextService === d); el.querySelector('#mtDay').innerHTML = on.length ? on.map((v) => '<span class="chip">' + I('wrench') + v.id + '</span>').join(' ') : '<span class="small muted">No services booked on ' + U.date(d + 'T12:00') + '.</span>'; LX.hydrateIcons(el); } });
        draw();
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-release]'); if (b) { LX.fleet.update(b.dataset.release, { status: 'Available', nextService: U.iso(U.addDays(new Date(), 90)) }); draw(); LX.toast('Vehicle released', b.dataset.release + ' is back in service.', 'success'); } });
        document.addEventListener('lx:fleet', draw);
      },
      fuel(el) {
        const vs = LX.fleet.all();
        const low = vs.filter((v) => v.fuel < 30 && !v.type.includes('Electric'));
        el.innerHTML = H.head('Fuel', 'Consumption, cost and low-fuel alerts.') +
          '<div class="kpis">' + H.kpi('fuel', '', 'Fuel this week', '164,200 L', '<span class="trend up">' + I('trending-down') + '1.6% vs last week</span>') + H.kpi('dollar', 'accent', 'Fuel spend', '$213,460', '$1.30 / L average') + H.kpi('gauge', 'success', 'Fleet efficiency', '31.4 L/100km', H.trend(true, 'improved 0.8')) + H.kpi('alert', 'danger', 'Low fuel', low.length, 'Below 30%') + '</div>' +
          '<div class="dgrid g-1-1"><div class="card"><div class="card-head"><div><h3 class="h3">Consumption by vehicle type</h3><span class="xs muted">L/100 km</span></div></div><div class="chart-box"><canvas id="fuelType" role="img" aria-label="Bar chart of fuel consumption by vehicle type"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><h3 class="h3">Low-fuel alerts</h3></div><div class="list-rows">' + (low.length ? low.map((v) => '<div><span class="icon-box sm danger">' + I('fuel') + '</span><div class="grow"><strong class="mono">' + v.id + '</strong><span class="cell-sub">' + v.driverName + ' · ' + v.location + '</span></div><strong class="text-danger">' + v.fuel + '%</strong><button class="btn btn-ghost btn-xs" data-refuel="' + v.id + '">Notify driver</button></div>').join('') : '<p class="small">No vehicles below 30%.</p>') + '</div></div></div>';
        LX.charts.bar('fuelType', ['Van', 'Pickup', 'Medium', 'Heavy', 'Container', 'Reefer'], [{ label: 'L/100 km', data: [11.8, 13.2, 24.6, 34.1, 36.8, 38.9] }], { format: (v) => v + ' L/100 km' });
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-refuel]'); if (b) LX.toast('Driver notified', 'Nearest partner fuel station sent to ' + b.dataset.refuel + '.', 'success'); });
      },
      reports(el) {
        const reps = [['Fleet utilization report', 'Vehicle hours, idle time and utilization by type', () => H.csv('fleet-utilization.csv', [['Vehicle', 'id'], ['Type', 'type'], ['Utilization %', 'utilization'], ['Deliveries', 'deliveries']], LX.fleet.all())],
          ['Maintenance compliance', 'Service intervals, overdue and upcoming work', () => H.csv('maintenance.csv', [['Vehicle', 'id'], ['Mileage', 'mileage'], ['Next service', 'nextService'], ['Status', 'status']], LX.fleet.all())],
          ['Driver hours of service', 'Weekly hours, on-time rate and ratings', () => H.csv('driver-hours.csv', [['Driver', 'name'], ['ID', 'id'], ['Hours', 'hours'], ['On-time %', 'onTime'], ['Rating', 'rating']], LX.drivers.all())],
          ['Shipment performance', 'Status and ETA for all road shipments', () => H.csv('road-shipments.csv', [['ID', 'id'], ['From', 'from'], ['To', 'to'], ['Status', 'status'], ['Remaining km', 'remaining']], LX.sim.all().filter((s) => s.mode === 'road'))]];
        el.innerHTML = H.head('Reports', 'Download live data as CSV for Excel or BI tools.') + '<div class="dgrid g-1-1">' + reps.map((r, i) => '<div class="card report-card"><span class="icon-box">' + I('file') + '</span><div><strong>' + r[0] + '</strong><p class="small">' + r[1] + '</p></div><button class="btn btn-ghost btn-sm" data-rep="' + i + '">' + I('download') + 'CSV</button></div>').join('') + '</div>';
        el.addEventListener('click', (e) => { const b = e.target.closest('[data-rep]'); if (b) reps[+b.dataset.rep][2](); });
      },
      analytics(el) {
        el.innerHTML = H.head('Analytics', 'Fleet performance trends.') +
          '<div class="dgrid g-1-1"><div class="card"><div class="card-head"><div><h3 class="h3">Fleet utilization</h3><span class="xs muted">Monthly average</span></div></div><div class="chart-box"><canvas id="faUtil" role="img" aria-label="Line chart of monthly fleet utilization"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><div><h3 class="h3">Deliveries per day</h3><span class="xs muted">Last 14 days</span></div></div><div class="chart-box"><canvas id="faDel" role="img" aria-label="Bar chart of deliveries per day"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><div><h3 class="h3">On-time by region</h3><span class="xs muted">This month</span></div></div><div class="chart-box"><canvas id="faReg" role="img" aria-label="Horizontal bar chart of on-time rate by region"></canvas></div></div>' +
          '<div class="card"><div class="card-head"><div><h3 class="h3">Delivery delays</h3><span class="xs muted">Cause of late deliveries, this month</span></div></div><div class="chart-box"><canvas id="faDelay" role="img" aria-label="Doughnut chart of delay causes"></canvas></div></div></div>';
        LX.charts.line('faUtil', LX.charts.lastMonths(12), [{ label: 'Utilization', data: [78, 79, 81, 80, 83, 84, 82, 85, 86, 87, 86, 88], fill: true }], { format: (v) => v + '%', axisFormat: (v) => v + '%', extend: (o) => { o.scales.y.beginAtZero = false; o.scales.y.min = 70; o.scales.y.max = 95; } });
        LX.charts.bar('faDel', Array.from({ length: 14 }, (_, i) => U.dateShort(U.addDays(new Date(), i - 13))), [{ label: 'Deliveries', data: [1320, 1402, 988, 610, 1388, 1455, 1497, 1412, 1530, 1011, 640, 1421, 1468, 1486] }], { format: (v) => U.num(v) + ' deliveries' });
        LX.charts.bar('faReg', ['Midwest', 'South', 'West', 'Northeast', 'Southeast', 'Canada'], [{ label: 'On-time', data: [98.9, 98.4, 97.6, 98.1, 98.7, 97.2] }], { horizontal: true, format: (v) => v + '%', extend: (o) => { o.scales.x.beginAtZero = false; o.scales.x.min = 94; o.scales.x.max = 100; } });
        LX.charts.doughnut('faDelay', ['Traffic', 'Weather', 'Customer not ready', 'Mechanical', 'Customs'], [{ data: [38, 21, 19, 12, 10] }], { format: (v) => v + ' delays' });
      }
    }
  });

  LX.ready(() => { if (document.body.dataset.role && document.body.dataset.role !== 'admin') LX.dash.boot(); });
})();
