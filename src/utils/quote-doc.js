// Shared branded quote/proposal renderer — used BOTH for the hosted quote page
// (/q/:token) and as the source for the Browser-Rendering PDF. Print-clean (A4).
// Branding comes from `issuer` (customer's business for CRM quotes; Caddisfly for
// admin Leads quotes). Drafted with the local coder model, then reviewed/fixed.

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

// Fixed-label dict (en/es/pt). The issuer's own copy (intro/title/notes/terms)
// is already in their language; only these chrome labels are localized.
const QD = {
  en: { quote: 'QUOTE', no: 'No.', valid_until: 'Valid until {d}', prepared_for: 'Prepared for', th_desc: 'Description', th_qty: 'Qty', th_unit: 'Unit', th_amount: 'Amount', no_items: 'No items.', total: 'Total', download: '⬇ Download PDF', locale: 'en-US' },
  es: { quote: 'COTIZACIÓN', no: 'N.º', valid_until: 'Válida hasta {d}', prepared_for: 'Preparado para', th_desc: 'Descripción', th_qty: 'Cant.', th_unit: 'Unitario', th_amount: 'Importe', no_items: 'Sin artículos.', total: 'Total', download: '⬇ Descargar PDF', locale: 'es-ES' },
  pt: { quote: 'ORÇAMENTO', no: 'N.º', valid_until: 'Válido até {d}', prepared_for: 'Preparado para', th_desc: 'Descrição', th_qty: 'Qtd.', th_unit: 'Unitário', th_amount: 'Valor', no_items: 'Sem itens.', total: 'Total', download: '⬇ Baixar PDF', locale: 'pt-BR' },
};

function money(cents, currency, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format((cents || 0) / 100);
  } catch {
    return '$' + ((cents || 0) / 100).toFixed(2);
  }
}
const fmtDate = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : '');

/**
 * @param {{quote:object, items:object[], issuer:object, pdfUrl?:string}} p
 * issuer = { name, logo, contact:string[], accent, intro, thankYou, terms }
 * @returns {string} a complete HTML document
 */
