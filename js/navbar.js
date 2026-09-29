/* ==========================================================================
   NorthLane Logistics — Site chrome
   Announcement bar, sticky header + mega menu, mobile drawer, footer,
   theme toggle, scroll progress, back-to-top, loader and page transitions.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const I = (n) => LX.icon(n);

  /* Apply saved theme as early as possible */
  const prefs = LX.store.get('prefs', {});
  if (prefs.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');

  /* Flat primary navigation (no dropdowns). `keys` = page ids that highlight the link. */
  const NAV = [
    { label: 'Home', href: 'index.html', keys: ['home'] },
    { label: 'About', href: 'about.html', keys: ['about', 'industries', 'case-studies', 'sustainability'] },
    { label: 'Services', href: 'services.html', keys: ['services', 'road', 'air', 'ocean', 'freight', 'warehousing', 'last-mile', 'express'] },
    { label: 'Tracking', href: 'tracking.html', keys: ['tracking', 'shipment-details', 'calculator', 'book'] },
    { label: 'Blog', href: 'blog.html', keys: ['blog'] },
    { label: 'Contact', href: 'contact.html', keys: ['contact', 'faq'] }
  ];

  function headerHTML(page) {
    const session = LX.session.current();
    const menu = NAV.map((n) => {
      const on = n.keys.includes(page);
      return '<li class="nav-item"><a class="nav-link' + (on ? ' active' : '') + '" href="' + n.href + '"' + (on ? ' aria-current="page"' : '') + '>' + n.label + '</a></li>';
    }).join('');

    /* Single account button: "Sign In" for visitors, "Dashboard" once signed in */
    const accountHref = session ? LX.session.home(session.role) : 'login.html';
    const accountIcon = session ? 'grid' : 'login';
    const accountLabel = session ? 'Dashboard' : 'Sign In';

    return '<header class="site-header" id="siteHeader"><div class="container nav">' +
      '<a class="brand" href="index.html" aria-label="Stackly home">' + LX.brandLogo() + '</a>' +
      '<nav aria-label="Primary"><ul class="nav-menu" id="navMenu">' + menu +
      '<li class="mobile-only nav-mobile-actions">' +
      (session ? '' : '<a class="btn btn-ghost btn-block" href="login.html">' + I('user') + 'Login</a>') +
      '<a class="btn btn-accent btn-block" href="' + accountHref + '">' + I(accountIcon) + accountLabel + '</a></li>' +
      '</ul></nav>' +
      '<div class="nav-actions">' +
      (session ? '' : '<a class="btn btn-ghost btn-sm hide-sm" href="login.html">' + I('user') + '<span>Login</span></a>') +
      '<a class="btn btn-accent btn-sm hide-sm" href="' + accountHref + '">' + I(accountIcon) + '<span>' + accountLabel + '</span></a>' +
      '<button class="icon-btn nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navMenu">' + I('menu') + '</button>' +
      '</div></div></header><div class="nav-overlay" id="navOverlay"></div>';
  }

  function announcementHTML() {
    if (LX.store.get('annClosed') === true || document.body.hasAttribute('data-no-announcement')) return '';
    return '<div class="announcement theme-dark" id="announcement"><div class="container">' +
      '<span class="tag">New</span><span>Electric last-mile now live in 18 cities — cut delivery emissions by up to 72%.</span>' +
      '<a href="sustainability.html">See the EV network</a>' +
      '<button class="close-ann" aria-label="Dismiss announcement">' + I('x') + '</button></div></div>';
  }

  function footerHTML() {
    /* Footer column links, legal links and social icons all lead to the 404 page for now */
    const NA = '404.html';
    const col = (title, links) => '<div class="footer-col"><h4>' + title + '</h4>' + links.map((l) => '<a href="' + NA + '">' + l[1] + '</a>').join('') + '</div>';
    return '<footer class="site-footer theme-dark" role="contentinfo"><div class="container">' +
      '<div class="footer-top">' +
      '<div class="footer-brand"><a class="brand" href="index.html" aria-label="Stackly home">' + LX.brandLogo() + '</a>' +
      '<p>Technology-driven freight, fleet and fulfillment for companies that can\'t afford to wait. Real-time visibility on every kilometre.</p>' +
      '<div class="socials mt-3"><a href="' + NA + '" aria-label="LinkedIn">' + I('linkedin') + '</a><a href="' + NA + '" aria-label="X (Twitter)">' + I('twitter') + '</a><a href="' + NA + '" aria-label="Facebook">' + I('facebook') + '</a><a href="' + NA + '" aria-label="Instagram">' + I('instagram') + '</a><a href="' + NA + '" aria-label="YouTube">' + I('youtube') + '</a></div></div>' +
      col('Services', [['road-transport.html', 'Road Transportation'], ['air-freight.html', 'Air Freight'], ['ocean-freight.html', 'Ocean Freight'], ['freight.html', 'Freight & Rail'], ['warehousing.html', 'Warehousing'], ['last-mile.html', 'Last-Mile Delivery']]) +
      col('Platform', [['tracking.html', 'Track Shipment'], ['shipping-calculator.html', 'Shipping Calculator'], ['book-shipment.html', 'Book Shipment'], ['customer-dashboard.html', 'Customer Portal'], ['driver-dashboard.html', 'Driver App'], ['fleet-dashboard.html', 'Fleet Control']]) +
      col('Company', [['about.html', 'About Us'], ['industries.html', 'Industries'], ['case-studies.html', 'Case Studies'], ['sustainability.html', 'Sustainability'], ['pricing.html', 'Pricing'], ['faq.html', 'FAQ']]) +
      '<div class="footer-col"><h4>Contact</h4><ul class="footer-contact">' +
      '<li>' + I('map-pin') + '<span>1200 W Fulton Market,<br>Chicago, IL 60607, USA</span></li>' +
      '<li>' + I('phone') + '<a href="tel:+18005550148">+1 (800) 555-0148</a></li>' +
      '<li>' + I('mail') + '<a href="mailto:dispatch@northlane.io">dispatch@northlane.io</a></li>' +
      '<li>' + I('headset') + '<span>24/7 dispatch & tracking desk</span></li></ul></div>' +
      '</div>' +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' NorthLane Logistics, Inc. All rights reserved.</span>' +
      '<nav aria-label="Legal"><a href="' + NA + '">Privacy Policy</a><a href="' + NA + '">Terms of Service</a><a href="' + NA + '">Cookie Settings</a><a href="contact.html">Contact</a></nav></div>' +
      '</div></footer>';
  }

  function utilitiesHTML() {
    const r = 27, c = 2 * Math.PI * r;
    return '<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>' +
      '<button class="back-to-top" id="backToTop" aria-label="Back to top"><svg class="ring" viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="' + r + '" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '"/></svg>' + I('arrow-up') + '</button>' +
      '<div class="page-fade" id="pageFade" aria-hidden="true"></div>';
  }

  /* Site-wide preloader: logo, a truck driving along a road, and a progress bar */
  function loaderHTML() {
    return '<div class="page-loader" id="pageLoader" role="status" aria-live="polite" aria-label="Loading">' +
      '<div class="pl-inner">' + LX.brandLogo('pl-logo') +
      '<div class="pl-road" aria-hidden="true"><span class="pl-truck">' + I('truck') + '</span></div>' +
      '<div class="pl-bar" aria-hidden="true"><i></i></div>' +
      '<span class="pl-text">Loading</span></div></div>';
  }

  /* ---------------- Mount ---------------- */
  LX.mountChrome = function () {
    const body = document.body;
    const page = body.dataset.page || '';
    const layout = body.dataset.layout || 'site';

    if (!document.querySelector('.skip-link')) body.insertAdjacentHTML('afterbegin', '<a class="skip-link" href="#main">Skip to content</a>');
    body.insertAdjacentHTML('afterbegin', loaderHTML());
    document.documentElement.classList.remove('nl-loading'); // the real preloader now covers the page

    if (layout === 'site') {
      const h = document.getElementById('site-header');
      if (h) h.outerHTML = announcementHTML() + headerHTML(page);
      const f = document.getElementById('site-footer');
      if (f) f.outerHTML = footerHTML();
    }
    body.insertAdjacentHTML('beforeend', utilitiesHTML());
    bind(layout);
  };

  function bind(layout) {
    const header = document.getElementById('siteHeader');
    const menu = document.getElementById('navMenu');
    const toggle = document.getElementById('navToggle');
    const overlay = document.getElementById('navOverlay');

    /* Announcement */
    const ann = document.getElementById('announcement');
    if (ann) ann.querySelector('.close-ann').addEventListener('click', () => { ann.remove(); LX.store.set('annClosed', true); });

    /* Mobile drawer */
    const setMenu = (open) => {
      if (!menu) return;
      menu.classList.toggle('open', open);
      overlay && overlay.classList.toggle('show', open);
      toggle && toggle.setAttribute('aria-expanded', String(open));
      toggle && (toggle.innerHTML = I(open ? 'x' : 'menu'));
      document.body.classList.toggle('menu-open', open);
    };
    toggle && toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
    overlay && overlay.addEventListener('click', () => setMenu(false));

    /* Close the mobile menu with Escape or after choosing a link */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu && menu.classList.contains('open')) { setMenu(false); toggle && toggle.focus(); }
    });
    menu && menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

    /* Theme toggle */
    document.querySelectorAll('#themeToggle, [data-theme-toggle]').forEach((btn) => btn.addEventListener('click', () => LX.toggleTheme()));

    /* Scroll: sticky header, progress, back-to-top */
    const prog = document.getElementById('scrollProgress');
    const btt = document.getElementById('backToTop');
    const ring = btt && btt.querySelector('circle');
    const circ = ring ? parseFloat(ring.getAttribute('stroke-dasharray')) : 0;
    const scroller = layout === 'app' ? document.querySelector('.dash-main') || window : window;
    let ticking = false;
    const onScroll = () => {
      const el = scroller === window ? document.documentElement : scroller;
      const y = scroller === window ? window.scrollY : scroller.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? y / max : 0;
      if (header) header.classList.toggle('scrolled', y > 20);
      if (prog) prog.style.transform = 'scaleX(' + p + ')';
      if (btt) { btt.classList.toggle('show', y > 600); if (ring) ring.style.strokeDashoffset = circ * (1 - p); }
      ticking = false;
    };
    (scroller === window ? window : scroller).addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    onScroll();
    btt && btt.addEventListener('click', () => (scroller === window ? window : scroller).scrollTo({ top: 0, behavior: 'smooth' }));

    /* Preloader: stays at least ~1.2s after navigation start so it reads as intentional,
       hides as soon as the page has loaded after that, and never lingers beyond 4s. */
    let hidden = false;
    const hideLoader = () => {
      if (hidden) return; hidden = true;
      const l = document.getElementById('pageLoader');
      if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 700); }
    };
    const afterMin = () => setTimeout(hideLoader, Math.max(0, 1200 - performance.now()));
    if (document.readyState === 'complete') afterMin(); else window.addEventListener('load', afterMin);
    setTimeout(hideLoader, 4000);

    /* Smooth page transitions for internal links */
    const fade = document.getElementById('pageFade');
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || /^https?:/.test(href) || href.startsWith('javascript')) return;
      if (href.split('#')[0] === location.pathname.split('/').pop()) return;
      e.preventDefault();
      fade && fade.classList.add('active');
      setTimeout(() => (location.href = href), 260);
    });
    window.addEventListener('pageshow', () => fade && fade.classList.remove('active'));
  }

  LX.toggleTheme = function () {
    const light = document.documentElement.getAttribute('data-theme') !== 'light';
    if (light) document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    const p = LX.store.get('prefs', {});
    p.theme = light ? 'light' : 'dark';
    LX.store.set('prefs', p);
    document.querySelectorAll('#themeToggle, [data-theme-toggle]').forEach((b) => { if (!b.dataset.keepLabel) b.innerHTML = I(light ? 'moon' : 'sun'); });
    document.dispatchEvent(new CustomEvent('lx:theme', { detail: { theme: p.theme } }));
  };
})();
