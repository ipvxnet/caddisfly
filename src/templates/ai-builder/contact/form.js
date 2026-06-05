// Contact Section with Form

import { t } from '../../../i18n/index.js';

/**
 * Generates a contact section with form
 * @param {object} data - Content data
 * @param {object} config - Website configuration
 * @returns {string} HTML template
 */
export function contactFormTemplate(data, config) {
  const {
    heading = 'Get In Touch',
    subheading = "We'd love to hear from you",
    button_text = 'Send Message',
    phone = '',
    address = '',
    email = '',
  } = data;
  const { primary_color = '#667eea', font_heading = 'Inter' } = config;

  // Real submissions (published pages only): the assembler threads trackId +
  // appOrigin + lang through renderConfig, so the form bakes its endpoint and
  // localized status messages at render time. Previews (no trackId) show a
  // "form activates on publish" note instead of posting.
  const lang = config.lang || 'en';
  const siteId = config.trackId || '';
  const endpoint = `${config.appOrigin || ''}/api/forms/submit`;
  const attr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // Real business contact details (e.g. from Google Places) shown only when present.
  const infoItems = [
    phone && `<a class="contact-info-item" href="tel:${phone.replace(/[^+\d]/g, '')}"><span>📞</span>${phone}</a>`,
    email && `<a class="contact-info-item" href="mailto:${email}"><span>✉️</span>${email}</a>`,
    address && `<span class="contact-info-item"><span>📍</span>${address}</span>`,
  ].filter(Boolean);
  const contactInfo = infoItems.length
    ? `<div class="contact-info">${infoItems.join('')}</div>`
    : '';

  return `
<section id="contact" class="contact-section">
  <div class="contact-container">
    <div class="contact-header">
      <h2 class="contact-heading">${heading}</h2>
      <p class="contact-subheading">${subheading}</p>
    </div>
    ${contactInfo}
    <form class="contact-form" data-cf-site="${attr(siteId)}" data-cf-endpoint="${attr(endpoint)}"
      data-msg-sending="${attr(t(lang, 'formw.sending'))}" data-msg-success="${attr(t(lang, 'formw.success'))}"
      data-msg-error="${attr(t(lang, 'formw.error'))}" data-msg-preview="${attr(t(lang, 'formw.preview'))}">
      <div class="form-row">
        <div class="form-group">
          <label for="name">Your Name</label>
          <input type="text" id="name" name="name" required />
        </div>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" required />
        </div>
      </div>
      <div class="form-group">
        <label for="message">Message</label>
        <textarea id="message" name="message" rows="5" required></textarea>
      </div>
      <!-- Honeypot: humans never see it; bots that fill it are silently dropped -->
      <input class="cf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button type="submit" class="contact-submit">${button_text}</button>
      <p class="contact-form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>

<script>
(function () {
  if (window.__cfFormInit) return; window.__cfFormInit = 1;
  // Delegated so multiple contact sections share one handler and the script
  // stays idempotent across re-injected previews.
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
    if (btn) btn.disabled = true;
    show(form.dataset.msgSending, true);
    fetch(form.dataset.cfEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s: form.dataset.cfSite, p: location.pathname, name: val('name'), email: val('email'), message: val('message'), hp: hp ? hp.value : '' })
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
</script>

<style>
.contact-section {
  padding: 5rem 2rem;
  background: #f7fafc;
}

.contact-container {
  max-width: 800px;
  margin: 0 auto;
}

.contact-header {
  text-align: center;
  margin-bottom: 3rem;
}

.contact-heading {
  font-family: ${font_heading}, sans-serif;
  font-size: clamp(2rem, 3vw, 2.5rem);
  font-weight: 700;
  color: #1a202c;
  margin-bottom: 1rem;
}

.contact-subheading {
  font-size: 1.25rem;
  color: #4a5568;
}

.contact-info {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem 2rem;
  margin-bottom: 2.5rem;
}

.contact-info-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #2d3748;
  font-size: 1.0625rem;
  text-decoration: none;
}

.contact-info-item span {
  font-size: 1.25rem;
}

a.contact-info-item:hover {
  color: ${primary_color};
}

.contact-form {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.875rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: ${primary_color};
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.contact-submit {
  width: 100%;
  padding: 1rem 2rem;
  background: ${primary_color};
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.contact-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.contact-submit:disabled {
  opacity: 0.6;
  cursor: default;
  transform: none;
}

.contact-form-status {
  margin-top: 1rem;
  font-weight: 600;
  text-align: center;
}

.contact-form-status:empty {
  display: none;
}

.contact-form-status.ok {
  color: #2f855a;
}

.contact-form-status.err {
  color: #c53030;
}

/* Honeypot — moved off-screen, not display:none (some bots skip hidden fields) */
.cf-hp {
  position: absolute !important;
  left: -9999px !important;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 768px) {
  .contact-section {
    padding: 3rem 1.5rem;
  }

  .contact-form {
    padding: 2rem;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
  `.trim();
}
