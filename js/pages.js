/* ==========================================================================
   NorthLane Logistics — Content page behaviour
   Pricing · Blog listing · Blog article · FAQ · Contact · Industries ·
   Case studies · Sustainability · 404
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  /* ---------------- Pricing ---------------- */
  function pricing() {
    const grid = document.getElementById('priceGrid');
    if (!grid) return;
    const toggle = document.getElementById('billingToggle');
    const render = () => {
      const yearly = toggle.checked;
      grid.innerHTML = LX.data.pricingPlans.map((p, i) =>
        '<article class="card card-hover price-card' + (p.popular ? ' popular' : '') + '" data-aos="fade-up" data-aos-delay="' + i * 80 + '">' +
        (p.popular ? '<span class="badge badge-accent no-dot pc-tag">Most popular</span>' : '') +
        '<span class="icon-box' + (p.popular ? ' accent' : '') + '">' + I(p.icon) + '</span><h3>' + p.name + '</h3><span class="xs muted">' + p.tag + '</span>' +
        '<div class="price">' + (p.monthly ? '<strong>$' + U.num(yearly ? p.yearly : p.monthly) + '</strong><span>/ month' + (yearly ? ', billed yearly' : '') + '</span>' : '<strong style="font-size:2.2rem">Custom</strong><span>tailored contract</span>') + '</div>' +
        '<div class="volume">' + I('package') + ' ' + p.volume + '</div>' +
        '<ul>' + p.features.map((f) => '<li class="' + (f[1] ? 'yes' : 'no') + '">' + I(f[1] ? 'check-circle' : 'x') + f[0] + '</li>').join('') + '</ul>' +
        '<button class="btn ' + (p.popular ? '' : 'btn-ghost') + ' btn-block" data-plan="' + p.id + '">' + (p.monthly ? 'Choose ' + p.name : 'Contact sales') + I('arrow-right') + '</button></article>').join('');
      LX.hydrateIcons(grid);
    };
    toggle.addEventListener('change', () => { render(); document.querySelectorAll('[data-billing-label]').forEach((l) => l.classList.toggle('text-primary', (l.dataset.billingLabel === 'yearly') === toggle.checked)); });
    render();
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-plan]');
      if (!b) return;
      const plan = LX.data.pricingPlans.find((p) => p.id === b.dataset.plan);
      if (!plan.monthly) { location.href = 'contact.html?plan=global'; return; }
      LX.store.set('selectedPlan', { id: plan.id, billing: toggle.checked ? 'yearly' : 'monthly', at: Date.now() });
      LX.modal.show('<span class="icon-box accent">' + I(plan.icon) + '</span><h3 class="mt-2">Start your ' + plan.name + ' plan</h3><p>' + plan.volume + ' · $' + U.num(toggle.checked ? plan.yearly : plan.monthly) + '/month ' + (toggle.checked ? 'billed yearly' : 'billed monthly') + '. Includes a 30-day free trial — cancel anytime.</p><div class="flex mt-3" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-close>Not now</button><a class="btn btn-sm" href="register.html?plan=' + plan.id + '">' + I('user') + 'Create account</a></div>', { label: 'Choose plan' });
    });
  }

  /* ---------------- Blog: article bodies ---------------- */
  const BODIES = {
    'ai-route-optimization': [
      ['Why static lane plans stopped working', ['For most of the last decade we planned our network the way most carriers still do: a weekly lane plan, adjusted by dispatchers when something went wrong. It worked when demand was predictable. It stopped working when same-day volumes tripled and a single weather event could strand a quarter of our trucks.', 'Empty miles were the symptom that made it impossible to ignore. By 2024, 17% of the kilometres our trucks drove carried no freight at all — fuel, driver hours and emissions spent on repositioning.']],
      ['Re-planning 1,200 trucks every 15 minutes', ['Our routing engine now rebuilds the plan for the whole fleet every quarter hour. It combines live GPS, hours-of-service clocks, traffic and weather feeds, and every open order in the network, then solves for on-time delivery first and empty miles second.', 'Dispatchers still make the final call. The engine proposes; people approve. That design choice — keeping humans in the loop for exceptions — is why adoption went from pilot to network-wide in five months.']],
      ['What changed', ['Empty miles fell from 17% to 11.4% — a one-third reduction. On-time delivery rose 1.8 points, and drivers averaged 40 more minutes at home per week because relays are planned around their home terminals.', 'The lesson for shippers is simple: the tightest delivery windows are now achievable without premium rates, because the carrier is no longer paying for the slack in its own plan.']]
    ],
    'fleet-electrification': [
      ['Starting with the right routes', ['We began with urban last-mile routes under 180 km per day, where regenerative braking and predictable depot returns play to an EV\'s strengths. Those routes now run entirely on 204 electric vans across 18 cities.', 'Longer regional routes stayed diesel until we could guarantee opportunity charging at customer docks.']],
      ['Charging is an operations problem', ['Depot charging windows turned out to be the real constraint. Staggered overnight schedules and a load-management system let us charge 60 vans on a grid connection sized for 25.', 'Payload trade-offs were smaller than expected: parcel routes cube out long before they weigh out.']],
      ['The numbers after 3.1 million km', ['Total cost of ownership is now 11% below diesel on qualifying routes, driven by energy and maintenance savings. Emissions per delivery fell 72%, and drivers consistently rate the EVs as quieter and less tiring.']]
    ],
    'warehouse-automation': [
      ['Start with the data you already have', ['Most warehouses can find a 20–30% productivity gain without a single robot. The first step is slotting: putting your fastest-moving SKUs closest to the pack stations and at waist height.', 'We re-slot our facilities monthly using the previous 90 days of order lines.']],
      ['Pick paths and voice picking', ['Batch picking with optimized pick paths cut average travel per order line by 38% in our Newark facility. Voice-directed picking freed pickers\' hands and eyes, lifting accuracy to 99.9%.']],
      ['When robots do make sense', ['Autonomous mobile robots pay back fastest in high-volume e-commerce operations with long travel distances. For most B2B warehouses, software and process changes deliver the majority of the benefit first.']]
    ],
    'port-congestion': [
      ['What the data is showing', ['Average dwell time for import containers at US West Coast ports has climbed from 3.1 to 4.6 days since June, and vessel schedule reliability on trans-Pacific lanes has slipped below 60%.']],
      ['Three contingency plays', ['First, split volume across gateways: routing 20–30% of Asia imports via East Coast or Gulf ports reduces single-point risk. Second, pre-book drayage against actual berth windows rather than scheduled ETAs. Third, move peak-season purchase orders forward by two weeks.']],
      ['How we are responding', ['Our control tower now flags containers at risk of missing their vessel cut-off, and our carrier allocation agreements protect space for committed customers even when spot markets tighten.']]
    ],
    'last-mile-economics': [
      ['Why the last mile costs so much', ['A line-haul truck moves thousands of parcels between two points. A last-mile van delivers them one door at a time. Stop density, failed first attempts and urban parking make the final leg the most expensive part of the journey.']],
      ['Density changes everything', ['Doubling stops per route roughly halves the cost per parcel. That is why zone-skipping, scheduled delivery windows and pickup-point options are so powerful: they concentrate deliveries in time and space.']],
      ['Reducing failed deliveries', ['Every failed first attempt adds 12–18% to the cost of that parcel. Live ETA links and flexible redirect options cut our failed attempts by 41% for one e-commerce customer.']]
    ],
    'cold-chain-compliance': [
      ['Qualify the lane, not just the truck', ['Good Distribution Practice audits look at the whole lane: seasonal temperature profiles, handover points and contingency plans for breakdowns. We qualify every pharma lane in both summer and winter conditions.']],
      ['Calibrated sensors, continuous data', ['Each reefer carries dual calibrated sensors reporting every five minutes. Data is stored immutably and shared with the shipper\'s QA team in real time.']],
      ['Excursion handling', ['When a reading drifts out of range, the control desk is alerted within 60 seconds with a pre-approved playbook: nearest qualified facility, backup unit and customer notification. Documentation is generated automatically for the batch record.']]
    ],
    'driver-retention': [
      ['Turnover is a planning problem', ['Industry driver turnover still exceeds 40% a year. The most common reason drivers give for leaving is unpredictable time at home, not pay.']],
      ['Predictable schedules', ['We plan relays so that 80% of our drivers sleep at home at least four nights a week, and we publish schedules seven days ahead.']],
      ['Fair load allocation', ['Loads are allocated by algorithm with transparent rules, removing the perception of favouritism. Turnover fell to 14% — about a third of the industry average.']]
    ],
    'intermodal-rail': [
      ['The break-even point', ['On our network, intermodal rail becomes cheaper than truckload beyond roughly 800 km for loads above 18 tonnes. Transit is typically one to two days longer.']],
      ['Carbon advantage', ['Rail emits around 22 g CO₂e per tonne-km compared with 62 g for road — a reduction of about 65–75% depending on lane and equipment.']],
      ['When to stay on the road', ['Short lanes, time-critical freight and origins far from a rail ramp still favour trucks. Our planners model both options for every recurring lane.']]
    ],
    'control-tower': [
      ['Exception-first, not map-first', ['A wall-sized map of every truck looks impressive, but dispatchers act on exceptions. Our control tower surfaces only shipments at risk, ranked by customer impact.']],
      ['One model of the network', ['Transport, warehouse and carrier data flow into a single model so a delay at a port automatically updates the truck, the dock appointment and the customer ETA.']],
      ['Measuring adoption', ['The metric that matters is how many exceptions are resolved before the customer notices. For us, that number is now above 80%.']]
    ]
  };

  function blogList() {
    const grid = document.getElementById('postGrid');
    if (!grid) return;
    const posts = LX.data.blogPosts;
    const featured = posts.find((p) => p.featured) || posts[0];
    const fp = document.getElementById('featuredPost');
    if (fp) fp.innerHTML = '<a class="fp-media" href="blog-details.html?post=' + featured.slug + '" tabindex="-1" aria-hidden="true"><img src="' + featured.img + '" alt=""></a><div class="fp-body"><div class="flex flex-wrap"><span class="badge badge-accent no-dot">Featured</span><span class="badge badge-primary no-dot">' + featured.category + '</span></div><h2><a href="blog-details.html?post=' + featured.slug + '">' + featured.title + '</a></h2><p>' + featured.excerpt + '</p><div class="pc-author mt-3" style="border:0;padding:0"><img src="' + featured.authorImg + '" alt="' + featured.author + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover"><span class="small"><strong>' + featured.author + '</strong> · ' + U.date(featured.date + 'T12:00') + ' · ' + featured.read + ' min read</span></div><a class="btn mt-3" style="width:fit-content" href="404.html">Read article' + I('arrow-right') + '</a></div>';
    const catEl = document.getElementById('catList');
    const cats = ['Logistics', 'Transportation', 'Supply Chain', 'Fleet Management', 'Warehousing', 'E-Commerce Logistics', 'Technology', 'Sustainability', 'Industry News'];
    catEl.innerHTML = '<li><a href="#" class="active" data-value="all">All articles <span>' + posts.length + '</span></a></li>' + cats.map((c) => '<li><a href="#" data-value="' + c + '">' + c + ' <span>' + posts.filter((p) => p.category === c).length + '</span></a></li>').join('');
    catEl.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    const tags = Array.from(new Set(posts.flatMap((p) => p.tags)));
    const tagEl = document.getElementById('tagCloud');
    tagEl.innerHTML = '<button class="active" data-value="all">All</button>' + tags.map((t) => '<button data-value="' + t + '">#' + t + '</button>').join('');
    document.getElementById('popularPosts').innerHTML = posts.filter((p) => p.popular).map((p) => '<a class="mini-post" href="blog-details.html?post=' + p.slug + '"><img src="' + p.img + '" alt="" loading="lazy"><span><strong>' + p.title + '</strong><span class="xs muted">' + U.dateShort(p.date + 'T12:00') + ' · ' + p.read + ' min</span></span></a>').join('');
    const initialCat = U.param('category');
    if (initialCat) { catEl.dataset.value = initialCat; catEl.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.value === initialCat)); }
    LX.list({
      items: posts, container: grid, render: LX.cards.post, pageSize: 6, scroll: true,
      pager: document.getElementById('postPager'), count: document.getElementById('postCount'),
      search: document.getElementById('blogSearch'), searchKeys: ['title', 'excerpt', 'category', 'author'],
      filters: [{ el: catEl, key: 'category' }, { el: tagEl, key: 'tags', test: (r, v) => r.tags.includes(v) }],
      empty: 'No articles match — try another keyword or category.'
    });
  }

  function blogDetails() {
    const root = document.getElementById('article');
    if (!root) return;
    const posts = LX.data.blogPosts;
    const p = posts.find((x) => x.slug === U.param('post')) || posts[0];
    document.title = p.title + ' | NorthLane Insights';
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.excerpt);
    const body = BODIES[p.slug] || [];
    const sections = body.map((s, i) => '<h2 id="s' + i + '">' + s[0] + '</h2>' + s[1].map((t) => '<p>' + t + '</p>').join('') + (i === 0 ? '<blockquote>' + p.excerpt + '</blockquote>' : '') + (i === 1 ? '<div class="article-stat-row"><div><strong>98.7%</strong><span class="xs muted">Network on-time rate</span></div><div><strong>1,200+</strong><span class="xs muted">Connected vehicles</span></div><div><strong>45+</strong><span class="xs muted">Countries served</span></div></div>' : '')).join('');
    document.getElementById('articleHead').innerHTML =
      '<nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a>' + I('chevron-right') + '<a href="blog.html">Blog</a>' + I('chevron-right') + '<a href="blog.html?category=' + encodeURIComponent(p.category) + '">' + p.category + '</a></nav>' +
      '<h1>' + p.title + '</h1><div class="article-meta"><div class="author"><img src="' + p.authorImg + '" alt="' + p.author + '"><div><strong>' + p.author + '</strong><br><span class="xs">' + p.role + '</span></div></div><span>' + I('calendar') + ' ' + U.date(p.date + 'T12:00') + '</span><span>' + I('clock') + ' ' + p.read + ' min read</span><span class="badge badge-primary no-dot">' + p.category + '</span></div>' +
      '<div class="article-cover"><img src="' + p.img + '" alt="' + U.esc(p.title) + '"></div>';
    root.innerHTML = '<p class="lead" style="font-size:1.2rem;color:var(--heading)">' + p.excerpt + '</p>' + sections +
      '<div class="share-bar"><strong class="small">Share:</strong><button class="icon-btn" data-share-net="LinkedIn" aria-label="Share on LinkedIn">' + I('linkedin') + '</button><button class="icon-btn" data-share-net="X" aria-label="Share on X">' + I('twitter') + '</button><button class="icon-btn" data-share-net="Facebook" aria-label="Share on Facebook">' + I('facebook') + '</button><button class="btn btn-ghost btn-sm" data-copy-link>' + I('send') + 'Copy link</button><div class="tag-cloud" style="margin-left:auto">' + p.tags.map((t) => '<a href="blog.html">#' + t + '</a>').join('') + '</div></div>' +
      '<div class="author-box card"><img src="' + p.authorImg + '" alt="' + p.author + '"><div><span class="xs muted">Written by</span><h3 style="font-size:1.1rem">' + p.author + '</h3><p class="small">' + p.role + ' at NorthLane Logistics. Writes about network design, technology and the people who keep freight moving.</p></div></div>';
    document.getElementById('toc').innerHTML = body.map((s, i) => '<a href="#s' + i + '">' + s[0] + '</a>').join('');
    document.getElementById('relatedPosts').innerHTML = posts.filter((x) => x.slug !== p.slug && (x.category === p.category || x.tags.some((t) => p.tags.includes(t)))).concat(posts.filter((x) => x.slug !== p.slug)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3).map(LX.cards.post).join('');
    // Reading progress + TOC highlight
    const bar = document.getElementById('readingProgress');
    const heads = Array.from(root.querySelectorAll('h2'));
    window.addEventListener('scroll', () => {
      const r = root.getBoundingClientRect();
      bar.style.width = U.clamp((-r.top + 120) / (r.height - window.innerHeight / 2) * 100, 0, 100) + '%';
      let cur = 0; heads.forEach((h, i) => { if (h.getBoundingClientRect().top < 160) cur = i; });
      document.querySelectorAll('#toc a').forEach((a, i) => a.classList.toggle('active', i === cur));
    }, { passive: true });
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-copy-link]')) { (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(() => LX.toast('Link copied', 'Article link copied to your clipboard.', 'success'), () => LX.toast('Copy this link', location.href, 'info', 6000)); }
      const n = e.target.closest('[data-share-net]');
      if (n) LX.toast('Share on ' + n.dataset.shareNet, 'A share window would open here in production.', 'info');
    });
  }

  /* ---------------- FAQ ---------------- */
  const FAQ = [
    ['Shipping', 'package', [
      ['What can I ship with NorthLane?', 'Almost any legal commercial cargo: general freight, palletised goods, parcels, perishables, pharmaceuticals, dangerous goods (with declaration), machinery and oversized project cargo. Prohibited items include live animals on road services, cash and unapproved hazardous materials.'],
      ['How do I book a shipment?', 'Use the Book Shipment page for a guided six-step booking with an instant price, call our dispatch desk, or connect your ERP or storefront through our REST or EDI APIs.'],
      ['What is the cut-off time for same-day pickup?', 'Book before 2 pm local time for same-day pickup in our 18 metro areas. Next-day pickups can be booked until 10 pm.'],
      ['Do you offer pallet and packaging supplies?', 'Yes. Business and Enterprise customers can order pallets, stretch wrap, cartons and temperature-controlled packaging through the customer portal.']]],
    ['Tracking', 'navigation', [
      ['How do I track my shipment?', 'Enter your tracking ID (for example TRK-2026-45821) on the Track Shipment page. You will see the live vehicle position, ETA, distance remaining and every scan event.'],
      ['How often is the location updated?', 'Road vehicles report GPS every 30 seconds. Air and ocean shipments update at each milestone and via container trackers where available.'],
      ['Can I share tracking with my customer?', 'Yes — use the Share Tracking button to copy a public tracking link. Business accounts can also send branded notifications by email and SMS.']]],
    ['Pricing', 'tag', [
      ['How is my shipping price calculated?', 'Price is based on distance, chargeable weight (the greater of actual or volumetric weight), transport mode, delivery speed and package type, plus fuel surcharge, handling, insurance and tax. Our calculator shows each component.'],
      ['Are there hidden fees?', 'No. Quotes include fuel, handling, standard insurance and tax. Optional accessorials such as liftgate or inside delivery are shown before you confirm.'],
      ['Do you offer volume discounts?', 'Yes. Business, Enterprise and Global plans include discounted lane rates. Contact sales for a custom rate card if you ship more than 500 loads a month.']]],
    ['Delivery', 'home', [
      ['What happens if nobody is available to receive the delivery?', 'The driver follows your safe-place instructions if provided. Otherwise we attempt a second delivery the next business day at no extra cost, and the recipient can reschedule via the tracking link.'],
      ['Do you provide proof of delivery?', 'Every delivery includes a photo, GPS stamp, timestamp and e-signature, available instantly in your dashboard and via API.'],
      ['Can I schedule a delivery window?', 'Yes. Scheduled delivery offers 2-hour windows up to 14 days ahead, including evenings and Saturdays in most metro areas.']]],
    ['International Shipping', 'globe', [
      ['Which countries do you serve?', 'We operate in 45+ countries across North America, Europe, the Middle East, Asia-Pacific, Latin America and Africa, through 14 international hubs.'],
      ['Do you handle customs clearance?', 'Yes. Our licensed customs brokers file import and export declarations, classify goods and manage duties and taxes in 18 countries.'],
      ['What Incoterms do you support?', 'All Incoterms 2020 rules. Our trade advisors can recommend the right term for your contract and insurance needs.']]],
    ['Warehousing', 'warehouse', [
      ['What is the minimum storage commitment?', 'Contracts start at 500 pallet positions with a 3-month term. Short-term overflow space is available during peak season.'],
      ['Can you integrate with my e-commerce store?', 'Yes — plug-ins for Shopify, WooCommerce and Magento sync orders, inventory and tracking automatically.'],
      ['Do you offer temperature-controlled storage?', 'Yes, chilled (2–8 °C) and frozen storage is available in 14 facilities, all with continuous temperature mapping.']]],
    ['Insurance', 'shield-check', [
      ['Is my cargo insured?', 'Every shipment includes cargo insurance up to $100,000 per load by default. Additional cover is available at 0.6% of declared value.'],
      ['How do I file a claim?', 'Open the shipment in your dashboard and choose Report Issue, or email claims@northlane.io with photos. 91% of claims are resolved within five business days.']]],
    ['Returns', 'refresh', [
      ['Do you handle product returns?', 'Yes. We collect, inspect, grade and restock returns within 48 hours, and report the outcome of each return in your dashboard.'],
      ['Can customers print return labels?', 'Returns portals can be branded with your logo so customers generate labels and book pickups themselves.']]],
    ['Business Logistics', 'building', [
      ['Do you offer dedicated fleets?', 'Yes. Dedicated contract carriage gives you trucks and drivers in your livery, managed and maintained by NorthLane.'],
      ['Can you design my distribution network?', 'Our solutions team models your lanes, volumes and service levels to recommend the right mix of warehouses, cross-docks and modes.'],
      ['Do you provide API access?', 'All Business plans and above include REST APIs for quoting, booking, tracking and invoicing, plus EDI 204/214/210 support.']]]
  ];
  function faq() {
    const wrap = document.getElementById('faqGroups');
    if (!wrap) return;
    const nav = document.getElementById('faqNav');
    const renderAll = (q) => {
      const re = q ? new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig') : null;
      const hl = (t) => (re ? U.esc(t).replace(re, '<mark>$1</mark>') : U.esc(t));
      let total = 0;
      wrap.innerHTML = FAQ.map(([cat, icon, items], gi) => {
        const list = items.filter(([a, b]) => !q || (a + ' ' + b).toLowerCase().includes(q.toLowerCase()));
        total += list.length;
        if (!list.length) return '';
        return '<section class="faq-group" id="faq-' + U.slug(cat) + '"><h2><span class="icon-box sm">' + I(icon) + '</span>' + cat + '</h2><div class="accordion" data-single>' + list.map(([qq, a], i) => {
          const id = 'fq' + gi + '-' + i;
          const open = q && i === 0;
          return '<div class="acc-item' + (open ? ' open' : '') + '"><h3 style="margin:0;font-size:inherit"><button class="acc-btn" aria-expanded="' + !!open + '" aria-controls="' + id + '">' + hl(qq) + '<span class="acc-icon">' + I('plus') + '</span></button></h3><div class="acc-panel" id="' + id + '" role="region"><div><p>' + hl(a) + '</p></div></div></div>';
        }).join('') + '</div></section>';
      }).join('') || '<div class="empty-state">' + I('search') + '<p>No answers match “' + U.esc(q) + '”. <a class="text-primary" href="contact.html">Ask our team</a>.</p></div>';
      document.getElementById('faqCount').textContent = total + ' answer' + (total === 1 ? '' : 's');
    };
    nav.innerHTML = FAQ.map(([cat, icon, items], i) => '<button data-target="faq-' + U.slug(cat) + '"' + (i === 0 ? ' class="active"' : '') + '><span class="flex" style="gap:10px">' + I(icon) + cat + '</span><span class="count">' + items.length + '</span></button>').join('');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('[data-target]');
      if (!b) return;
      const t = document.getElementById(b.dataset.target);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    renderAll('');
    const search = document.getElementById('faqSearch');
    search.addEventListener('input', U.debounce(() => renderAll(search.value.trim()), 200));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.target === en.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
      const watch = () => wrap.querySelectorAll('.faq-group').forEach((g) => io.observe(g));
      watch();
      search.addEventListener('input', U.debounce(watch, 260));
    }
  }

  /* ---------------- Contact ---------------- */
  const OFFICES = [
    { city: 'Chicago', name: 'Global Headquarters', addr: '1200 W Fulton Market, Chicago, IL 60607, USA', phone: '+1 (312) 555-0100', hours: 'Mon–Fri 8am–6pm CT', ll: [41.8866, -87.6517] },
    { city: 'Dallas', name: 'Southern Region Hub', addr: '4801 Wright Blvd, Dallas, TX 75236, USA', phone: '+1 (214) 555-0180', hours: 'Mon–Fri 7am–6pm CT', ll: [32.6947, -96.8837] },
    { city: 'Rotterdam', name: 'European Headquarters', addr: 'Waalhaven Zuidzijde 21, 3089 JH Rotterdam, NL', phone: '+31 10 555 0140', hours: 'Mon–Fri 8:30–17:30 CET', ll: [51.8841, 4.4273] }
  ];
  function contact() {
    const list = document.getElementById('officeList');
    if (!list) return;
    list.innerHTML = OFFICES.map((o, i) => '<button class="card card-hover office-card' + (i === 0 ? ' active' : '') + '" data-office="' + i + '" style="text-align:left"><h3>' + o.name + '<span class="badge badge-primary no-dot">' + o.city + '</span></h3><p>' + o.addr + '</p><div class="oc-meta"><span>' + I('phone') + o.phone + '</span><span>' + I('clock') + o.hours + '</span></div></button>').join('');
    let map = null;
    const markers = [];
    const el = document.getElementById('contactMap');
    LX.onVisible([el], () => {
      map = LX.maps.create(el, { center: OFFICES[0].ll, zoom: 12 });
      if (!map) return;
      OFFICES.forEach((o, i) => markers.push(LX.maps.pin(o.ll, i === 0 ? 'dest' : '', o.name).addTo(map).bindPopup('<strong>' + o.name + '</strong><br>' + o.addr)));
      markers[0].openPopup();
    }, { threshold: 0.1 });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-office]');
      if (!b) return;
      list.querySelectorAll('.office-card').forEach((c) => c.classList.toggle('active', c === b));
      const o = OFFICES[+b.dataset.office];
      if (map) { map.flyTo(o.ll, 12, { duration: 1.2 }); markers[+b.dataset.office].openPopup(); }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const ind = U.param('industry'), plan = U.param('plan');
    const msg = document.getElementById('cMessage');
    if (msg && ind) msg.value = 'Hello NorthLane team — we are a company in the ' + ind + ' sector and would like to discuss our logistics requirements.';
    if (msg && plan) msg.value = 'Hello — we are interested in the Global plan for multi-country operations. Please contact us to scope a tailored contract.';
  }

  /* ---------------- Industries: search filter ---------------- */
  function industries() {
    const grid = document.getElementById('industryGrid');
    if (!grid) return;
    LX.list({ items: LX.data.industries, container: grid, render: LX.cards.industry, pageSize: 15, search: document.getElementById('industrySearch'), searchKeys: ['title', 'challenge', 'solution', 'model'], count: document.getElementById('industryCount'), scroll: false });
  }

  /* ---------------- Case studies ---------------- */
  function caseStudies() {
    const feat = document.getElementById('caseFeature');
    if (!feat) return;
    const c = LX.data.caseStudies[1];
    feat.innerHTML = '<div class="csf-media"><img src="' + c.img + '" alt="' + c.title + '"></div><div class="csf-body"><div class="flex flex-wrap"><span class="badge badge-accent no-dot">Featured</span><span class="badge badge-primary no-dot">' + c.industry + '</span></div><h2 class="mt-2" style="font-size:clamp(1.5rem,2.6vw,2.1rem)">' + c.title + '</h2><span class="xs muted">' + c.client + '</span>' +
      '<div class="cs-block">' + '<strong>' + I('alert') + 'Challenge</strong><p>' + c.challenge + '</p></div><div class="cs-block"><strong>' + I('bulb') + 'Solution</strong><p>' + c.solution + '</p></div>' +
      '<div class="cs-tags"><span class="chip">' + I('route') + c.method + '</span><span class="chip">' + I('cpu') + c.tech + '</span></div>' +
      '<div class="cs-metrics-big">' + c.metrics.map((m) => '<div><strong>' + m[1] + '</strong><span class="xs muted">' + m[0] + '</span></div>').join('') + '</div></div>';
  }

  /* ---------------- Sustainability charts ---------------- */
  function sustainability() {
    if (!document.getElementById('co2Trend') || !LX.charts) return;
    LX.charts.line('co2Trend', ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'], [{ label: 'g CO₂e per tonne-km', data: [71, 68, 64, 60, 55, 51, 47, 44], fill: true }], { format: (v) => v + ' g CO₂e / t-km', extend: (o) => { o.scales.y.beginAtZero = false; o.scales.y.min = 30; } });
    LX.charts.bar('evGrowth', ['2021', '2022', '2023', '2024', '2025', '2026'], [{ label: 'Electric vehicles in fleet', data: [12, 38, 74, 121, 168, 204] }], { format: (v) => v + ' EVs' });
  }

  LX.ready(() => { pricing(); blogList(); blogDetails(); faq(); contact(); industries(); caseStudies(); sustainability(); });
})();
