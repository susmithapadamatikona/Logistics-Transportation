/* ==========================================================================
   NorthLane Logistics — Data layer
   LocalStorage store, utilities, geo/route math, demo datasets,
   session helpers and the live shipment simulation engine.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const PREFIX = 'nl_';
  const DATA_VERSION = '1.2';

  /* ---------------- Storage ---------------- */
  const store = (LX.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(PREFIX + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
      return value;
    },
    remove(key) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} },
    push(key, item, max) {
      const arr = store.get(key, []);
      arr.unshift(item);
      if (max && arr.length > max) arr.length = max;
      return store.set(key, arr);
    }
  });

  /* ---------------- Utilities ---------------- */
  const util = (LX.util = {
    money(n, dec) {
      const d = dec === undefined ? 2 : dec;
      return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    num(n, dec) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: dec || 0 }); },
    compact(n) { return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n); },
    date(d, opts) { return new Date(d).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' }); },
    dateShort(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
    time(d) { return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); },
    dateTime(d) { return util.dateShort(d) + ', ' + util.time(d); },
    iso(d) { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); },
    addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
    addHours(d, h) { return new Date(new Date(d).getTime() + h * 3600000); },
    duration(hours) {
      if (hours < 1 / 60) return 'Arriving';
      const d = Math.floor(hours / 24), h = Math.floor(hours % 24), m = Math.round((hours * 60) % 60);
      if (d > 0) return d + 'd ' + h + 'h';
      return (h ? h + 'h ' : '') + m + 'm';
    },
    ago(ts) {
      const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
      if (s < 10) return 'Just now';
      if (s < 60) return s + ' seconds ago';
      if (s < 3600) return Math.floor(s / 60) + ' min ago';
      if (s < 86400) return Math.floor(s / 3600) + ' h ago';
      return Math.floor(s / 86400) + ' d ago';
    },
    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    },
    rng(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    clamp(v, a, b) { return Math.min(b, Math.max(a, v)); },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    param(name) { return new URLSearchParams(location.search).get(name); },
    uid(prefix, digits) { return prefix + String(Math.floor(Math.random() * Math.pow(10, digits || 5))).padStart(digits || 5, '0'); },
    debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 200); }; },
    slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); },
    initials(name) { return String(name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(); }
  });

  /* ---------------- Geography ---------------- */
  const CITIES = {
    'New York': [40.7128, -74.006, 'USA'], 'Chicago': [41.8781, -87.6298, 'USA'], 'Los Angeles': [34.0522, -118.2437, 'USA'],
    'Dallas': [32.7767, -96.797, 'USA'], 'Atlanta': [33.749, -84.388, 'USA'], 'Houston': [29.7604, -95.3698, 'USA'],
    'Denver': [39.7392, -104.9903, 'USA'], 'Seattle': [47.6062, -122.3321, 'USA'], 'Miami': [25.7617, -80.1918, 'USA'],
    'Memphis': [35.1495, -90.049, 'USA'], 'Phoenix': [33.4484, -112.074, 'USA'], 'Kansas City': [39.0997, -94.5786, 'USA'],
    'Nashville': [36.1627, -86.7816, 'USA'], 'St. Louis': [38.627, -90.1994, 'USA'], 'Oklahoma City': [35.4676, -97.5164, 'USA'],
    'Toronto': [43.6532, -79.3832, 'Canada'], 'Mexico City': [19.4326, -99.1332, 'Mexico'],
    'London': [51.5074, -0.1278, 'UK'], 'Rotterdam': [51.9244, 4.4777, 'Netherlands'], 'Hamburg': [53.5511, 9.9937, 'Germany'],
    'Frankfurt': [50.1109, 8.6821, 'Germany'], 'Paris': [48.8566, 2.3522, 'France'], 'Madrid': [40.4168, -3.7038, 'Spain'],
    'Milan': [45.4642, 9.19, 'Italy'], 'Warsaw': [52.2297, 21.0122, 'Poland'], 'Dubai': [25.2048, 55.2708, 'UAE'],
    'Mumbai': [19.076, 72.8777, 'India'], 'Delhi': [28.6139, 77.209, 'India'], 'Singapore': [1.3521, 103.8198, 'Singapore'],
    'Shanghai': [31.2304, 121.4737, 'China'], 'Hong Kong': [22.3193, 114.1694, 'China'], 'Tokyo': [35.6762, 139.6503, 'Japan'],
    'Busan': [35.1796, 129.0756, 'South Korea'], 'Sydney': [-33.8688, 151.2093, 'Australia'], 'São Paulo': [-23.5505, -46.6333, 'Brazil'],
    'Johannesburg': [-26.2041, 28.0473, 'South Africa'], 'Lagos': [6.5244, 3.3792, 'Nigeria']
  };

  const geo = (LX.geo = {
    cities: CITIES,
    cityNames: Object.keys(CITIES).sort(),
    find(name) {
      if (!name) return null;
      const n = String(name).toLowerCase().split(',')[0].trim();
      const key = Object.keys(CITIES).find((c) => c.toLowerCase() === n) || Object.keys(CITIES).find((c) => n.includes(c.toLowerCase()) || c.toLowerCase().includes(n));
      return key ? { name: key, lat: CITIES[key][0], lng: CITIES[key][1], country: CITIES[key][2] } : null;
    },
    label(name) { const c = geo.find(name); return c ? c.name + ', ' + c.country : name; },
    haversine(a, b) {
      const R = 6371, toR = Math.PI / 180;
      const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    },
    /* Estimated transport distance between two place names (km). Unknown places get a stable pseudo-distance. */
    distance(from, to, mode) {
      const a = geo.find(from), b = geo.find(to);
      const factor = { road: 1.22, rail: 1.18, air: 1.04, ocean: 1.35 }[mode || 'road'] || 1.2;
      if (a && b) return Math.max(18, Math.round(geo.haversine([a.lat, a.lng], [b.lat, b.lng]) * factor));
      if (!from || !to) return 0;
      return 120 + (util.hash(String(from).toLowerCase() + '>' + String(to).toLowerCase()) % 2200);
    },
    /* Build a smooth route polyline between two coordinates. */
    route(a, b, opts) {
      opts = opts || {};
      const mode = opts.mode || 'road';
      const n = opts.points || 80;
      let bl = b[1];
      if (bl - a[1] > 180) bl -= 360; else if (a[1] - bl > 180) bl += 360;
      const B = [b[0], bl];
      const dx = B[1] - a[1], dy = B[0] - a[0];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const bend = (opts.bend !== undefined ? opts.bend : (mode === 'air' ? 0.18 : mode === 'ocean' ? 0.12 : 0.06)) * len;
      const ctrl = [(a[0] + B[0]) / 2 + ny * bend, (a[1] + B[1]) / 2 + nx * bend];
      const seed = util.rng(util.hash(a.join() + B.join()));
      const waves = 3 + Math.floor(seed() * 4);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        let lat = u * u * a[0] + 2 * u * t * ctrl[0] + t * t * B[0];
        let lng = u * u * a[1] + 2 * u * t * ctrl[1] + t * t * B[1];
        if (mode === 'road' || mode === 'rail') {
          const wob = Math.sin(t * Math.PI * waves) * Math.sin(t * Math.PI) * len * 0.018;
          lat += ny * wob; lng += nx * wob;
        }
        pts.push([lat, lng]);
      }
      return pts;
    },
    pathLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += geo.haversine(pts[i - 1], pts[i]); return d; },
    /* Interpolated position at fraction p along the polyline */
    pointAt(pts, p) {
      p = util.clamp(p, 0, 1);
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) { const d = geo.haversine(pts[i - 1], pts[i]); segs.push(d); total += d; }
      let target = total * p;
      for (let i = 0; i < segs.length; i++) {
        if (target <= segs[i]) {
          const f = segs[i] ? target / segs[i] : 0;
          const A = pts[i], B = pts[i + 1];
          return { latlng: [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f], index: i + 1, bearing: Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI };
        }
        target -= segs[i];
      }
      return { latlng: pts[pts.length - 1], index: pts.length - 1, bearing: 0 };
    }
  });

  /* ---------------- Reference data ---------------- */
  const IMG = 'assets/images/';

  const customers = [
    'Helix Pharma', 'Summit Foods', 'Brightline Retail', 'Arcadia Electronics', 'Orbit Commerce', 'Kestrel Motors',
    'Vantage Health', 'Northwind Apparel', 'Granite Build Co.', 'Solace Energy', 'Crescent Agro', 'Nimbus Tech'
  ];

  const driverSeed = [
    ['Marcus Reyes', 1, 'Chicago', 12, 'On Delivery'], ['Daniel Brooks', 3, 'Denver', 9, 'On Delivery'],
    ['Andre Coleman', 5, 'New York', 14, 'On Delivery'], ['Sofia Lindqvist', 6, 'Los Angeles', 7, 'On Delivery'],
    ['Viktor Hale', 7, 'Houston', 18, 'On Delivery'], ['Hannah Weber', 8, 'Hamburg', 6, 'Online'],
    ['Mei Tanaka', 10, 'Atlanta', 5, 'Online'], ['Lucas Fischer', 11, 'Madrid', 8, 'Break'],
    ['Tom Becker', 12, 'Toronto', 11, 'On Delivery'], ['Diego Alvarez', 13, 'London', 4, 'On Delivery'],
    ['Ethan Moore', 17, 'Dallas', 10, 'Online'], ['Noah Petrov', 18, 'Phoenix', 3, 'Offline'],
    ['Liam Carter', 19, 'Seattle', 7, 'Break'], ['Kai Morgan', 20, 'Miami', 6, 'Online'],
    ['Robert Kline', 9, 'Memphis', 22, 'Online'], ['Priya Nair', 4, 'Nashville', 9, 'Offline'],
    ['Jordan Blake', null, 'Kansas City', 5, 'Online'], ['Samira Haddad', null, 'Dallas', 8, 'On Delivery'],
    ['Owen Fletcher', null, 'St. Louis', 13, 'Break'], ['Aisha Bello', null, 'Atlanta', 4, 'Online'],
    ['Mateo Rossi', null, 'Milan', 10, 'On Delivery'], ['Chloe Martin', null, 'Paris', 6, 'Offline'],
    ['Ravi Menon', null, 'Oklahoma City', 7, 'Online'], ['Tessa Novak', null, 'Warsaw', 9, 'On Delivery']
  ];

  const VTYPES = {
    'Delivery Van': { cap: '1.5 t', kg: 1500, icon: 'van', img: IMG + 'fleet/delivery-van-loading.jpg' },    'Pickup Truck': { cap: '1.1 t', kg: 1100, icon: 'truck', img: IMG + 'trucks/mountain-truck.jpg' },
    'Medium Truck': { cap: '8 t', kg: 8000, icon: 'truck', img: IMG + 'trucks/road-truck-desert.jpg' },
    'Heavy Truck': { cap: '24 t', kg: 24000, icon: 'truck', img: IMG + 'trucks/heavy-truck.jpg' },
    'Container Truck': { cap: '40 ft · 28 t', kg: 28000, icon: 'container', img: IMG + 'trucks/scania-truck.jpg' },
    'Refrigerated Truck': { cap: '18 t · -25/+25 °C', kg: 18000, icon: 'snowflake', img: IMG + 'trucks/long-haul-truck.jpg' },
    'Electric Delivery Vehicle': { cap: '1.2 t · 280 km range', kg: 1200, icon: 'battery', img: IMG + 'fleet/courier-scooter.jpg' }
  };

  function buildDrivers() {
    const r = util.rng(7);
    return driverSeed.map((d, i) => ({
      id: 'DRV-' + (1001 + i),
      name: d[0],
      photo: d[1] ? IMG + 'drivers/person-' + d[1] + '.jpg' : null,
      location: d[2],
      experience: d[3],
      status: d[4],
      rating: Math.round((4.5 + r() * 0.5) * 10) / 10,
      deliveries: 380 + Math.floor(r() * 2600),
      onTime: Math.round((93 + r() * 6.6) * 10) / 10,
      hours: 28 + Math.floor(r() * 18),
      phone: '+1 (312) 555-0' + String(100 + i * 7).slice(-3),
      license: i % 4 === 0 ? 'CDL Class A · HAZMAT' : i % 3 === 0 ? 'CDL Class B' : 'CDL Class A',
      vehicle: null
    }));
  }

  function buildVehicles(drivers) {
    const r = util.rng(42);
    const types = Object.keys(VTYPES);
    const states = ['IL', 'TX', 'CA', 'GA', 'NY', 'CO', 'WA', 'FL', 'TN', 'AZ'];
    const statusPool = ['On Route', 'On Route', 'On Route', 'Available', 'Available', 'Loading', 'Maintenance', 'Offline'];
    const list = [];
    for (let i = 0; i < 32; i++) {
      const type = types[i % types.length];
      const driver = drivers[i] || null;
      let status = statusPool[Math.floor(r() * statusPool.length)];
      if (driver && driver.status === 'On Delivery') status = 'On Route';
      if (driver && driver.status === 'Offline') status = 'Offline';
      if (!driver && status === 'On Route') status = 'Available';
      const plate = 'NL-' + states[i % states.length] + '-' + (4000 + Math.floor(r() * 5999));
      const v = {
        id: plate,
        type,
        capacity: VTYPES[type].cap,
        driver: driver ? driver.id : null,
        driverName: driver ? driver.name : 'Unassigned',
        location: driver ? driver.location : geo.cityNames[Math.floor(r() * geo.cityNames.length)],
        fuel: type === 'Electric Delivery Vehicle' ? 35 + Math.floor(r() * 64) : 18 + Math.floor(r() * 80),
        mileage: 18000 + Math.floor(r() * 320000),
        nextService: util.iso(util.addDays(new Date(), 3 + Math.floor(r() * 80))),
        deliveries: 120 + Math.floor(r() * 2200),
        year: 2019 + Math.floor(r() * 7),
        utilization: 48 + Math.floor(r() * 50),
        status
      };
      if (driver) driver.vehicle = plate;
      list.push(v);
    }
    return list;
  }

  const drivers = buildDrivers();
  const vehicles = buildVehicles(drivers);
  const drv = (i) => drivers[i];

  /* Shipment seed: [idSuffix, customer, from, to, mode, service, cargo, weightKg, pieces, progress, driverIdx|carrier, priority, extra] */
  const shipmentSeed = [
    ['45821', 0, 'Chicago', 'Dallas', 'road', 'Temperature Controlled', 'Pharmaceuticals', 6400, 18, 0.58, 0, 'Express', { temp: '4°C' }],
    ['28491', 1, 'Denver', 'Chicago', 'road', 'Full Truckload', 'Chilled Food & Beverage', 17200, 26, 0.62, 1, 'Standard', { temp: '4°C' }],
    ['51207', 2, 'New York', 'Atlanta', 'road', 'Less Than Truckload', 'Retail Merchandise', 3800, 42, 0.34, 2, 'Standard'],
    ['60318', 3, 'Los Angeles', 'Seattle', 'road', 'Full Truckload', 'Consumer Electronics', 12600, 60, 0.81, 3, 'Express'],
    ['73942', 4, 'Houston', 'Miami', 'road', 'Express Delivery', 'E-Commerce Parcels', 2100, 320, 0.93, 4, 'Same Day'],
    ['38210', 3, 'Shanghai', 'Los Angeles', 'ocean', 'Full Container Load', 'Consumer Electronics', 21800, 2, 0.47, 'MV NorthLane Meridian', 'Standard', { container: 'NLMU 482193-7' }],
    ['44719', 5, 'Rotterdam', 'New York', 'ocean', 'Less Container Load', 'Machinery Parts', 7400, 11, 0.22, 'MV Atlantic Crest', 'Standard', { container: 'NLMU 330418-2' }],
    ['90112', 5, 'Frankfurt', 'Dubai', 'air', 'Express Air Freight', 'Automotive Components', 940, 14, 0.66, 'Flight NL 482', 'Express'],
    ['15533', 6, 'Singapore', 'London', 'air', 'Priority Air Freight', 'Medical Devices', 420, 6, 0.12, 'Flight NL 219', 'Urgent'],
    ['62048', 8, 'Hamburg', 'Warsaw', 'rail', 'Rail Freight', 'Industrial Components', 18400, 4, 0.41, 'Train EU-7731', 'Standard'],
    ['70331', 2, 'Atlanta', 'Memphis', 'road', 'Regional Delivery', 'Retail Merchandise', 5200, 34, 0.03, 6, 'Standard'],
    ['83374', 7, 'Mumbai', 'Dubai', 'ocean', 'Import · Port-to-Port', 'Textiles & Apparel', 16300, 1, 0.71, 'MV Arabian Star', 'Standard', { container: 'NLMU 771250-4' }],
    ['24590', 9, 'Dallas', 'Houston', 'road', 'Heavy Cargo', 'Solar Inverters', 15800, 12, 1, 10, 'Standard'],
    ['36781', 10, 'Seattle', 'Denver', 'road', 'Full Truckload', 'Agricultural Equipment', 11200, 8, 1, 12, 'Standard'],
    ['48822', 7, 'Madrid', 'Paris', 'road', 'Full Truckload', 'Fashion Apparel', 6900, 88, 1, 7, 'Express'],
    ['57314', 11, 'Toronto', 'Chicago', 'road', 'Less Than Truckload', 'Networking Hardware', 2600, 30, 0.55, 8, 'Express', { delayed: true, delayReason: 'Customs inspection at Detroit–Windsor crossing' }],
    ['66205', 6, 'Tokyo', 'Sydney', 'air', 'International Cargo', 'Diagnostic Equipment', 780, 9, 0.88, 'Flight NL 604', 'Express'],
    ['79460', 4, 'Miami', 'Mexico City', 'air', 'Door-to-Door Air', 'E-Commerce Parcels', 1350, 140, 0.3, 'Flight NL 377', 'Standard'],
    ['88137', 8, 'London', 'Milan', 'road', 'Full Truckload', 'Construction Materials', 19800, 16, 0.07, 9, 'Standard'],
    ['99021', 1, 'Phoenix', 'Los Angeles', 'road', 'Refrigerated', 'Fresh Produce', 14100, 24, 1, 11, 'Same Day', { temp: '2°C' }],
    ['31176', 0, 'Memphis', 'Nashville', 'road', 'Temperature Controlled', 'Vaccines', 1200, 40, 0.18, 14, 'Urgent', { temp: '5°C' }],
    ['42650', 2, 'Kansas City', 'St. Louis', 'road', 'Last-Mile Delivery', 'Retail Orders', 900, 64, 0.76, 16, 'Same Day']
  ];

  const SPEED = { road: 68, rail: 55, air: 760, ocean: 30 };

  function buildShipments() {
    const now = new Date();
    return shipmentSeed.map((s, i) => {
      const [suffix, cust, from, to, mode, service, cargo, weight, pieces, progress, carrier, priority, extra] = s;
      const a = geo.find(from), b = geo.find(to);
      const dist = geo.distance(from, to, mode);
      const hoursTotal = dist / SPEED[mode] + (mode === 'air' ? 10 : mode === 'ocean' ? 48 : 4);
      const pickup = util.addHours(now, -hoursTotal * Math.max(progress, 0.02) - 6);
      const d = typeof carrier === 'number' ? drv(carrier) : null;
      const veh = d ? vehicles.find((v) => v.driver === d.id) : null;
      const cost = Math.round((dist * (mode === 'air' ? 3.9 : mode === 'ocean' ? 0.9 : mode === 'rail' ? 1.1 : 1.85) + weight * (mode === 'air' ? 1.6 : 0.09)) * (priority === 'Urgent' ? 1.45 : priority === 'Same Day' ? 1.3 : priority === 'Express' ? 1.18 : 1));
      return Object.assign({
        id: 'TRK-2026-' + suffix,
        customer: customers[cust],
        from, to,
        fromLabel: a ? a.name + ', ' + a.country : from,
        toLabel: b ? b.name + ', ' + b.country : to,
        mode, service, cargo, weight, pieces, priority,
        baseProgress: progress,
        distance: dist,
        driver: d ? d.id : null,
        driverName: d ? d.name : carrier,
        driverPhone: d ? d.phone : '+1 (800) 555-0148',
        vehicle: veh ? veh.id + ' · ' + veh.type : mode === 'ocean' ? carrier : mode === 'air' ? carrier + ' · B777F' : carrier,
        pickupDate: pickup.toISOString(),
        eta: util.addHours(pickup, hoursTotal).toISOString(),
        cost,
        bookedAt: util.addHours(pickup, -30).toISOString(),
        index: i
      }, extra || {});
    });
  }

  const shipments = buildShipments();

  const invoices = shipments.slice(0, 18).map((s, i) => {
    const subtotal = s.cost;
    const fuel = Math.round(subtotal * 0.12 * 100) / 100;
    const handling = s.mode === 'road' ? 85 : s.mode === 'air' ? 160 : 240;
    const tax = Math.round((subtotal + fuel + handling) * 0.08 * 100) / 100;
    const statuses = ['Paid', 'Paid', 'Pending', 'Paid', 'Overdue', 'Pending', 'Paid', 'Paid', 'Pending', 'Paid', 'Overdue', 'Paid'];
    const date = util.addDays(new Date(s.bookedAt), 0);
    return {
      id: 'INV-2026-' + (1040 + i),
      shipment: s.id,
      customer: s.customer,
      service: s.service,
      mode: s.mode,
      route: s.from + ' → ' + s.to,
      date: date.toISOString(),
      due: util.addDays(date, 30).toISOString(),
      subtotal, fuel, handling, tax,
      total: Math.round((subtotal + fuel + handling + tax) * 100) / 100,
      status: statuses[i % statuses.length]
    };
  });

  const warehouses = [
    { id: 'WH-CHI', name: 'Chicago Distribution Center', city: 'Chicago', sqft: 420000, occupancy: 78, docks: 64, inbound: 142, outbound: 188, orders: 1260, type: 'Distribution Center' },
    { id: 'WH-DAL', name: 'Dallas Regional Hub', city: 'Dallas', sqft: 310000, occupancy: 74, docks: 48, inbound: 96, outbound: 131, orders: 940, type: 'Cross-Dock Hub' },
    { id: 'WH-ATL', name: 'Atlanta Cross-Dock', city: 'Atlanta', sqft: 185000, occupancy: 64, docks: 52, inbound: 118, outbound: 124, orders: 610, type: 'Cross-Dock' },
    { id: 'WH-LAX', name: 'Los Angeles Gateway', city: 'Los Angeles', sqft: 520000, occupancy: 88, docks: 80, inbound: 210, outbound: 176, orders: 1840, type: 'Port Gateway' },
    { id: 'WH-NYC', name: 'Newark Fulfillment Center', city: 'New York', sqft: 280000, occupancy: 71, docks: 40, inbound: 88, outbound: 164, orders: 2210, type: 'E-Commerce Fulfillment' },
    { id: 'WH-RTM', name: 'Rotterdam EU Hub', city: 'Rotterdam', sqft: 360000, occupancy: 69, docks: 56, inbound: 132, outbound: 118, orders: 870, type: 'International Hub' },
    { id: 'WH-DXB', name: 'Dubai Free Zone Hub', city: 'Dubai', sqft: 240000, occupancy: 58, docks: 36, inbound: 74, outbound: 69, orders: 430, type: 'Free Trade Zone' },
    { id: 'WH-SIN', name: 'Singapore APAC Hub', city: 'Singapore', sqft: 300000, occupancy: 83, docks: 44, inbound: 126, outbound: 140, orders: 1120, type: 'International Hub' }
  ];

  const notifications = [
    { id: 1, type: 'success', title: 'Shipment delivered', text: 'TRK-2026-24590 was delivered to Houston, TX and signed by R. Ortega.', time: Date.now() - 12 * 60000, read: false },
    { id: 2, type: 'warning', title: 'Delay alert', text: 'TRK-2026-57314 held for customs inspection at the Detroit–Windsor crossing. New ETA +6h.', time: Date.now() - 48 * 60000, read: false },
    { id: 3, type: 'info', title: 'Out for delivery', text: 'TRK-2026-73942 is out for delivery in Miami with 3 stops remaining.', time: Date.now() - 95 * 60000, read: false },
    { id: 4, type: 'info', title: 'Invoice issued', text: 'Invoice INV-2026-1042 for $4,318.40 is ready to review.', time: Date.now() - 5 * 3600000, read: true },
    { id: 5, type: 'success', title: 'Pickup confirmed', text: 'Driver Diego Alvarez collected 16 pallets in London for TRK-2026-88137.', time: Date.now() - 8 * 3600000, read: true }
  ];

  const services = [
    { slug: 'road', title: 'Road Transportation', icon: 'truck', img: IMG + 'trucks/road-truck-desert.jpg', url: 'road-transport.html', time: '1–5 days', text: 'FTL, LTL and regional trucking across 48 states and Europe on a GPS-tracked fleet.', features: ['Full & partial truckload', 'Live GPS telemetry', 'Dedicated lanes'] },
    { slug: 'air', title: 'Air Freight', icon: 'plane', img: IMG + 'logistics/air-cargo-plane.jpg', url: 'air-freight.html', time: '1–3 days', text: 'Time-critical cargo on scheduled and charter flights through 120+ gateway airports, door to door.', features: ['Next-flight-out', 'Airport-to-airport', 'Dangerous goods certified'] },
    { slug: 'ocean', title: 'Ocean Freight', icon: 'ship', img: IMG + 'logistics/container-ship.jpg', url: 'ocean-freight.html', time: '14–35 days', text: 'FCL and LCL sailings on major trade lanes with container-level visibility from port to final mile.', features: ['FCL & LCL', 'Customs brokerage', 'Container tracking'] },
    { slug: 'rail', title: 'Rail Freight', icon: 'train', img: IMG + 'logistics/freight-train.jpg', url: 'freight.html', time: '3–9 days', text: 'Intermodal rail for heavy, high-volume cargo — lower cost per tonne and up to 75% less CO₂.', features: ['Intermodal transfer', 'Bulk & breakbulk', 'Lower emissions'] },
    { slug: 'express', title: 'Express Delivery', icon: 'zap', img: IMG + 'fleet/courier-scooter.jpg', url: 'express-delivery.html', time: 'Same day – 24 h', text: 'Guaranteed same-day and overnight delivery with dedicated couriers and priority line-haul.', features: ['Same-day windows', 'Money-back SLA', 'Priority dispatch'] },
    { slug: 'last-mile', title: 'Last-Mile Delivery', icon: 'home', img: IMG + 'logistics/parcel-handover.jpg', url: 'last-mile.html', time: '2–48 h', text: 'Doorstep delivery with live driver tracking, 30-minute arrival windows and photo proof.', features: ['Live ETA links', 'Photo & e-signature POD', 'Scheduled slots'] },
    { slug: 'warehousing', title: 'Warehousing', icon: 'warehouse', img: IMG + 'warehouse/warehouse-aisle.jpg', url: 'warehousing.html', time: 'On demand', text: '4.2M sq ft of ambient, chilled and bonded storage with pick, pack and cross-docking.', features: ['WMS integration', 'Pick & pack', 'Cross-docking'] },
    { slug: 'cold-chain', title: 'Cold Chain Logistics', icon: 'snowflake', img: IMG + 'industries/pharma.jpg', url: 'road-transport.html#temperature', time: '1–4 days', text: 'GDP-compliant transport from −25 °C to +25 °C with continuous temperature logging.', features: ['GDP compliant', 'Sensor logging', 'Excursion alerts'] },
    { slug: 'ecommerce', title: 'E-Commerce Logistics', icon: 'cart', img: IMG + 'logistics/parcels.jpg', url: 'last-mile.html', time: '1–3 days', text: 'Storefront-connected fulfillment, returns processing and branded tracking for online retailers.', features: ['Shopify & Magento sync', 'Returns management', 'Branded tracking'] },
    { slug: 'heavy', title: 'Heavy Cargo', icon: 'weight', img: IMG + 'trucks/heavy-truck.jpg', url: 'road-transport.html#heavy', time: 'Project based', text: 'Oversized and heavy-lift moves with route surveys, permits, escorts and specialised trailers.', features: ['Route surveys', 'Permits & escorts', 'Lowbed trailers'] },
    { slug: 'international', title: 'International Shipping', icon: 'globe', img: IMG + 'backgrounds/port-aerial.jpg', url: 'ocean-freight.html', time: '3–35 days', text: 'Multimodal freight forwarding across 45+ countries with in-house customs brokerage.', features: ['Freight forwarding', 'Customs & duties', 'Incoterms advisory'] },
    { slug: 'supply-chain', title: 'Supply Chain Management', icon: 'layers', img: IMG + 'logistics/analytics-screen.jpg', url: 'freight.html', time: 'Ongoing', text: 'End-to-end control tower for demand planning, network design and carrier management.', features: ['Control tower', 'Network design', 'Carrier management'] }
  ];

  const industries = [
    ['E-Commerce', 'cart', 'ecommerce', 'Peak-season volume spikes and customer expectations of next-day delivery.', 'Elastic fulfillment capacity with storefront-connected WMS and a zone-skipping line-haul network.', 'Fulfillment + last-mile'],
    ['Retail', 'bag', 'retail', 'Store replenishment across hundreds of locations with tight receiving windows.', 'Multi-stop route optimization with appointment scheduling and store-ready pallet builds.', 'Multi-stop FTL / LTL'],
    ['Manufacturing', 'factory', 'manufacturing', 'Line stoppages when inbound components arrive late.', 'Just-in-time milk runs with dock-to-line sequencing and live inbound visibility.', 'JIT milk runs'],
    ['Automotive', 'car', 'automotive', 'High-value parts moving across borders on tight production schedules.', 'Expedited air and road bridges with customs pre-clearance and returnable-rack tracking.', 'Expedited road & air'],
    ['Healthcare', 'health', 'healthcare', 'Sensitive medical devices that must reach hospitals on time, every time.', 'White-glove delivery, chain-of-custody scans and 24/7 critical-shipment desk.', 'White-glove express'],
    ['Pharmaceuticals', 'pill', 'pharma', 'Strict 2–8 °C compliance and full audit trails for regulators.', 'GDP-certified reefers with calibrated sensors and automatic excursion alerts.', 'Cold chain FTL'],
    ['Food & Beverage', 'food', 'food', 'Short shelf life and multi-temperature loads.', 'Multi-zone reefer trailers with FSMA-compliant handling and first-expiry-first-out picking.', 'Refrigerated road'],
    ['Construction', 'hardhat', 'construction', 'Oversized materials to sites with limited access.', 'Flatbed and lowbed fleet with site surveys, crane coordination and just-in-time delivery.', 'Flatbed & heavy haul'],
    ['Agriculture', 'wheat', 'agriculture', 'Seasonal harvest surges from rural origins.', 'Surge capacity contracts with bulk hoppers and grain-to-port rail connections.', 'Bulk road & rail'],
    ['Technology', 'cpu', 'technology', 'High-value, theft-targeted electronics and data-center hardware.', 'Secure-lane trucking with dual drivers, geofencing and tamper-evident sealing.', 'Secure dedicated lanes'],
    ['FMCG', 'package', 'fmcg', 'Thin margins and constant, high-frequency replenishment.', 'Consolidated LTL, cross-dock hubs and VMI-integrated forecasting.', 'Cross-dock LTL'],
    ['Fashion', 'shirt', 'fashion', 'Seasonal drops and high return rates.', 'Garment-on-hanger transport, returns grading and rapid restock to stores.', 'GOH & returns'],
    ['Electronics', 'phone2', 'electronics', 'Launch-day volumes that must hit every channel at once.', 'Global air consolidation into regional hubs with synchronized launch-day release.', 'Air + hub release'],
    ['Energy', 'zap', 'energy', 'Turbine blades, transformers and solar arrays to remote sites.', 'Project cargo management with route engineering, permits and escort coordination.', 'Project cargo'],
    ['International Trade', 'anchor', 'trade', 'Complex documentation, duties and multi-party handoffs.', 'In-house customs brokerage, bonded storage and single-window trade compliance.', 'Ocean + customs']
  ].map((r) => ({ title: r[0], icon: r[1], img: IMG + 'industries/' + r[2] + '.jpg', challenge: r[3], solution: r[4], model: r[5] }));

  const caseStudies = [
    { slug: 'ecommerce-optimization', title: 'E-Commerce Delivery Optimization', client: 'Orbit Commerce', industry: 'E-Commerce', img: IMG + 'logistics/parcels.jpg', method: 'Last-mile + zone-skipping line-haul', tech: 'Route optimization engine, live ETA links', challenge: 'Orbit Commerce was missing next-day promises on 18% of orders during peak season because parcels waited in a single national sort center.', solution: 'We introduced zone-skipping trailers into four regional cross-docks and dynamic route planning for 140 last-mile vans.', result: 'Next-day on-time rate rose from 82% to 97.6% within one quarter.', improvement: '+15.6 pts', saving: '−22%', metrics: [['On-time', '97.6%'], ['Cost / parcel', '−22%'], ['Failed first attempts', '−41%']] },
    { slug: 'cold-chain', title: 'Cold Chain Transportation', client: 'Helix Pharma', industry: 'Pharmaceuticals', img: IMG + 'industries/pharma.jpg', method: 'GDP-certified refrigerated road', tech: 'IoT temperature sensors, excursion alerting', challenge: 'Temperature excursions on vaccine lanes were causing write-offs and regulatory findings.', solution: 'Dedicated reefer fleet with calibrated dual sensors, 5-minute telemetry and automated escalation to a 24/7 control desk.', result: 'Zero reportable excursions across 11,400 shipments in 12 months.', improvement: '100% compliant', saving: '−$1.8M write-offs', metrics: [['Excursions', '0'], ['Shipments', '11.4K'], ['Write-offs avoided', '$1.8M']] },
    { slug: 'retail-distribution', title: 'Retail Distribution Network', client: 'Brightline Retail', industry: 'Retail', img: IMG + 'industries/retail.jpg', method: 'Multi-stop FTL + cross-dock', tech: 'Network design modelling, dock scheduling', challenge: '340 stores were replenished from two distribution centers, causing long transit and stock-outs in the South-East.', solution: 'Network redesign added an Atlanta cross-dock and consolidated store deliveries into optimized multi-stop routes.', result: 'Store stock availability climbed to 98.9% while trucking miles fell 19%.', improvement: '−1.4 days', saving: '−19% miles', metrics: [['Availability', '98.9%'], ['Transit time', '−1.4 days'], ['Miles driven', '−19%']] },
    { slug: 'manufacturing-supply-chain', title: 'Manufacturing Supply Chain', client: 'Kestrel Motors', industry: 'Automotive', img: IMG + 'industries/manufacturing.jpg', method: 'JIT milk runs + expedited air', tech: 'Control tower, ASN integration', challenge: 'Late inbound components caused 9 line stoppages per quarter at the assembly plant.', solution: 'Sequenced milk runs from 46 suppliers with a control tower that auto-books expedited capacity when an ASN slips.', result: 'Line stoppages due to logistics fell to zero for three consecutive quarters.', improvement: '0 stoppages', saving: '−$4.2M downtime', metrics: [['Line stoppages', '0'], ['Suppliers', '46'], ['Downtime saved', '$4.2M']] },
    { slug: 'international-freight', title: 'International Freight Consolidation', client: 'Arcadia Electronics', industry: 'Electronics', img: IMG + 'logistics/port-cranes.jpg', method: 'Ocean FCL + air bridge', tech: 'Container tracking, customs pre-clearance', challenge: 'Fragmented LCL bookings from 12 Asian factories made landed cost unpredictable.', solution: 'Buyer consolidation in Shanghai and Singapore into weekly FCL sailings with an air bridge for launch-critical SKUs.', result: 'Landed cost per unit fell 17% and customs dwell time halved.', improvement: '−50% dwell', saving: '−17% landed cost', metrics: [['Landed cost', '−17%'], ['Customs dwell', '−50%'], ['Sailings / week', '3']] }
  ];

  const blogPosts = [
    { slug: 'ai-route-optimization', title: 'How AI Route Optimization Cuts Empty Miles by a Third', category: 'Technology', date: '2026-09-18', read: 7, img: IMG + 'blog/ai-route-optimization.jpg', author: 'Oliver Grant', authorImg: IMG + 'drivers/person-16.jpg', role: 'Chief Technology Officer', tags: ['Route Optimization', 'AI', 'Fleet'], excerpt: 'Dynamic routing is replacing static lane plans. Here is what changed when we re-planned 1,200 trucks every 15 minutes.', featured: true, popular: true },
    { slug: 'fleet-electrification', title: 'Fleet Electrification: Lessons From Our First 200 EVs', category: 'Sustainability', date: '2026-09-09', read: 6, img: IMG + 'blog/fleet-electrification.jpg', author: 'Elena Vasquez', authorImg: IMG + 'drivers/person-2.jpg', role: 'Chief Operating Officer', tags: ['EV', 'Sustainability', 'Fleet'], excerpt: 'Charging windows, payload trade-offs and total cost of ownership after 3.1 million electric kilometres.', popular: true },
    { slug: 'warehouse-automation', title: 'Warehouse Automation Without the Seven-Figure Robot Bill', category: 'Warehousing', date: '2026-08-28', read: 5, img: IMG + 'blog/warehouse-automation.jpg', author: 'Grace Kim', authorImg: IMG + 'drivers/person-14.jpg', role: 'VP, Customer Operations', tags: ['Warehousing', 'Automation'], excerpt: 'Slotting, pick-path optimization and voice picking deliver most of the gains for a fraction of the capital.' },
    { slug: 'port-congestion', title: 'Port Congestion in 2026: What Shippers Should Plan For', category: 'Industry News', date: '2026-08-15', read: 8, img: IMG + 'blog/port-congestion.jpg', author: 'James Whitfield', authorImg: IMG + 'drivers/person-15.jpg', role: 'Chief Executive Officer', tags: ['Ocean Freight', 'Ports'], excerpt: 'Dwell times on trans-Pacific lanes are rising again. Three contingency plays to protect peak-season inventory.', popular: true },
    { slug: 'last-mile-economics', title: 'The Economics of the Last Mile, Explained', category: 'E-Commerce Logistics', date: '2026-07-30', read: 6, img: IMG + 'blog/last-mile-economics.jpg', author: 'Grace Kim', authorImg: IMG + 'drivers/person-14.jpg', role: 'VP, Customer Operations', tags: ['Last-Mile', 'E-Commerce'], excerpt: 'Why the final few kilometres account for up to 53% of total shipping cost — and how density changes everything.' },
    { slug: 'cold-chain-compliance', title: 'Cold Chain Compliance: A Practical GDP Checklist', category: 'Supply Chain', date: '2026-07-12', read: 9, img: IMG + 'blog/cold-chain-compliance.jpg', author: 'Oliver Grant', authorImg: IMG + 'drivers/person-16.jpg', role: 'Chief Technology Officer', tags: ['Cold Chain', 'Pharma', 'Compliance'], excerpt: 'Lane qualification, sensor calibration and excursion handling — the essentials auditors ask about first.' },
    { slug: 'driver-retention', title: 'Driver Retention Starts With Predictable Schedules', category: 'Fleet Management', date: '2026-06-24', read: 5, img: IMG + 'fleet/driver-cab.jpg', author: 'Elena Vasquez', authorImg: IMG + 'drivers/person-2.jpg', role: 'Chief Operating Officer', tags: ['Drivers', 'Fleet'], excerpt: 'Home-time guarantees and fair load allocation cut our driver turnover to 14%, a third of the industry average.' },
    { slug: 'intermodal-rail', title: 'When Intermodal Rail Beats the Truck', category: 'Transportation', date: '2026-06-06', read: 6, img: IMG + 'logistics/freight-train.jpg', author: 'James Whitfield', authorImg: IMG + 'drivers/person-15.jpg', role: 'Chief Executive Officer', tags: ['Rail', 'Intermodal'], excerpt: 'Past 800 km and above 18 tonnes, rail usually wins on cost and carbon. Here is the break-even maths.' },
    { slug: 'control-tower', title: 'Building a Logistics Control Tower That People Actually Use', category: 'Logistics', date: '2026-05-21', read: 7, img: IMG + 'logistics/dashboard-laptop.jpg', author: 'Oliver Grant', authorImg: IMG + 'drivers/person-16.jpg', role: 'Chief Technology Officer', tags: ['Visibility', 'Technology'], excerpt: 'Exception-first dashboards, not wall-sized maps, are what make visibility actionable for dispatch teams.' }
  ];

  const pricingPlans = [
    { id: 'local', name: 'Local', tag: 'For small businesses', monthly: 149, yearly: 119, icon: 'home', volume: 'Up to 250 shipments / mo', features: [['Real-time tracking', true], ['Email support (24h)', true], ['Basic route optimization', true], ['Shipment analytics', false], ['API integration', false], ['Warehouse support', false], ['Fleet management', false]] },
    { id: 'business', name: 'Business', tag: 'Most popular', monthly: 499, yearly: 399, icon: 'building', volume: 'Up to 2,500 shipments / mo', popular: true, features: [['Real-time tracking', true], ['Dedicated support manager', true], ['Advanced route optimization', true], ['Shipment analytics', true], ['REST API integration', true], ['Warehouse support', false], ['Fleet management', false]] },
    { id: 'enterprise', name: 'Enterprise', tag: 'For national operations', monthly: 1499, yearly: 1199, icon: 'layers', volume: 'Up to 25,000 shipments / mo', features: [['Real-time tracking', true], ['24/7 priority support', true], ['AI route optimization', true], ['Custom analytics & BI export', true], ['API + EDI integration', true], ['Warehouse support', true], ['Fleet management', true]] },
    { id: 'global', name: 'Global', tag: 'Multinational supply chains', monthly: null, yearly: null, icon: 'globe', volume: 'Unlimited shipments', features: [['Global control tower', true], ['Dedicated account team', true], ['Network design & optimization', true], ['Custom analytics & data lake', true], ['API, EDI & ERP connectors', true], ['Multi-country warehousing', true], ['Fleet & carrier management', true]] }
  ];

  LX.data = { customers, drivers, vehicles, shipments, invoices, warehouses, notifications, services, industries, caseStudies, blogPosts, pricingPlans, VTYPES, SPEED, IMG };

  /* ---------------- Seed LocalStorage (first visit) ---------------- */
  if (store.get('version') !== DATA_VERSION) {
    store.set('version', DATA_VERSION);
    store.set('notifications', notifications);
    store.set('sim', {});
    store.set('prefs', store.get('prefs', { theme: 'dark', sidebar: 'expanded' }));
    store.set('users', [
      { name: 'Alex Morgan', company: 'Helix Pharma', email: 'customer@northlane.io', phone: '+1 312 555 0142', password: 'Demo@1234', role: 'customer' },
      { name: 'Marcus Reyes', company: 'NorthLane Logistics', email: 'driver@northlane.io', phone: '+1 312 555 0101', password: 'Demo@1234', role: 'driver' },
      { name: 'Ruth Adeyemi', company: 'NorthLane Logistics', email: 'fleet@northlane.io', phone: '+1 312 555 0188', password: 'Demo@1234', role: 'fleet' },
      { name: 'Admin', company: 'NorthLane Logistics', email: 'admin@northlane.io', phone: '+1 312 555 0100', password: 'Demo@1234', role: 'admin' }
    ]);
    if (!store.get('addresses')) store.set('addresses', [
      { label: 'HQ Receiving', line: '1200 W Fulton Market, Chicago, IL 60607', contact: 'Dock 4 · Mon–Fri 7am–5pm' },
      { label: 'Dallas Warehouse', line: '4801 Wright Blvd, Dallas, TX 75236', contact: 'Gate B · 24/7 receiving' },
      { label: 'Atlanta Store Ops', line: '210 Peachtree St NW, Atlanta, GA 30303', contact: 'Appointment required' }
    ]);
  }

  /* ---------------- Session ---------------- */
  const ROLE_HOME = { customer: 'customer-dashboard.html', business: 'customer-dashboard.html', driver: 'driver-dashboard.html', fleet: 'fleet-dashboard.html', admin: 'admin-dashboard.html' };
  LX.session = {
    current() { return store.get('session', null) || (sessionStorage.getItem('nl_session') ? JSON.parse(sessionStorage.getItem('nl_session')) : null); },
    login(user, remember) {
      const s = { name: user.name, email: user.email, role: user.role, company: user.company, phone: user.phone, since: Date.now() };
      if (remember) store.set('session', s); else { store.remove('session'); try { sessionStorage.setItem('nl_session', JSON.stringify(s)); } catch (e) {} }
      return s;
    },
    logout() { store.remove('session'); try { sessionStorage.removeItem('nl_session'); } catch (e) {} },
    home(role) { return ROLE_HOME[role] || 'customer-dashboard.html'; }
  };

  /* ---------------- Live shipment simulation ---------------- */
  const STEPS = [
    { key: 'booked', label: 'Booking Confirmed', at: 0, icon: 'clipboard' },
    { key: 'scheduled', label: 'Pickup Scheduled', at: 0.02, icon: 'calendar' },
    { key: 'picked', label: 'Package Picked Up', at: 0.05, icon: 'package' },
    { key: 'sorting', label: 'At Sorting Facility', at: 0.12, icon: 'warehouse' },
    { key: 'transit', label: 'In Transit', at: 0.2, icon: 'truck' },
    { key: 'ofd', label: 'Out for Delivery', at: 0.9, icon: 'navigation' },
    { key: 'delivered', label: 'Delivered', at: 1, icon: 'check-circle' }
  ];
  const STATUS_FLOW = ['Booked', 'Picked Up', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered'];

  function statusOf(p) {
    if (p >= 1) return 'Delivered';
    if (p >= 0.9) return 'Out for Delivery';
    if (p >= 0.2) return 'In Transit';
    if (p >= 0.12) return 'Processing';
    if (p >= 0.05) return 'Picked Up';
    return 'Booked';
  }

  const routeCache = {};
  function routeFor(s) {
    if (routeCache[s.id]) return routeCache[s.id];
    const a = geo.find(s.from), b = geo.find(s.to);
    let pts;
    if (a && b) pts = geo.route([a.lat, a.lng], [b.lat, b.lng], { mode: s.mode });
    else {
      const r = util.rng(util.hash(s.id));
      const base = [33 + r() * 10, -118 + r() * 40];
      pts = geo.route(base, [base[0] + (r() - 0.5) * 6, base[1] + 4 + r() * 8], { mode: 'road' });
    }
    routeCache[s.id] = pts;
    return pts;
  }

  function pseudoShipment(id) {
    const r = util.rng(util.hash(id));
    const pairs = [['Chicago', 'Atlanta'], ['Dallas', 'Denver'], ['New York', 'Chicago'], ['Los Angeles', 'Phoenix'], ['Houston', 'Memphis'], ['Seattle', 'Los Angeles'], ['Miami', 'Atlanta'], ['Kansas City', 'Dallas']];
    const pr = pairs[Math.floor(r() * pairs.length)];
    const d = drivers[Math.floor(r() * 14)];
    const veh = vehicles.find((v) => v.driver === d.id);
    const dist = geo.distance(pr[0], pr[1], 'road');
    const progress = Math.round((0.1 + r() * 0.8) * 100) / 100;
    const hoursTotal = dist / SPEED.road + 4;
    const pickup = util.addHours(new Date(), -hoursTotal * progress - 3);
    return {
      id, customer: customers[Math.floor(r() * customers.length)], from: pr[0], to: pr[1],
      fromLabel: geo.label(pr[0]), toLabel: geo.label(pr[1]), mode: 'road', service: ['Full Truckload', 'Less Than Truckload', 'Express Delivery'][Math.floor(r() * 3)],
      cargo: ['General Cargo', 'Retail Merchandise', 'Industrial Parts', 'E-Commerce Parcels'][Math.floor(r() * 4)], weight: 800 + Math.floor(r() * 14000), pieces: 2 + Math.floor(r() * 60),
      priority: 'Standard', baseProgress: progress, distance: dist, driver: d.id, driverName: d.name, driverPhone: d.phone,
      vehicle: veh ? veh.id + ' · ' + veh.type : 'NL-IL-5521 · Medium Truck', pickupDate: pickup.toISOString(), eta: util.addHours(pickup, hoursTotal).toISOString(),
      cost: Math.round(dist * 1.9), bookedAt: util.addHours(pickup, -20).toISOString(), generated: true
    };
  }

  const sim = (LX.sim = {
    STEPS, STATUS_FLOW, statusOf,
    normalize(raw) {
      let id = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
      if (/^\d{5}$/.test(id)) id = 'TRK-2026-' + id;
      if (/^TRK-?\d{5}$/.test(id)) id = 'TRK-2026-' + id.slice(-5);
      if (/^TRK\d{4}\d{5}$/.test(id)) id = 'TRK-' + id.slice(3, 7) + '-' + id.slice(7);
      return id;
    },
    valid(id) { return /^TRK-\d{4}-\d{5}$/.test(id) || /^NL-BK-\d{6}$/.test(id); },
    all() {
      const booked = store.get('bookings', []).map((b) => b.shipment).filter(Boolean);
      return booked.concat(shipments).map(sim.live);
    },
    find(raw) {
      let id = sim.normalize(raw);
      const bookings = store.get('bookings', []);
      if (/^NL-BK-/.test(id)) { const bk = bookings.find((b) => b.bookingId === id); if (bk) id = bk.shipmentId; }
      const booked = bookings.map((b) => b.shipment).filter(Boolean);
      let s = booked.concat(shipments).find((x) => x.id === id);
      if (!s && /^TRK-\d{4}-\d{5}$/.test(id)) s = pseudoShipment(id);
      return s ? sim.live(s) : null;
    },
    progressOf(s) {
      const state = store.get('sim', {});
      return state[s.id] !== undefined ? state[s.id] : s.baseProgress;
    },
    live(s) {
      const p = sim.progressOf(s);
      const route = routeFor(s);
      const pos = geo.pointAt(route, p);
      const remaining = Math.max(0, Math.round(s.distance * (1 - p)));
      const speed = SPEED[s.mode];
      const hoursLeft = p >= 1 ? 0 : remaining / speed + (s.mode === 'air' ? 3 : s.mode === 'ocean' ? 12 : 0.4);
      const status = s.delayed && p < 1 ? 'Delayed' : statusOf(p);
      const nearest = (() => {
        let best = null, bd = Infinity;
        Object.keys(CITIES).forEach((c) => {
          const d = geo.haversine(pos.latlng, [CITIES[c][0], CITIES[c][1]]);
          if (d < bd) { bd = d; best = c; }
        });
        if (p >= 1) return s.toLabel;
        if (s.mode === 'ocean' && bd > 250) return 'At sea · ' + Math.abs(pos.latlng[0]).toFixed(2) + '°' + (pos.latlng[0] >= 0 ? 'N' : 'S') + ', ' + Math.abs(((pos.latlng[1] + 540) % 360) - 180).toFixed(2) + '°' + (((pos.latlng[1] + 540) % 360) - 180 >= 0 ? 'E' : 'W');
        if (s.mode === 'air' && bd > 250) return 'In flight · FL' + (340 + (util.hash(s.id) % 5) * 20);
        return (bd < 40 ? '' : Math.round(bd) + ' km from ') + best + ', ' + CITIES[best][2];
      })();
      return Object.assign({}, s, {
        progress: p, status, route, position: pos.latlng, bearing: pos.bearing, remaining,
        hoursLeft, etaLive: new Date(Date.now() + hoursLeft * 3600000).toISOString(), currentLocation: nearest,
        stepIndex: STEPS.reduce((acc, st, i) => (p >= st.at ? i : acc), 0),
        updatedAt: store.get('simTs', {})[s.id] || Date.now() - 1000 * (8 + (util.hash(s.id) % 50))
      });
    },
    /* Advance one shipment; returns the live object. */
    advance(id, delta) {
      const s = sim.find(id);
      if (!s || s.progress >= 1) return s;
      const state = store.get('sim', {});
      const ts = store.get('simTs', {});
      let next = s.progress + (delta || 0.0025);
      if (s.delayed) next = s.progress + (delta || 0.0025) * 0.25;
      if (s.progress < 1 && next >= 1) next = 1;
      state[s.id] = Math.round(next * 10000) / 10000;
      ts[s.id] = Date.now();
      store.set('sim', state);
      store.set('simTs', ts);
      return sim.find(id);
    },
    reset(id) { const st = store.get('sim', {}); delete st[id]; store.set('sim', st); }
  });
})();
