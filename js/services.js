/* ==========================================================================
   NorthLane Logistics — Service page widgets
   Road lane map · air flight visual & board · ocean container tracker ·
   warehouse dashboard · last-mile delivery simulation · express countdown
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Road: US lane map with moving trucks ---------- */
  function roadMap() {
    const el = document.getElementById('roadMap');
    if (!el) return;
    LX.onVisible([el], () => {
      const map = LX.maps.create(el, { center: [38.5, -96], zoom: 4 });
      if (!map) return;
      const lanes = [['Seattle', 'Denver'], ['Los Angeles', 'Phoenix'], ['Phoenix', 'Dallas'], ['Denver', 'Kansas City'], ['Kansas City', 'Chicago'], ['Dallas', 'Houston'], ['Dallas', 'Memphis'], ['Memphis', 'Nashville'], ['Nashville', 'Atlanta'], ['Chicago', 'New York'], ['Atlanta', 'Miami'], ['Atlanta', 'New York'], ['Chicago', 'Toronto'], ['Los Angeles', 'Seattle'], ['Houston', 'Atlanta'], ['St. Louis', 'Chicago'], ['Oklahoma City', 'Dallas']];
      const movers = [];
      lanes.forEach(([a, b], i) => {
        const A = LX.geo.find(a), B = LX.geo.find(b);
        const pts = LX.geo.route([A.lat, A.lng], [B.lat, B.lng], { mode: 'road', points: 60 });
        LX.maps.line(pts, i % 4 === 0 ? '#FFB000' : '#00AEEF', { weight: 2.5, opacity: 0.55 }).addTo(map);
        movers.push({ pts, t: (i * 0.23) % 1, dir: i % 2 ? -1 : 1, m: LX.maps.vehicle(pts[0], 'truck', 'sm' + (i % 4 === 0 ? '' : ' blue')).addTo(map) });
      });
      ['Chicago', 'Dallas', 'Atlanta', 'Los Angeles', 'New York', 'Denver', 'Memphis', 'Seattle', 'Miami', 'Houston', 'Phoenix', 'Kansas City', 'Nashville', 'Toronto', 'St. Louis', 'Oklahoma City'].forEach((c) => {
        const x = LX.geo.find(c);
        LX.maps.pin([x.lat, x.lng], ['Chicago', 'Dallas', 'Atlanta', 'Los Angeles'].includes(c) ? 'dest' : 'hub', c).addTo(map).bindPopup('<strong>' + c + '</strong><br>' + (['Chicago', 'Dallas', 'Atlanta', 'Los Angeles'].includes(c) ? 'Regional hub' : 'Terminal'));
      });
      if (reduce) return;
      setInterval(() => movers.forEach((mv) => { mv.t = (mv.t + 0.004 * mv.dir + 1) % 1; LX.maps.glide(mv.m, LX.geo.pointAt(mv.pts, mv.t).latlng, 1400); }), 1500);
    }, { threshold: 0.1 });
  }

  /* ---------- Air: flight visual (SVG) + live board ---------- */
  const AIRPORTS = [['ORD', 'Chicago'], ['JFK', 'New York'], ['LAX', 'Los Angeles'], ['MIA', 'Miami'], ['LHR', 'London'], ['FRA', 'Frankfurt'], ['DXB', 'Dubai'], ['BOM', 'Mumbai'], ['SIN', 'Singapore'], ['PVG', 'Shanghai'], ['NRT', 'Tokyo'], ['SYD', 'Sydney'], ['GRU', 'São Paulo'], ['MEX', 'Mexico City'], ['JNB', 'Johannesburg']];
  function flightViz() {
    const svg = document.getElementById('flightSvg');
    if (!svg) return;
    const W = 1000, H = 440;
    const proj = (c) => [30 + ((c.lng + 130) / 290) * (W - 90), 70 + ((62 - c.lat) / 100) * (H - 110)];
    const P = {};
    AIRPORTS.forEach(([code, city]) => (P[code] = proj(LX.geo.find(city))));
    const routes = [['ORD', 'LHR'], ['JFK', 'FRA'], ['LAX', 'NRT'], ['LAX', 'PVG'], ['FRA', 'DXB'], ['DXB', 'SIN'], ['DXB', 'BOM'], ['SIN', 'SYD'], ['LHR', 'JNB'], ['MIA', 'GRU'], ['ORD', 'MEX'], ['FRA', 'PVG'], ['NRT', 'SYD'], ['JFK', 'LHR']];
    const hubs = ['ORD', 'FRA', 'DXB', 'SIN'];
    let defs = '', arcs = '', planes = '', apts = '';
    routes.forEach(([a, b], i) => {
      const [x1, y1] = P[a], [x2, y2] = P[b];
      const lift = Math.min(90, Math.hypot(x2 - x1, y2 - y1) * 0.22);
      const d = 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' Q' + ((x1 + x2) / 2).toFixed(1) + ',' + (Math.min(y1, y2) - lift).toFixed(1) + ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);
      defs += '<path id="fa' + i + '" d="' + d + '"/>';
      arcs += '<use href="#fa' + i + '" class="arc' + (i % 3 === 0 ? ' gold' : '') + '"/>';
      planes += '<g class="plane"><path d="M0,-2 L10,0 L0,2 L2,0 Z M3,-1 L1,-6 L3,-6 L6,-1 Z M3,1 L1,6 L3,6 L6,1 Z" transform="translate(-5,0)"/><animateMotion dur="' + (7 + (i % 5) * 1.6) + 's" repeatCount="indefinite" rotate="auto" begin="-' + (i * 0.9).toFixed(1) + 's"><mpath href="#fa' + i + '"/></animateMotion></g>';
    });
    AIRPORTS.forEach(([code, city]) => {
      const [x, y] = P[code];
      const hub = hubs.includes(code);
      apts += '<g class="apt' + (hub ? ' hub' : '') + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (hub ? 7 : 5) + '"/>' + (hub ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="12" fill="none" stroke="#FFB000" stroke-opacity=".4"><animate attributeName="r" values="8;16;8" dur="2.6s" repeatCount="indefinite"/></circle>' : '') + '<text x="' + (x + 10).toFixed(1) + '" y="' + (y + 4).toFixed(1) + '">' + code + '</text><text class="city" x="' + (x + 10).toFixed(1) + '" y="' + (y + 16).toFixed(1) + '">' + city + '</text></g>';
    });
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = '<defs>' + defs + '<pattern id="fvDots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="rgba(145,164,181,.14)"/></pattern></defs><rect width="100%" height="100%" fill="url(#fvDots)"/>' + arcs + apts + planes;
  }

  function flightBoard() {
    const body = document.getElementById('flightBoard');
    if (!body) return;
    const now = Date.now();
    const flights = [
      ['NL 482', 'FRA', 'DXB', 'B777F', 0.66, 'Automotive components'], ['NL 219', 'SIN', 'LHR', 'B747-8F', 0.12, 'Medical devices'],
      ['NL 604', 'NRT', 'SYD', 'A350F', 0.88, 'Diagnostic equipment'], ['NL 377', 'MIA', 'MEX', 'B767F', 0.3, 'E-commerce parcels'],
      ['NL 118', 'ORD', 'LHR', 'B777F', 0.02, 'Pharmaceuticals'], ['NL 745', 'LAX', 'PVG', 'B747-8F', 0.51, 'Semiconductors'],
      ['NL 530', 'DXB', 'BOM', 'A330-200F', 1, 'Textiles'], ['NL 902', 'JFK', 'FRA', 'B767F', 0.74, 'Luxury goods']
    ].map((f) => ({ no: f[0], from: f[1], to: f[2], ac: f[3], p: f[4], cargo: f[5], dur: 6 + (U.hash(f[0]) % 8) }));
    const status = (p) => p >= 1 ? ['Landed', 'badge-delivered'] : p < 0.05 ? ['Boarding', 'badge-pending'] : p > 0.9 ? ['Descending', 'badge-out-for-delivery'] : ['In Flight', 'badge-transit'];
    const render = () => {
      body.innerHTML = flights.map((f) => {
        const [st, cls] = status(f.p);
        const eta = new Date(now + (1 - f.p) * f.dur * 3600000 + (Date.now() - now));
        return '<tr><td><span class="code">' + f.no + '</span><div class="cell-sub">' + f.ac + '</div></td><td><span class="code">' + f.from + '</span><div class="cell-sub">' + AIRPORTS.find((a) => a[0] === f.from)[1] + '</div></td><td><span class="code">' + f.to + '</span><div class="cell-sub">' + AIRPORTS.find((a) => a[0] === f.to)[1] + '</div></td><td>' + f.cargo + '</td><td style="min-width:140px"><div class="progress"><span style="width:' + Math.round(f.p * 100) + '%"></span></div></td><td>' + (f.p >= 1 ? '—' : U.time(eta)) + '</td><td><span class="badge ' + cls + (st === 'Boarding' ? ' blink' : '') + '">' + st + '</span></td></tr>';
      }).join('');
    };
    render();
    if (!reduce) setInterval(() => { flights.forEach((f) => { if (f.p < 1) f.p = Math.min(1, f.p + 0.004 + Math.random() * 0.004); }); render(); }, 3000);
  }

  /* ---------- Live status card for one shipment (air / ocean pages) ---------- */
  function liveCard() {
    const el = document.querySelector('[data-live-card]');
    if (!el) return;
    const id = el.dataset.liveCard;
    const s = LX.sim.find(id);
    if (!s) return;
    el.innerHTML =
      '<div class="card-head"><div><span class="xs muted">Live shipment</span><h3 class="mono">' + s.id + '</h3></div><span class="badge ' + LX.tracking.statusClass(s.status) + '" data-live="status">' + s.status + '</span></div>' +
      '<div class="tp-route" style="margin:0 0 16px"><div><span class="xs muted">From</span><strong>' + s.fromLabel + '</strong></div>' + I('arrow-right') + '<div><span class="xs muted">To</span><strong>' + s.toLabel + '</strong></div></div>' +
      '<div class="progress-label"><span>' + U.esc(s.vehicle) + '</span><strong data-live="pctNum"></strong></div><div class="progress progress-lg striped"><span data-live="bar"></span></div>' +
      '<div class="kv mt-3"><div><span>Estimated Arrival</span><strong data-live="eta"></strong></div><div><span>Remaining</span><strong data-live="remaining"></strong></div><div><span>Position</span><strong data-live="location"></strong></div><div><span>Cargo</span><strong>' + U.esc(s.cargo) + ' · ' + U.num(s.weight) + ' kg</strong></div></div>' +
      '<div class="flex mt-3 flex-wrap"><span class="live-pill"><span class="live-dot"></span>Live</span><span class="xs muted" data-live="updated"></span><a class="link-arrow" style="margin-left:auto" href="tracking.html?id=' + s.id + '">Track ' + I('arrow-right') + '</a></div>';
    LX.tracking.updateLive(el, s);
    LX.tracking.liveLoop(id, (x) => LX.tracking.updateLive(el, x), 0.003);
  }

  /* ---------- Ocean: container tracker ---------- */
  const CONTAINERS = [
    { id: 'NLMU 482193-7', vessel: 'MV NorthLane Meridian', imo: 'IMO 9811024', type: "40' High Cube", from: 'Shanghai', fromPort: 'Port of Shanghai (CNSHA)', to: 'Los Angeles', toPort: 'Port of Los Angeles (USLAX)', dep: -9, arr: 7, p: 0.47, status: 'In Transit · Pacific Ocean', shipment: 'TRK-2026-38210' },
    { id: 'NLMU 330418-2', vessel: 'MV Atlantic Crest', imo: 'IMO 9774513', type: "20' Dry", from: 'Rotterdam', fromPort: 'Port of Rotterdam (NLRTM)', to: 'New York', toPort: 'Port of NY & NJ (USNYC)', dep: -3, arr: 8, p: 0.22, status: 'In Transit · North Atlantic', shipment: 'TRK-2026-44719' },
    { id: 'NLMU 771250-4', vessel: 'MV Arabian Star', imo: 'IMO 9690121', type: "40' Dry", from: 'Mumbai', fromPort: 'Nhava Sheva (INNSA)', to: 'Dubai', toPort: 'Jebel Ali (AEJEA)', dep: -4, arr: 1, p: 0.71, status: 'Approaching port', shipment: 'TRK-2026-83374' },
    { id: 'NLMU 205884-1', vessel: 'MV Pacific Horizon', imo: 'IMO 9802277', type: "40' Reefer", from: 'Busan', fromPort: 'Port of Busan (KRPUS)', to: 'Los Angeles', toPort: 'Port of Los Angeles (USLAX)', dep: -12, arr: 0, p: 1, status: 'Discharged · awaiting pickup', shipment: null },
    { id: 'NLMU 619932-5', vessel: 'MV Cape Aurora', imo: 'IMO 9755310', type: "20' Open Top", from: 'Hamburg', fromPort: 'Port of Hamburg (DEHAM)', to: 'São Paulo', toPort: 'Port of Santos (BRSSZ)', dep: 2, arr: 21, p: 0, status: 'Gate-in at origin terminal', shipment: null }
  ];
  function containerTracker() {
    const form = document.getElementById('containerForm');
    if (!form) return;
    const out = document.getElementById('containerResult');
    const show = (c) => {
      const today = new Date();
      LX.render(out,
        '<div class="card vessel-card"><div class="vs-media"><img src="assets/images/logistics/container-ship.jpg" alt="Container vessel ' + c.vessel + '"></div><div class="vs-body">' +
        '<div class="flex-between flex-wrap"><div><span class="xs muted">Container ID</span><h3 class="mono" style="font-size:1.35rem">' + c.id + '</h3></div><span class="badge ' + (c.p >= 1 ? 'badge-delivered' : c.p === 0 ? 'badge-pending' : 'badge-transit') + '">' + c.status + '</span></div>' +
        '<div class="voyage"><div class="v-line"><i style="width:' + c.p * 100 + '%"></i></div><span class="v-ship" style="left:' + Math.max(3, Math.min(97, c.p * 100)) + '%">' + I('ship') + '</span>' +
        '<div class="v-ports"><div><span class="xs muted">Departure</span><strong>' + c.from + '</strong><span class="xs muted">' + U.date(U.addDays(today, c.dep)) + '</span></div><div style="text-align:right"><span class="xs muted">Arrival</span><strong>' + c.to + '</strong><span class="xs muted">' + U.date(U.addDays(today, c.arr)) + '</span></div></div></div>' +
        '<div class="kv mt-3"><div><span>Vessel Name</span><strong>' + c.vessel + '</strong></div><div><span>Vessel ID</span><strong>' + c.imo + '</strong></div><div><span>Port of Loading</span><strong>' + c.fromPort + '</strong></div><div><span>Port of Discharge</span><strong>' + c.toPort + '</strong></div><div><span>Container Type</span><strong>' + c.type + '</strong></div><div><span>Estimated Arrival</span><strong>' + (c.p >= 1 ? 'Arrived' : U.date(U.addDays(today, c.arr)) + ' · ' + Math.max(0, c.arr) + ' days') + '</strong></div></div>' +
        (c.shipment ? '<a class="btn btn-sm mt-3" href="tracking.html?id=' + c.shipment + '">' + I('map') + 'Live position on map</a>' : '') +
        '</div></div>');
    };
    const table = document.getElementById('containerTable');
    if (table) table.innerHTML = CONTAINERS.map((c) => '<tr><td><button class="link-arrow" data-container="' + c.id + '">' + c.id + '</button></td><td>' + c.vessel + '</td><td>' + c.from + ' → ' + c.to + '</td><td>' + U.dateShort(U.addDays(new Date(), c.dep)) + '</td><td>' + U.dateShort(U.addDays(new Date(), c.arr)) + '</td><td><span class="badge ' + (c.p >= 1 ? 'badge-delivered' : c.p === 0 ? 'badge-pending' : 'badge-transit') + '">' + c.status.split(' · ')[0] + '</span></td></tr>').join('');
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-container]');
      if (!b) return;
      form.querySelector('input').value = b.dataset.container;
      show(CONTAINERS.find((c) => c.id === b.dataset.container));
      out.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = form.querySelector('input').value.trim().toUpperCase().replace(/[\s-]/g, '');
      const c = CONTAINERS.find((x) => x.id.replace(/[\s-]/g, '') === v || x.id.replace(/[\s-]/g, '').startsWith(v) && v.length >= 6);
      if (!c) { LX.toast('Container not found', 'Try NLMU 482193-7 or pick one from the table below.', 'error'); return; }
      show(c);
    });
    show(CONTAINERS[0]);
  }

  /* ---------- Warehouse dashboard ---------- */
  function warehouseDash() {
    const dash = document.getElementById('whDash');
    if (!dash) return;
    const W = LX.data.warehouses;
    const totalSq = W.reduce((a, w) => a + w.sqft, 0);
    const occ = W.reduce((a, w) => a + w.sqft * w.occupancy / 100, 0);
    const state = { inventory: 1842600, orders: W.reduce((a, w) => a + w.orders, 0), inbound: W.reduce((a, w) => a + w.inbound, 0), outbound: W.reduce((a, w) => a + w.outbound, 0) };
    const occPct = Math.round((occ / totalSq) * 100);
    const card = (icon, cls, label, id, val, sub) => '<div class="card card-sm wh-stat"><span class="icon-box ' + cls + '">' + I(icon) + '</span><div class="stat-mini"><span class="num" id="' + id + '">' + val + '</span><span class="lbl">' + label + '</span>' + (sub ? '<span class="xs muted">' + sub + '</span>' : '') + '</div></div>';
    LX.render(dash,
      card('layers', '', 'Total Inventory (units)', 'whInv', U.num(state.inventory), 'Across 8 facilities') +
      '<div class="card card-sm wh-stat"><div class="ring" id="whRingFree" style="--c:var(--success)"><span>' + (100 - occPct) + '%</span></div><div class="stat-mini"><span class="num">' + U.compact(totalSq - occ) + '</span><span class="lbl">Available Space (sq ft)</span></div></div>' +
      '<div class="card card-sm wh-stat"><div class="ring" id="whRingOcc" style="--c:var(--primary)"><span>' + occPct + '%</span></div><div class="stat-mini"><span class="num">' + U.compact(occ) + '</span><span class="lbl">Occupied Space (sq ft)</span></div></div>' +
      card('clipboard', 'accent', 'Pending Orders', 'whOrders', U.num(state.orders), 'Pick & pack queue') +
      card('download', 'success', 'Incoming Shipments', 'whIn', U.num(state.inbound), 'Scheduled today') +
      card('upload', '', 'Outgoing Shipments', 'whOut', U.num(state.outbound), 'Dispatching today')
    );
    // animate rings
    LX.onVisible([dash], () => {
      [['whRingFree', 100 - occPct], ['whRingOcc', occPct]].forEach(([id, v]) => {
        const el = document.getElementById(id); let cur = 0;
        const step = () => { cur = Math.min(v, cur + 1.5); el.style.setProperty('--p', cur); if (cur < v) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    });
    const tbody = document.getElementById('whTable');
    if (tbody) tbody.innerHTML = W.map((w) => '<tr><td><div class="cell-main">' + w.name + '</div><div class="cell-sub">' + w.id + ' · ' + w.type + '</div></td><td>' + w.city + '</td><td data-v="' + w.sqft + '">' + U.num(w.sqft) + '</td><td data-v="' + w.occupancy + '"><div class="flex"><div class="progress ' + (w.occupancy > 85 ? 'danger' : w.occupancy > 75 ? 'warning' : 'success') + '" style="flex:1"><span data-progress="' + w.occupancy + '"></span></div><strong class="small">' + w.occupancy + '%</strong></div></td><td>' + w.docks + '</td><td>' + w.inbound + '</td><td>' + w.outbound + '</td></tr>').join('');
    if (document.getElementById('whFlow') && LX.charts) {
      LX.charts.bar('whFlow', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [
        { label: 'Inbound pallets', data: [1180, 1320, 1260, 1410, 1530, 820, 540] },
        { label: 'Outbound pallets', data: [1240, 1290, 1380, 1460, 1610, 910, 480] }
      ], { format: (v) => U.num(v) + ' pallets' });
    }
    if (reduce) return;
    setInterval(() => {
      state.inventory += Math.round((Math.random() - 0.45) * 120);
      state.orders += Math.round((Math.random() - 0.5) * 14);
      state.inbound += Math.random() > 0.6 ? 1 : 0;
      state.outbound += Math.random() > 0.5 ? 1 : 0;
      [['whInv', state.inventory], ['whOrders', state.orders], ['whIn', state.inbound], ['whOut', state.outbound]].forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el && el.textContent !== U.num(v)) { el.textContent = U.num(v); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      });
    }, 3500);
  }

  /* ---------- Last-mile: live multi-stop delivery run ---------- */
  const DEPOT = [41.8866, -87.6517];
  const STOPS = [
    { name: 'Harper & Co. Interiors', addr: '820 N Michigan Ave', ll: [41.8969, -87.6244], pkg: 2 },
    { name: 'Olivia Bennett', addr: '1520 N Halsted St, Apt 4B', ll: [41.9097, -87.6481], pkg: 1 },
    { name: 'Lincoln Park Pharmacy', addr: '2340 N Clark St', ll: [41.9241, -87.6415], pkg: 4 },
    { name: 'Samuel Okoye', addr: '3100 N Broadway', ll: [41.9392, -87.6443], pkg: 1 },
    { name: 'Roscoe Cycle Works', addr: '2016 W Roscoe St', ll: [41.9434, -87.6785], pkg: 3 },
    { name: 'Nadia Farouk', addr: '2600 N Milwaukee Ave', ll: [41.9289, -87.7075], pkg: 1 },
    { name: 'Wicker Park Books', addr: '1600 N Damen Ave', ll: [41.9105, -87.6776], pkg: 6 },
    { name: 'Ethan Walsh', addr: '900 N Ashland Ave', ll: [41.8988, -87.6668], pkg: 2 }
  ];
  function lastMile() {
    const el = document.getElementById('lmMap');
    if (!el) return;
    const list = document.getElementById('stopList');
    // Street-grid style path: depot → each stop (L-shaped legs) → depot
    const pts = [DEPOT];
    const stopIdx = [];
    [...STOPS.map((s) => s.ll), DEPOT].forEach((ll) => {
      const prev = pts[pts.length - 1];
      pts.push([prev[0], ll[1]]);
      pts.push(ll);
      stopIdx.push(pts.length - 1);
    });
    // Fraction of the path at which each stop is reached
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = LX.geo.haversine(pts[i - 1], pts[i]); seg.push(d); total += d; }
    const cum = [0]; seg.forEach((d) => cum.push(cum[cum.length - 1] + d));
    const at = stopIdx.map((i) => cum[i] / total);
    let p = 0.02, dwell = 0;
    const renderList = () => {
      const cur = at.findIndex((a) => p < a);
      list.innerHTML = STOPS.map((s, i) => '<div class="stop ' + (i < cur ? 'done' : i === cur ? 'current' : '') + '"><span class="s-num">' + (i < cur ? '✓' : i + 1) + '</span><div><strong>' + s.name + '</strong><span class="xs muted">' + s.addr + ' · ' + s.pkg + ' pkg</span></div><span class="xs ' + (i < cur ? 'text-success' : i === cur ? 'text-accent' : 'muted') + '">' + (i < cur ? 'Delivered' : i === cur ? 'Next' : U.time(Date.now() + (i - cur + 1) * 11 * 60000)) + '</span></div>').join('');
      const remaining = Math.max(0, STOPS.length - Math.max(0, cur === -1 ? STOPS.length : cur));
      const next = STOPS[cur] || null;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
      set('lmStops', remaining + ' of ' + STOPS.length);
      set('lmEta', next ? Math.max(1, Math.round((at[cur] - p) * total / 0.35)) + ' min' : 'Returning');
      set('lmAddr', next ? next.addr : 'NorthLane Fulton Market depot');
      set('lmCustomer', next ? next.name : '—');
      set('lmStatus', next ? (dwell > 0 ? 'Delivering…' : 'Out for Delivery') : 'Run complete');
      set('lmDelivered', (STOPS.length - remaining) + ' delivered');
      return cur;
    };
    LX.onVisible([el], () => {
      const map = LX.maps.create(el, { center: [41.915, -87.665], zoom: 13 });
      let van = null, done = null;
      if (map) {
        LX.maps.line(pts, '#36C5FF', { weight: 3, opacity: 0.5, dashArray: '6 10', className: 'route-anim' }).addTo(map);
        done = LX.maps.line([], '#00AEEF', { weight: 5, className: 'route-done' }).addTo(map);
        L.marker(DEPOT, { icon: L.divIcon({ className: '', html: '<div class="map-pin warehouse"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map).bindPopup('<strong>Fulton Market Depot</strong><br>1200 W Fulton Market');
        STOPS.forEach((s, i) => L.marker(s.ll, { icon: L.divIcon({ className: '', html: '<div class="map-pin stop" style="color:#fff"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map).bindPopup('<strong>Stop ' + (i + 1) + ' · ' + s.name + '</strong><br>' + s.addr));
        van = LX.maps.vehicle(DEPOT, 'van').addTo(map);
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
      }
      let last = renderList();
      const tick = () => {
        if (dwell > 0) { dwell--; return; }
        p += 0.0035;
        if (p >= 1) { p = 0.001; LX.toast('Route complete', 'All 8 stops delivered. Van returning to depot for the next wave.', 'success'); }
        const pos = LX.geo.pointAt(pts, p);
        if (van) { LX.maps.glide(van, pos.latlng, 900); done.setLatLngs(pts.slice(0, pos.index).concat([pos.latlng])); }
        const cur = renderList();
        if (cur !== last && last >= 0 && last < STOPS.length) {
          dwell = 2;
          LX.toast('Delivery confirmed · Stop ' + (last + 1), STOPS[last].name + ' — photo POD & e-signature captured.', 'success', 3000);
        }
        last = cur;
      };
      if (!reduce) setInterval(tick, 1000);
    }, { threshold: 0.1 });
  }

  /* ---------- Express: next cutoff countdown ---------- */
  function expressCountdown() {
    const el = document.getElementById('cutoff');
    if (!el) return;
    const label = document.getElementById('cutoffLabel');
    const tick = () => {
      const now = new Date();
      const cut = new Date(now); cut.setHours(14, 0, 0, 0);
      let name = 'same-day pickup';
      if (now >= cut) { cut.setHours(22, 0, 0, 0); name = 'overnight line-haul'; }
      if (now >= cut) { cut.setDate(cut.getDate() + 1); cut.setHours(14, 0, 0, 0); name = 'same-day pickup (tomorrow)'; }
      const s = Math.max(0, Math.floor((cut - now) / 1000));
      el.innerHTML = [['Hours', Math.floor(s / 3600)], ['Minutes', Math.floor((s % 3600) / 60)], ['Seconds', s % 60]].map(([k, v]) => '<div><strong>' + String(v).padStart(2, '0') + '</strong><span>' + k + '</span></div>').join('');
      if (label) label.textContent = 'Next cutoff: ' + name + ' at ' + U.time(cut);
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Freight: mode charts ---------- */
  function freightCharts() {
    if (!document.getElementById('modeCost') || !LX.charts) return;
    LX.charts.bar('modeCost', ['Road', 'Rail', 'Air', 'Ocean'], [{ label: 'Cost per tonne-km (USD)', data: [0.11, 0.05, 0.62, 0.02], colors: ['#0A96D0', '#139A88', '#8A6CF0', '#BF8000'] }], { format: (v) => '$' + v.toFixed(2) + ' / t-km', axisFormat: (v) => '$' + v });
    LX.charts.bar('modeCo2', ['Road', 'Rail', 'Air', 'Ocean'], [{ label: 'g CO₂e per tonne-km', data: [62, 22, 602, 8], colors: ['#0A96D0', '#139A88', '#8A6CF0', '#BF8000'] }], { format: (v) => v + ' g CO₂e / t-km' });
  }

  /* ---------- Road: vehicle type cards ---------- */
  function vehicleTypes() {
    const el = document.getElementById('vehicleTypes');
    if (!el) return;
    const T = LX.data.VTYPES;
    const use = { 'Delivery Van': 'Urban & e-commerce', 'Pickup Truck': 'Small B2B loads', 'Medium Truck': 'Regional LTL', 'Heavy Truck': 'Long-haul FTL', 'Container Truck': 'Port drayage', 'Refrigerated Truck': 'Cold chain', 'Electric Delivery Vehicle': 'Zero-emission last mile' };
    el.innerHTML = Object.keys(T).map((k, i) => {
      const n = LX.data.vehicles.filter((v) => v.type === k);
      return '<article class="card card-hover vehicle-card" data-aos="fade-up" data-aos-delay="' + (i % 4) * 70 + '"><div class="vc-media"><img src="' + T[k].img + '" alt="' + k + '" loading="lazy"></div><div class="vc-body"><div class="flex-between"><h3 style="font-size:1rem">' + k + '</h3><span class="icon-box sm">' + I(T[k].icon) + '</span></div><div class="vc-specs"><div><span>Capacity</span>' + T[k].cap + '</div><div><span>Best for</span>' + use[k] + '</div><div><span>Available now</span>' + n.filter((v) => v.status === 'Available').length + ' of ' + n.length + ' in demo fleet</div><div><span>Telematics</span>GPS · ELD · Cam</div></div></div></article>';
    }).join('');
  }

  LX.ready(() => {
    vehicleTypes();
    roadMap();
    flightViz();
    flightBoard();
    liveCard();
    containerTracker();
    warehouseDash();
    lastMile();
    expressCountdown();
    freightCharts();
  });
})();
