/* ==========================================================================
   NorthLane Logistics — Admin console
   Registers the "admin" role with LX.dash and reuses fleet panels where the
   workflows are identical (vehicles, drivers, routes, maintenance, reports).
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  const state = () => LX.store.get('adminState', { services: {}, prices: {}, posts: [], broadcast: [] });
  const saveState = (s) => LX.store.set('adminState', s);
  const allInvoices = () => {
    const paid = LX.store.get('paidInvoices', []);
    return LX.store.get('invoicesCustom', []).concat(LX.data.invoices).map((i) => (paid.includes(i.id) ? Object.assign({}, i, { status: 'Paid' }) : i));
  };
  const customers = () => LX.data.customers.map((c, i) => {
    const sh = LX.sim.all().filter((s) => s.customer === c);
    const inv = allInvoices().filter((x) => x.customer === c);
    return { id: 'CUS-' + (2101 + i), name: c, contact: ['Alex Morgan', 'Priya Nair', 'Jordan Lee', 'Sam Patel', 'Mei Tanaka', 'Robert Kline', 'Dana Cruz', 'Chris Novak', 'Taylor Brooks', 'Morgan Reed', 'Avery Quinn', 'Riley Shaw'][i], email: 'ops@' + U.slug(c).replace(/-/g, '') + '.com', shipments: sh.length + 20 + (U.hash(c) % 180), spend: inv.reduce((a, x) => a + x.total, 0) + (U.hash(c) % 90000) + 12000, plan: ['Enterprise', 'Business', 'Enterprise', 'Business', 'Business', 'Enterprise', 'Local', 'Business', 'Business', 'Enterprise', 'Local', 'Business'][i], status: i === 10 ? 'Pending' : 'Active', since: 2016 + (i % 9) };
  });
  const orders = () => {
    const r = U.rng(314);
    return Array.from({ length: 40 }, (_, i) => {
      const c = LX.data.customers[Math.floor(r() * LX.data.customers.length)];
      const st = ['Pending', 'Processing', 'Scheduled', 'In Transit', 'Delivered', 'Delivered', 'Delivered'][Math.floor(r() * 7)];
      return { id: 'ORD-' + (58210 - i * 7), customer: c, items: 1 + Math.floor(r() * 48), value: Math.round(800 + r() * 42000), channel: ['EDI', 'API', 'Portal', 'Shopify'][Math.floor(r() * 4)], date: U.addDays(new Date(), -Math.floor(i / 3)).toISOString(), status: st };
    });
  };
  const payments = () => allInvoices().filter((i) => i.status === 'Paid').map((i, k) => ({ id: 'PAY-' + (73100 + k), invoice: i.id, customer: i.customer, amount: i.total, method: ['ACH', 'Card', 'Wire', 'Wallet'][k % 4], date: U.addDays(new Date(i.date), 6 + (k % 12)).toISOString(), status: 'Completed' }));

  LX.ready(() => {
    if (document.body.dataset.role !== 'admin') return;
    const D = LX.dash, H = D.H, F = D.get('fleet').panels;

    D.register('admin', {
      title: 'Admin Dashboard', roleLabel: 'Administrator', icon: 'shield-check', accept: ['admin'],
      nav: [
        { group: 'Operations' }, { key: 'dashboard', label: 'Dashboard', icon: 'grid' }, { key: 'shipments', label: 'Shipments', icon: 'package' }, { key: 'customers', label: 'Customers', icon: 'users' }, { key: 'drivers', label: 'Drivers', icon: 'steering' }, { key: 'vehicles', label: 'Vehicles', icon: 'truck' }, { key: 'fleet', label: 'Fleet', icon: 'map' }, { key: 'warehouses', label: 'Warehouses', icon: 'warehouse' }, { key: 'routes', label: 'Routes', icon: 'route' }, { key: 'orders', label: 'Orders', icon: 'clipboard' },
        { group: 'Finance' }, { key: 'invoices', label: 'Invoices', icon: 'receipt', count: () => allInvoices().filter((i) => i.status === 'Overdue').length || '' }, { key: 'payments', label: 'Payments', icon: 'card' }, { key: 'services', label: 'Services', icon: 'layers' }, { key: 'pricing', label: 'Pricing', icon: 'tag' },
        { group: 'Insights & content' }, { key: 'reports', label: 'Reports', icon: 'file' }, { key: 'analytics', label: 'Analytics', icon: 'chart' }, { key: 'notifications', label: 'Notifications', icon: 'bell' }, { key: 'blog', label: 'Blog', icon: 'edit' },
        { group: 'System' }, { key: 'users', label: 'Users', icon: 'user' }, { key: 'settings', label: 'Settings', icon: 'settings' }, { key: 'logout', label: 'Logout', icon: 'logout' }
      ],
      panels: {
        dashboard(el) {
          const sh = LX.sim.all();
          const inv = allInvoices();
          const vs = LX.fleet.all(), ds = LX.drivers.all();
          const rev = inv.reduce((a, i) => a + i.total, 0) + 2184300;
          el.innerHTML = H.head('Operations overview', 'Network-wide performance · updated live.', '<button class="btn btn-ghost btn-sm" data-open="reports">' + I('download') + 'Export</button><a class="btn btn-sm" href="book-shipment.html">' + I('plus') + 'New shipment</a>') +
            '<div class="kpis">' +
            H.kpi('package', '', 'Total Shipments', '<span data-count="' + (250000 + sh.length * 41) + '">0</span>', H.trend(true, '9.4% YoY')) +
            H.kpi('truck', '', 'Active Shipments', '<span data-count="' + (2360 + sh.filter((s) => s.progress < 1).length) + '">0</span>', '<span class="live-dot blue"></span> In motion now') +
            H.kpi('check-circle', 'success', 'Delivered Shipments', '<span data-count="' + (18420 + sh.filter((s) => s.progress >= 1).length) + '">0</span>', 'This month') +
            H.kpi('dollar', 'accent', 'Total Revenue', '<span data-count="' + Math.round(rev) + '" data-prefix="$">0</span>', H.trend(true, '12.8% vs last month')) +
            H.kpi('navigation', '', 'Active Vehicles', vs.filter((v) => ['On Route', 'Loading'].includes(v.status)).length + ' / ' + vs.length, 'Sample fleet') +
            H.kpi('steering', 'success', 'Drivers Online', ds.filter((d) => d.status !== 'Offline').length, ds.filter((d) => d.status === 'On Delivery').length + ' on delivery') +
            H.kpi('clock', 'warning', 'Pending Deliveries', '<span data-count="' + (640 + sh.filter((s) => s.progress < 0.05).length) + '">0</span>', 'Awaiting pickup') +
            H.kpi('alert', 'danger', 'Delayed Shipments', 84 + sh.filter((s) => s.status === 'Delayed').length, H.trend(false, '0.4% of volume')) + '</div>' +
            '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><div><h3 class="h3">Revenue Analytics</h3><span class="xs muted">Daily revenue, last 30 days</span></div><span class="trend up">' + I('trending-up') + '12.8%</span></div><div class="chart-box"><canvas id="adRevenue" role="img" aria-label="Line chart of daily revenue for the last 30 days"></canvas></div></div>' +
            '<div class="card"><div class="card-head"><div><h3 class="h3">Delivery Performance</h3><span class="xs muted">This month</span></div></div><div class="chart-box"><canvas id="adPerf" role="img" aria-label="Doughnut chart of on-time, late and failed deliveries"></canvas></div></div></div>' +
            '<div class="dgrid g-1-1"><div class="card"><div class="card-head"><div><h3 class="h3">Shipment Volume</h3><span class="xs muted">Shipments per month by mode</span></div></div><div class="chart-box"><canvas id="adVolume" role="img" aria-label="Stacked bar chart of monthly shipments by transport mode"></canvas></div></div>' +
            '<div class="card"><div class="card-head"><div><h3 class="h3">Monthly Revenue</h3><span class="xs muted">2026 vs 2025, USD</span></div></div><div class="chart-box"><canvas id="adMonthly" role="img" aria-label="Grouped bar chart comparing monthly revenue in 2026 and 2025"></canvas></div></div></div>' +
            '<div class="dgrid g-3"><div class="card"><div class="card-head"><div><h3 class="h3">Vehicle Utilization</h3><span class="xs muted">By type, last 30 days</span></div></div><div class="chart-box sm"><canvas id="adUtil" role="img" aria-label="Bar chart of utilization by vehicle type"></canvas></div></div>' +
            '<div class="card"><div class="card-head"><div><h3 class="h3">Customer Growth</h3><span class="xs muted">Active accounts</span></div></div><div class="chart-box sm"><canvas id="adCust" role="img" aria-label="Line chart of active customer accounts"></canvas></div></div>' +
            '<div class="card"><div class="card-head"><div><h3 class="h3">Regional Shipments</h3><span class="xs muted">This month</span></div></div><div class="chart-box sm"><canvas id="adRegion" role="img" aria-label="Horizontal bar chart of shipments by region"></canvas></div></div></div>' +
            '<div class="dgrid g-2-1"><div class="card"><div class="card-head"><h3 class="h3">Latest shipments</h3><button class="link-arrow xs" data-open="shipments">Manage ' + I('arrow-right') + '</button></div><div class="table-wrap" style="border:0"><table class="table"><caption class="sr-only">Latest shipments</caption><thead><tr><th>ID</th><th>Customer</th><th>Route</th><th>Mode</th><th>Status</th><th>Value</th></tr></thead><tbody>' + sh.slice(0, 7).map((s) => '<tr><td><a class="mono cell-main" href="shipment-details.html?id=' + s.id + '">' + s.id + '</a></td><td>' + s.customer + '</td><td>' + s.from + ' → ' + s.to + '</td><td>' + s.mode + '</td><td>' + H.badge(s.status) + '</td><td>' + U.money(s.cost, 0) + '</td></tr>').join('') + '</tbody></table></div></div>' +
            '<div class="card"><div class="card-head"><h3 class="h3">Live activity</h3><span class="live-pill"><span class="live-dot"></span>Live</span></div><div class="activity-feed" id="adFeed"></div></div></div>';
          const days = Array.from({ length: 30 }, (_, i) => U.dateShort(U.addDays(new Date(), i - 29)));
          const r = U.rng(5);
          LX.charts.line('adRevenue', days, [{ label: 'Revenue', data: days.map((_, i) => Math.round(62000 + i * 900 + (r() - 0.4) * 16000 - (i % 7 >= 5 ? 22000 : 0))), fill: true }], { format: (v) => U.money(v, 0), axisFormat: LX.charts.money });
          LX.charts.doughnut('adPerf', ['On time', 'Late', 'Failed attempt'], [{ data: [21224, 196, 84], colors: ['#22C55E', '#F59E0B', '#EF4444'] }], { format: (v) => U.num(v) + ' deliveries' });
          const m6 = LX.charts.lastMonths(6);
          LX.charts.bar('adVolume', m6, [{ label: 'Road', data: [14200, 14900, 15400, 16100, 16800, 17350] }, { label: 'Air', data: [1680, 1720, 1810, 1790, 1920, 2010] }, { label: 'Ocean', data: [920, 960, 1010, 1080, 1120, 1164] }, { label: 'Rail', data: [610, 640, 700, 730, 790, 840] }], { stacked: true, format: (v) => U.num(v) + ' shipments', axisFormat: (v) => U.compact(v) });
          const m12 = LX.charts.lastMonths(12);
          LX.charts.bar('adMonthly', m12, [{ label: '2026', data: [1.62, 1.58, 1.71, 1.76, 1.84, 1.9, 1.87, 1.95, 2.02, 2.11, 2.08, 2.19].map((x) => Math.round(x * 1e6)) }, { label: '2025', data: [1.41, 1.38, 1.5, 1.52, 1.6, 1.66, 1.63, 1.7, 1.74, 1.82, 1.85, 1.94].map((x) => Math.round(x * 1e6)) }], { format: (v) => U.money(v, 0), axisFormat: (v) => '$' + (v / 1e6).toFixed(1) + 'M' });
          const types = Object.keys(LX.data.VTYPES);
          LX.charts.bar('adUtil', types.map((t) => t.replace(' Delivery Vehicle', ' EV').replace(' Truck', '')), [{ label: 'Utilization', data: types.map((t) => { const v = vs.filter((x) => x.type === t); return Math.round(v.reduce((a, x) => a + x.utilization, 0) / (v.length || 1)); }) }], { format: (v) => v + '%', extend: (o) => { o.scales.y.max = 100; } });
          LX.charts.line('adCust', m12, [{ label: 'Active customers', data: [1840, 1880, 1930, 1990, 2040, 2090, 2150, 2200, 2260, 2310, 2360, 2412], fill: true }], { format: (v) => U.num(v) + ' accounts', extend: (o) => { o.scales.y.beginAtZero = false; } });
          LX.charts.bar('adRegion', ['North America', 'Europe', 'Middle East', 'Asia-Pacific', 'LatAm', 'Africa'], [{ label: 'Shipments', data: [14820, 3960, 1210, 2440, 690, 380] }], { horizontal: true, format: (v) => U.num(v) + ' shipments', axisFormat: (v) => U.compact(v) });
          const feed = el.querySelector('#adFeed');
          const events = () => { const s = sh[Math.floor(Math.random() * sh.length)]; return [[I('package'), 'Shipment ' + s.id + ' scanned at ' + s.currentLocation.split(',')[0]], [I('check-circle'), 'POD captured for ' + s.id], [I('receipt'), 'Invoice ' + allInvoices()[Math.floor(Math.random() * 8)].id + ' issued'], [I('truck'), LX.fleet.all()[Math.floor(Math.random() * 20)].id + ' departed terminal'], [I('user'), 'New portal login from ' + LX.data.customers[Math.floor(Math.random() * 12)]]][Math.floor(Math.random() * 5)]; };
          const add = (t) => { const e = events(); feed.insertAdjacentHTML('afterbegin', '<div class="af-item"><span class="icon-box sm">' + e[0] + '</span><div style="flex:1">' + e[1] + '</div><time>' + U.time(t || new Date()) + '</time></div>'); if (feed.children.length > 8) feed.lastElementChild.remove(); };
          for (let i = 6; i > 0; i--) add(new Date(Date.now() - i * 95000));
          setInterval(() => add(), 4500);
        },
        shipments(el) {
          el.innerHTML = H.head('Shipments', 'All shipments across customers and modes.', '<button class="btn btn-ghost btn-sm" data-exp>' + I('download') + 'CSV</button><a class="btn btn-sm" href="book-shipment.html">' + I('plus') + 'Create</a>') + '<div class="card" id="asTable"></div>';
          const t = H.table(el.querySelector('#asTable'), {
            rows: () => LX.sim.all().filter((s) => !(LX.store.get('deletedShipments', [])).includes(s.id)), pageSize: 10, searchKeys: ['id', 'customer', 'from', 'to', 'cargo', 'driverName'], placeholder: 'Search shipments…',
            filters: [{ label: 'Status', key: 'status', options: ['Booked', 'Picked Up', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Delayed'] }, { label: 'Mode', key: 'mode', options: ['road', 'air', 'ocean', 'rail'] }],
            cols: [
              { label: 'ID', render: (s) => '<a class="mono cell-main" href="shipment-details.html?id=' + s.id + '">' + s.id + '</a>', sort: (s) => s.id },
              { label: 'Customer', render: (s) => s.customer, sort: (s) => s.customer }, { label: 'Route', render: (s) => s.from + ' → ' + s.to, sort: (s) => s.from },
              { label: 'Mode', render: (s) => s.mode, sort: (s) => s.mode }, { label: 'Status', render: (s) => H.badge(s.status), sort: (s) => s.progress },
              { label: 'Progress', render: (s) => '<div class="progress" style="min-width:80px"><span style="width:' + Math.round(s.progress * 100) + '%"></span></div>', sort: (s) => s.progress },
              { label: 'Value', render: (s) => U.money(s.cost, 0), sort: (s) => s.cost },
              { label: '', render: (s) => '<div class="table-actions"><a class="btn btn-ghost btn-xs" href="tracking.html?id=' + s.id + '" aria-label="Track ' + s.id + '">' + I('map') + '</a>' + (s.progress < 1 ? '<button class="btn btn-ghost btn-xs" data-advance="' + s.id + '" aria-label="Advance status of ' + s.id + '">' + I('arrow-right') + '</button>' : '') + '<button class="btn btn-ghost btn-xs" data-del="' + s.id + '" aria-label="Archive ' + s.id + '">' + I('trash') + '</button></div>' }
            ]
          });
          el.addEventListener('click', (e) => {
            const a = e.target.closest('[data-advance]');
            if (a) { const s = LX.sim.find(a.dataset.advance); const next = LX.sim.STEPS.find((st) => st.at > s.progress + 0.001); LX.sim.advance(s.id, (next ? next.at : 1) - s.progress + 0.0001); t.refresh(); LX.toast('Status advanced', s.id + ' → ' + LX.sim.find(s.id).status, 'success', 2000); }
            const d = e.target.closest('[data-del]');
            if (d) LX.modal.confirm('Archive shipment?', d.dataset.del + ' will be hidden from the admin list.', () => { const l = LX.store.get('deletedShipments', []); l.push(d.dataset.del); LX.store.set('deletedShipments', l); t.refresh(); LX.toast('Shipment archived', d.dataset.del, 'success', 2000); }, 'Archive');
          });
          el.querySelector('[data-exp]').onclick = () => H.csv('shipments.csv', [['ID', 'id'], ['Customer', 'customer'], ['From', 'from'], ['To', 'to'], ['Mode', 'mode'], ['Status', 'status'], ['Weight', 'weight'], ['Value', 'cost']], LX.sim.all());
        },
        customers(el) {
          el.innerHTML = H.head('Customers', 'Shipper accounts and lifetime value.', '<button class="btn btn-sm" data-addc>' + I('plus') + 'Add customer</button>') + '<div class="card" id="acTable"></div>';
          const extra = () => LX.store.get('extraCustomers', []);
          const t = H.table(el.querySelector('#acTable'), {
            rows: () => customers().concat(extra()), searchKeys: ['name', 'contact', 'email', 'id'], filters: [{ label: 'Plan', key: 'plan', options: ['Local', 'Business', 'Enterprise', 'Global'] }, { label: 'Status', key: 'status', options: ['Active', 'Pending'] }],
            cols: [{ label: 'Customer', render: (c) => '<div class="table-user"><span class="avatar avatar-initials avatar-sm">' + U.initials(c.name) + '</span><div><div class="cell-main">' + c.name + '</div><div class="cell-sub">' + c.id + ' · since ' + c.since + '</div></div></div>', sort: (c) => c.name }, { label: 'Contact', render: (c) => c.contact + '<div class="cell-sub">' + c.email + '</div>', sort: (c) => c.contact }, { label: 'Plan', render: (c) => '<span class="badge badge-primary no-dot">' + c.plan + '</span>', sort: (c) => c.plan }, { label: 'Shipments', render: (c) => U.num(c.shipments), sort: (c) => c.shipments }, { label: 'Lifetime spend', render: (c) => U.money(c.spend, 0), sort: (c) => c.spend }, { label: 'Status', render: (c) => H.badge(c.status), sort: (c) => c.status }]
          });
          el.querySelector('[data-addc]').onclick = () => {
            const m = LX.modal.show('<h3>Add customer</h3><form id="cForm" class="stack mt-2" novalidate><div class="field"><label for="ncName">Company</label><input id="ncName" class="input" name="name" required><span class="field-error"></span></div><div class="field"><label for="ncContact">Contact name</label><input id="ncContact" class="input" name="contact" required><span class="field-error"></span></div><div class="field"><label for="ncEmail">Email</label><input id="ncEmail" class="input" type="email" name="email" required><span class="field-error"></span></div><div class="field"><label for="ncPlan">Plan</label><select id="ncPlan" class="select" name="plan"><option>Local</option><option selected>Business</option><option>Enterprise</option><option>Global</option></select></div><button class="btn" type="submit">' + I('check') + 'Create customer</button></form>', { label: 'Add customer' });
            m.querySelector('#cForm').onsubmit = (e) => { e.preventDefault(); if (!LX.validate(e.target)) return; const f = e.target; const l = extra(); l.push({ id: 'CUS-' + (2200 + l.length), name: f.name.value, contact: f.contact.value, email: f.email.value, plan: f.plan.value, shipments: 0, spend: 0, status: 'Pending', since: new Date().getFullYear() }); LX.store.set('extraCustomers', l); LX.modal.close(m); t.refresh(); LX.toast('Customer created', f.name.value + ' will receive an onboarding email.', 'success'); };
          };
        },
        drivers: F.drivers, vehicles: F.vehicles, routes: F.routes, reports: F.reports, analytics: F.analytics,
        fleet(el) {
          el.innerHTML = '<div id="fleetWrap"></div>';
          F.dashboard(el.querySelector('#fleetWrap'));
        },
        warehouses(el) {
          el.innerHTML = H.head('Warehouses', 'Capacity and throughput across the network.') + '<div class="card" id="awTable"></div>';
          H.table(el.querySelector('#awTable'), {
            rows: LX.data.warehouses, searchKeys: ['name', 'city', 'type', 'id'], filters: [{ label: 'Type', key: 'type', options: Array.from(new Set(LX.data.warehouses.map((w) => w.type))) }],
            cols: [{ label: 'Facility', render: (w) => '<div class="cell-main">' + w.name + '</div><div class="cell-sub">' + w.id + ' · ' + w.type + '</div>', sort: (w) => w.name }, { label: 'City', render: (w) => w.city, sort: (w) => w.city }, { label: 'Sq ft', render: (w) => U.num(w.sqft), sort: (w) => w.sqft }, { label: 'Occupancy', render: (w) => '<div class="flex"><div class="progress ' + (w.occupancy > 85 ? 'danger' : w.occupancy > 75 ? 'warning' : 'success') + '" style="min-width:90px;flex:1"><span style="width:' + w.occupancy + '%"></span></div><strong class="small">' + w.occupancy + '%</strong></div>', sort: (w) => w.occupancy }, { label: 'Pending orders', render: (w) => U.num(w.orders), sort: (w) => w.orders }, { label: 'In / Out', render: (w) => w.inbound + ' / ' + w.outbound, sort: (w) => w.inbound }]
          });
        },
        orders(el) {
          el.innerHTML = H.head('Orders', 'Customer orders received through EDI, API, portal and storefronts.') + '<div class="card" id="aoTable"></div>';
          H.table(el.querySelector('#aoTable'), {
            rows: orders(), pageSize: 10, searchKeys: ['id', 'customer', 'channel'], filters: [{ label: 'Status', key: 'status', options: ['Pending', 'Processing', 'Scheduled', 'In Transit', 'Delivered'] }, { label: 'Channel', key: 'channel', options: ['EDI', 'API', 'Portal', 'Shopify'] }],
            cols: [{ label: 'Order', render: (o) => '<span class="mono cell-main">' + o.id + '</span>', sort: (o) => o.id }, { label: 'Customer', render: (o) => o.customer, sort: (o) => o.customer }, { label: 'Items', render: (o) => o.items, sort: (o) => o.items }, { label: 'Value', render: (o) => U.money(o.value, 0), sort: (o) => o.value }, { label: 'Channel', render: (o) => '<span class="chip" style="padding:4px 10px">' + o.channel + '</span>', sort: (o) => o.channel }, { label: 'Date', render: (o) => U.dateShort(o.date), sort: (o) => o.date }, { label: 'Status', render: (o) => H.badge(o.status), sort: (o) => o.status }]
          });
        },
        invoices(el) {
          const draw = () => t.refresh();
          el.innerHTML = H.head('Invoices', 'Issue, send and reconcile invoices.', '<button class="btn btn-ghost btn-sm" data-exp>' + I('download') + 'CSV</button>') + '<div class="card" id="aiTable"></div>';
          const t = H.table(el.querySelector('#aiTable'), {
            rows: () => allInvoices(), pageSize: 10, searchKeys: ['id', 'customer', 'shipment', 'service'], filters: [{ label: 'Status', key: 'status', options: ['Paid', 'Pending', 'Overdue'] }],
            cols: [{ label: 'Invoice', render: (i) => '<a class="mono cell-main" href="invoice.html?id=' + i.id + '">' + i.id + '</a>', sort: (i) => i.id }, { label: 'Customer', render: (i) => i.customer, sort: (i) => i.customer }, { label: 'Shipment', render: (i) => '<span class="mono">' + i.shipment + '</span>', sort: (i) => i.shipment }, { label: 'Due', render: (i) => U.dateShort(i.due), sort: (i) => new Date(i.due).getTime() }, { label: 'Total', render: (i) => '<strong>' + U.money(i.total) + '</strong>', sort: (i) => i.total }, { label: 'Status', render: (i) => H.badge(i.status), sort: (i) => i.status },
              { label: '', render: (i) => '<div class="table-actions">' + (i.status !== 'Paid' ? '<button class="btn btn-success btn-xs" data-paid="' + i.id + '">Mark paid</button>' : '') + '<button class="btn btn-ghost btn-xs" data-send="' + i.id + '" aria-label="Send ' + i.id + '">' + I('send') + '</button></div>' }]
          });
          el.addEventListener('click', (e) => {
            const p = e.target.closest('[data-paid]');
            if (p) { const l = LX.store.get('paidInvoices', []); l.push(p.dataset.paid); LX.store.set('paidInvoices', l); draw(); LX.toast('Payment recorded', p.dataset.paid + ' marked as paid.', 'success'); }
            const s = e.target.closest('[data-send]');
            if (s) LX.toast('Invoice sent', s.dataset.send + ' emailed to the billing contact.', 'success');
          });
          el.querySelector('[data-exp]').onclick = () => H.csv('invoices.csv', [['Invoice', 'id'], ['Customer', 'customer'], ['Shipment', 'shipment'], ['Date', (i) => U.date(i.date)], ['Due', (i) => U.date(i.due)], ['Total', 'total'], ['Status', 'status']], allInvoices());
        },
        payments(el) {
          const p = payments();
          el.innerHTML = H.head('Payments', 'Settled payments and cash collection.') +
            '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + H.kpi('wallet', 'success', 'Collected (30 days)', U.money(p.reduce((a, x) => a + x.amount, 0) + 1860000, 0), H.trend(true, '7.1%')) + H.kpi('clock', 'accent', 'Days sales outstanding', '31.4', 'Target ≤ 35') + H.kpi('alert', 'danger', 'Overdue', U.money(allInvoices().filter((i) => i.status === 'Overdue').reduce((a, i) => a + i.total, 0), 0), 'Follow-up scheduled') + '</div>' +
            '<div class="dgrid g-2-1"><div class="card" id="apTable"></div><div class="card"><div class="card-head"><div><h3 class="h3">Payment methods</h3><span class="xs muted">Share of value, 30 days</span></div></div><div class="chart-box"><canvas id="apMethods" role="img" aria-label="Doughnut chart of payment methods"></canvas></div></div></div>';
          H.table(el.querySelector('#apTable'), { rows: p, searchKeys: ['id', 'invoice', 'customer', 'method'], filters: [{ label: 'Method', key: 'method', options: ['ACH', 'Card', 'Wire', 'Wallet'] }], cols: [{ label: 'Payment', render: (x) => '<span class="mono cell-main">' + x.id + '</span>', sort: (x) => x.id }, { label: 'Invoice', render: (x) => '<a class="mono" href="invoice.html?id=' + x.invoice + '">' + x.invoice + '</a>', sort: (x) => x.invoice }, { label: 'Customer', render: (x) => x.customer, sort: (x) => x.customer }, { label: 'Method', render: (x) => x.method, sort: (x) => x.method }, { label: 'Date', render: (x) => U.dateShort(x.date), sort: (x) => x.date }, { label: 'Amount', render: (x) => '<strong>' + U.money(x.amount) + '</strong>', sort: (x) => x.amount }, { label: 'Status', render: (x) => H.badge('Paid'), sort: (x) => x.status }] });
          LX.charts.doughnut('apMethods', ['ACH', 'Card', 'Wire', 'Wallet'], [{ data: [48, 22, 24, 6] }], { format: (v) => v + '%' });
        },
        services(el) {
          const draw = () => {
            const st = state();
            el.innerHTML = H.head('Services', 'Enable or pause services shown on the website and booking flow.') + '<div class="dgrid g-3">' + LX.data.services.map((s) => { const on = st.services[s.slug] !== false; return '<div class="card"><div class="flex-between"><span class="icon-box">' + I(s.icon) + '</span><label class="switch"><input type="checkbox" data-svc="' + s.slug + '"' + (on ? ' checked' : '') + ' aria-label="Enable ' + s.title + '"><span class="track"></span></label></div><h3 class="h3 mt-2">' + s.title + '</h3><p class="small mt-1">' + s.text + '</p><div class="flex mt-2">' + H.badge(on ? 'Active' : 'Offline') + '<span class="xs muted">' + s.time + '</span></div></div>'; }).join('') + '</div>';
          };
          draw();
          el.addEventListener('change', (e) => { const i = e.target.closest('[data-svc]'); if (!i) return; const st = state(); st.services[i.dataset.svc] = i.checked; saveState(st); draw(); LX.toast('Service ' + (i.checked ? 'enabled' : 'paused'), LX.data.services.find((s) => s.slug === i.dataset.svc).title, 'success', 2000); });
        },
        pricing(el) {
          const st = state();
          el.innerHTML = H.head('Pricing', 'Plan prices and lane surcharges.') +
            '<div class="dgrid g-1-1"><form class="card" id="planForm"><h3 class="h3 mb-2">Plan prices (USD / month)</h3><div class="form-grid">' + LX.data.pricingPlans.filter((p) => p.monthly).map((p) => '<div class="field"><label for="pm' + p.id + '">' + p.name + ' · monthly</label><input id="pm' + p.id + '" class="input" type="number" min="0" name="' + p.id + '_m" value="' + ((st.prices[p.id] || {}).m || p.monthly) + '"></div><div class="field"><label for="py' + p.id + '">' + p.name + ' · yearly</label><input id="py' + p.id + '" class="input" type="number" min="0" name="' + p.id + '_y" value="' + ((st.prices[p.id] || {}).y || p.yearly) + '"></div>').join('') + '</div><button class="btn mt-3" type="submit">' + I('check') + 'Save prices</button></form>' +
            '<div class="card"><h3 class="h3 mb-2">Surcharges</h3><div class="list-rows">' + [['Road fuel surcharge', '14%'], ['Air fuel surcharge', '18%'], ['Ocean bunker adjustment', '11%'], ['Rail fuel surcharge', '9%'], ['Sales tax', '8%'], ['Insurance rate', '0.6% of value'], ['Express multiplier', '×1.35'], ['Same-day multiplier', '×1.75']].map((x) => '<div><span class="icon-box sm">' + I('percent') + '</span><div class="grow"><strong>' + x[0] + '</strong></div><span class="badge badge-primary no-dot">' + x[1] + '</span></div>').join('') + '</div><p class="xs muted mt-2">Surcharges feed the live pricing engine used by the calculator and booking flow.</p></div></div>';
          el.querySelector('#planForm').onsubmit = (e) => { e.preventDefault(); const s2 = state(); LX.data.pricingPlans.filter((p) => p.monthly).forEach((p) => { s2.prices[p.id] = { m: +e.target[p.id + '_m'].value, y: +e.target[p.id + '_y'].value }; }); saveState(s2); LX.toast('Prices saved', 'Plan prices updated for new subscriptions.', 'success'); };
        },
        blog(el) {
          const posts = () => state().posts.concat(LX.data.blogPosts.map((p) => Object.assign({ status: 'Published' }, p)));
          el.innerHTML = H.head('Blog', 'Manage articles on the Insights blog.', '<button class="btn btn-sm" data-newpost>' + I('plus') + 'New article</button>') + '<div class="card" id="abTable"></div>';
          const t = H.table(el.querySelector('#abTable'), { rows: posts, searchKeys: ['title', 'author', 'category'], filters: [{ label: 'Status', key: 'status', options: ['Published', 'Draft'] }], cols: [{ label: 'Title', render: (p) => '<div class="cell-main">' + p.title + '</div><div class="cell-sub">' + p.category + '</div>', sort: (p) => p.title }, { label: 'Author', render: (p) => p.author, sort: (p) => p.author }, { label: 'Date', render: (p) => U.dateShort(p.date + 'T12:00'), sort: (p) => p.date }, { label: 'Status', render: (p) => H.badge(p.status === 'Draft' ? 'Pending' : 'Active').replace(/>(Pending|Active)</, '>' + p.status + '<'), sort: (p) => p.status }, { label: '', render: (p) => (p.slug ? '<a class="btn btn-ghost btn-xs" href="blog-details.html?post=' + p.slug + '">View</a>' : '') }] });
          el.querySelector('[data-newpost]').onclick = () => {
            const m = LX.modal.show('<h3>New article</h3><form id="postForm" class="stack mt-2" novalidate><div class="field"><label for="npTitle">Title</label><input id="npTitle" class="input" name="title" required><span class="field-error"></span></div><div class="field"><label for="npCat">Category</label><select id="npCat" class="select" name="category"><option>Logistics</option><option>Transportation</option><option>Supply Chain</option><option>Technology</option><option>Sustainability</option><option>Industry News</option></select></div><div class="field"><label for="npBody">Summary</label><textarea id="npBody" class="textarea" name="excerpt" required></textarea><span class="field-error"></span></div><button class="btn" type="submit">' + I('check') + 'Save as draft</button></form>', { size: 'lg', label: 'New article' });
            m.querySelector('#postForm').onsubmit = (e) => { e.preventDefault(); if (!LX.validate(e.target)) return; const s2 = state(); s2.posts.unshift({ title: e.target.title.value, category: e.target.category.value, excerpt: e.target.excerpt.value, author: 'Admin', date: U.iso(new Date()), status: 'Draft' }); saveState(s2); LX.modal.close(m); t.refresh(); LX.toast('Draft saved', e.target.title.value, 'success'); };
          };
        },
        users(el) {
          const roles = ['customer', 'business', 'driver', 'fleet', 'admin'];
          el.innerHTML = H.head('Users', 'Portal accounts and roles (stored in this browser).') + '<div class="card" id="auTable"></div>';
          const t = H.table(el.querySelector('#auTable'), {
            rows: () => LX.store.get('users', []), searchKeys: ['name', 'email', 'company', 'role'], filters: [{ label: 'Role', key: 'role', options: roles }],
            cols: [{ label: 'User', render: (u) => '<div class="table-user"><span class="avatar avatar-initials avatar-sm">' + U.initials(u.name) + '</span><div><div class="cell-main">' + U.esc(u.name) + '</div><div class="cell-sub">' + U.esc(u.email) + '</div></div></div>', sort: (u) => u.name }, { label: 'Company', render: (u) => U.esc(u.company || '—'), sort: (u) => u.company || '' },
              { label: 'Role', render: (u) => '<label class="sr-only" for="ur' + U.slug(u.email) + '">Role</label><select class="select" id="ur' + U.slug(u.email) + '" data-role-of="' + U.esc(u.email) + '" style="min-height:36px;padding:6px 34px 6px 10px;font-size:.8rem">' + roles.map((r) => '<option' + (r === u.role ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>', sort: (u) => u.role },
              { label: 'Created', render: (u) => (u.createdAt ? U.dateShort(u.createdAt) : 'Seed account'), sort: (u) => u.createdAt || 0 }, { label: '', render: (u) => (u.email.endsWith('@northlane.io') ? '<span class="xs muted">Demo</span>' : '<button class="btn btn-ghost btn-xs" data-deluser="' + U.esc(u.email) + '" aria-label="Delete user">' + I('trash') + '</button>') }]
          });
          el.addEventListener('change', (e) => { const s = e.target.closest('[data-role-of]'); if (!s) return; const l = LX.store.get('users', []); const u = l.find((x) => x.email === s.dataset.roleOf); if (u) { u.role = s.value; LX.store.set('users', l); LX.toast('Role updated', u.email + ' is now ' + s.value + '.', 'success', 2000); } });
          el.addEventListener('click', (e) => { const d = e.target.closest('[data-deluser]'); if (d) LX.modal.confirm('Delete user?', d.dataset.deluser + ' will lose portal access.', () => { LX.store.set('users', LX.store.get('users', []).filter((u) => u.email !== d.dataset.deluser)); t.refresh(); LX.toast('User deleted', '', 'success', 1800); }, 'Delete'); });
        },
        notifications(el) {
          D.common.notifications(el);
          el.insertAdjacentHTML('beforeend', '<form class="card mt-3" id="bcForm" novalidate><h3 class="h3 mb-2">Broadcast a notification</h3><div class="form-grid"><div class="field"><label for="bcTitle">Title</label><input id="bcTitle" class="input" name="title" required><span class="field-error"></span></div><div class="field"><label for="bcType">Type</label><select id="bcType" class="select" name="type"><option value="info">Information</option><option value="warning">Service alert</option><option value="success">Good news</option></select></div><div class="field full"><label for="bcMsg">Message</label><textarea id="bcMsg" class="textarea" name="msg" required style="min-height:90px"></textarea><span class="field-error"></span></div></div><button class="btn mt-2" type="submit">' + I('send') + 'Send to all users</button></form>');
          el.querySelector('#bcForm').onsubmit = (e) => { e.preventDefault(); if (!LX.validate(e.target)) return; LX.notify.add(e.target.title.value, e.target.msg.value, e.target.type.value); e.target.reset(); LX.toast('Broadcast sent', 'Delivered to 2,412 active accounts.', 'success'); };
        },
        settings(el) {
          const s = LX.store.get('companySettings', { name: 'NorthLane Logistics, Inc.', email: 'dispatch@northlane.io', phone: '+1 (800) 555-0148', currency: 'USD', tz: 'America/Chicago', tax: 8 });
          el.innerHTML = '<form class="card mb-3" id="coForm" novalidate><h3 class="h3 mb-2">Company settings</h3><div class="form-grid"><div class="field"><label for="coName">Legal name</label><input id="coName" class="input" name="name" value="' + U.esc(s.name) + '" required><span class="field-error"></span></div><div class="field"><label for="coEmail">Support email</label><input id="coEmail" class="input" type="email" name="email" value="' + U.esc(s.email) + '" required><span class="field-error"></span></div><div class="field"><label for="coPhone">Support phone</label><input id="coPhone" class="input" type="tel" name="phone" value="' + U.esc(s.phone) + '"></div><div class="field"><label for="coCur">Currency</label><select id="coCur" class="select" name="currency"><option' + (s.currency === 'USD' ? ' selected' : '') + '>USD</option><option' + (s.currency === 'EUR' ? ' selected' : '') + '>EUR</option><option' + (s.currency === 'GBP' ? ' selected' : '') + '>GBP</option></select></div><div class="field"><label for="coTz">Time zone</label><select id="coTz" class="select" name="tz"><option>America/Chicago</option><option>America/New_York</option><option>Europe/Amsterdam</option><option>Asia/Dubai</option><option>Asia/Singapore</option></select></div><div class="field"><label for="coTax">Default tax rate (%)</label><input id="coTax" class="input" type="number" name="tax" min="0" max="30" step="0.5" value="' + s.tax + '"></div></div><button class="btn mt-3" type="submit">' + I('check') + 'Save settings</button></form><div id="prefWrap"></div>';
          el.querySelector('#coTz').value = s.tz;
          el.querySelector('#coForm').onsubmit = (e) => { e.preventDefault(); if (!LX.validate(e.target)) return; const f = e.target; LX.store.set('companySettings', { name: f.name.value, email: f.email.value, phone: f.phone.value, currency: f.currency.value, tz: f.tz.value, tax: +f.tax.value }); LX.toast('Settings saved', 'Company settings updated.', 'success'); };
          D.common.settings(el.querySelector('#prefWrap'));
        }
      }
    });
    D.boot();
  });
})();
