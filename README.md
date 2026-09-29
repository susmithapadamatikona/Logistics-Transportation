# NorthLane Logistics — Logistics & Transportation Platform

A multi-page logistics website and portal built with **HTML5, CSS3 and vanilla JavaScript**. It has no frameworks and no backend. It includes real-time shipment tracking on live maps, a pricing engine, a six-step booking flow, fleet and driver management, and four role-based dashboards. All data is stored in the browser's LocalStorage.

## Quick start

The site works when you open `index.html` directly. Serving it over HTTP works best, because the map tiles and some browser APIs behave more reliably that way:

```bash
# from this folder
python -m http.server 8080
# then open http://localhost:8080
```

### Demo accounts

Every demo account uses the password `Demo@1234`. The login page also has one-click buttons that fill these in.

| Role | Email | Lands on |
|---|---|---|
| Customer | customer@northlane.io | `customer-dashboard.html` |
| Driver | driver@northlane.io | `driver-dashboard.html` |
| Fleet manager | fleet@northlane.io | `fleet-dashboard.html` |
| Admin | admin@northlane.io | `admin-dashboard.html` |

You can open the dashboards without signing in. They then run in **demo mode** and show a banner saying so.

### Demo tracking IDs

`TRK-2026-45821` (road, reefer) · `TRK-2026-73942` (out for delivery) · `TRK-2026-90112` (air) · `TRK-2026-38210` (ocean) · `TRK-2026-57314` (delayed).

Any ID in the format `TRK-YYYY-NNNNN` produces a simulated shipment. Bookings you make on `book-shipment.html` can be tracked straight away by their Shipment ID or Booking ID.

## Pages (33)

| Area | Pages |
|---|---|
| Marketing | `index`, `about`, `services`, `freight`, `road-transport`, `air-freight`, `ocean-freight`, `warehousing`, `last-mile`, `express-delivery`, `industries`, `pricing`, `case-studies`, `sustainability`, `blog`, `blog-details`, `faq`, `contact`, `404` |
| Shipping tools | `tracking` (Shipment Tracking / Track Shipment), `shipment-details`, `shipping-calculator`, `book-shipment`, `invoice` |
| Fleet | `fleet`, `drivers` |
| Accounts | `login`, `register`, `forgot-password` |
| Dashboards | `customer-dashboard`, `driver-dashboard`, `fleet-dashboard`, `admin-dashboard` |

## Features

- **Live simulation (`js/data.js` → `LX.sim`):** shipments advance along curved route polylines, and status moves through Booked → Picked Up → Processing → In Transit → Out for Delivery → Delivered. ETA, distance remaining, current location and the timeline update every 3 seconds. Progress persists in LocalStorage.
- **Maps (Leaflet):** these include the live tracking map with a moving vehicle, completed and remaining route, stops, and a traffic segment. There are also a world coverage map with animated lanes and moving shipments, a road network map, a last-mile run with eight stops and proof-of-delivery toasts, and fleet maps in the dashboards.
- **Pricing engine (`LX.pricing`):** calculates distance, chargeable (volumetric) weight, mode and speed multipliers, fuel surcharge, handling, insurance and tax. The calculator, the homepage quick quote and the booking flow all use it.
- **Booking flow:** six validated steps, including a recommended vehicle based on weight, a calendar date picker, a promo code (`NORTH10`) and payment method. Draft progress autosaves. Confirming a booking generates Booking and Shipment IDs and creates an invoice.
- **Dashboards:**
  - Customer: live map, shipments, quotes, invoices, address book.
  - Driver: Start → Arrived → Delivered workflow with a signature pad, issue reporting, navigation, earnings and vehicle inspection.
  - Fleet manager: live fleet map, maintenance calendar, fuel, CSV reports.
  - Admin: 19 modules covering shipments, customers, invoices, payments, pricing, users and more.
- **UI system:**
  - Dark and light themes.
  - Toasts, modals with focus trapping, accordions, tabs.
  - Search, filter, sort and pagination through the shared `LX.list`.
  - AOS scroll reveals, count-up counters, 3D tilt, button ripple, parallax.
  - Scroll progress bar, back-to-top button, page loader and page transitions.
