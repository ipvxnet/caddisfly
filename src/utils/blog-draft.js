// Shared blog-draft generation — the AI drafting core used by BOTH the
// interactive blog manager (POST .../blog/ai-draft) and the email-to-blog
// inbound handler. Keeping one code path means the two entry points produce
// identical posts and the prompt only lives in one place.

import { callWorkersAI } from './ai-content-generator.js';
import { screenContent, POLICY_INSTRUCTION } from './content-policy.js';
import { mdLiteExcerpt } from './md-lite.js';

const LANG_NAMES = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

/**
 * Parse a LABEL-delimited AI response into { label: text }. We deliberately do
 * NOT ask the model for JSON — multi-paragraph markdown with raw newlines is
 * invalid inside JSON string literals and small models emit exactly that.
 * Labels must be UPPERCASE and appear at line start, in order.
 */
export function parseLabeled(raw, labels) {
  const text = String(raw || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  const out = {};
  for (let i = 0; i < labels.length; i++) {
    const start = text.search(new RegExp(`^${labels[i]}:`, 'm'));
    if (start === -1) return null;
    let end = text.length;
    for (let j = i + 1; j < labels.length; j++) {
      const next = text.slice(start + labels[i].length).search(new RegExp(`^${labels[j]}:`, 'm'));
      if (next !== -1) { end = start + labels[i].length + next; break; }
    }
    out[labels[i].toLowerCase()] = text.slice(start + labels[i].length + 1, end).trim();
  }
  return out;
}

/**
 * Turn a free-text brief into a structured post draft. Returns
 * { title, excerpt, content } (clamped to DB limits) or throws an Error whose
 * `.code` is 'policy' (input/output flagged) or 'malformed' (AI gibberish), so
 * callers can map to the right HTTP status / email notice.
 *
 * Does NOT charge credits, screen affordability, or persist — the caller owns
 * the credit ledger and createPost so each entry point keeps its own gating.
 *
 * @param {object} env
 * @param {{businessName: string, industry?: string, language?: string}} site
 * @param {string} brief
 */
export async function generateBlogDraftContent(env, site, brief) {
  const businessName = site.businessName || 'My Website';
  const industry = site.industry || '';
  const langName = LANG_NAMES[site.language] || 'English';

  const prompt = `You are writing a blog post for the website of "${businessName}"${industry ? ` (${industry})` : ''}.

The owner's brief for the post:
"""
${brief}
"""

Write an engaging, SEO-friendly blog post of 400-700 words based on the brief. Write ALL text in ${langName}.
Format the post body in simple markdown: "## " for section headings, "- " for bullet list items, "**bold**" for emphasis, blank lines between paragraphs. Do NOT use any other markdown syntax. Do not invent specific facts, prices, dates or statistics the brief doesn't mention.

Respond in EXACTLY this format (plain text, no JSON, no commentary, keep the uppercase labels):
TITLE: the post title, max 70 characters
EXCERPT: a 1-2 sentence summary, max 160 characters
CONTENT:
the full post body in the markdown described above
${POLICY_INSTRUCTION}`;

  const raw = await callWorkersAI(env, prompt, {
    max_tokens: 2048,
    temperature: 0.6,
    system_message: 'You are a professional content writer for small-business websites.',
  });
  const draft = parseLabeled(raw, ['TITLE', 'EXCERPT', 'CONTENT']);
  if (!draft || !draft.title || !draft.content) {
    const e = new Error('The AI draft came back malformed — please try again.');
    e.code = 'malformed';
    throw e;
  }
  const outScreen = screenContent(`${draft.title}\n${draft.content}`);
  if (!outScreen.allowed) {
    const e = new Error(outScreen.message);
    e.code = 'policy';
    e.screen = outScreen;
    throw e;
  }
  return {
    title: String(draft.title).slice(0, 200),
    excerpt: String(draft.excerpt || mdLiteExcerpt(draft.content)).slice(0, 300),
    content: String(draft.content).slice(0, 30000),
  };
}

/**
 * Flux prompt for a post cover image. Diffusion renders text poorly, so the
 * prompt forbids any words/typography — a clean editorial photo, not a headline.
 */
export function blogCoverPrompt({ title, excerpt, industry }) {
  return (
    `Professional editorial cover photograph for a business blog article titled "${title}". ` +
    `${excerpt || ''} ` +
    `${industry ? `Industry: ${industry}. ` : ''}` +
    `Photorealistic, high quality, wide 16:9 composition, soft natural lighting, modern and clean. ` +
    `Strictly NO text, NO words, NO letters, NO typography, NO logos, NO watermarks.`
  );
}
