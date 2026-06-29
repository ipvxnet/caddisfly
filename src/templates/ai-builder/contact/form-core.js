// Shared contact-form building blocks so every contact variant reuses the SAME
// live-submission form + script (real submissions, honeypot, localized status)
// without duplicating that critical logic. The form variant and any new variants
// (split, etc.) compose these.

import { t } from '../../../i18n/index.js';
import { optionalFieldsHtml } from './form-fields.js';

export const attr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Localize heading/sub/button: known English placeholders swap to the site
// language; genuinely custom text is kept.
export function contactCopy(data, config) {
  const lang = config.lang || 'en';
  const EN_DEFAULTS = {
    heading: ['Get In Touch', 'Get in touch', 'Contact Us', 'Contact us'],
    sub: ["We'd love to hear from you", 'We would love to hear from you'],
    send: ['Send Message', 'Send message', 'Submit'],
  };
  const loc = (val, key, list) => {
    if (!val) return t(lang, `formw.${key}`);
    if (lang !== 'en' && list.includes(val)) return t(lang, `formw.${key}`);
    return val;
  };
  return {
    heading: loc(data.heading, 'heading', EN_DEFAULTS.heading),
    subheading: loc(data.subheading, 'sub', EN_DEFAULTS.sub),
    button_text: loc(data.button_text, 'send', EN_DEFAULTS.send),
  };
}

// Real business contact details (phone/email/address), shown only when present.
export function contactInfoHtml(data) {
  const { phone = '', address = '', email = '' } = data;
  const items = [
    phone && `<a class="contact-info-item" href="tel:${phone.replace(/[^+\d]/g, '')}"><span>📞</span>${phone}</a>`,
    email && `<a class="contact-info-item" href="mailto:${email}"><span>✉️</span>${email}</a>`,
    address && `<span class="contact-info-item"><span>📍</span>${address}</span>`,
  ].filter(Boolean);
  return items.length ? `<div class="contact-info">${items.join('')}</div>` : '';
}

const SOCIAL_LABELS = { facebook: 'Facebook', instagram: 'Instagram', x: 'X', twitter: 'X', youtube: 'YouTube', linkedin: 'LinkedIn', tiktok: 'TikTok' };
export function contactSocialHtml(data) {
  const links = Array.isArray(data.social_links) ? data.social_links.filter((s) => s && s.url && s.url !== '#') : [];
  if (!links.length) return '';
  return `<div class="contact-social">${links
    .map((s) => `<a class="contact-social-link" href="${attr(s.url)}" target="_blank" rel="noopener">${SOCIAL_LABELS[String(s.platform).toLowerCase()] || s.platform}</a>`)
    .join('')}</div>`;
}