export function renderQuoteHtml({ quote, items, issuer, pdfUrl, lang = 'en' }) {
  const T = QD[lang] || QD.en;
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(issuer.accent || '') ? issuer.accent : '#5a3da8';
  const rows = (items || []).map((it, i) => `
        <tr>
          <td class="c">${i + 1}</td>
          <td>${esc(it.description)}</td>
          <td class="c">${esc(it.qty)}</td>
          <td class="r">${money(it.unit_price_cents, quote.currency, T.locale)}</td>
          <td class="r">${money(it.qty * it.unit_price_cents, quote.currency, T.locale)}</td>
        </tr>`).join('');
  const contact = (issuer.contact || []).filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${T.quote} ${T.no} ${esc(quote.id)} — ${esc(issuer.name)}</title>
<style>
  :root { --accent: ${accent}; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2733; margin: 0; background: #f4f5f8; }
  .sheet { max-width: 720px; margin: 24px auto; background: #fff; padding: 0 0 32px; box-shadow: 0 2px 18px rgba(0,0,0,.08); border-radius: 12px; overflow: hidden; }
  .band { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; background: var(--accent); color: #fff; padding: 26px 32px; }
  .band .iss { display: flex; align-items: center; gap: 14px; }
  .band .logo { max-height: 46px; max-width: 160px; background: #fff; border-radius: 8px; padding: 4px; }
  .band h2 { margin: 0; font-size: 1.2rem; font-weight: 800; }
  .band .qmeta { text-align: right; line-height: 1.45; }
  .band .qmeta .big { font-size: 1.5rem; font-weight: 900; letter-spacing: .12em; }
  .band .qmeta small { opacity: .9; font-size: .82rem; }
  .body { padding: 26px 32px; }
  .contact { color: #4a5568; font-size: .84rem; margin: 0 0 1.4rem; }
  .for { color: #6b7280; font-size: .82rem; text-transform: uppercase; letter-spacing: .05em; margin: 0; }
  .for b { color: #1f2733; font-size: 1rem; text-transform: none; letter-spacing: 0; }
  h1.title { font-size: 1.35rem; margin: .2rem 0 1rem; color: #111827; }
  .intro { color: #4a5568; line-height: 1.6; margin: 0 0 1.4rem; }
  table { width: 100%; border-collapse: collapse; margin: .4rem 0 1.2rem; font-size: .9rem; }
  thead th { background: var(--accent); color: #fff; text-align: left; padding: 9px 12px; font-size: .76rem; text-transform: uppercase; letter-spacing: .04em; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #edf0f4; }
  td.c { text-align: center; } td.r, th.r { text-align: right; }
  tfoot td { padding: 12px; font-size: 1.05rem; font-weight: 800; color: var(--accent); border-top: 2px solid var(--accent); }
  tfoot .lbl { text-align: right; color: #1f2733; }
  .notes { background: #f8fafc; border-left: 3px solid var(--accent); padding: 12px 16px; border-radius: 6px; color: #374151; font-size: .9rem; white-space: pre-wrap; margin: 1.2rem 0; }
  .thanks { background: color-mix(in srgb, var(--accent) 8%, #fff); border: 1px solid color-mix(in srgb, var(--accent) 25%, #fff); border-radius: 10px; padding: 16px 18px; color: #374151; line-height: 1.55; margin: 1.4rem 0 0; }
  .terms { color: #8a94a6; font-size: .76rem; line-height: 1.5; margin-top: 1.6rem; border-top: 1px solid #edf0f4; padding-top: 1rem; white-space: pre-wrap; }
  .dl { position: fixed; right: 22px; bottom: 22px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 700; font-size: .9rem; padding: .7rem 1.1rem; border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,.2); }
  @media print {
    body { background: #fff; }
    .sheet { box-shadow: none; margin: 0; max-width: none; border-radius: 0; }
    .no-print { display: none !important; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="band">
      <div class="iss">
        ${issuer.logo ? `<img class="logo" src="${esc(issuer.logo)}" alt="">` : ''}
        <h2>${esc(issuer.name)}</h2>
      </div>
      <div class="qmeta">
        <div class="big">${T.quote}</div>
        <small>${T.no} ${esc(quote.id)}<br>${fmtDate(quote.created_at)}${quote.valid_until ? `<br>${T.valid_until.replace('{d}', fmtDate(quote.valid_until))}` : ''}</small>
      </div>
    </div>
    <div class="body">
      ${contact ? `<p class="contact">${contact}</p>` : ''}
      <p class="for">${T.prepared_for}<br><b>${esc(quote.contact_email)}</b></p>
      ${quote.title ? `<h1 class="title">${esc(quote.title)}</h1>` : ''}
      ${issuer.intro ? `<p class="intro">${esc(issuer.intro)}</p>` : ''}
      <table>
        <thead><tr><th>#</th><th>${T.th_desc}</th><th class="c">${T.th_qty}</th><th class="r">${T.th_unit}</th><th class="r">${T.th_amount}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" class="c">${T.no_items}</td></tr>`}</tbody>
        <tfoot><tr><td class="lbl" colspan="4">${T.total}</td><td class="r">${money(quote.total_cents, quote.currency, T.locale)}</td></tr></tfoot>
      </table>
      ${quote.notes ? `<div class="notes">${esc(quote.notes)}</div>` : ''}
      ${issuer.thankYou ? `<div class="thanks">${esc(issuer.thankYou)}</div>` : ''}
      ${issuer.terms ? `<div class="terms">${esc(issuer.terms)}</div>` : ''}
    </div>
  </div>
  ${pdfUrl ? `<a class="dl no-print" href="${esc(pdfUrl)}">${T.download}</a>` : ''}
</body>
</html>`;
}
