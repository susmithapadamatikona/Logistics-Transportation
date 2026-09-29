/* ==========================================================================
   NorthLane Logistics — Maps & shipment tracking
   LX.maps      Leaflet helpers (themed tiles, pins, animated routes, vehicles)
   LX.tracking  Tracking widget, live tracking page, shipment details page
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);
  const TICK_MS = 3000;

  /* ====================================================================== */
  /* Maps                                                                    */
  /* ====================================================================== */
  /* Esri Canvas basemaps (no API key required). Base + label reference layer, themed. */
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const TILE = (theme) => ESRI + (theme === 'light' ? 'World_Light_Gray_Base' : 'World_Dark_Gray_Base') + '/MapServer/tile/{z}/{y}/{x}';
  const LABELS = (theme) => ESRI + (theme === 'light' ? 'World_Light_Gray_Reference' : 'World_Dark_Gray_Reference') + '/MapServer/tile/{z}/{y}/{x}';
  const maps = (LX.maps = {
    available: () => !!window.L,
    create(el, opts) {
      el = typeof el === 'string' ? document.getElementById(el) : el;
      if (!el) return null;
      if (!window.L) { el.innerHTML = '<div class="map-fallback">' + I('map') + '&nbsp; Live map requires an internet connection.</div>'; return null; }
      opts = opts || {};
      const map = L.map(el, Object.assign({ zoomControl: true, attributionControl: true, scrollWheelZoom: false, worldCopyJump: true, minZoom: 2 }, opts));
      const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const layer = L.tileLayer(TILE(theme), { attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors', maxZoom: 16 }).addTo(map);
      map.createPane('labels');
      map.getPane('labels').style.zIndex = 350;
      map.getPane('labels').style.pointerEvents = 'none';
      const labels = L.tileLayer(LABELS(theme), { maxZoom: 16, pane: 'labels', opacity: 0.8 }).addTo(map);
      document.addEventListener('lx:theme', (e) => { layer.setUrl(TILE(e.detail.theme)); labels.setUrl(LABELS(e.detail.theme)); });
      map.on('focus', () => map.scrollWheelZoom.enable());
      map.on('blur', () => map.scrollWheelZoom.disable());
      setTimeout(() => map.invalidateSize(), 200);
      return map;
    },
    pin(latlng, cls, title) {
      return L.marker(latlng, { icon: L.divIcon({ className: '', html: '<div class="map-pin ' + (cls || '') + '"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: title || '', keyboard: !!title });
    },
    vehicle(latlng, icon, cls) {
      return L.marker(latlng, { icon: L.divIcon({ className: '', html: '<div class="vehicle-marker ' + (cls || '') + '">' + I(icon || 'truck') + '</div>', iconSize: cls && cls.includes('sm') ? [30, 30] : [42, 42], iconAnchor: cls && cls.includes('sm') ? [15, 15] : [21, 21] }), zIndexOffset: 1000, keyboard: false });
    },
    line(pts, color, opts) {
      return L.polyline(pts, Object.assign({ color: color || '#00AEEF', weight: 3, opacity: 0.9, lineCap: 'round' }, opts || {}));
    },
    /* Smoothly glide a marker to a new position */
    glide(marker, to, ms) {
      const from = marker.getLatLng();
      const start = performance.now();
      const d = ms || 1200;
      const step = (now) => {
        const t = Math.min(1, (now - start) / d);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    modeIcon: (m) => ({ road: 'truck', air: 'plane', ocean: 'ship', rail: 'train' }[m] || 'truck'),

    /* Draw a full live shipment on a map; returns { update(s), fit() } */
    shipment(map, s, opts) {
      opts = opts || {};
      const route = s.route;
      const group = L.featureGroup().addTo(map);
      const remaining = maps.line(route, '#36C5FF', { weight: 3, opacity: 0.55, dashArray: '8 12', className: 'route-anim' }).addTo(group);
      const done = maps.line([], '#00AEEF', { weight: 5, opacity: 1, className: 'route-done' }).addTo(group);
      const traffic = maps.line([], '#F59E0B', { weight: 5, opacity: 0.9 }).addTo(group);
      maps.pin(route[0], 'origin', 'Origin').addTo(group).bindPopup('<strong>Origin</strong><br>' + U.esc(s.fromLabel));
      maps.pin(route[route.length - 1], 'dest', 'Destination').addTo(group).bindPopup('<strong>Destination</strong><br>' + U.esc(s.toLabel) + '<br>ETA ' + U.dateTime(s.etaLive));
      const stops = [];
      if (s.mode === 'road' || s.mode === 'rail') {
        [[0.34, 'Distribution Center', 'hub'], [0.68, 'Cross-dock Warehouse', 'warehouse']].forEach(([p, label, cls]) => {
          const pt = LX.geo.pointAt(route, p).latlng;
          const m = maps.pin(pt, cls + (s.progress >= p ? ' done' : ''), label).addTo(group).bindPopup('<strong>' + label + '</strong><br>' + (s.progress >= p ? 'Checked through ✓' : 'Scheduled stop'));
          stops.push({ p, m, cls });
        });
      }
      const vm = maps.vehicle(s.position, maps.modeIcon(s.mode), opts.vehicleClass).addTo(group);
      vm.bindPopup(() => '<strong>' + U.esc(s.id) + '</strong><br>' + U.esc(s.driverName || '') + '<br>' + U.esc(s.status));
      const paint = (x) => {
        const pos = LX.geo.pointAt(route, x.progress);
        done.setLatLngs(route.slice(0, pos.index).concat([pos.latlng]));
        if (x.progress < 0.97 && (x.mode === 'road' || x.delayed)) {
          const a = LX.geo.pointAt(route, Math.min(1, x.progress + 0.04)), b = LX.geo.pointAt(route, Math.min(1, x.progress + 0.11));
          traffic.setLatLngs(route.slice(a.index, b.index).length ? [a.latlng].concat(route.slice(a.index, b.index)).concat([b.latlng]) : []);
        } else traffic.setLatLngs([]);
        stops.forEach((st) => { if (x.progress >= st.p) st.m.setIcon(L.divIcon({ className: '', html: '<div class="map-pin ' + st.cls + ' done"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] })); });
      };
      paint(s);
      return {
        group, marker: vm,
        fit(pad) { map.fitBounds(group.getBounds(), { padding: pad || [50, 50] }); },
        update(x) { s = x; paint(x); maps.glide(vm, x.position, TICK_MS * 0.9); if (opts.follow) map.panTo(x.position, { animate: true, duration: 2 }); }
      };
    }
  });

  /* ====================================================================== */
  /* Tracking widget                                                         */
  /* ====================================================================== */
  const statusClass = (st) => 'badge-' + U.slug(st === 'In Transit' ? 'transit' : st);

  function stepsMini(s) {
    const flow = LX.sim.STATUS_FLOW;
    const cur = s.status === 'Delayed' ? flow.indexOf('In Transit') : flow.indexOf(s.status);
    return '<ol class="status-steps" aria-label="Shipment status progress">' + flow.map((f, i) =>
      '<li class="' + (i < cur ? 'done' : i === cur ? 'current' : '') + '"><span>' + (i < cur ? I('check') : i + 1) + '</span><em>' + f + '</em></li>').join('') + '</ol>';
  }

  function resultHTML(s, compact) {
    const pct = Math.round(s.progress * 100);
    return '<div class="track-result" data-track-id="' + s.id + '">' +
      '<div class="tr-head">' +
      '<div><span class="xs muted">Tracking ID</span><h3 class="mono">' + s.id + '</h3></div>' +
      '<div class="flex flex-wrap"><span class="badge ' + statusClass(s.status) + '" data-live="status">' + s.status + '</span>' +
      (s.progress < 1 ? '<span class="live-pill"><span class="live-dot"></span>Live Tracking</span>' : '') +
      '<span class="xs muted" data-live="updated">Updated ' + U.ago(s.updatedAt) + '</span></div></div>' +
      (s.delayed && s.progress < 1 ? '<div class="notice warn mt-2">' + I('alert') + '<span><strong>Delay reported:</strong> ' + U.esc(s.delayReason || 'Operational delay') + '. Our team is actively managing this shipment.</span></div>' : '') +
      '<div class="tr-progress"><div class="tr-ends"><span>' + I('map-pin') + U.esc(s.fromLabel) + '</span><span>' + U.esc(s.toLabel) + I('flag') + '</span></div>' +
      '<div class="progress progress-lg striped"><span data-live="bar" style="width:' + pct + '%"></span></div>' +
      '<div class="tr-ends xs muted"><span data-live="pct">' + pct + '% of route completed</span><span data-live="remaining2">' + U.num(s.remaining) + ' km to go</span></div></div>' +
      stepsMini(s) +
      '<div class="tr-grid">' +
      cell('map-pin', 'Current Location', '<span data-live="location">' + U.esc(s.currentLocation) + '</span>') +
      cell('flag', 'Origin', U.esc(s.fromLabel)) +
      cell('target', 'Destination', U.esc(s.toLabel)) +
      cell('route', 'Distance Remaining', '<span data-live="remaining">' + U.num(s.remaining) + ' km</span>') +
      cell('clock', 'Estimated Delivery', '<span data-live="eta">' + (s.progress >= 1 ? 'Delivered' : U.dateTime(s.etaLive)) + '</span>') +
      cell('steering', s.mode === 'road' ? 'Driver' : 'Carrier', U.esc(s.driverName)) +
      cell(LX.maps.modeIcon(s.mode), 'Vehicle', U.esc(s.vehicle)) +
      cell('package', 'Shipment Type', U.esc(s.service) + ' · ' + U.esc(s.cargo)) +
      cell('refresh', 'Last Updated', '<span data-live="updatedAbs">' + U.time(s.updatedAt) + '</span>') +
      '</div>' +
      '<div class="tr-actions">' +
      '<a class="btn btn-sm" href="404.html">' + I('map') + 'Open Live Map</a>' +
      '<a class="btn btn-ghost btn-sm" href="404.html">' + I('file') + 'Shipment Details</a>' +
      (compact ? '' : '<button class="btn btn-ghost btn-sm" data-share="' + s.id + '">' + I('send') + 'Share Tracking</button>') +
      '</div></div>';
    function cell(icon, label, val) { return '<div class="tr-cell"><span class="icon-box sm">' + I(icon) + '</span><div><span>' + label + '</span><strong>' + val + '</strong></div></div>'; }
  }

  function updateLive(root, s) {
    const set = (k, v, flash) => root.querySelectorAll('[data-live="' + k + '"]').forEach((el) => {
      if (el.textContent !== v) { el.textContent = v; if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } }
    });
    const pct = Math.round(s.progress * 100);
    set('status', s.status);
    root.querySelectorAll('[data-live="status"]').forEach((el) => { el.className = 'badge ' + statusClass(s.status); });
    set('location', s.currentLocation);
    set('remaining', U.num(s.remaining) + ' km', true);
    set('remaining2', U.num(s.remaining) + ' km to go');
    set('eta', s.progress >= 1 ? 'Delivered' : U.dateTime(s.etaLive));
    set('etaIn', s.progress >= 1 ? 'Delivered' : U.duration(s.hoursLeft), true);
    set('pct', pct + '% of route completed');
    set('pctNum', pct + '%');
    set('updated', 'Updated ' + U.ago(s.updatedAt));
    set('updatedAbs', U.time(s.updatedAt));
    set('speed', s.progress >= 1 ? '0 km/h' : Math.round(LX.data.SPEED[s.mode] * (0.9 + Math.random() * 0.2)) + ' km/h');
    set('coords', s.position[0].toFixed(4) + ', ' + (((s.position[1] + 540) % 360) - 180).toFixed(4));
    root.querySelectorAll('[data-live="bar"]').forEach((el) => (el.style.width = pct + '%'));
    const steps = root.querySelector('.status-steps');
    if (steps) steps.outerHTML = stepsMini(s);
  }

  /* Poll + advance a shipment while it is on screen */
  function liveLoop(id, onTick, delta) {
    let last = null;
    const timer = setInterval(() => {
      const s = LX.sim.advance(id, delta);
      if (!s) return;
      if (last && last.status !== s.status) {
        LX.toast('Status update · ' + s.id, s.status === 'Delivered' ? 'Delivered to ' + s.toLabel + '. Proof of delivery captured.' : 'Shipment is now ' + s.status + '.', s.status === 'Delivered' ? 'success' : 'info');
        LX.notify.add('Shipment ' + s.status.toLowerCase(), s.id + ' is now ' + s.status + ' (' + s.currentLocation + ').', s.status === 'Delivered' ? 'success' : 'info');
      }
      last = s;
      onTick(s);
      if (s.progress >= 1) clearInterval(timer);
    }, TICK_MS);
    const ageTimer = setInterval(() => {
      const s = LX.sim.find(id);
      if (s) document.querySelectorAll('[data-live="updated"]').forEach((el) => (el.textContent = 'Updated ' + U.ago(s.updatedAt)));
    }, 1000);
    return () => { clearInterval(timer); clearInterval(ageTimer); };
  }

  function rememberSearch(id) {
    const list = LX.store.get('recentTracking', []).filter((x) => x !== id);
    list.unshift(id);
    LX.store.set('recentTracking', list.slice(0, 6));
  }

  /* Bind a tracking form: <form><input name="tracking"></form> */
  function bindForm(form, output, opts) {
    opts = opts || {};
    let stop = null;
    const run = (raw, silent) => {
      const id = LX.sim.normalize(raw);
      if (!id) { LX.toast('Enter a tracking ID', 'Example: TRK-2026-45821', 'warning'); return; }
      if (!LX.sim.valid(id)) {
        LX.toast('Invalid tracking ID', 'Tracking IDs look like TRK-2026-45821.', 'error');
        output && (output.innerHTML = '<div class="notice warn mt-3">' + I('alert') + '<span>We couldn\'t recognise <strong>' + U.esc(raw) + '</strong>. Tracking IDs use the format <span class="mono">TRK-YYYY-NNNNN</span>.</span></div>');
        return;
      }
      const btn = form.querySelector('[type="submit"]');
      btn && btn.classList.add('is-loading');
      if (output) output.innerHTML = '<div class="track-loading"><div class="skeleton" style="height:22px;width:40%"></div><div class="skeleton" style="height:12px;margin-top:18px"></div><div class="skeleton" style="height:90px;margin-top:18px"></div></div>';
      setTimeout(() => {
        btn && btn.classList.remove('is-loading');
        const s = LX.sim.find(id);
        if (!s) return;
        rememberSearch(s.id);
        if (stop) stop();
        if (opts.onFound) opts.onFound(s);
        if (output) {
          LX.render(output, resultHTML(s, opts.compact));
          const root = output.querySelector('.track-result');
          stop = liveLoop(s.id, (x) => updateLive(root, x), opts.delta);
        }
        if (!silent) LX.toast('Shipment found', s.id + ' · ' + s.status, 'success', 2600);
      }, silent ? 0 : 650);
    };
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (e) => { e.preventDefault(); run(form.querySelector('input').value); });
    form.parentElement.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => { form.querySelector('input').value = b.dataset.sample; run(b.dataset.sample); }));
    return { run };
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    const url = location.href.split('/').slice(0, -1).join('/') + '/tracking.html?id=' + b.dataset.share;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => LX.toast('Tracking link copied', 'Share it with your consignee for live updates.', 'success'),
      () => LX.toast('Share link', url, 'info', 7000));
  });

  /* ====================================================================== */
  /* Tracking page                                                           */
  /* ====================================================================== */
  function trackingPage() {
    const form = document.getElementById('trackPageForm');
    if (!form) return;
    const panel = document.getElementById('trackPanel');
    const mapEl = document.getElementById('trackMap');
    let map = null, drawn = null, stop = null;

    const timelineHTML = (s) => LX.sim.STEPS.map((st, i) => {
      const state = i < s.stepIndex || s.progress >= 1 ? 'done' : i === s.stepIndex ? 'current' : '';
      return '<li class="' + state + '"><span class="tl-dot">' + I(state === 'done' ? 'check' : st.icon) + '</span><div><strong>' + st.label + '</strong><span class="xs muted">' + stepTime(s, i, state) + '</span></div></li>';
    }).join('');

    const show = (s) => {
      if (stop) stop();
      history.replaceState(null, '', '?id=' + s.id);
      document.getElementById('trackEmpty') && document.getElementById('trackEmpty').classList.add('hidden');
      document.getElementById('trackLayout').classList.remove('hidden');
      const pct = Math.round(s.progress * 100);
      LX.render(panel,
        '<div class="card card-sm tp-status"><div class="flex-between"><div><span class="xs muted">Tracking ID</span><h2 class="mono tp-id">' + s.id + '</h2></div><span class="badge ' + statusClass(s.status) + '" data-live="status">' + s.status + '</span></div>' +
        '<div class="flex mt-1 flex-wrap"><span class="live-pill"><span class="live-dot"></span>Live</span><span class="xs muted" data-live="updated">Last Updated: Just Now</span></div>' +
        '<div class="tp-route"><div><span class="xs muted">From</span><strong>' + U.esc(s.fromLabel) + '</strong></div>' + I('arrow-right') + '<div><span class="xs muted">To</span><strong>' + U.esc(s.toLabel) + '</strong></div></div>' +
        '<div class="progress-label"><span>Route progress</span><strong data-live="pctNum">' + pct + '%</strong></div><div class="progress progress-lg striped"><span data-live="bar" style="width:' + pct + '%"></span></div>' +
        '<div class="tp-kpis"><div><span>ETA</span><strong data-live="etaIn">' + (s.progress >= 1 ? 'Delivered' : U.duration(s.hoursLeft)) + '</strong></div><div><span>Distance</span><strong data-live="remaining">' + U.num(s.remaining) + ' km</strong></div><div><span>Speed</span><strong data-live="speed">' + LX.data.SPEED[s.mode] + ' km/h</strong></div></div>' +
        (s.delayed && s.progress < 1 ? '<div class="notice warn mt-2">' + I('alert') + '<span>' + U.esc(s.delayReason) + '</span></div>' : '') +
        '</div>' +
        '<div class="card card-sm"><div class="card-head"><h3>Current Position</h3><span class="xs muted mono" data-live="coords"></span></div><p class="tp-loc">' + I('map-pin') + '<span data-live="location">' + U.esc(s.currentLocation) + '</span></p>' +
        '<div class="kv mt-2"><div><span>Estimated Delivery</span><strong data-live="eta">' + U.dateTime(s.etaLive) + '</strong></div><div><span>Shipment Type</span><strong>' + U.esc(s.service) + '</strong></div><div><span>Cargo</span><strong>' + U.esc(s.cargo) + '</strong></div><div><span>Weight · Pieces</span><strong>' + U.num(s.weight) + ' kg · ' + s.pieces + '</strong></div>' + (s.temp ? '<div><span>Reefer Temp</span><strong class="text-primary">' + s.temp + ' ✓</strong></div>' : '') + '<div><span>Traffic</span><strong class="text-warning">' + (s.mode === 'road' ? (s.delayed ? 'Heavy' : 'Moderate') : 'N/A') + '</strong></div></div></div>' +
        '<div class="card card-sm"><div class="card-head"><h3>' + (s.mode === 'road' ? 'Driver & Vehicle' : 'Carrier') + '</h3></div>' + driverBlock(s) + '</div>' +
        '<div class="card card-sm"><div class="card-head"><h3>Shipment Timeline</h3><a class="link-arrow xs" href="shipment-details.html?id=' + s.id + '">Full details ' + I('arrow-right') + '</a></div><ol class="timeline compact" id="tpTimeline">' + timelineHTML(s) + '</ol></div>'
      );
      // Map
      if (mapEl && LX.maps.available()) {
        if (!map) map = LX.maps.create(mapEl, { zoomControl: true });
        if (drawn) map.removeLayer(drawn.group);
        drawn = LX.maps.shipment(map, s);
        drawn.fit([60, 60]);
      } else if (mapEl && !map) LX.maps.create(mapEl);
      document.getElementById('mapTitle').textContent = s.fromLabel.split(',')[0] + ' → ' + s.toLabel.split(',')[0];
      updateLive(document.getElementById('trackLayout'), s);
      const feed = document.getElementById('trackFeed');
      if (feed) feed.innerHTML = seedFeed(s);
      const followBtn = document.getElementById('followBtn');
      let follow = false;
      if (followBtn) followBtn.onclick = () => { follow = !follow; followBtn.classList.toggle('active', follow); followBtn.setAttribute('aria-pressed', String(follow)); if (follow && map) map.setView(LX.sim.find(s.id).position, 7); else drawn && drawn.fit(); };
      const fitBtn = document.getElementById('fitBtn');
      if (fitBtn) fitBtn.onclick = () => drawn && drawn.fit();
      let n = 0;
      stop = liveLoop(s.id, (x) => {
        updateLive(document.getElementById('trackLayout'), x);
        drawn && drawn.update(x);
        if (follow && map) map.panTo(x.position, { animate: true, duration: 2 });
        const tl = document.getElementById('tpTimeline');
        if (tl) tl.innerHTML = timelineHTML(x);
        if (feed && ++n % 2 === 0) feed.insertAdjacentHTML('afterbegin', feedRow(new Date(), gpsText(x)));
      }, 0.004);
      renderRecent();
    };

    const tracker = bindForm(form, null, { onFound: show });
    function renderRecent() {
      const box = document.getElementById('recentList');
      if (!box) return;
      const list = LX.store.get('recentTracking', []);
      box.innerHTML = list.length ? list.map((id) => '<button class="chip" data-recent="' + id + '">' + I('clock') + '<span class="mono">' + id + '</span></button>').join('') : '<span class="xs muted">Your recent searches will appear here.</span>';
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-recent]');
      if (b) { form.querySelector('input').value = b.dataset.recent; tracker.run(b.dataset.recent, true); window.scrollTo({ top: document.getElementById('trackLayout').offsetTop - 100, behavior: 'smooth' }); }
    });

    // Active shipments list
    const act = document.getElementById('activeShipments');
    if (act) {
      const rows = LX.sim.all().filter((s) => s.progress < 1).slice(0, 8);
      act.innerHTML = rows.map((s) => '<button class="active-ship" data-recent="' + s.id + '"><span class="icon-box sm">' + I(LX.maps.modeIcon(s.mode)) + '</span><span class="as-main"><strong class="mono">' + s.id + '</strong><span>' + s.from + ' → ' + s.to + '</span></span><span class="badge ' + statusClass(s.status) + '">' + s.status + '</span></button>').join('');
    }
    renderRecent();
    const initial = U.param('id');
    if (initial) { form.querySelector('input').value = initial; tracker.run(initial, true); }
  }

  function driverBlock(s) {
    const d = s.driver ? LX.data.drivers.find((x) => x.id === s.driver) : null;
    return '<div class="driver-block">' +
      (d ? (d.photo ? '<img class="avatar avatar-lg" src="' + d.photo + '" alt="Portrait of driver ' + U.esc(d.name) + '">' : '<span class="avatar avatar-lg avatar-initials">' + U.initials(d.name) + '</span>') : '<span class="icon-box">' + I(LX.maps.modeIcon(s.mode)) + '</span>') +
      '<div><strong>' + U.esc(s.driverName) + '</strong>' + (d ? '<span class="xs muted">' + d.id + ' · ★ ' + d.rating + ' · ' + d.experience + ' yrs</span>' : '<span class="xs muted">' + U.esc(s.service) + '</span>') +
      '<span class="xs">' + U.esc(s.vehicle) + '</span></div></div>' +
      '<div class="flex mt-2 flex-wrap"><a class="btn btn-ghost btn-xs" href="tel:' + s.driverPhone.replace(/[^\d+]/g, '') + '">' + I('phone') + 'Call</a><button class="btn btn-ghost btn-xs" onclick="LX.toast(\'Message sent\',\'Your message was delivered to the ' + (d ? 'driver' : 'carrier desk') + '.\',\'success\')">' + I('message') + 'Message</button>' + (d ? '<span class="badge badge-online">GPS Active</span>' : '') + '</div>';
  }

  function stepTime(s, i, state) {
    const st = LX.sim.STEPS[i];
    const t0 = new Date(s.pickupDate).getTime(), t1 = new Date(s.progress >= 1 ? s.eta : s.etaLive).getTime();
    let ts;
    if (i === 0) ts = new Date(s.bookedAt).getTime();
    else if (i === 1) ts = new Date(s.bookedAt).getTime() + 2 * 3600000;
    else ts = t0 + (t1 - t0) * st.at;
    return (state === 'done' ? '' : state === 'current' ? 'In progress · ' : 'Expected · ') + U.dateTime(ts);
  }

  function feedRow(date, text) { return '<div><time>' + U.time(date) + '</time><span>' + text + '</span></div>'; }
  function gpsText(s) { return 'GPS ping · ' + s.currentLocation + ' · ' + U.num(s.remaining) + ' km remaining'; }
  function seedFeed(s) {
    const t0 = new Date(s.pickupDate).getTime();
    const rows = [
      [t0 - 5400000, 'Booking confirmed and dispatched to ' + (s.mode === 'road' ? 'driver ' + s.driverName : s.driverName)],
      [t0, 'Picked up at origin · ' + s.pieces + ' pieces scanned'],
      [t0 + 3 * 3600000, 'Departed ' + s.fromLabel.split(',')[0] + ' hub after sort'],
      [Date.now() - 20 * 60000, 'Checkpoint cleared · ' + s.currentLocation],
      [Date.now() - 4 * 60000, gpsText(s)]
    ].filter((r) => s.progress > 0.1 || r[0] < Date.now());
    if (s.temp) rows.push([Date.now() - 2 * 60000, 'Reefer telemetry · ' + s.temp + ' · within range']);
    return rows.sort((a, b) => b[0] - a[0]).map((r) => feedRow(r[0], U.esc(r[1]))).join('');
  }

  /* ====================================================================== */
  /* Shipment details page                                                   */
  /* ====================================================================== */
  function detailsPage() {
    const root = document.getElementById('shipmentDetails');
    if (!root) return;
    const id = U.param('id') || 'TRK-2026-45821';
    const s = LX.sim.find(id);
    if (!s) { root.innerHTML = '<div class="empty-state">' + I('search') + '<p>Shipment not found.</p><a class="btn mt-2" href="tracking.html">Track another shipment</a></div>'; return; }
    document.title = s.id + ' · Shipment Details | NorthLane Logistics';
    const pct = Math.round(s.progress * 100);
    const inv = LX.data.invoices.find((x) => x.shipment === s.id);
    const timeline = () => { const x = LX.sim.find(s.id); return LX.sim.STEPS.map((st, i) => {
      const state = i < x.stepIndex || x.progress >= 1 ? 'done' : i === x.stepIndex ? 'current' : '';
      return '<li class="' + state + '"><span class="tl-dot">' + I(state === 'done' ? 'check' : st.icon) + '</span><div><strong>' + st.label + '</strong><span class="xs muted">' + stepTime(x, i, state) + '</span>' + (state === 'current' ? '<span class="badge badge-transit mt-1">Current step</span>' : '') + '</div></li>';
    }).join(''); };

    LX.render(root,
      '<div class="sd-header card">' +
      '<div class="sd-title"><span class="icon-box">' + I(LX.maps.modeIcon(s.mode)) + '</span><div><span class="xs muted">Tracking ID</span><h1 class="mono">' + s.id + '</h1><div class="flex flex-wrap mt-1"><span class="badge ' + statusClass(s.status) + '" data-live="status">' + s.status + '</span>' + (s.progress < 1 ? '<span class="live-pill"><span class="live-dot"></span>Live</span>' : '') + '<span class="xs muted" data-live="updated">Updated just now</span></div></div></div>' +
      '<div class="flex flex-wrap"><button class="btn btn-ghost btn-sm" onclick="window.print()">' + I('printer') + 'Print</button><button class="btn btn-ghost btn-sm" data-share="' + s.id + '">' + I('send') + 'Share</button>' + (inv ? '<a class="btn btn-ghost btn-sm" href="invoice.html?id=' + inv.id + '">' + I('receipt') + 'Invoice</a>' : '') + '<a class="btn btn-sm" href="tracking.html?id=' + s.id + '">' + I('map') + 'Live Map</a></div>' +
      '<div class="sd-progress"><div class="tr-ends"><span>' + I('map-pin') + U.esc(s.fromLabel) + '</span><span data-live="pct">' + pct + '% of route completed</span><span>' + U.esc(s.toLabel) + I('flag') + '</span></div><div class="progress progress-lg striped"><span data-live="bar" style="width:' + pct + '%"></span></div></div>' +
      '</div>' +
      '<div class="sd-grid">' +
      '<div class="sd-main">' +
      '<div class="card"><div class="card-head"><h2 class="h3">Shipment Overview</h2></div><div class="kv kv-3">' +
      kv('Shipment Status', '<span data-live="status2">' + s.status + '</span>') + kv('Origin', s.fromLabel) + kv('Destination', s.toLabel) +
      kv('Current Location', '<span data-live="location">' + U.esc(s.currentLocation) + '</span>') + kv('Shipment Type', s.service) + kv('Cargo', s.cargo) +
      kv('Weight', U.num(s.weight) + ' kg') + kv('Package Count', s.pieces + ' pieces') + kv('Priority', s.priority) +
      kv('Pickup Date', U.dateTime(s.pickupDate)) + kv('Expected Delivery', '<span data-live="eta">' + (s.progress >= 1 ? 'Delivered' : U.dateTime(s.etaLive)) + '</span>') + kv('Distance Remaining', '<span data-live="remaining">' + U.num(s.remaining) + ' km</span>') +
      kv('Customer', s.customer) + kv('Total Distance', U.num(s.distance) + ' km') + kv(s.container ? 'Container' : 'Temperature', s.container || s.temp || 'Ambient') +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h2 class="h3">Live Route</h2><span class="live-pill"><span class="live-dot"></span>GPS Active</span></div><div class="sd-map"><div class="leaflet-holder" id="sdMap"></div></div></div>' +
      '<div class="card"><div class="card-head"><h2 class="h3">Documents</h2></div><div class="doc-list">' +
      ['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Proof of Delivery'].map((d, i) => '<div class="doc-row"><span class="icon-box sm">' + I('file') + '</span><div><strong>' + d + '</strong><span class="xs muted">' + s.id.slice(-5) + '-' + U.slug(d).toUpperCase().slice(0, 3) + '.pdf · ' + (120 + i * 64) + ' KB</span></div>' + (i === 3 && s.progress < 1 ? '<span class="badge">Pending</span>' : '<button class="btn btn-ghost btn-xs" onclick="LX.toast(\'Download started\',\'' + d + ' is downloading.\',\'success\')">' + I('download') + 'PDF</button>') + '</div>').join('') +
      '</div></div>' +
      '</div>' +
      '<aside class="sd-side">' +
      '<div class="card"><div class="card-head"><h2 class="h3">Shipment Timeline</h2></div><ol class="timeline" id="sdTimeline">' + timeline() + '</ol></div>' +
      '<div class="card"><div class="card-head"><h2 class="h3">' + (s.mode === 'road' ? 'Driver & Vehicle' : 'Carrier') + '</h2></div>' + driverBlock(s) + '</div>' +
      '<div class="card"><div class="card-head"><h2 class="h3">Contact Information</h2></div><ul class="contact-mini">' +
      '<li>' + I('headset') + '<div><strong>Shipment desk</strong><a href="tel:+18005550148">+1 (800) 555-0148</a></div></li>' +
      '<li>' + I('mail') + '<div><strong>Email</strong><a href="mailto:dispatch@northlane.io">dispatch@northlane.io</a></div></li>' +
      '<li>' + I('user') + '<div><strong>Account manager</strong><span>Grace Kim · VP Customer Ops</span></div></li></ul></div>' +
      '</aside></div>'
    );
    function kv(k, v) { return '<div><span>' + k + '</span><strong>' + v + '</strong></div>'; }

    let map = null, drawn = null;
    if (LX.maps.available()) { map = LX.maps.create('sdMap'); drawn = LX.maps.shipment(map, s); drawn.fit(); } else LX.maps.create('sdMap');
    liveLoop(s.id, (x) => {
      updateLive(root, x);
      root.querySelectorAll('[data-live="status2"]').forEach((el) => (el.textContent = x.status));
      document.getElementById('sdTimeline').innerHTML = timeline();
      drawn && drawn.update(x);
    }, 0.004);
  }

  /* Recent shipments sidebar on tracking page etc. */
  LX.tracking = { resultHTML, updateLive, bindForm, liveLoop, statusClass, driverBlock, stepTime };

  LX.ready(() => {
    document.querySelectorAll('form.js-track-form').forEach((f) => {
      const out = document.getElementById(f.dataset.output);
      bindForm(f, out, { compact: true });
    });
    trackingPage();
    detailsPage();
  });
})();