// The form element + submit script (the live-submission core). Idempotent script
// (guarded) so it's safe even if more than one contact form is on the page.
export function contactFormBlock(data, config) {
  const lang = config.lang || 'en';
  const { button_text } = contactCopy(data, config);
  const siteId = config.trackId || '';
  const endpoint = `${config.appOrigin || ''}/api/forms/submit`;
  return `
    <form class="contact-form" data-cf-site="${attr(siteId)}" data-cf-endpoint="${attr(endpoint)}"
      data-msg-sending="${attr(t(lang, 'formw.sending'))}" data-msg-success="${attr(t(lang, 'formw.success'))}"
      data-msg-error="${attr(t(lang, 'formw.error'))}" data-msg-preview="${attr(t(lang, 'formw.preview'))}">
      <div class="form-row">
        <div class="form-group">
          <label for="name">${t(lang, 'formw.name')}</label>
          <input type="text" id="name" name="name" required />
        </div>
        <div class="form-group">
          <label for="email">${t(lang, 'formw.email')}</label>
          <input type="email" id="email" name="email" required />
        </div>
      </div>
      ${optionalFieldsHtml(data, lang)}
      <div class="form-group">
        <label for="message">${t(lang, 'formw.message')}</label>
        <textarea id="message" name="message" rows="5" required></textarea>
      </div>
      <input class="cf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button type="submit" class="contact-submit">${button_text}</button>
      <p class="contact-form-status" role="status" aria-live="polite"></p>
    </form>

<script>
(function () {
  if (window.__cfFormInit) return; window.__cfFormInit = 1;
  document.addEventListener('submit', function (e) {
    var form = e.target && e.target.closest ? e.target.closest('form.contact-form') : null;
    if (!form) return;
    e.preventDefault();
    var status = form.querySelector('.contact-form-status');
    var btn = form.querySelector('.contact-submit');
    var show = function (msg, ok) {
      if (status) { status.textContent = msg || ''; status.className = 'contact-form-status ' + (ok ? 'ok' : 'err'); }
    };
    if (!form.dataset.cfSite) { show(form.dataset.msgPreview, true); return; }
    var hp = form.querySelector('.cf-hp');
    var val = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value : ''; };
    var extra = {};
    var ffs = form.querySelectorAll('[data-ff]');
    for (var i = 0; i < ffs.length; i++) {
      var k = ffs[i].getAttribute('data-ff');
      if (ffs[i].value) extra[k] = ffs[i].value;
    }
    if (btn) btn.disabled = true;
    show(form.dataset.msgSending, true);
    fetch(form.dataset.cfEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s: form.dataset.cfSite, p: location.pathname, name: val('name'), email: val('email'), message: val('message'), extra: extra, hp: hp ? hp.value : '' })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok && d.success, d: d }; }); })
      .then(function (res) {
        if (res.ok) { show(form.dataset.msgSuccess, true); form.reset(); }
        else { show((res.d && res.d.error) || form.dataset.msgError, false); }
        if (btn) btn.disabled = false;
      })
      .catch(function () { show(form.dataset.msgError, false); if (btn) btn.disabled = false; });
  });
})();
</script>`;
}

// Shared form CSS (form card, rows, inputs, submit, status, honeypot). Section/
// header/info/social layout is owned by each variant.
export function contactFormStyles(config) {
  const { primary_color = '#667eea' } = config;
  return `
.contact-info { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem 2rem; margin-bottom: 2.5rem; }
.contact-info-item { display: inline-flex; align-items: center; gap: 0.5rem; color: #2d3748; font-size: 1.0625rem; text-decoration: none; }
.contact-info-item span { font-size: 1.25rem; }
a.contact-info-item:hover { color: ${primary_color}; }
.contact-social { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.5rem; }
.contact-social-link { display: inline-flex; align-items: center; padding: 0.4rem 0.9rem; border: 1px solid #cbd5e0; border-radius: 999px; color: #2d3748; font-size: 0.95rem; text-decoration: none; transition: all 0.2s ease; }
.contact-social-link:hover { border-color: ${primary_color}; color: ${primary_color}; }
.contact-form { background: white; padding: 2.5rem; border-radius: var(--cf-radius, 12px); box-shadow: var(--cf-shadow-sm, 0 4px 20px rgba(0,0,0,0.08)); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.875rem; border: 2px solid #e2e8f0; border-radius: var(--cf-radius-sm, 8px); font-size: 1rem; font-family: inherit; transition: all 0.3s ease; background: #fff; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: ${primary_color}; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
.form-group .ff-req { color: #e53e3e; }
.form-group textarea { resize: vertical; min-height: 120px; }
.contact-submit { width: 100%; padding: 1rem 2rem; background: ${primary_color}; color: var(--on-primary, #fff); border: none; border-radius: var(--cf-btn-radius, 8px); font-size: 1.125rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
.contact-submit:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5); }
.contact-submit:disabled { opacity: 0.6; cursor: default; transform: none; }
.contact-form-status { margin-top: 1rem; font-weight: 600; text-align: center; }
.contact-form-status:empty { display: none; }
.contact-form-status.ok { color: #2f855a; }
.contact-form-status.err { color: #c53030; }
.cf-hp { position: absolute !important; left: -9999px !important; width: 1px; height: 1px; opacity: 0; pointer-events: none; }`;
}
