// Mini-cart runtime shared by the shop_list and shop_product templates. Baked
// once per page (guarded by window.__cfCartLoaded). The cart lives in
// localStorage (per site); checkout POSTs cross-origin to the app worker
// (forms/analytics pattern) which creates a Stripe Checkout Session on the
// merchant's connected account and returns its URL.
//
// Server truth: the checkout endpoint reprices every line from the DB — the
// cart only sends {id, qty}; name/price here are display-only.

import { t } from '../../../i18n/index.js';

/** The cart <script> + minimal styles for one shop page render. */
export function cartScript(config) {
  const lang = config.lang || 'en';
  const siteId = config.trackId || '';
  const endpoint = `${config.appOrigin || ''}/api/store/checkout`;
  const currency = (config.store_currency || 'usd').toUpperCase();
  const primary = config.primary_color || '#667eea';

  const cfg = {
    site: siteId,
    endpoint,
    currency,
    lang,
    preview: !siteId,
    // Discount codes (Advanced Store): the input shows only when the owner is
    // entitled; the buyer's preview is server-validated (re-priced) before checkout.
    discounts: !!config.hasAdvStore,
    validateUrl: `${config.appOrigin || ''}/api/store/discount/validate`,
    s: {
      added: t(lang, 'shopw.added'),
      add: t(lang, 'shopw.add'),
      cart: t(lang, 'shopw.cart'),
      empty: t(lang, 'shopw.empty'),
      checkout: t(lang, 'shopw.checkout'),
      starting: t(lang, 'shopw.starting'),
      remove: t(lang, 'shopw.remove'),
      total: t(lang, 'shopw.total'),
      paid: t(lang, 'shopw.paid'),
      cancelled: t(lang, 'shopw.cancelled'),
      error: t(lang, 'shopw.error'),
      preview: t(lang, 'shopw.preview_note'),
      myOrders: t(lang, 'rcpt.my_orders'),
      discountLabel: t(lang, 'shopw.discount_label'),
      discountApply: t(lang, 'shopw.discount_apply'),
      discountApplied: t(lang, 'shopw.discount_applied'),
      discountRemove: t(lang, 'shopw.discount_remove'),
      discountOff: t(lang, 'shopw.discount_off'),
      discountChecking: t(lang, 'shopw.discount_checking'),
    },
    ordersUrl: siteId ? `${config.appOrigin || ''}/store/orders?s=${siteId}` : '',
  };

  return `
<style>
#cf-cart-fab { position: fixed; right: 1.2rem; bottom: 1.2rem; z-index: 9000; width: 56px; height: 56px;
  border-radius: 50%; background: ${primary}; color: #fff; border: none; cursor: pointer; font-size: 1.45rem;
  box-shadow: 0 6px 24px rgba(0,0,0,.25); display: none; align-items: center; justify-content: center; }
#cf-cart-fab .cf-n { position: absolute; top: -4px; right: -4px; background: #1a202c; color: #fff; border-radius: 999px;
  font-size: .72rem; font-weight: 700; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
#cf-cart-panel { position: fixed; right: 1.2rem; bottom: 5.6rem; z-index: 9001; width: min(360px, calc(100vw - 2.4rem));
  background: #fff; color: #1a202c; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,.3); padding: 1.1rem 1.2rem; display: none;
  font-family: inherit; max-height: 70vh; overflow: auto; }
#cf-cart-panel h3 { margin: 0 0 .7rem; font-size: 1.05rem; }
.cf-cart-row { display: flex; align-items: center; gap: .7rem; padding: .5rem 0; border-bottom: 1px solid #edf2f7; }
.cf-cart-row img { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; background: #f7fafc; }
.cf-cart-row .cf-i { flex: 1; min-width: 0; }
.cf-cart-row .cf-i b { display: block; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cf-cart-row .cf-i span { font-size: .8rem; color: #718096; }
.cf-qty { display: flex; align-items: center; gap: .35rem; }
.cf-qty button { width: 22px; height: 22px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; line-height: 1; }
.cf-rm { background: none; border: none; color: #b91c1c; cursor: pointer; font-size: .95rem; }
.cf-cart-total { display: flex; justify-content: space-between; font-weight: 700; margin: .8rem 0; }
.cf-cart-go { width: 100%; background: ${primary}; color: #fff; border: none; border-radius: 10px; padding: .75rem; font-size: .95rem; font-weight: 700; cursor: pointer; }
.cf-cart-go:disabled { opacity: .6; cursor: default; }
.cf-cart-note { font-size: .8rem; color: #718096; margin-top: .5rem; text-align: center; }
.cf-disc { display: flex; gap: .4rem; margin: .5rem 0 .2rem; }
.cf-disc input { flex: 1; min-width: 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: .5rem .6rem; font-size: .85rem; text-transform: uppercase; }
.cf-disc button { border: 1px solid ${primary}; background: #fff; color: ${primary}; border-radius: 8px; padding: 0 .9rem; font-weight: 700; cursor: pointer; font-size: .85rem; }
.cf-disc-applied { display: flex; justify-content: space-between; align-items: center; font-size: .85rem; margin: .4rem 0 .2rem; color: #15803d; }
.cf-disc-applied button { background: none; border: none; color: #b91c1c; cursor: pointer; font-size: .8rem; text-decoration: underline; }
.cf-cart-disc { display: flex; justify-content: space-between; color: #15803d; font-size: .9rem; margin: .3rem 0 0; }
#cf-shop-toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: 1.2rem; z-index: 9002; background: #1a202c; color: #fff;
  border-radius: 10px; padding: .7rem 1.1rem; font-size: .9rem; box-shadow: 0 8px 24px rgba(0,0,0,.3); display: none; max-width: 90vw; }
</style>
<script>
(function () {
  if (window.__cfCartLoaded) return; window.__cfCartLoaded = true;
  var CFG = ${JSON.stringify(cfg)};
  var KEY = 'cf-cart-' + (CFG.site || 'preview');
  var APPLIED = { code: null, amount: 0 }; // discount code applied to this cart
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function write(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} render(); if (APPLIED.code) refreshDiscount(); }
  function money(cents) {
    try { return new Intl.NumberFormat(CFG.lang, { style: 'currency', currency: CFG.currency }).format(cents / 100); }
    catch (e) { return (cents / 100).toFixed(2) + ' ' + CFG.currency; }
  }
  function toast(msg, ms) {
    var el = document.getElementById('cf-shop-toast');
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(el.__t); el.__t = setTimeout(function () { el.style.display = 'none'; }, ms || 3500);
  }
  function render() {
    var cart = read();
    var n = cart.reduce(function (a, i) { return a + i.qty; }, 0);
    var fab = document.getElementById('cf-cart-fab');
    fab.style.display = n ? 'flex' : 'none';
    fab.querySelector('.cf-n').textContent = n;
    var panel = document.getElementById('cf-cart-panel');
    if (!n) { panel.style.display = 'none'; return; }
    var rows = cart.map(function (i, idx) {
      return '<div class="cf-cart-row">' +
        (i.image ? '<img src="' + i.image.replace(/"/g, '&quot;') + '" alt="">' : '<img alt="">') +
        '<div class="cf-i"><b></b><span>' + money(i.price_cents) + '</span></div>' +
        '<div class="cf-qty"><button data-d="' + idx + '">−</button><span>' + i.qty + '</span><button data-u="' + idx + '">+</button></div>' +
        '<button class="cf-rm" data-r="' + idx + '" title="' + CFG.s.remove + '">✕</button></div>';
    }).join('');
    var total = cart.reduce(function (a, i) { return a + i.price_cents * i.qty; }, 0);
    var discAmt = APPLIED.code ? Math.min(APPLIED.amount, total) : 0;
    var finalTotal = total - discAmt;
    var discBlock = '';
    if (CFG.discounts && !CFG.preview) {
      if (APPLIED.code) {
        discBlock =
          '<div class="cf-cart-disc"><span>' + CFG.s.discountOff + ' (' + APPLIED.code + ')</span><span>−' + money(discAmt) + '</span></div>' +
          '<div class="cf-disc-applied"><span>' + CFG.s.discountApplied + ' ✓</span><button class="cf-disc-remove">' + CFG.s.discountRemove + '</button></div>';
      } else {
        discBlock = '<div class="cf-disc"><input class="cf-disc-input" placeholder="' + CFG.s.discountLabel + '" maxlength="40"><button class="cf-disc-apply">' + CFG.s.discountApply + '</button></div>';
      }
    }
    panel.innerHTML = '<h3>' + CFG.s.cart + '</h3>' + rows +
      discBlock +
      '<div class="cf-cart-total"><span>' + CFG.s.total + '</span><span>' + money(finalTotal) + '</span></div>' +
      '<button class="cf-cart-go">' + CFG.s.checkout + '</button>' +
      (CFG.preview ? '<div class="cf-cart-note">' + CFG.s.preview + '</div>' : '') +
      (CFG.ordersUrl ? '<div class="cf-cart-note"><a href="' + CFG.ordersUrl + '" target="_blank" rel="noopener" style="color:inherit">' + CFG.s.myOrders + ' →</a></div>' : '');
    // product names via textContent (never trusted as HTML)
    var bs = panel.querySelectorAll('.cf-i b');
    for (var k = 0; k < cart.length; k++) bs[k].textContent = cart[k].name;
    panel.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { bump(+b.getAttribute('data-d'), -1); }; });
    panel.querySelectorAll('[data-u]').forEach(function (b) { b.onclick = function () { bump(+b.getAttribute('data-u'), 1); }; });
    panel.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { var c = read(); c.splice(+b.getAttribute('data-r'), 1); write(c); }; });
    panel.querySelector('.cf-cart-go').onclick = checkout;
    var applyBtn = panel.querySelector('.cf-disc-apply');
    if (applyBtn) applyBtn.onclick = function () { applyCode(panel.querySelector('.cf-disc-input').value); };
    var remBtn = panel.querySelector('.cf-disc-remove');
    if (remBtn) remBtn.onclick = removeCode;
  }
  async function validateCode(code) {
    var cart = read();
    var res = await fetch(CFG.validateUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s: CFG.site, code: code, items: cart.map(function (i) { return { id: i.id, qty: i.qty }; }) }),
    });
    var d = await res.json().catch(function () { return {}; });
    if (!res.ok || d.success === false) throw new Error(d.error || CFG.s.error);
    return d;
  }
  async function applyCode(raw) {
    var code = (raw || '').trim();
    if (!code) return;
    try { var d = await validateCode(code); APPLIED = { code: d.code, amount: d.amount_cents || 0 }; render(); }
    catch (e) { toast(e.message || CFG.s.error); }
  }
  function removeCode() { APPLIED = { code: null, amount: 0 }; render(); }
  async function refreshDiscount() {
    if (!APPLIED.code) return;
    try { var d = await validateCode(APPLIED.code); if (d.amount_cents !== APPLIED.amount) { APPLIED.amount = d.amount_cents || 0; render(); } }
    catch (e) { removeCode(); }
  }
  function bump(idx, d) {
    var c = read(); if (!c[idx]) return;
    c[idx].qty = Math.max(0, Math.min(99, c[idx].qty + d));
    if (!c[idx].qty) c.splice(idx, 1);
    write(c);
  }
  function add(item) {
    var c = read();
    for (var i = 0; i < c.length; i++) {
      if (c[i].id === item.id) { c[i].qty = Math.min(99, c[i].qty + 1); write(c); return; }
    }
    c.push({ id: item.id, name: item.name, price_cents: item.price_cents, image: item.image, qty: 1 });
    write(c);
  }
  async function checkout() {
    if (CFG.preview) { toast(CFG.s.preview); return; }
    var cart = read(); if (!cart.length) return;
    var btn = document.querySelector('.cf-cart-go');
    btn.disabled = true; btn.textContent = CFG.s.starting;
    try {
      var res = await fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s: CFG.site,
          items: cart.map(function (i) { return { id: i.id, qty: i.qty }; }),
          path: location.pathname,
          discount_code: APPLIED.code || undefined,
        }),
      });
      var d = await res.json().catch(function () { return {}; });
      // A code that lapsed between apply and checkout → drop it and let them retry.
      if (d && d.discount_error) { removeCode(); }
      if (!res.ok || !d.url) throw new Error(d.error || CFG.s.error);
      location.href = d.url;
      return;
    } catch (e) { toast(e.message || CFG.s.error); }
    btn.disabled = false; btn.textContent = CFG.s.checkout;
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-cf-add]');
    if (!b) return;
    ev.preventDefault();
    add({
      id: parseInt(b.getAttribute('data-id'), 10),
      name: b.getAttribute('data-name') || '',
      price_cents: parseInt(b.getAttribute('data-price'), 10) || 0,
      image: b.getAttribute('data-image') || '',
    });
    var old = b.textContent; b.textContent = CFG.s.added;
    setTimeout(function () { b.textContent = old; }, 1200);
    document.getElementById('cf-cart-panel').style.display = 'block';
  });
  document.addEventListener('DOMContentLoaded', function () {
    var fab = document.createElement('button');
    fab.id = 'cf-cart-fab'; fab.innerHTML = '🛒<span class="cf-n"></span>';
    fab.onclick = function () {
      var p = document.getElementById('cf-cart-panel');
      p.style.display = p.style.display === 'block' ? 'none' : 'block';
    };
    document.body.appendChild(fab);
    var panel = document.createElement('div'); panel.id = 'cf-cart-panel'; document.body.appendChild(panel);
    var tst = document.createElement('div'); tst.id = 'cf-shop-toast'; document.body.appendChild(tst);
    var q = new URLSearchParams(location.search);
    if (q.get('paid') === '1') { write([]); toast(CFG.s.paid, 6000); }
    else if (q.get('cancelled') === '1') { toast(CFG.s.cancelled); }
    render();
  });
})();
</script>`.trim();
}
