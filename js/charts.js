/* ==========================================================================
   NorthLane Logistics — Chart helpers (Chart.js 4)
   Series colors come from CSS tokens (--series-1..5), validated for CVD
   separation on both the dark and light surfaces. Order is fixed per entity.
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const instances = [];

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function palette() {
    return {
      series: [css('--series-1'), css('--series-2'), css('--series-3'), css('--series-4'), css('--series-5')],
      text: css('--muted') || '#91A4B5',
      heading: css('--heading') || '#fff',
      grid: css('--line-soft') || 'rgba(255,255,255,.06)',
      surface: getComputedStyle(document.body).getPropertyValue('--surface').trim() || '#14263A',
      success: '#22C55E', danger: '#EF4444', warning: '#F59E0B'
    };
  }
  function alpha(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function baseOptions(kind, multi, opts) {
    const p = palette();
    const o = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1100, easing: 'easeOutQuart' },
      interaction: kind === 'line' ? { mode: 'index', intersect: false } : { mode: 'nearest', intersect: true },
      plugins: {
        legend: {
          display: multi,
          position: 'top', align: 'end',
          labels: { color: p.text, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { family: 'Inter', size: 12, weight: '600' } }
        },
        tooltip: {
          backgroundColor: 'rgba(7,17,31,.94)', borderColor: 'rgba(255,255,255,.12)', borderWidth: 1,
          titleColor: '#fff', bodyColor: '#E7EEF5', padding: 12, cornerRadius: 10, boxPadding: 6, usePointStyle: true,
          titleFont: { family: 'Manrope', weight: '700' }, bodyFont: { family: 'Inter' },
          callbacks: opts && opts.format ? { label: (ctx) => ' ' + (kind === 'doughnut' ? ctx.label + ': ' : ctx.dataset.label ? ctx.dataset.label + ': ' : '') + opts.format(ctx.parsed.y !== undefined && kind !== 'doughnut' ? (opts.horizontal ? ctx.parsed.x : ctx.parsed.y) : ctx.parsed) } : {}
        }
      }
    };
    if (kind !== 'doughnut') {
      const tick = { color: p.text, font: { family: 'Inter', size: 11 }, padding: 8 };
      const valueAxis = { beginAtZero: true, grid: { color: p.grid, drawTicks: false }, border: { display: false }, ticks: Object.assign({}, tick, { maxTicksLimit: 6, callback: opts && opts.axisFormat ? opts.axisFormat : undefined }) };
      const catAxis = { grid: { display: false }, border: { color: p.grid }, ticks: tick };
      o.scales = opts && opts.horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis };
      if (opts && opts.stacked) { o.scales.x.stacked = true; o.scales.y.stacked = true; }
      if (opts && opts.horizontal) o.indexAxis = 'y';
    } else {
      o.cutout = '72%';
      o.plugins.legend.display = true;
      o.plugins.legend.position = opts && opts.legendPos ? opts.legendPos : 'bottom';
      o.plugins.legend.align = 'center';
    }
    return o;
  }

  function styleDatasets(kind, datasets, opts) {
    const p = palette();
    return datasets.map((d, i) => {
      const color = d.color || p.series[(d.slot !== undefined ? d.slot : i) % p.series.length];
      if (kind === 'line') {
        return Object.assign({
          borderColor: color, backgroundColor: (ctx) => {
            if (!d.fill && !(opts && opts.area)) return 'transparent';
            const c = ctx.chart.ctx, area = ctx.chart.chartArea;
            if (!area) return alpha(color, 0.15);
            const g = c.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, alpha(color, 0.28)); g.addColorStop(1, alpha(color, 0));
            return g;
          },
          fill: !!(d.fill || (opts && opts.area)), borderWidth: 2, tension: 0.38,
          pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: p.surface, pointBackgroundColor: color
        }, d, { color: undefined });
      }
      if (kind === 'bar') {
        const top = opts && opts.horizontal ? { topRight: 4, bottomRight: 4 } : { topLeft: 4, topRight: 4 };
        return Object.assign({
          backgroundColor: d.colors || color, borderRadius: opts && opts.stacked && i < datasets.length - 1 ? 0 : top, borderSkipped: 'start',
          borderColor: p.surface, borderWidth: opts && opts.stacked ? { top: 2 } : 0,
          maxBarThickness: 26, categoryPercentage: 0.66, barPercentage: 0.82
        }, d, { color: undefined, colors: undefined });
      }
      return Object.assign({ backgroundColor: d.colors || p.series, borderColor: p.surface, borderWidth: 2, hoverOffset: 6, spacing: 1 }, d, { colors: undefined });
    });
  }

  /* LX.charts.make(canvasOrId, 'line'|'bar'|'doughnut', labels, datasets, opts) */
  function make(target, kind, labels, datasets, opts) {
    const canvas = typeof target === 'string' ? document.getElementById(target) : target;
    if (!canvas || !window.Chart) {
      if (canvas && !window.Chart) canvas.parentElement.innerHTML = '<div class="map-fallback">Chart library unavailable offline.</div>';
      return null;
    }
    opts = opts || {};
    const rec = { canvas, kind, labels, datasets, opts, chart: null };
    const build = () => {
      if (rec.chart) rec.chart.destroy();
      const multi = datasets.length > 1;
      const config = {
        type: kind,
        data: { labels, datasets: styleDatasets(kind, datasets, opts) },
        options: baseOptions(kind, multi, opts)
      };
      if (opts.extend) opts.extend(config.options);
      rec.chart = new window.Chart(canvas, config);
    };
    rec.build = build;
    instances.push(rec);
    if (LX.onVisible) LX.onVisible([canvas], build, { threshold: 0.15 }); else build();
    return rec;
  }

  document.addEventListener('lx:theme', () => {
    setTimeout(() => instances.forEach((r) => { if (r.chart) r.build(); }), 30);
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  LX.charts = {
    make, palette, alpha, instances, months,
    line: (t, l, d, o) => make(t, 'line', l, d, o),
    bar: (t, l, d, o) => make(t, 'bar', l, d, o),
    doughnut: (t, l, d, o) => make(t, 'doughnut', l, d, o),
    money: (v) => '$' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1) + 'K' : v),
    /* Trailing 12 month labels ending in the current month */
    lastMonths(n) {
      const out = [], d = new Date();
      for (let i = (n || 12) - 1; i >= 0; i--) out.push(months[(d.getMonth() - i + 12) % 12]);
      return out;
    }
  };
})();
