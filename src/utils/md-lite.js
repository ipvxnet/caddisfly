// Markdown-lite → safe HTML for blog posts. Deliberately tiny: escape
// EVERYTHING first, then allow a small whitelist of constructs. No raw HTML
// passthrough — post content is customer/AI text, never trusted markup.
//
// Supported: ## / ### headings, - bullet lists, > quotes, **bold**, *italic*,
// [text](https://url), ![alt](https://image-url), blank-line paragraphs.

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u) {
  const url = String(u || '').trim();
  return /^(https?:\/\/|\/)/i.test(url) && !/["'<>]/.test(url) ? url : '';
}

// Inline marks on an ALREADY-ESCAPED line.
function inline(escaped) {
  return escaped
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      const u = safeUrl(url);
      return u ? `<img src="${u}" alt="${alt}" loading="lazy">` : '';
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      const u = safeUrl(url);
      return u ? `<a href="${u}" target="_blank" rel="noopener">${text}</a>` : text;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** Render markdown-lite source to safe HTML. */
export function mdLiteToHtml(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null; // open <ul> items
  let para = [];   // open paragraph lines

  const flushPara = () => {
    if (para.length) { out.push(`<p>${para.map((l) => inline(escapeHtml(l))).join('<br>')}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) { out.push(`<ul>${list.map((i) => `<li>${inline(escapeHtml(i))}</li>`).join('')}</ul>`); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) { flushPara(); flushList(); continue; }
    if (t.startsWith('### ')) { flushPara(); flushList(); out.push(`<h3>${inline(escapeHtml(t.slice(4)))}</h3>`); continue; }
    if (t.startsWith('## ')) { flushPara(); flushList(); out.push(`<h2>${inline(escapeHtml(t.slice(3)))}</h2>`); continue; }
    if (t.startsWith('> ')) { flushPara(); flushList(); out.push(`<blockquote>${inline(escapeHtml(t.slice(2)))}</blockquote>`); continue; }
    if (t.startsWith('- ') || t.startsWith('* ')) { flushPara(); (list = list || []).push(t.slice(2)); continue; }
    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  return out.join('\n');
}

/** Plain-text excerpt from markdown-lite source (for cards/meta). */
export function mdLiteExcerpt(src, maxLen = 160) {
  const text = String(src || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{2,3}\s+/gm, '')
    .replace(/[*>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text;
}
