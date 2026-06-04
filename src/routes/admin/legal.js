// SaaS admin legal-page editor (/admin/legal). Gated by [authMiddleware,
// adminMiddleware]. Lets an allowlisted admin edit the Terms and Privacy bodies
// (stored in legal_documents, rendered on the public /terms + /privacy pages)
// so counsel changes ship without a code deploy. Live preview + reset-to-default.

import { htmlResponse, redirect } from '../../utils/response.js';
import { baseCss } from '../../components/brand.js';
import { LEGAL_CSS, LEGAL_META, effectiveDoc } from '../public/legal-content.js';
import { upsertLegalDoc, deleteLegalDoc } from '../../db/legal.js';

const SLUGS = ['terms', 'privacy'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(ts) {
  if (!ts) return '';
  try { return new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch { return ''; }
}
async function formData(request) {
  try { return Object.fromEntries((await request.formData()).entries()); } catch { return {}; }
}

/** GET /admin/legal[?doc=terms|privacy] */
export async function handleAdminLegal(ctx) {
  const { env, query } = ctx;
  const slug = SLUGS.includes(query && query.doc) ? query.doc : 'terms';
  const meta = LEGAL_META[slug];
  const doc = await effectiveDoc(env.DB, slug);

  const notice = (query && query.saved)
    ? `<div class="note ok">Saved. The live <a href="${meta.nav}" target="_blank">${meta.label}</a> page now shows your changes.</div>`
    : (query && query.reset)
    ? `<div class="note ok">Reverted to the built-in default.</div>`
    : (query && query.err === 'empty')
    ? `<div class="note err">Nothing saved — the body was empty.</div>`
    : '';

  const tabs = SLUGS
    .map((s) => `<a class="tab ${s === slug ? 'active' : ''}" href="/admin/legal?doc=${s}">${LEGAL_META[s].label}</a>`)
    .join('');

  const status = doc.custom
    ? `<span class="badge warn">Custom</span> last edited ${esc(fmt(doc.updatedAt))}${doc.updatedBy ? ' by ' + esc(doc.updatedBy) : ''}`
    : `<span class="badge">Built-in default</span> — not yet customized`;

  // CSS used in the live preview iframe (same look as the public page).
  const previewCss = baseCss() + '\n' + LEGAL_CSS;

  const inner = `
    <div class="thead">
      <h2>Legal pages</h2>
      <a class="back" href="/admin">← Dashboard</a>
    </div>
    <p class="muted">Edit the Terms of Service and Privacy Policy shown on the public site. Changes save instantly — no code deploy. Edits are stored separately from the built-in template; use <strong>Revert</strong> to restore the default.</p>
    <div class="tabs">${tabs}</div>
    ${notice}

    <div class="meta-row">
      <div>${status}</div>
      <a class="view" href="${meta.nav}" target="_blank">View live ${meta.label} ↗</a>
    </div>

    <div class="grid">
      <form method="POST" action="/api/admin/legal/${slug}" class="editor">
        <label for="body">Body (HTML)</label>
        <textarea id="body" name="body" spellcheck="false">${esc(doc.body)}</textarea>
        <div class="actions">
          <button type="submit" class="primary">Save changes</button>
          <button type="submit" form="reset-form" class="ghost" onclick="return confirm('Revert ${meta.label} to the built-in default? Your custom text will be removed.')">Revert to default</button>
        </div>
        <p class="hint">Tip: this is the inner HTML of the page body. You can keep the existing headings (<code>&lt;h2 id=&quot;...&quot;&gt;</code>) so the table-of-contents links keep working. Classes available: <code>.callout</code>, <code>.danger</code>, and tables. Counsel placeholders to resolve are marked with <em>[brackets]</em> (e.g. governing jurisdiction / arbitration in Terms §16).</p>
      </form>
      <form id="reset-form" method="POST" action="/api/admin/legal/${slug}" hidden>
        <input type="hidden" name="action" value="reset">
      </form>

      <div class="preview">
        <div class="preview-head">Live preview</div>
        <iframe id="preview" title="preview"></iframe>
      </div>
    </div>

    <script>
      var PREVIEW_CSS = ${JSON.stringify(previewCss)};
      var ta = document.getElementById('body');
      var frame = document.getElementById('preview');
      function render() {
        frame.srcdoc = '<style>' + PREVIEW_CSS + '</style><main><div class="legal">' + ta.value + '</div></main>';
      }
      ta.addEventListener('input', render);
      render();
    </script>`;

  return htmlResponse(page(inner, meta.label));
}

/** POST /api/admin/legal/:slug  (body | action=reset) */
export async function handleAdminLegalSave(ctx) {
  const { env, request, params } = ctx;
  const slug = params.slug;
  if (!SLUGS.includes(slug)) return redirect('/admin/legal', 303);

  const form = await formData(request);
  if (form.action === 'reset') {
    await deleteLegalDoc(env.DB, slug);
    return redirect(`/admin/legal?doc=${slug}&reset=1`, 303);
  }

  const body = String(form.body || '').trim();
  if (!body) return redirect(`/admin/legal?doc=${slug}&err=empty`, 303);

  await upsertLegalDoc(env.DB, slug, { body, updatedBy: ctx.user && ctx.user.email });
  return redirect(`/admin/legal?doc=${slug}&saved=1`, 303);
}

function page(inner, label) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex"><title>${esc(label)} · Caddisfly Admin</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a202c}
  .wrap{max-width:1200px;margin:0 auto;padding:2rem 1.5rem}
  .thead{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap}
  h2{font-size:1.3rem}
  a{color:#5a3da8;text-decoration:none}
  .muted{color:#718096;font-size:.9rem;margin-bottom:1rem;max-width:760px;line-height:1.5}
  .tabs{display:flex;gap:.4rem;margin-bottom:1rem;flex-wrap:wrap}
  .tab{font-size:.85rem;font-weight:700;padding:.35rem .9rem;border:1px solid #e2e8f0;border-radius:999px;background:#fff}
  .tab.active{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
  .note{border-radius:10px;padding:.7rem 1rem;margin-bottom:1rem;font-size:.9rem}
  .note.ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
  .note.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
  .meta-row{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem;font-size:.85rem;color:#4a5568}
  .badge{display:inline-block;border-radius:999px;padding:.1rem .55rem;font-size:.72rem;font-weight:700;background:#edf2f7;color:#4a5568}
  .badge.warn{background:#fffbeb;color:#92400e}
  .view{font-weight:700}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;align-items:start}
  @media(max-width:900px){.grid{grid-template-columns:1fr}}
  .editor label{display:block;font-weight:700;margin-bottom:.5rem;font-size:.9rem}
  textarea{width:100%;height:560px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;line-height:1.5;padding:.8rem;border:1px solid #cbd5e0;border-radius:10px;background:#fff;resize:vertical}
  .actions{display:flex;gap:.6rem;margin-top:.8rem;flex-wrap:wrap}
  button{font:inherit;font-weight:700;padding:.55rem 1rem;border-radius:9px;cursor:pointer;border:1px solid #cbd5e0;background:#fff}
  button.primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none}
  button.ghost{color:#b91c1c;border-color:#fecaca;background:#fff}
  .hint{font-size:.8rem;color:#718096;margin-top:.8rem;line-height:1.6}
  .hint code{background:#edf2f7;padding:.05rem .3rem;border-radius:4px;font-size:.92em}
  .preview{border:1px solid #e2e8f0;border-radius:10px;background:#fff;overflow:hidden}
  .preview-head{font-size:.78rem;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:.04em;padding:.5rem .8rem;border-bottom:1px solid #edf2f7;background:#fafbfc}
  iframe{width:100%;height:560px;border:0;display:block;background:#fff}
</style></head>
<body><div class="wrap">${inner}</div></body></html>`;
}