- **Charts (Chart.js):** a colour-blind-safe categorical palette validated for both themes (`--series-1..5` in `css/style.css`), no dual axes, tooltips on every chart, and legends only where there are two or more series.
- **Accessibility:** semantic landmarks, a skip link, ARIA on menus, tabs, accordions and live regions, keyboard support, visible focus states, labelled forms and `prefers-reduced-motion` support.

## Structure

```
index.html … 404.html      33 static pages (shared header/footer are injected by js/navbar.js)
css/
  style.css                design tokens, base, components (buttons, cards, forms, tables, nav, footer, toasts…)
  animations.css           keyframes, reveal, tilt, shimmer
  home.css                 homepage sections
  services.css             content pages, service widgets, pricing, blog, FAQ, contact, invoice
  tracking.css             tracking widget, live tracking, timeline, shipment details
  booking.css              booking stepper, calendar, calculator
  fleet.css                fleet & driver directories
  dashboard.css            dashboard shell and widgets
  auth.css                 login / register / reset
  responsive.css           breakpoints: 1280 · 1100 · 960 · 720 · 560 · 480
js/
  icons.js                 inline SVG icon set (<i data-icon="truck">) + brand mark
  data.js                  LocalStorage store, utils, geo/route math, demo data, session, live simulation
  notifications.js         toasts, modals, notification center
  navbar.js                header/mega menu/mobile drawer/footer, theme, scroll progress, transitions
  animations.js            AOS init + fallback, counters, progress bars, tilt, ripple, parallax
  charts.js                Chart.js theming helpers
  components.js            shared card renderers (services, posts, industries, case studies)
  main.js                  boot sequence, validation, list controller, tabs, accordions, forms
  tracking.js              Leaflet helpers, tracking widget, live tracking + shipment details pages
  calculator.js            pricing engine + calculator page
  booking.js               quick quote, calendar, multi-step booking
  services.js              service-page widgets (lane map, flight board, containers, warehouse, last-mile, express)
  fleet.js / drivers.js    fleet & driver stores and pages
  pages.js                 pricing, blog, article, FAQ, contact, industries, case studies, sustainability
  home.js                  homepage hero console, coverage map, live preview, route network, testimonials
  auth.js                  login, register, forgot password
  dashboard.js             dashboard framework + customer, driver, fleet dashboards
  admin.js                 admin console
  invoice.js               invoice view, print, download, send, pay
assets/
  images/{hero,trucks,fleet,warehouse,logistics,drivers,industries,blog,backgrounds}
  icons/favicon.png, apple-touch-icon.png   (from the Stackly logo symbol)
  fonts/                   (empty — Inter, Manrope and Outfit load from Google Fonts)
```

Scripts are classic deferred scripts that share one global namespace, `window.LX`. They are not ES modules, which keeps the site working from `file://`. Each page loads `icons → data → notifications → navbar → animations → [charts] → page scripts → main`. Page scripts register work through `LX.ready(fn)`.

## Customising

- **Brand and colours:** edit the tokens in `:root` at the top of `css/style.css`. The light theme lives in `:root[data-theme="light"]`.
- **Demo data:** shipments, drivers, vehicles, warehouses, services, industries, blog posts and pricing plans are all in `js/data.js`. After you change seed data, increase `DATA_VERSION` so browsers reseed LocalStorage. You can also use **Settings → Reset demo data** in any dashboard.
- **Navigation and footer:** edit `NAV` and `footerHTML()` in `js/navbar.js`.

## Third-party libraries & credits (CDN)

- [Leaflet 1.9.4](https://leafletjs.com) — maps. Map tiles: Esri World Dark/Light Gray Canvas (no API key needed; check Esri's terms before commercial production use).
- [Chart.js 4.4.1](https://www.chartjs.org) — charts.
- [AOS 2.3.4](https://michalsnik.github.io/aos/) — scroll animations. The site falls back to its own IntersectionObserver reveal if AOS is unavailable.
- Google Fonts: Inter, Manrope, Outfit.
- Photography from [Unsplash](https://unsplash.com), under the Unsplash License, stored locally in `assets/images`.

NorthLane Logistics is a fictional company. All names, figures, shipments and customers are demo content.
