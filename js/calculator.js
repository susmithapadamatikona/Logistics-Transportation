/* ==========================================================================
   NorthLane Logistics — Pricing engine & shipping calculator
   LX.pricing.quote(params) is shared by the calculator, the home quick
   quote and the multi-step booking flow.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  const MODE = {
    road: { label: 'Road', icon: 'truck', divisor: 5000, fuel: 0.14, speed: 68, prep: 6, base: 45 },
    rail: { label: 'Rail', icon: 'train', divisor: 5000, fuel: 0.09, speed: 55, prep: 30, base: 180 },
    air: { label: 'Air', icon: 'plane', divisor: 6000, fuel: 0.18, speed: 760, prep: 18, base: 120 },
    ocean: { label: 'Ocean', icon: 'ship', divisor: 1000, fuel: 0.11, speed: 30, prep: 96, base: 350 }
  };
  const SPEEDS = {
    'Standard': { mult: 1, time: 1 },
    'Express': { mult: 1.35, time: 0.72 },
    'Same Day': { mult: 1.75, time: 0.5 },
    'Urgent': { mult: 2.1, time: 0.55 }
  };
  const VEHICLES = {
    'Mini Truck': { mult: 0.7, kg: 750, icon: 'truck' },
    'Van': { mult: 0.8, kg: 1500, icon: 'van' },
    'Pickup Truck': { mult: 0.85, kg: 1100, icon: 'truck' },
    'Medium Truck': { mult: 1, kg: 8000, icon: 'truck' },
    'Heavy Truck': { mult: 1.3, kg: 24000, icon: 'truck' },
    'Container Truck': { mult: 1.45, kg: 28000, icon: 'container' },
    'Refrigerated Truck': { mult: 1.55, kg: 18000, icon: 'snowflake' }
  };
  const PACKAGES = { 'Documents': 0.6, 'Parcel': 1, 'Pallet': 1.05, 'Crate': 1.1, 'Fragile Goods': 1.2, 'Perishable': 1.25, 'Hazardous Materials': 1.45, 'Heavy Machinery': 1.3, 'Container (FCL)': 1.15 };
  const TAX = 0.08;

  function quote(p) {
    const mode = MODE[p.mode] ? p.mode : 'road';
    const m = MODE[mode];
    const qty = Math.max(1, +p.qty || 1);
    const weight = Math.max(0.1, +p.weight || 1) * qty;
    const vol = p.dims && p.dims.l && p.dims.w && p.dims.h ? (p.dims.l * p.dims.w * p.dims.h * qty) / m.divisor : 0;
    const chargeable = Math.max(weight, vol);
    const distance = LX.geo.distance(p.from, p.to, mode) || 0;
    const speed = SPEEDS[p.speed] || SPEEDS.Standard;
    const pkg = PACKAGES[p.packageType] || 1;
    const veh = mode === 'road' && VEHICLES[p.vehicle] ? VEHICLES[p.vehicle].mult : 1;

    let base;
    if (mode === 'road') base = m.base + distance * 1.15 * veh + chargeable * distance * 0.00018;
    else if (mode === 'rail') base = m.base + distance * 0.7 + chargeable * distance * 0.00009;
    else if (mode === 'air') base = m.base + chargeable * (1.9 + distance / 4000);
    else base = m.base + Math.max(1, chargeable / 1000) * (60 + distance * 0.012); // ocean: per tonne / CBM
    base = base * pkg * speed.mult;

    const fuel = base * m.fuel;
    const handling = 25 + qty * 4 + (p.packageType === 'Fragile Goods' ? 40 : 0) + (p.packageType === 'Hazardous Materials' ? 120 : 0);
    const insurance = p.insurance === false ? 0 : Math.max(15, (+p.declared > 0 ? +p.declared * 0.006 : base * 0.015));
    const tax = (base + fuel + handling + insurance) * TAX;
    const total = base + fuel + handling + insurance + tax;
    const hours = (distance / m.speed + m.prep) * speed.time;
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
      mode, distance, chargeable: Math.round(chargeable), weight: Math.round(weight), volumetric: Math.round(vol),
      hours, timeText: timeText(hours), eta: U.addHours(new Date(p.pickupDate || Date.now()), hours + 2).toISOString(),
      base: r2(base), fuel: r2(fuel), handling: r2(handling), insurance: r2(insurance), tax: r2(tax), total: r2(total),
      fuelRate: m.fuel, sameDayWarning: p.speed === 'Same Day' && (mode !== 'road' || distance > 650)
    };
  }
  function timeText(h) {
    if (h < 24) { const a = Math.max(2, Math.floor(h)), b = Math.ceil(h * 1.2) + 1; return a + '–' + b + ' hours'; }
    const d = h / 24; const a = Math.max(1, Math.floor(d)), b = Math.ceil(d * 1.15) + (d > 10 ? 2 : 0);
    return a === b ? a + ' day' + (a > 1 ? 's' : '') : a + '–' + b + ' days';
  }

  LX.pricing = { quote, MODE, SPEEDS, VEHICLES, PACKAGES, TAX, timeText };

  /* ---------------- Calculator page ---------------- */
  function calculatorPage() {
    const form = document.getElementById('calcForm');
    if (!form) return;
    const out = document.getElementById('calcResult');
    const read = () => {
      const f = new FormData(form);
      return {
        from: f.get('origin'), to: f.get('destination'), packageType: f.get('packageType'),
        weight: +f.get('weight'), qty: +f.get('qty'), mode: f.get('mode'), speed: f.get('speed'),
        dims: { l: +f.get('l'), w: +f.get('w'), h: +f.get('h') }, insurance: form.querySelector('[name="insurance"]').checked, declared: +f.get('declared')
      };
    };
    let lastTotal = 0;
    const calc = (announce) => {
      const p = read();
      if (!p.from || !p.to || !p.weight) {
        out.innerHTML = '<div class="calc-empty">' + I('percent') + '<h3>Your quote appears here</h3><p>Enter an origin, destination and weight to see a full price breakdown.</p></div>';
        return;
      }
      const q = quote(p);
      const rows = [['Base Price', q.base], ['Fuel Surcharge (' + Math.round(q.fuelRate * 100) + '%)', q.fuel], ['Handling Fee', q.handling], ['Insurance', q.insurance], ['Tax (8%)', q.tax]];
      LX.render(out,
        '<div class="calc-summary"><div><span class="xs muted">Final Shipping Cost</span><div class="calc-total" id="calcTotal">' + U.money(q.total) + '</div><span class="xs muted">' + LX.geo.label(p.from) + ' → ' + LX.geo.label(p.to) + '</span></div><span class="icon-box">' + I(MODE[q.mode].icon) + '</span></div>' +
        '<div class="calc-kpis"><div><span>Estimated Distance</span><strong>' + U.num(q.distance) + ' km</strong></div><div><span>Delivery Time</span><strong>' + q.timeText + '</strong></div><div><span>Chargeable Weight</span><strong>' + U.num(q.chargeable) + ' kg</strong></div><div><span>Est. Delivery</span><strong>' + U.dateShort(q.eta) + '</strong></div></div>' +
        (q.sameDayWarning ? '<div class="notice warn mt-2">' + I('alert') + '<span>Same-day service is available for road shipments under 650 km. This lane will be quoted as next-flight-out.</span></div>' : '') +
        '<ul class="calc-lines">' + rows.map((r) => '<li><span>' + r[0] + '</span><div class="calc-bar"><i style="width:' + Math.max(2, (r[1] / q.total) * 100).toFixed(1) + '%"></i></div><strong>' + U.money(r[1]) + '</strong></li>').join('') +
        '<li class="total"><span>Total</span><div></div><strong>' + U.money(q.total) + '</strong></li></ul>' +
        '<div class="flex flex-wrap mt-3"><button class="btn btn-accent" id="calcBook">' + I('package') + 'Book This Shipment</button><button class="btn btn-ghost" id="calcSave">' + I('bookmark') + 'Save Quote</button></div>'
      );
      const el = document.getElementById('calcTotal');
      LX.countUp(el, q.total, { from: lastTotal, prefix: '$', decimals: 2, duration: 700 });
      lastTotal = q.total;
      compare(p);
      document.getElementById('calcBook').onclick = () => { LX.store.set('bookingDraft', Object.assign({}, p, { step: 1 })); location.href = 'book-shipment.html'; };
      document.getElementById('calcSave').onclick = () => {
        LX.store.push('quotes', { id: U.uid('QT-', 6), at: Date.now(), from: p.from, to: p.to, mode: q.mode, weight: q.weight, total: q.total, time: q.timeText }, 30);
        LX.toast('Quote saved', 'Find it under Quotes in your customer dashboard.', 'success');
      };
      if (announce) LX.toast('Quote updated', U.money(q.total) + ' · ' + q.timeText, 'info', 2200);
    };
    const compare = (p) => {
      const body = document.getElementById('compareBody');
      if (!body) return;
      const all = Object.keys(MODE).map((k) => Object.assign({ k }, quote(Object.assign({}, p, { mode: k }))));
      const cheapest = all.reduce((a, b) => (a.total < b.total ? a : b)).k;
      const fastest = all.reduce((a, b) => (a.hours < b.hours ? a : b)).k;
      const co2 = { road: 62, rail: 22, air: 602, ocean: 8 };
      body.innerHTML = all.map((q) => '<tr' + (q.k === p.mode ? ' class="selected"' : '') + '><td><span class="flex"><span class="icon-box sm">' + I(MODE[q.k].icon) + '</span><strong>' + MODE[q.k].label + '</strong></span></td><td>' + U.num(q.distance) + ' km</td><td>' + q.timeText + (q.k === fastest ? ' <span class="badge badge-primary no-dot">Fastest</span>' : '') + '</td><td>' + U.num((q.chargeable / 1000) * q.distance * co2[q.k] / 1000, 1) + ' kg</td><td><strong>' + U.money(q.total) + '</strong>' + (q.k === cheapest ? ' <span class="badge badge-success no-dot">Best value</span>' : '') + '</td><td><button class="btn btn-ghost btn-xs" data-pick-mode="' + q.k + '">Select</button></td></tr>').join('');
    };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick-mode]');
      if (!b) return;
      const r = form.querySelector('[name="mode"][value="' + b.dataset.pickMode + '"]');
      if (r) { r.checked = true; calc(true); document.getElementById('calcResult').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    form.addEventListener('input', U.debounce(() => calc(false), 250));
    form.addEventListener('change', () => calc(false));
    form.addEventListener('submit', (e) => { e.preventDefault(); if (LX.validate(form)) calc(true); });
    document.getElementById('swapCities') && document.getElementById('swapCities').addEventListener('click', () => {
      const a = form.querySelector('[name="origin"]'), b = form.querySelector('[name="destination"]');
      [a.value, b.value] = [b.value, a.value];
      calc(false);
    });
    calc(false);
  }

  LX.ready(calculatorPage);
})();
