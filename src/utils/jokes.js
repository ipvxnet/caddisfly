// Short, clean jokes to keep customers entertained while their site builds.
// Workers AI generates fresh ones on demand; the canned list is the instant
// supply (rendered with the page immediately) and the fallback when AI is
// unavailable or slow.

const FALLBACK = [
  "Why did the web developer leave the restaurant? Because of the table layout.",
  "I told my website a joke about HTTP — it took a while to respond.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I'd tell you a UDP joke, but you might not get it.",
  "Why was the JavaScript developer sad? Because they didn't Node how to Express themselves.",
  "There are 10 kinds of people: those who understand binary and those who don't.",
  "Why did the database administrator leave their spouse? They wanted separate tables.",
  "A SQL query walks into a bar, sees two tables, and asks: 'Mind if I join you?'",
  "Why don't websites ever get cold? They have plenty of cookies.",
  "My small business is so cutting-edge, even our 404 page is a destination.",
  "Why did the CSS file break up with the HTML? It said there was no class.",
  "I changed my password to 'incorrect' so my computer reminds me when I forget.",
];

/** Instant, deterministic-ish pick (no AI call). */
export function cannedJoke(seed = 0) {
  return FALLBACK[Math.abs(Math.floor(seed)) % FALLBACK.length];
}

/** Ask Workers AI for a fresh one-liner; falls back to a canned joke. */
export async function aiJoke(env) {
  try {
    if (!env || !env.AI) return cannedJoke(Date.now());
    const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content:
            'You are a friendly comedian. Reply with exactly ONE short, clean, family-friendly one-liner joke (max 200 characters). No preamble, no quotation marks, no emoji, no explanation — just the joke.',
        },
        {
          role: 'user',
          content: 'Tell me a quick joke about websites, computers, coffee, or running a small business.',
        },
      ],
      max_tokens: 80,
      temperature: 0.9,
    });
    const text = (r && r.response ? String(r.response) : '').trim().replace(/^["']+|["']+$/g, '').trim();
    return text && text.length > 6 ? text.slice(0, 220) : cannedJoke(Date.now());
  } catch {
    return cannedJoke(Date.now());
  }
}
