/* ==========================================================================
   NorthLane Logistics — Driver management
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);
  const STATUS = ['Online', 'On Delivery', 'Break', 'Offline'];
  const COLOR = { 'Online': 'var(--success)', 'On Delivery': 'var(--primary)', 'Break': 'var(--warning)', 'Offline': 'var(--muted)' };

  const drivers = (LX.drivers = {
    STATUS,
    all() {
      const o = LX.store.get('driverState', {});
      return LX.data.drivers.map((d) => Object.assign({}, d, o[d.id] || {}));
    },
    update(id, patch) {
      const o = LX.store.get('driverState', {});
      o[id] = Object.assign(o[id] || {}, patch);
      LX.store.set('driverState', o);
      document.dispatchEvent(new CustomEvent('lx:drivers'));
    },
    stars(r) { let h = ''; for (let i = 1; i <= 5; i++) h += I('star').replace('<svg', '<svg style="opacity:' + (r >= i - 0.25 ? 1 : 0.25) + '"'); return '<span class="rating" aria-label="Rated ' + r + ' out of 5">' + h + '</span>'; },
    monthly(d) { const r = U.rng(U.hash(d.id)); return LX.charts ? LX.charts.lastMonths(6).map(() => Math.round(d.deliveries / 30 + r() * 40 + 60)) : []; },
    openProfile(id) {
      const d = drivers.all().find((x) => x.id === id);
      if (!d) return;
      const v = LX.data.vehicles.find((x) => x.id === d.vehicle);
      const m = LX.modal.show(
        '<div class="profile-head">' + LX.fleet.avatar(d) + '<div><h3 style="padding:0">' + d.name + '</h3><span class="xs muted">' + d.id + ' · ' + d.license + '</span><div class="flex mt-1 flex-wrap"><span class="badge badge-' + U.slug(d.status) + '">' + d.status + '</span>' + drivers.stars(d.rating) + '<strong class="small">' + d.rating + '</strong></div></div></div>' +
        '<div class="drv-stats"><div><strong>' + U.num(d.deliveries) + '</strong><span>Deliveries</span></div><div><strong>' + d.onTime + '%</strong><span>On time</span></div><div><strong>' + d.experience + ' yrs</strong><span>Experience</span></div></div>' +
        '<div class="kv"><div><span>Vehicle</span><strong>' + (v ? v.id + ' · ' + v.type : 'Not assigned') + '</strong></div><div><span>Current location</span><strong>' + d.location + '</strong></div><div><span>Hours this week</span><strong>' + d.hours + ' / 60 h</strong></div><div><span>Phone</span><strong>' + d.phone + '</strong></div></div>' +
        '<h4 class="mt-3 mb-2">Deliveries per month</h4><div class="chart-box" style="height:200px"><canvas id="drvChart" role="img" aria-label="Monthly deliveries for ' + U.esc(d.name) + '"></canvas></div>' +
        '<div class="flex flex-wrap mt-3" style="justify-content:flex-end"><a class="btn btn-ghost btn-sm" href="tel:' + d.phone.replace(/[^\d+]/g, '') + '">' + I('phone') + 'Call</a><button class="btn btn-sm" data-msg>' + I('message') + 'Send message</button></div>',
        { size: 'lg', label: 'Driver profile ' + d.name });
      m.querySelector('[data-msg]').onclick = () => { LX.modal.close(m); LX.toast('Message sent', 'Your message was delivered to ' + d.name + "'s driver app.", 'success'); };
      if (LX.charts) setTimeout(() => LX.charts.bar(m.querySelector('#drvChart'), LX.charts.lastMonths(6), [{ label: 'Deliveries', data: drivers.monthly(d) }], { format: (x) => x + ' deliveries' }), 120);
    }
  });

  function card(d, i) {
    const v = LX.data.vehicles.find((x) => x.id === d.vehicle);
    return '<article class="card card-hover drv-card" data-aos="fade-up" data-aos-delay="' + (i % 4) * 60 + '">' +
      '<div class="drv-cover"></div><div class="drv-photo">' + LX.fleet.avatar(d) + '<span class="dot ' + U.slug(d.status) + '" title="' + d.status + '"></span></div>' +
      '<div class="drv-body"><h3>' + d.name + '</h3><span class="drv-id">' + d.id + '</span><div class="flex mt-1" style="justify-content:center;gap:6px">' + drivers.stars(d.rating) + '<strong class="small">' + d.rating + '</strong></div>' +
      '<div class="drv-stats"><div><strong>' + U.compact(d.deliveries) + '</strong><span>Deliveries</span></div><div><strong>' + d.experience + 'y</strong><span>Exp.</span></div><div><strong>' + d.onTime + '%</strong><span>On time</span></div></div>' +
      '<div class="drv-info"><div>' + I('truck') + (v ? v.id + ' · ' + v.type : 'No vehicle assigned') + '</div><div>' + I('map-pin') + d.location + '</div><div>' + I('activity') + '<span class="badge badge-' + U.slug(d.status) + '">' + d.status + '</span></div></div>' +
      '<div class="drv-actions"><button class="btn btn-ghost btn-xs" data-driver="' + d.id + '">' + I('user') + 'Profile</button><a class="btn btn-ghost btn-xs" href="tel:' + d.phone.replace(/[^\d+]/g, '') + '" aria-label="Call ' + U.esc(d.name) + '">' + I('phone') + 'Call</a></div></div></article>';
  }

  function driversPage() {
    const grid = document.getElementById('driverGrid');
    if (!grid) return;
    const summary = document.getElementById('driverSummary');
    const renderSummary = () => {
      const all = drivers.all();
      const cur = summary.dataset.value || 'all';
      summary.innerHTML = [['all', 'All drivers', all.length, 'var(--primary-light)']].concat(STATUS.map((s) => [s, s, all.filter((d) => d.status === s).length, COLOR[s]])).map(([val, label, n, c]) =>
        '<button class="status-pill' + (cur === val ? ' active' : '') + '" data-value="' + val + '" aria-pressed="' + (cur === val) + '" style="--c:' + c + '"><strong>' + n + '</strong><span>' + label + '</span></button>').join('');
    };
    renderSummary();
    summary.addEventListener('click', () => setTimeout(renderSummary, 0));
    LX.list({
      items: () => drivers.all(), container: grid, render: card, pageSize: 8,
      pager: document.getElementById('driverPager'), count: document.getElementById('driverCount'),
      search: document.getElementById('driverSearch'), searchKeys: ['name', 'id', 'location', 'vehicle', 'status'],
      filters: [{ el: summary, key: 'status' }],
      sort: document.getElementById('driverSort'),
      sorters: { 'rating': (a, b) => b.rating - a.rating, 'deliveries': (a, b) => b.deliveries - a.deliveries, 'experience': (a, b) => b.experience - a.experience, 'ontime': (a, b) => b.onTime - a.onTime, 'name': (a, b) => a.name.localeCompare(b.name) }
    });

    const lb = document.getElementById('leaderboard');
    if (lb) {
      const top = drivers.all().slice().sort((a, b) => b.onTime * b.rating - a.onTime * a.rating).slice(0, 5);
      lb.innerHTML = top.map((d, i) => '<li><span class="rank">' + (i + 1) + '</span>' + LX.fleet.avatar(d) + '<div><strong>' + d.name + '</strong><span class="xs muted" style="display:block">' + d.onTime + '% on time · ★ ' + d.rating + '</span></div><span class="badge badge-success no-dot">' + U.compact(d.deliveries) + '</span></li>').join('');
    }
    if (LX.charts && document.getElementById('drvTop')) {
      const top = drivers.all().slice().sort((a, b) => b.deliveries - a.deliveries).slice(0, 8);
      LX.charts.bar('drvTop', top.map((d) => d.name.split(' ')[0] + ' ' + d.name.split(' ')[1][0] + '.'), [{ label: 'Deliveries completed', data: top.map((d) => d.deliveries) }], { horizontal: true, format: (v) => U.num(v) + ' deliveries' });
      LX.charts.line('drvTrend', LX.charts.lastMonths(12), [{ label: 'Team on-time rate', data: [95.8, 96.1, 96.4, 96.2, 96.9, 97.3, 97.1, 97.6, 97.9, 98.1, 98.0, 98.4], fill: true }], { format: (v) => v + '%', axisFormat: (v) => v + '%', extend: (o) => { o.scales.y.beginAtZero = false; o.scales.y.min = 94; o.scales.y.max = 100; } });
      const all = drivers.all();
      LX.charts.doughnut('drvStatus', STATUS, [{ data: STATUS.map((s) => all.filter((d) => d.status === s).length), colors: ['#22C55E', '#00AEEF', '#F59E0B', '#64748B'] }], { format: (v) => v + ' drivers' });
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-driver]');
    if (b) drivers.openProfile(b.dataset.driver);
  });

  LX.ready(driversPage);
})();
