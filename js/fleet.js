/* ==========================================================================
   NorthLane Logistics — Fleet management
   LX.fleet: persistent vehicle store (LocalStorage overrides on demo data)
   Fleet page: status summary, search / filter / sort, grid & table views,
   pagination, vehicle modal and live telemetry updates.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);
  const STATUS = ['Available', 'On Route', 'Loading', 'Maintenance', 'Offline'];
  const COLOR = { 'Available': 'var(--success)', 'On Route': 'var(--primary)', 'Loading': 'var(--warning)', 'Maintenance': 'var(--danger)', 'Offline': 'var(--muted)' };

  const fleet = (LX.fleet = {
    STATUS, COLOR,
    all() {
      const o = LX.store.get('fleetState', {});
      return LX.data.vehicles.map((v) => Object.assign({}, v, o[v.id] || {}));
    },
    get(id) { return fleet.all().find((v) => v.id === id); },
    update(id, patch) {
      const o = LX.store.get('fleetState', {});
      o[id] = Object.assign(o[id] || {}, patch);
      LX.store.set('fleetState', o);
      document.dispatchEvent(new CustomEvent('lx:fleet', { detail: { id } }));
    },
    icon: (type) => (LX.data.VTYPES[type] || {}).icon || 'truck',
    driver: (id) => LX.data.drivers.find((d) => d.id === id),
    avatar(d, cls) {
      if (!d) return '<span class="avatar avatar-initials ' + (cls || '') + '" style="background:var(--surface-2);color:var(--muted)">—</span>';
      return d.photo ? '<img class="avatar ' + (cls || '') + '" src="' + d.photo + '" alt="' + U.esc(d.name) + '" loading="lazy">' : '<span class="avatar avatar-initials ' + (cls || '') + '">' + U.initials(d.name) + '</span>';
    },
    fuelClass: (f) => (f < 25 ? 'danger' : f < 50 ? 'warning' : 'success'),
    serviceSoon: (v) => (new Date(v.nextService) - Date.now()) / 86400000 < 14,
    /* Detail modal (used on fleet page and fleet dashboard) */
    openModal(id) {
      const v = fleet.get(id);
      if (!v) return;
      const d = fleet.driver(v.driver);
      const m = LX.modal.show(
        '<div class="veh-id"><span class="icon-box">' + I(fleet.icon(v.type)) + '</span><div><h3 class="mono" style="padding:0">' + v.id + '</h3><span>' + v.type + ' · ' + v.year + ' model</span></div></div>' +
        '<div class="flex mt-2 flex-wrap"><span class="badge badge-' + U.slug(v.status) + '">' + v.status + '</span>' + (fleet.serviceSoon(v) ? '<span class="badge badge-warning">Service due soon</span>' : '') + '</div>' +
        '<div class="kv mt-3"><div><span>Driver</span><strong>' + (d ? d.name + ' · ' + d.id : 'Unassigned') + '</strong></div><div><span>Capacity</span><strong>' + v.capacity + '</strong></div><div><span>Current location</span><strong>' + v.location + '</strong></div><div><span>' + (v.type.includes('Electric') ? 'Battery' : 'Fuel level') + '</span><strong>' + v.fuel + '%</strong></div><div><span>Mileage</span><strong>' + U.num(v.mileage) + ' km</strong></div><div><span>Next service</span><strong>' + U.date(v.nextService) + '</strong></div><div><span>Deliveries</span><strong>' + U.num(v.deliveries) + '</strong></div><div><span>Utilization</span><strong>' + v.utilization + '%</strong></div></div>' +
        '<div class="field mt-3"><label for="vmStatus">Update status</label><select id="vmStatus" class="select">' + STATUS.map((s) => '<option' + (s === v.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
        '<div class="flex flex-wrap mt-3" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-act="service">' + I('wrench') + 'Schedule service</button><button class="btn btn-sm" data-act="save">' + I('check') + 'Save changes</button></div>',
        { label: 'Vehicle ' + v.id });
      m.querySelector('[data-act="save"]').onclick = () => {
        fleet.update(v.id, { status: m.querySelector('#vmStatus').value });
        LX.modal.close(m);
        LX.toast('Vehicle updated', v.id + ' is now ' + m.querySelector('#vmStatus').value + '.', 'success');
      };
      m.querySelector('[data-act="service"]').onclick = () => {
        const date = U.iso(U.addDays(new Date(), 3));
        fleet.update(v.id, { nextService: date });
        LX.modal.close(m);
        LX.toast('Service scheduled', v.id + ' booked into the workshop on ' + U.date(date) + '.', 'success');
      };
    }
  });

  function vehicleCard(v, i) {
    const d = fleet.driver(v.driver);
    const ev = v.type.includes('Electric');
    return '<article class="card card-hover veh-card" data-aos="fade-up" data-aos-delay="' + (i % 3) * 60 + '">' +
      '<div class="veh-top"><div class="veh-id"><span class="icon-box">' + I(fleet.icon(v.type)) + '</span><div><strong>' + v.id + '</strong><span>' + v.type + '</span></div></div><span class="badge badge-' + U.slug(v.status) + '">' + v.status + '</span></div>' +
      '<div class="veh-meta"><div><span>Capacity</span><strong>' + v.capacity + '</strong></div><div><span>Location</span><strong>' + v.location + '</strong></div><div><span>Mileage</span><strong>' + U.num(v.mileage) + ' km</strong></div><div><span>Deliveries</span><strong>' + U.num(v.deliveries) + '</strong></div><div><span>Next service</span><strong class="' + (fleet.serviceSoon(v) ? 'service-due' : '') + '">' + U.dateShort(v.nextService) + '</strong></div><div><span>Utilization</span><strong>' + v.utilization + '%</strong></div></div>' +
      '<div class="fuel">' + I(ev ? 'battery' : 'fuel') + '<div class="progress ' + fleet.fuelClass(v.fuel) + '"><span data-progress="' + v.fuel + '"></span></div><strong>' + v.fuel + '%</strong></div>' +
      '<div class="veh-foot"><div class="veh-driver">' + fleet.avatar(d, 'avatar-sm') + '<span>' + (d ? d.name : 'Unassigned') + '</span></div><button class="btn btn-ghost btn-xs" data-vehicle="' + v.id + '">Details' + I('arrow-right') + '</button></div></article>';
  }
  function vehicleRow(v) {
    const d = fleet.driver(v.driver);
    return '<tr><td><div class="table-user"><span class="icon-box sm">' + I(fleet.icon(v.type)) + '</span><div><div class="cell-main">' + v.id + '</div><div class="cell-sub">' + v.type + '</div></div></div></td><td>' + (d ? d.name : '<span class="muted">Unassigned</span>') + '</td><td>' + v.capacity + '</td><td>' + v.location + '</td><td><div class="fuel"><div class="progress ' + fleet.fuelClass(v.fuel) + '" style="min-width:70px"><span style="width:' + v.fuel + '%"></span></div>' + v.fuel + '%</div></td><td>' + U.num(v.mileage) + '</td><td><span class="badge badge-' + U.slug(v.status) + '">' + v.status + '</span></td><td class="' + (fleet.serviceSoon(v) ? 'service-due' : '') + '">' + U.dateShort(v.nextService) + '</td><td>' + U.num(v.deliveries) + '</td><td><button class="btn btn-ghost btn-xs" data-vehicle="' + v.id + '">View</button></td></tr>';
  }

  function fleetPage() {
    const grid = document.getElementById('vehicleGrid');
    if (!grid) return;
    const summary = document.getElementById('statusSummary');
    const statusFilter = { el: summary, key: 'status' };
    let view = LX.store.get('prefs', {}).fleetView || 'grid';
    const tableWrap = document.getElementById('vehicleTableWrap');
    const tbody = document.getElementById('vehicleTable');

    const renderSummary = () => {
      const all = fleet.all();
      const cur = summary.dataset.value || 'all';
      summary.innerHTML = [['all', 'All vehicles', all.length, 'var(--primary-light)']].concat(STATUS.map((s) => [s, s, all.filter((v) => v.status === s).length, COLOR[s]])).map(([val, label, n, c]) =>
        '<button class="status-pill' + (cur === val ? ' active' : '') + '" data-value="' + val + '" aria-pressed="' + (cur === val) + '" style="--c:' + c + '"><strong>' + n + '</strong><span>' + label + '</span></button>').join('');
    };
    renderSummary();

    const list = LX.list({
      items: () => fleet.all(),
      container: grid,
      render: vehicleCard,
      pageSize: 9,
      pager: document.getElementById('vehiclePager'),
      count: document.getElementById('vehicleCount'),
      search: document.getElementById('vehicleSearch'),
      searchKeys: ['id', 'type', 'driverName', 'location', 'status'],
      filters: [statusFilter, { el: document.getElementById('vehicleType'), key: 'type' }],
      sort: document.getElementById('vehicleSort'),
      sorters: {
        'fuel-asc': (a, b) => a.fuel - b.fuel, 'fuel-desc': (a, b) => b.fuel - a.fuel,
        'mileage-desc': (a, b) => b.mileage - a.mileage, 'deliveries-desc': (a, b) => b.deliveries - a.deliveries,
        'service-asc': (a, b) => new Date(a.nextService) - new Date(b.nextService), 'id-asc': (a, b) => a.id.localeCompare(b.id)
      },
      after: (slice, rows) => {
        tbody.innerHTML = rows.map(vehicleRow).join('');
        LX.hydrateIcons(tbody);
      }
    });
    const setView = (v) => {
      view = v;
      grid.classList.toggle('hidden', v !== 'grid');
      document.getElementById('vehiclePager').classList.toggle('hidden', v !== 'grid');
      tableWrap.classList.toggle('hidden', v !== 'table');
      document.querySelectorAll('[data-view]').forEach((b) => { b.classList.toggle('active', b.dataset.view === v); b.setAttribute('aria-pressed', String(b.dataset.view === v)); });
      const p = LX.store.get('prefs', {}); p.fleetView = v; LX.store.set('prefs', p);
    };
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    setView(view);
    summary.addEventListener('click', () => setTimeout(renderSummary, 0));
    document.addEventListener('lx:fleet', () => { renderSummary(); list.refresh(); });

    // Charts
    if (LX.charts && document.getElementById('fleetUtil')) {
      const types = Object.keys(LX.data.VTYPES);
      const all = fleet.all();
      LX.charts.bar('fleetUtil', types.map((t) => t.replace(' Delivery Vehicle', ' EV').replace(' Truck', '')), [{ label: 'Average utilization', data: types.map((t) => { const v = all.filter((x) => x.type === t); return Math.round(v.reduce((a, x) => a + x.utilization, 0) / (v.length || 1)); }) }], { format: (v) => v + '%', axisFormat: (v) => v + '%', extend: (o) => { o.scales.y.max = 100; } });
      LX.charts.doughnut('fleetStatus', STATUS, [{ data: STATUS.map((s) => all.filter((v) => v.status === s).length), colors: ['#22C55E', '#00AEEF', '#F59E0B', '#EF4444', '#64748B'] }], { format: (v) => v + ' vehicles', legendPos: 'right' });
    }

    // Live telemetry: vehicles on route burn fuel and add mileage
    setInterval(() => {
      const o = LX.store.get('fleetState', {});
      fleet.all().filter((v) => v.status === 'On Route').forEach((v) => {
        o[v.id] = Object.assign(o[v.id] || {}, { fuel: Math.max(8, v.fuel - (Math.random() > 0.7 ? 1 : 0)), mileage: v.mileage + Math.round(2 + Math.random() * 4) });
      });
      LX.store.set('fleetState', o);
    }, 6000);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vehicle]');
    if (b) fleet.openModal(b.dataset.vehicle);
  });

  LX.ready(fleetPage);
})();
