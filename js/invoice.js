/* ==========================================================================
   NorthLane Logistics — Invoice details (print / download / send / pay)
   ========================================================================== */
(function () {
  const LX = (window.LX = window.LX || {});
  const U = LX.util, I = (n) => LX.icon(n);

  function find(id) {
    const paid = LX.store.get('paidInvoices', []);
    const all = LX.store.get('invoicesCustom', []).concat(LX.data.invoices);
    const inv = all.find((x) => x.id === id) || all[2];
    return Object.assign({}, inv, paid.includes(inv.id) ? { status: 'Paid' } : {});
  }

  function render() {
    const root = document.getElementById('invoiceDoc');
    if (!root) return;
    const inv = find(U.param('id'));
    const s = LX.sim.find(inv.shipment);
    document.title = inv.id + ' · Invoice | NorthLane Logistics';
    const cust = inv.customer;
    const lines = [
      [inv.service + ' — ' + (s ? s.fromLabel + ' to ' + s.toLabel : inv.route), (s ? U.num(s.distance) + ' km · ' + U.num(s.weight) + ' kg · ' + s.pieces + ' pcs' : ''), inv.subtotal],
      ['Fuel surcharge', 'Indexed to DOE diesel average', inv.fuel],
      ['Handling & insurance', 'Terminal handling, cargo insurance up to $100,000', inv.handling]
    ];
    const statusCls = { Paid: 'badge-paid', Pending: 'badge-pending', Overdue: 'badge-overdue' }[inv.status];
    root.innerHTML =
      '<div class="inv-actions no-print"><a class="btn btn-ghost btn-sm" href="customer-dashboard.html#invoices">' + I('arrow-left') + 'Invoices</a><div class="flex flex-wrap"><button class="btn btn-ghost btn-sm" id="invPrint">' + I('printer') + 'Print Invoice</button><button class="btn btn-ghost btn-sm" id="invDownload">' + I('download') + 'Download Invoice</button><button class="btn btn-ghost btn-sm" id="invSend">' + I('send') + 'Send Invoice</button>' + (inv.status !== 'Paid' ? '<button class="btn btn-accent btn-sm" id="invPay">' + I('card') + 'Pay ' + U.money(inv.total) + '</button>' : '') + '</div></div>' +
      '<article class="invoice card" id="invoicePaper" aria-label="Invoice ' + inv.id + '">' +
      '<div class="inv-stamp ' + statusCls + '">' + inv.status + '</div>' +
      '<header class="inv-head"><div><a class="brand" href="index.html" aria-label="Stackly home">' + LX.brandLogo() + '</a><p class="small mt-2">NorthLane Logistics, Inc.<br>1200 W Fulton Market, Chicago, IL 60607<br>billing@northlane.io · +1 (800) 555-0148<br>EIN 36-4829175</p></div>' +
      '<div class="inv-meta"><h1>Invoice</h1><div class="kv"><div><span>Invoice Number</span><strong class="mono">' + inv.id + '</strong></div><div><span>Payment Status</span><strong><span class="badge ' + statusCls + '">' + inv.status + '</span></strong></div><div><span>Date</span><strong>' + U.date(inv.date) + '</strong></div><div><span>Due Date</span><strong>' + U.date(inv.due) + '</strong></div></div></div></header>' +
      '<div class="inv-parties"><div><span class="xs muted">Bill to</span><strong>' + cust + '</strong><p class="small">Accounts Payable<br>ap@' + U.slug(cust).replace(/-/g, '') + '.com<br>Net 30 terms</p></div><div><span class="xs muted">Shipment</span><strong class="mono">' + inv.shipment + '</strong><p class="small">' + inv.service + '<br>' + inv.route + '<br>Mode: ' + inv.mode + '</p></div><div><span class="xs muted">Service</span><strong>' + inv.service + '</strong><p class="small">' + (s ? 'Picked up ' + U.date(s.pickupDate) + '<br>' + (s.progress >= 1 ? 'Delivered' : 'ETA ' + U.date(s.etaLive)) : '') + '</p></div></div>' +
      '<div class="table-wrap" style="border:0"><table class="table inv-table"><caption class="sr-only">Invoice line items</caption><thead><tr><th scope="col">Description</th><th scope="col" style="text-align:right">Amount</th></tr></thead><tbody>' + lines.map((l) => '<tr><td><strong>' + l[0] + '</strong><div class="cell-sub">' + l[1] + '</div></td><td style="text-align:right">' + U.money(l[2]) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="inv-totals"><div><span>Subtotal</span><strong>' + U.money(inv.subtotal) + '</strong></div><div><span>Fuel Charge</span><strong>' + U.money(inv.fuel) + '</strong></div><div><span>Handling</span><strong>' + U.money(inv.handling) + '</strong></div><div><span>Tax (8%)</span><strong>' + U.money(inv.tax) + '</strong></div><div class="grand"><span>Total</span><strong>' + U.money(inv.total) + '</strong></div></div>' +
      '<footer class="inv-foot"><div><strong class="small">Payment details</strong><p class="xs">ACH · First Midwest Bank · Routing 071000013 · Account ••••4821<br>Reference ' + inv.id + ' on all payments.</p></div><p class="xs">Thank you for shipping with NorthLane. Questions? billing@northlane.io</p></footer>' +
      '</article>';
    document.getElementById('invPrint').onclick = () => window.print();
    document.getElementById('invDownload').onclick = () => {
      const css = Array.from(document.styleSheets).map((ss) => { try { return Array.from(ss.cssRules).map((r) => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
      const html = '<!DOCTYPE html><html lang="en" data-theme="light"><head><meta charset="utf-8"><title>' + inv.id + '</title><style>' + css + '</style></head><body style="padding:30px;background:#fff">' + document.getElementById('invoicePaper').outerHTML + '</body></html>';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = inv.id + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      LX.toast('Invoice downloaded', inv.id + '.html saved — open it and print to PDF if needed.', 'success');
    };
    document.getElementById('invSend').onclick = () => {
      const m = LX.modal.show('<h3>Send invoice</h3><p class="small">' + inv.id + ' · ' + U.money(inv.total) + '</p><form id="sendForm" class="stack mt-2" novalidate><div class="field"><label for="sTo">Recipient email</label><input id="sTo" class="input" type="email" name="to" required value="ap@' + U.slug(cust).replace(/-/g, '') + '.com"><span class="field-error"></span></div><div class="field"><label for="sMsg">Message</label><textarea id="sMsg" class="textarea" name="msg" style="min-height:90px">Hello, please find invoice ' + inv.id + ' for shipment ' + inv.shipment + ' attached. Payment is due ' + U.date(inv.due) + '.</textarea></div><label class="check"><input type="checkbox" checked>Attach PDF copy</label><button class="btn" type="submit">' + I('send') + 'Send</button></form>', { label: 'Send invoice' });
      m.querySelector('#sendForm').onsubmit = (e) => { e.preventDefault(); if (!LX.validate(e.target)) return; LX.modal.close(m); LX.toast('Invoice sent', inv.id + ' emailed to ' + e.target.to.value + '.', 'success'); };
    };
    const pay = document.getElementById('invPay');
    if (pay) {
      pay.onclick = () => {
        const m = LX.modal.show('<h3>Pay ' + U.money(inv.total) + '</h3><p class="small">Invoice ' + inv.id + '</p><form id="payForm" class="stack mt-2" novalidate><div class="field"><label for="pName">Name on card</label><input id="pName" class="input" name="name" required autocomplete="cc-name"><span class="field-error"></span></div><div class="field"><label for="pCard">Card number</label><input id="pCard" class="input" name="card" required inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" data-minlength="15"><span class="field-error"></span></div><div class="form-grid"><div class="field"><label for="pExp">Expiry</label><input id="pExp" class="input" name="exp" required placeholder="MM / YY" autocomplete="cc-exp"><span class="field-error"></span></div><div class="field"><label for="pCvc">CVC</label><input id="pCvc" class="input" name="cvc" required inputmode="numeric" autocomplete="cc-csc" data-minlength="3"><span class="field-error"></span></div></div><p class="xs muted">' + I('lock') + ' Demo checkout — no payment is processed and card details are not stored.</p><button class="btn btn-accent" type="submit">' + I('check') + 'Pay now</button></form>', { label: 'Pay invoice' });
        const card = m.querySelector('#pCard');
        card.addEventListener('input', () => { card.value = card.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); });
        m.querySelector('#payForm').onsubmit = (e) => {
          e.preventDefault();
          if (!LX.validate(e.target)) return;
          const b = e.target.querySelector('[type="submit"]'); b.classList.add('is-loading');
          setTimeout(() => { const l = LX.store.get('paidInvoices', []); l.push(inv.id); LX.store.set('paidInvoices', l); LX.modal.close(m); LX.notify.add('Payment received', inv.id + ' paid in full (' + U.money(inv.total) + ').', 'success'); LX.toast('Payment successful', 'Receipt sent to your email.', 'success'); render(); LX.hydrateIcons(); }, 1200);
        };
      };
      if (location.hash === '#pay') setTimeout(() => pay.click(), 400);
    }
  }

  LX.ready(render);
})();
