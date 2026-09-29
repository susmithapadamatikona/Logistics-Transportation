/* ==========================================================================
   NorthLane Logistics — Booking
   Home quick quote, calendar date-picker and the 6-step booking flow.
   Confirmed bookings are stored in LocalStorage and become trackable
   shipments immediately (see LX.sim.find).
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  /* ---------------- Calendar ---------------- */
  LX.calendar = function (el, opts) {
    opts = opts || {};
    const min = opts.min ? new Date(opts.min) : null;
    if (min) min.setHours(0, 0, 0, 0);
    let selected = opts.value ? new Date(opts.value) : null;
    let view = new Date(selected || min || new Date());
    view.setDate(1);
    const busy = opts.busy || {};
    const render = () => {
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < first; i++) cells += '<span></span>';
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const iso = U.iso(date);
        const dis = min && date < min;
        const sel = selected && U.iso(selected) === iso;
        const today = U.iso(new Date()) === iso;
        cells += '<button type="button" class="cal-day' + (sel ? ' selected' : '') + (today ? ' today' : '') + (busy[iso] ? ' busy' : '') + '" data-date="' + iso + '"' + (dis ? ' disabled' : '') + ' aria-label="' + U.date(date, { weekday: 'long', month: 'long', day: 'numeric' }) + (busy[iso] ? ', limited capacity' : '') + '"' + (sel ? ' aria-pressed="true"' : '') + ' tabindex="' + (sel || (!selected && today) ? 0 : -1) + '">' + d + '</button>';
      }
      el.innerHTML = '<div class="cal-head"><button type="button" class="icon-btn" data-nav="-1" aria-label="Previous month">' + I('chevron-left') + '</button><strong>' + view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '</strong><button type="button" class="icon-btn" data-nav="1" aria-label="Next month">' + I('chevron-right') + '</button></div>' +
        '<div class="cal-grid cal-dow">' + ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => '<span>' + d + '</span>').join('') + '</div><div class="cal-grid" role="grid">' + cells + '</div>' +
        (Object.keys(busy).length ? '<div class="cal-legend"><span><i class="sel"></i>Selected</span><span><i class="busy"></i>Limited capacity</span></div>' : '');
    };
    el.classList.add('calendar');
    el.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { view.setMonth(view.getMonth() + +nav.dataset.nav); render(); return; }
      const day = e.target.closest('.cal-day');
      if (day && !day.disabled) {
        selected = new Date(day.dataset.date + 'T00:00:00');
        render();
        el.querySelector('.cal-day.selected').focus();
        opts.onSelect && opts.onSelect(day.dataset.date);
      }
    });
    el.addEventListener('keydown', (e) => {
      const day = e.target.closest('.cal-day');
      if (!day) return;
      const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!map[e.key]) return;
      e.preventDefault();
      const all = Array.from(el.querySelectorAll('.cal-day'));
      const next = all[all.indexOf(day) + map[e.key]];
      if (next) { all.forEach((b) => (b.tabIndex = -1)); next.tabIndex = 0; next.focus(); }
    });
    render();
    return { set(v) { selected = new Date(v + 'T00:00:00'); view = new Date(selected); view.setDate(1); render(); }, get: () => selected && U.iso(selected) };
  };

  /* ---------------- Home quick quote ---------------- */
  function quickQuote() {
    const form = document.getElementById('quickQuoteForm');
    if (!form) return;
    const out = document.getElementById('quickQuoteResult');
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!LX.validate(form)) { LX.toast('Missing details', 'Complete the highlighted fields to get a quote.', 'error'); return; }
      const f = new FormData(form);
      const p = { from: f.get('pickup'), to: f.get('delivery'), pickupDate: f.get('pickupDate'), packageType: f.get('packageType'), weight: +f.get('weight'), qty: +f.get('qty'), vehicle: f.get('vehicle'), speed: f.get('priority'), mode: 'road' };
      const btn = form.querySelector('[type="submit"]');
      btn.classList.add('is-loading');
      setTimeout(() => {
        btn.classList.remove('is-loading');
        const q = LX.pricing.quote(p);
        const cap = LX.pricing.VEHICLES[p.vehicle];
        LX.render(out,
          (cap && q.weight > cap.kg ? '<div class="notice warn mb-2">' + I('alert') + '<span>' + U.num(q.weight) + ' kg exceeds the ' + p.vehicle + ' payload (' + U.num(cap.kg) + ' kg). We recommend a larger vehicle.</span></div>' : '') +
          '<div class="quote-breakdown">' +
          '<div><span>Distance</span><strong>' + U.num(q.distance) + ' km</strong></div>' +
          '<div><span>Est. Delivery Time</span><strong>' + q.timeText + '</strong></div>' +
          '<div><span>Transportation</span><strong>' + U.money(q.base + q.handling + q.insurance, 0) + '</strong></div>' +
          '<div><span>Fuel Charge</span><strong>' + U.money(q.fuel, 0) + '</strong></div>' +
          '<div><span>Tax (8%)</span><strong>' + U.money(q.tax, 0) + '</strong></div>' +
          '<div><span>Pickup</span><strong>' + (p.pickupDate ? U.dateShort(p.pickupDate + 'T09:00') : 'Flexible') + '</strong></div>' +
          '</div>' +
          '<div class="quote-total"><div><span class="xs muted">Total Estimate · ' + p.vehicle + ' · ' + p.speed + '</span><div class="amount" id="qqTotal">$0</div></div><button type="button" class="btn btn-accent" id="qqBook">' + I('arrow-right') + 'Book This Shipment</button></div>'
        );
        out.classList.add('show');
        LX.countUp(document.getElementById('qqTotal'), q.total, { prefix: '$', decimals: 2, duration: 900 });
        document.getElementById('qqBook').onclick = () => { LX.store.set('bookingDraft', Object.assign({}, p, { step: 1 })); location.href = 'book-shipment.html'; };
      }, 700);
    });
  }

  /* ---------------- Multi-step booking ---------------- */
  function bookingFlow() {
    const form = document.getElementById('bookingForm');
    if (!form) return;
    form.setAttribute('novalidate', '');
    const steps = Array.from(form.querySelectorAll('.bk-step'));
    const indicator = Array.from(document.querySelectorAll('.bk-progress li'));
    const bar = document.getElementById('bkBar');
    const prevBtn = document.getElementById('bkPrev'), nextBtn = document.getElementById('bkNext');
    const nav = document.getElementById('bkNav');
    let step = 0, promo = 0, calendar = null;

    const draft = LX.store.get('bookingDraft', null);
    if (draft) {
      const set = (n, v) => { const el = form.querySelector('[name="' + n + '"]'); if (el && v !== undefined && v !== null && v !== '') { if (el.type === 'radio') { const r = form.querySelector('[name="' + n + '"][value="' + v + '"]'); if (r) r.checked = true; } else el.value = v; } };
      set('pickupCity', draft.from); set('deliveryCity', draft.to); set('weight', draft.weight); set('qty', draft.qty);
      set('packageType', draft.packageType); set('mode', draft.mode); set('vehicle', draft.vehicle); set('priority', draft.speed);
      if (draft.dims) { set('l', draft.dims.l); set('w', draft.dims.w); set('h', draft.dims.h); }
      if (draft.pickupDate) set('pickupDate', draft.pickupDate);
    }

    const data = () => {
      const f = new FormData(form);
      const o = Object.fromEntries(f.entries());
      o.special = f.getAll('special');
      return o;
    };
    const params = (d) => ({ from: d.pickupCity, to: d.deliveryCity, weight: +d.weight, qty: +d.qty, packageType: d.packageType, mode: d.mode, vehicle: d.vehicle, speed: d.priority, dims: { l: +d.l, w: +d.w, h: +d.h }, declared: +d.declared, pickupDate: d.pickupDate });

    /* Vehicle tiles (road only) */
    const renderVehicles = () => {
      const d = data();
      const total = (+d.weight || 0) * (+d.qty || 1);
      const box = document.getElementById('vehicleTiles');
      const wrap = document.getElementById('vehicleWrap');
      wrap.classList.toggle('hidden', d.mode !== 'road');
      const V = LX.pricing.VEHICLES;
      const rec = Object.keys(V).find((k) => V[k].kg >= total && (!d.special.includes('temperature') || k === 'Refrigerated Truck')) || 'Heavy Truck';
      const current = d.vehicle || rec;
      box.innerHTML = Object.keys(V).map((k) => {
        const over = V[k].kg < total;
        return '<label class="option-tile' + (over ? ' disabled' : '') + '"><input type="radio" name="vehicle" value="' + k + '"' + (k === current && !over ? ' checked' : '') + (over ? ' disabled' : '') + '><span class="tile">' + I(V[k].icon) + '<strong>' + k + '</strong><span>Up to ' + U.num(V[k].kg) + ' kg</span>' + (k === rec ? '<em class="badge badge-accent no-dot">Recommended</em>' : over ? '<em class="badge no-dot">Over capacity</em>' : '') + '</span></label>';
      }).join('');
      if (!box.querySelector('input:checked')) { const r = box.querySelector('input[value="' + rec + '"]'); if (r) r.checked = true; }
      document.getElementById('bkWeightNote').textContent = total ? 'Total shipment weight: ' + U.num(total) + ' kg' : '';
    };

    /* Price step */
    const renderPrice = () => {
      const d = data();
      const q = LX.pricing.quote(params(d));
      const discount = promo ? Math.round(q.total * promo) / 100 : 0;
      const total = q.total - discount;
      const rows = [['Base transportation', q.base], ['Fuel surcharge', q.fuel], ['Handling', q.handling], ['Cargo insurance', q.insurance], ['Tax (8%)', q.tax]];
      if (discount) rows.push(['Promo NORTH10', -discount]);
      document.getElementById('priceBreakdown').innerHTML =
        '<div class="calc-kpis"><div><span>Distance</span><strong>' + U.num(q.distance) + ' km</strong></div><div><span>Transit time</span><strong>' + q.timeText + '</strong></div><div><span>Chargeable</span><strong>' + U.num(q.chargeable) + ' kg</strong></div><div><span>Est. delivery</span><strong>' + U.dateShort(q.eta) + '</strong></div></div>' +
        '<ul class="calc-lines">' + rows.map((r) => '<li><span>' + r[0] + '</span><div class="calc-bar"><i style="width:' + Math.max(2, Math.abs(r[1]) / q.total * 100).toFixed(1) + '%"></i></div><strong' + (r[1] < 0 ? ' class="text-success"' : '') + '>' + (r[1] < 0 ? '−' : '') + U.money(Math.abs(r[1])) + '</strong></li>').join('') +
        '<li class="total"><span>Total due</span><div></div><strong>' + U.money(total) + '</strong></li></ul>';
      return Object.assign({}, q, { discount, total: Math.round(total * 100) / 100 });
    };

    /* Summary sidebar */
    const summary = () => {
      const d = data();
      const el = document.getElementById('bookingSummary');
      if (!el) return;
      const q = d.pickupCity && d.deliveryCity && d.weight ? LX.pricing.quote(params(d)) : null;
      const row = (k, v) => '<li><span>' + k + '</span><strong>' + (v ? U.esc(v) : '<em class="muted">—</em>') + '</strong></li>';
      el.innerHTML = '<ul class="bk-summary">' +
        row('Package', d.packageType ? d.packageType + (d.qty ? ' × ' + d.qty : '') : '') +
        row('Weight', d.weight ? U.num(d.weight * (d.qty || 1)) + ' kg' : '') +
        row('From', d.pickupCity) + row('To', d.deliveryCity) +
        row('Mode', d.mode ? LX.pricing.MODE[d.mode].label + (d.mode === 'road' && d.vehicle ? ' · ' + d.vehicle : '') : '') +
        row('Pickup', d.pickupDate ? U.dateShort(d.pickupDate + 'T09:00') + (d.window ? ' · ' + d.window : '') : '') +
        row('Priority', d.priority) + '</ul>' +
        '<div class="bk-sum-total"><span>Estimated total</span><strong>' + (q ? U.money(q.total) : '—') + '</strong></div>';
      LX.store.set('bookingDraft', Object.assign(params(d), { step }));
    };

    const go = (n) => {
      step = n;
      steps.forEach((s, i) => { s.classList.toggle('active', i === n); s.hidden = i !== n; });
      indicator.forEach((li, i) => { li.classList.toggle('done', i < n); li.classList.toggle('current', i === n); if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      if (bar) bar.style.width = (n / (steps.length - 1)) * 100 + '%';
      prevBtn.disabled = n === 0;
      nextBtn.innerHTML = n === 4 ? I('check') + 'Confirm Booking' : 'Continue' + I('arrow-right');
      nav.classList.toggle('hidden', n === 5);
      if (n === 2) renderVehicles();
      if (n === 3 && !calendar) {
        const input = form.querySelector('[name="pickupDate"]');
        const busy = {};
        for (let i = 3; i < 60; i += 5) busy[U.iso(U.addDays(new Date(), i))] = true;
        calendar = LX.calendar(document.getElementById('pickupCalendar'), { min: new Date(), value: input.value || U.iso(U.addDays(new Date(), 1)), busy, onSelect: (v) => { input.value = v; summary(); } });
        if (!input.value) input.value = U.iso(U.addDays(new Date(), 1));
      }
      if (n === 4) renderPrice();
      summary();
      const top = document.getElementById('bookingTop');
      if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      const h = steps[n].querySelector('h2');
      if (h) { h.setAttribute('tabindex', '-1'); setTimeout(() => h.focus({ preventScroll: true }), 350); }
    };

    const confirm = () => {
      const d = data();
      const q = renderPrice();
      const bookingId = 'NL-BK-' + String(Math.floor(100000 + Math.random() * 899999));
      const shipmentId = 'TRK-2026-' + String(Math.floor(10000 + Math.random() * 89999));
      const avail = LX.data.drivers.filter((x) => x.status === 'Online');
      const drv = avail[Math.floor(Math.random() * avail.length)];
      const veh = LX.data.vehicles.find((v) => v.driver === drv.id);
      const pickup = new Date(d.pickupDate + 'T' + ({ 'Morning (8am–12pm)': '09:00', 'Afternoon (12pm–4pm)': '13:00', 'Evening (4pm–8pm)': '17:00' }[d.window] || '09:00'));
      const session = LX.session.current();
      const shipment = {
        id: shipmentId, customer: d.company || (session && session.company) || d.pickupContact || 'Guest shipper',
        from: d.pickupCity, to: d.deliveryCity, fromLabel: LX.geo.label(d.pickupCity), toLabel: LX.geo.label(d.deliveryCity),
        mode: d.mode, service: (d.priority || 'Standard') + ' ' + (d.mode === 'road' ? d.vehicle : LX.pricing.MODE[d.mode].label + ' Freight'), cargo: d.description || d.packageType,
        weight: Math.round((+d.weight) * (+d.qty || 1)), pieces: +d.qty || 1, priority: d.priority, baseProgress: 0, distance: q.distance,
        driver: d.mode === 'road' ? drv.id : null, driverName: d.mode === 'road' ? drv.name : { air: 'Flight NL 5' + shipmentId.slice(-2), ocean: 'MV NorthLane Horizon', rail: 'Train NA-' + shipmentId.slice(-4) }[d.mode],
        driverPhone: drv.phone, vehicle: d.mode === 'road' ? (veh ? veh.id : 'NL-IL-5521') + ' · ' + d.vehicle : LX.pricing.MODE[d.mode].label + ' capacity confirmed',
        pickupDate: pickup.toISOString(), eta: U.addHours(pickup, q.hours).toISOString(), cost: q.total, bookedAt: new Date().toISOString(),
        temp: (d.special || []).includes('temperature') ? '4°C' : undefined, booked: true
      };
      const booking = { bookingId, shipmentId, createdAt: Date.now(), details: d, quote: q, payment: d.payment, shipment };
      LX.store.push('bookings', booking, 50);
      LX.store.push('invoicesCustom', { id: 'INV-2026-' + (2000 + Math.floor(Math.random() * 999)), shipment: shipmentId, customer: shipment.customer, service: shipment.service, mode: d.mode, route: d.pickupCity + ' → ' + d.deliveryCity, date: new Date().toISOString(), due: U.addDays(new Date(), 30).toISOString(), subtotal: q.base, fuel: q.fuel, handling: q.handling + q.insurance, tax: q.tax, total: q.total, status: d.payment === 'invoice' ? 'Pending' : 'Paid' }, 50);
      LX.notify.add('Booking confirmed', bookingId + ' · ' + shipmentId + ' from ' + d.pickupCity + ' to ' + d.deliveryCity + '.', 'success');
      LX.store.remove('bookingDraft');
      LX.render('#bkConfirm',
        '<div class="bk-success"><div class="bk-check">' + I('check') + '</div><h2>Booking Confirmed</h2><p>Your shipment is scheduled. A confirmation has been sent to <strong>' + U.esc(d.pickupEmail || 'your email') + '</strong>.</p></div>' +
        '<div class="bk-ids">' +
        '<div><span>Booking ID</span><strong class="mono">' + bookingId + '</strong></div>' +
        '<div><span>Shipment ID</span><strong class="mono">' + shipmentId + '</strong></div>' +
        '<div><span>Estimated Delivery</span><strong>' + U.dateTime(shipment.eta) + '</strong></div>' +
        '<div><span>Shipping Cost</span><strong>' + U.money(q.total) + '</strong></div>' +
        '</div>' +
        '<div class="kv mt-3"><div><span>Route</span><strong>' + U.esc(shipment.fromLabel) + ' → ' + U.esc(shipment.toLabel) + '</strong></div><div><span>Pickup window</span><strong>' + U.date(pickup) + ' · ' + U.esc(d.window) + '</strong></div><div><span>Assigned</span><strong>' + U.esc(shipment.driverName) + '</strong></div><div><span>Vehicle</span><strong>' + U.esc(shipment.vehicle) + '</strong></div></div>' +
        '<div class="flex flex-wrap mt-4" style="justify-content:center"><a class="btn" href="tracking.html?id=' + shipmentId + '">' + I('map') + 'Track Shipment</a><a class="btn btn-ghost" href="shipment-details.html?id=' + shipmentId + '">' + I('file') + 'Shipment Details</a><a class="btn btn-ghost" href="customer-dashboard.html">' + I('grid') + 'Go to Dashboard</a><button type="button" class="btn btn-ghost" onclick="window.print()">' + I('printer') + 'Print</button></div>'
      );
      go(5);
      LX.toast('Booking confirmed', bookingId + ' has been created.', 'success');
    };

    nextBtn.addEventListener('click', () => {
      if (!LX.validate(steps[step])) { LX.toast('A few details are missing', 'Please complete the highlighted fields.', 'error'); return; }
      if (step === 1) {
        const d = data();
        if (d.pickupCity && d.deliveryCity && d.pickupCity.trim().toLowerCase() === d.deliveryCity.trim().toLowerCase()) { LX.toast('Check locations', 'Pickup and delivery cannot be the same place.', 'error'); return; }
      }
      if (step === 4) { nextBtn.classList.add('is-loading'); setTimeout(() => { nextBtn.classList.remove('is-loading'); confirm(); }, 900); return; }
      go(step + 1);
    });
    prevBtn.addEventListener('click', () => go(Math.max(0, step - 1)));
    indicator.forEach((li, i) => li.addEventListener('click', () => { if (i < step && step < 5) go(i); }));
    form.addEventListener('input', U.debounce(summary, 200));
    form.addEventListener('change', (e) => {
      if (e.target.name === 'mode' || e.target.name === 'special') renderVehicles();
      if (step === 4) renderPrice();
      summary();
    });
    const promoBtn = document.getElementById('promoBtn');
    promoBtn && promoBtn.addEventListener('click', () => {
      const v = form.querySelector('[name="promo"]').value.trim().toUpperCase();
      if (v === 'NORTH10') { promo = 10; renderPrice(); LX.toast('Promo applied', '10% off this shipment.', 'success'); }
      else LX.toast('Invalid code', 'Try NORTH10 for 10% off your first booking.', 'error');
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    go(0);
  }

  LX.ready(() => { quickQuote(); bookingFlow(); });
})();
