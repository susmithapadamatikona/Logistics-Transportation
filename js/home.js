/* ==========================================================================
   NorthLane Logistics — Home page
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  /* ---------- Hero: live shipment console ---------- */
  function heroConsole() {
    const path = document.getElementById('heroRoute');
    if (!path) return;
    const len = path.getTotalLength();
    const done = document.getElementById('heroRouteDone');
    const truck = document.getElementById('heroTruck');
    done.style.strokeDasharray = len;
    let km = 438, total = 1170;
    const temps = [4.1, 4.0, 3.9, 4.2, 4.0, 3.8, 4.1, 4.0, 4.2, 4.0];
    const kmEl = document.querySelectorAll('[data-hero="km"]'), etaEl = document.querySelectorAll('[data-hero="eta"]');
    const tempEl = document.getElementById('heroTemp'), spark = document.getElementById('heroSpark');
    const pctEl = document.getElementById('heroPct'), barEl = document.getElementById('heroBar');
    const paint = (animate) => {
      const p = 1 - km / total;
      const pt = path.getPointAtLength(len * p);
      const ahead = path.getPointAtLength(Math.min(len, len * p + 2));
      const ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI;
      truck.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
      done.style.strokeDashoffset = len * (1 - p);
      const mins = Math.round(km / 169.5 * 60);
      etaEl.forEach((e) => (e.textContent = Math.floor(mins / 60) + 'h ' + String(mins % 60).padStart(2, '0') + 'm'));
      kmEl.forEach((e) => { e.textContent = Math.round(km) + ' km'; if (animate) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } });
      if (pctEl) pctEl.textContent = Math.round(p * 100) + '%';
      if (barEl) barEl.style.width = (p * 100).toFixed(1) + '%';
    };
    const drawSpark = () => {
      if (!spark) return;
      const pts = temps.map((t, i) => (i * 10) + ',' + (22 - (t - 3.6) * 28).toFixed(1)).join(' ');
      spark.setAttribute('points', pts);
    };
    paint(false); drawSpark();
    setInterval(() => {
      km = Math.max(12, km - (0.6 + Math.random() * 0.7));
      paint(true);
      const t = Math.round((3.8 + Math.random() * 0.45) * 10) / 10;
      temps.push(t); temps.shift();
      if (tempEl) tempEl.textContent = t.toFixed(1) + '°C';
      drawSpark();
    }, 3000);
  }

  /* ---------- Live tracking preview ---------- */
  function livePreview() {
    const el = document.getElementById('previewMap');
    if (!el) return;
    const id = 'TRK-2026-45821';
    const panel = document.getElementById('previewPanel');
    const feed = document.getElementById('previewFeed');
    LX.onVisible([el], () => {
      const s = LX.sim.find(id);
      let drawn = null;
      if (LX.maps.available()) {
        const map = LX.maps.create(el, { zoomControl: true });
        drawn = LX.maps.shipment(map, s);
        drawn.fit([40, 40]);
      } else LX.maps.create(el);
      LX.tracking.updateLive(panel, s);
      let n = 0;
      LX.tracking.liveLoop(id, (x) => {
        LX.tracking.updateLive(panel, x);
        drawn && drawn.update(x);
        if (feed && ++n % 2 === 0) {
          feed.insertAdjacentHTML('afterbegin', '<div><time>' + U.time(new Date()) + '</time><span>GPS ping · ' + U.esc(x.currentLocation) + ' · ' + U.num(x.remaining) + ' km remaining</span></div>');
          if (feed.children.length > 12) feed.lastElementChild.remove();
        }
      }, 0.003);
    }, { threshold: 0.1 });
  }

  /* ---------- Route network (SVG schematic) ---------- */
  function routeNetwork() {
    const svg = document.getElementById('networkSvg');
    if (!svg) return;
    const W = 800, H = 470;
    const proj = (c) => [((c.lng + 125) / 56) * W, ((50 - c.lat) / 27) * H];
    const hubs = ['Seattle', 'Los Angeles', 'Phoenix', 'Denver', 'Dallas', 'Houston', 'Kansas City', 'Chicago', 'Memphis', 'Nashville', 'Atlanta', 'Miami', 'New York', 'Toronto'];
    const major = ['Chicago', 'Dallas', 'Atlanta', 'Los Angeles'];
    const lanes = [['Seattle', 'Denver'], ['Seattle', 'Los Angeles'], ['Los Angeles', 'Phoenix'], ['Phoenix', 'Dallas'], ['Los Angeles', 'Denver'], ['Denver', 'Kansas City'], ['Denver', 'Dallas'], ['Kansas City', 'Chicago'], ['Dallas', 'Houston'], ['Dallas', 'Memphis'], ['Dallas', 'Kansas City'], ['Houston', 'Atlanta'], ['Memphis', 'Nashville'], ['Nashville', 'Atlanta'], ['Chicago', 'Nashville'], ['Chicago', 'New York'], ['Chicago', 'Toronto'], ['Toronto', 'New York'], ['Atlanta', 'Miami'], ['Atlanta', 'New York'], ['Memphis', 'Chicago']];
    const P = {};
    hubs.forEach((h) => (P[h] = proj(LX.geo.find(h))));
    let defs = '', lanesSvg = '', flows = '', movers = '', nodes = '';
    lanes.forEach(([a, b], i) => {
      const [x1, y1] = P[a], [x2, y2] = P[b];
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
      const d = 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);
      defs += '<path id="lane' + i + '" d="' + d + '"/>';
      lanesSvg += '<use href="#lane' + i + '" class="lane"/>';
      flows += '<use href="#lane' + i + '" class="lane-flow' + (i % 3 === 0 ? ' amber' : '') + '"/>';
      const dur = 5 + (i % 5) * 1.3;
      movers += '<circle r="3.6" class="mover' + (i % 3 === 0 ? '' : ' blue') + '"><animateMotion dur="' + dur + 's" repeatCount="indefinite" begin="-' + (i * 0.7).toFixed(1) + 's"' + (i % 2 ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : '') + '><mpath href="#lane' + i + '"/></animateMotion></circle>';
    });
    hubs.forEach((h) => {
      const [x, y] = P[h];
      const isMajor = major.includes(h);
      const right = x < W - 110;
      nodes += '<g class="hub' + (isMajor ? ' major' : '') + '"><circle class="halo" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isMajor ? 16 : 11) + '"><animate attributeName="r" values="' + (isMajor ? '12;19;12' : '8;13;8') + '" dur="3s" repeatCount="indefinite"/></circle><circle class="core" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isMajor ? 6.5 : 4.5) + '"/><text x="' + (x + (right ? 12 : -12)).toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + h + '</text></g>';
    });
    svg.innerHTML = '<defs>' + defs + '<pattern id="nmDots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="rgba(145,164,181,.16)"/></pattern></defs><rect width="100%" height="100%" fill="url(#nmDots)"/>' + lanesSvg + flows + movers + nodes;
  }

  /* ---------- Fleet showcase rail ---------- */
  function fleetRail() {
    const rail = document.getElementById('fleetRail');
    if (!rail) return;
    const T = LX.data.VTYPES;
    const counts = { 'Delivery Van': 312, 'Pickup Truck': 96, 'Medium Truck': 248, 'Heavy Truck': 214, 'Container Truck': 138, 'Refrigerated Truck': 126, 'Electric Delivery Vehicle': 204 };
    const range = { 'Delivery Van': '450 km', 'Pickup Truck': '600 km', 'Medium Truck': '900 km', 'Heavy Truck': '1,800 km', 'Container Truck': '1,600 km', 'Refrigerated Truck': '1,400 km', 'Electric Delivery Vehicle': '280 km' };
    rail.innerHTML = Object.keys(T).map((k, i) => '<article class="card card-hover fleet-tile" data-aos="fade-left" data-aos-delay="' + i * 60 + '"><div class="ft-media"><img src="' + T[k].img + '" alt="' + k + ' in the NorthLane fleet" loading="lazy"></div><div class="ft-body"><div class="flex-between"><h3>' + k + '</h3><span class="icon-box sm">' + I(T[k].icon) + '</span></div><div class="ft-specs"><div><strong>' + counts[k] + '</strong><span>Units</span></div><div><strong>' + T[k].cap.split('·')[0].trim() + '</strong><span>Payload</span></div><div><strong>' + range[k] + '</strong><span>Daily range</span></div></div></div></article>').join('');
    document.querySelectorAll('[data-rail]').forEach((b) => b.addEventListener('click', () => rail.scrollBy({ left: +b.dataset.rail * 320, behavior: 'smooth' })));
  }

  /* ---------- Testimonials ---------- */
  function testimonials() {
    const wrap = document.getElementById('testimonials');
    if (!wrap) return;
    const items = Array.from(wrap.querySelectorAll('.testimonial'));
    const dots = document.getElementById('tDots');
    let i = 0, timer;
    dots.innerHTML = items.map((_, n) => '<button aria-label="Show testimonial ' + (n + 1) + '"' + (n === 0 ? ' class="active" aria-current="true"' : '') + '></button>').join('');
    const show = (n) => {
      i = (n + items.length) % items.length;
      items.forEach((it, k) => { it.classList.toggle('active', k === i); it.setAttribute('aria-hidden', String(k !== i)); });
      Array.from(dots.children).forEach((d, k) => { d.classList.toggle('active', k === i); if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    };
    const play = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 7000); };
    dots.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { show(Array.from(dots.children).indexOf(b)); play(); } });
    document.getElementById('tPrev').addEventListener('click', () => { show(i - 1); play(); });
    document.getElementById('tNext').addEventListener('click', () => { show(i + 1); play(); });
    wrap.addEventListener('mouseenter', () => clearInterval(timer));
    wrap.addEventListener('mouseleave', play);
    show(0); play();
  }

  /* ---------- Hero: fleet status card + tracking result reveal ---------- */
  function heroFleet() {
    const a = document.getElementById('hfActive'), t = document.getElementById('hfTransit'), m = document.getElementById('hfMaint');
    const out = document.getElementById('homeTrackResult');
    if (out && 'MutationObserver' in window) {
      new MutationObserver(() => {
        if (out.querySelector('.track-result') && !out.dataset.shown) { out.dataset.shown = '1'; out.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }).observe(out, { childList: true });
    }
    if (!a) return;
    const s = { a: 1184, t: 842, m: 16 };
    const set = (el, v) => { if (el.textContent !== U.num(v)) { el.textContent = U.num(v); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } };
    setInterval(() => {
      const d = Math.round((Math.random() - 0.45) * 4);
      s.a = U.clamp(s.a + d, 1170, 1200);
      s.t = U.clamp(s.t + Math.round((Math.random() - 0.5) * 6), 820, 870);
      if (Math.random() > 0.9) s.m = U.clamp(s.m + (Math.random() > 0.5 ? 1 : -1), 12, 20);
      set(a, s.a); set(t, s.t); set(m, s.m);
    }, 3500);
  }

  LX.ready(() => {
    heroConsole();
    heroFleet();
    livePreview();
    routeNetwork();
    fleetRail();
    testimonials();
  });
})();
