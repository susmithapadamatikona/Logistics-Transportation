/* ==========================================================================
   NorthLane Logistics — Shared card renderers
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  LX.cards = {
    service(s, i) {
      return '<article class="card card-hover service-card" data-aos="fade-up" data-aos-delay="' + ((i || 0) % 4) * 80 + '">' +
        '<div class="sc-media"><img src="' + s.img + '" alt="' + U.esc(s.title) + ' — NorthLane logistics service" loading="lazy"><span class="badge badge-accent no-dot sc-time">' + I('clock') + s.time + '</span></div>' +
        '<div class="sc-body"><span class="sc-icon">' + I(s.icon) + '</span><h3>' + s.title + '</h3><p>' + s.text + '</p><ul>' + s.features.map((f) => '<li>' + I('check') + f + '</li>').join('') + '</ul>' +
        '<div class="sc-foot"><a class="link-arrow" href="404.html" aria-label="Explore ' + U.esc(s.title) + '">Explore service ' + I('arrow-right') + '</a></div></div></article>';
    },
    post(p, i) {
      return '<article class="card card-hover post-card" data-aos="fade-up" data-aos-delay="' + ((i || 0) % 3) * 90 + '">' +
        '<a class="pc-media" href="blog-details.html?post=' + p.slug + '" tabindex="-1" aria-hidden="true"><img src="' + p.img + '" alt="" loading="lazy"><span class="badge badge-primary no-dot">' + p.category + '</span></a>' +
        '<div class="pc-body"><div class="pc-meta"><span>' + I('calendar') + U.date(p.date + 'T12:00') + '</span><span>' + I('clock') + p.read + ' min read</span></div>' +
        '<h3><a href="blog-details.html?post=' + p.slug + '">' + p.title + '</a></h3><p>' + p.excerpt + '</p>' +
        '<div class="pc-author"><img src="' + p.authorImg + '" alt="' + U.esc(p.author) + '" loading="lazy"><span><strong>' + p.author + '</strong><br><span class="muted xs">' + p.role + '</span></span></div></div></article>';
    },
    industry(ind, i) {
      return '<article class="card card-hover industry-card" data-aos="fade-up" data-aos-delay="' + ((i || 0) % 3) * 80 + '">' +
        '<div class="ic-media"><img src="' + ind.img + '" alt="Logistics for the ' + U.esc(ind.title) + ' industry" loading="lazy"><span class="icon-box">' + I(ind.icon) + '</span></div>' +
        '<div class="ic-body"><h3>' + ind.title + '</h3>' +
        '<div class="ic-row"><span class="ic-label">' + I('alert') + 'Logistics challenge</span><p>' + ind.challenge + '</p></div>' +
        '<div class="ic-row"><span class="ic-label">' + I('bulb') + 'Our solution</span><p>' + ind.solution + '</p></div>' +
        '<div class="ic-foot"><span class="badge badge-primary no-dot">' + I('route') + ind.model + '</span><a class="link-arrow" href="contact.html?industry=' + encodeURIComponent(ind.title) + '">Talk to an expert ' + I('arrow-right') + '</a></div></div></article>';
    },
    caseStudy(c, i, full) {
      return '<article class="card card-hover case-card" data-aos="fade-up" data-aos-delay="' + ((i || 0) % 3) * 90 + '" id="' + c.slug + '">' +
        '<div class="cc-media"><img src="' + c.img + '" alt="' + U.esc(c.title) + '" loading="lazy"><span class="badge badge-accent no-dot">' + c.industry + '</span></div>' +
        '<div class="cc-body"><span class="xs muted">' + c.client + '</span><h3>' + c.title + '</h3>' +
        (full
          ? '<div class="cs-block"><strong>' + I('alert') + 'Challenge</strong><p>' + c.challenge + '</p></div><div class="cs-block"><strong>' + I('bulb') + 'Solution</strong><p>' + c.solution + '</p></div>' +
            '<div class="cs-tags"><span class="chip">' + I('route') + c.method + '</span><span class="chip">' + I('cpu') + c.tech + '</span></div>' +
            '<div class="cs-block"><strong>' + I('award') + 'Result</strong><p>' + c.result + '</p></div>'
          : '<p>' + c.result + '</p>') +
        '<div class="cc-metrics"><div><strong>' + c.improvement + '</strong><span>Delivery improvement</span></div><div><strong>' + c.saving + '</strong><span>Cost reduction</span></div></div>' +
        (full ? '' : '<a class="link-arrow" href="404.html">Read case study ' + I('arrow-right') + '</a>') + '</div></article>';
    }
  };

  /* Render a named collection into [data-render="..."] containers */
  LX.ready(() => {
    document.querySelectorAll('[data-render]').forEach((el) => {
      const kind = el.dataset.render;
      const limit = +el.dataset.limit || undefined;
      const src = { services: LX.data.services, posts: LX.data.blogPosts, industries: LX.data.industries, cases: LX.data.caseStudies }[kind];
      const fn = { services: LX.cards.service, posts: LX.cards.post, industries: LX.cards.industry, cases: LX.cards.caseStudy }[kind];
      if (!src) return;
      el.innerHTML = src.slice(0, limit).map((x, i) => fn(x, i, el.dataset.full !== undefined)).join('');
    });
  });
})();
