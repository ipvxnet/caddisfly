// Short, clean jokes to keep customers entertained while their site builds.
// Workers AI generates fresh ones on demand; the canned list is the instant
// supply (rendered with the page immediately) and the fallback when AI is
// unavailable or slow.

const FALLBACK = {
  en: [
    "Why did the web developer leave the restaurant? Because of the table layout.",
    "I told my website a joke about HTTP — it took a while to respond.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "There are 10 kinds of people: those who understand binary and those who don't.",
    "A SQL query walks into a bar, sees two tables, and asks: 'Mind if I join you?'",
    "Why don't websites ever get cold? They have plenty of cookies.",
    "My small business is so cutting-edge, even our 404 page is a destination.",
    "Why did the CSS file break up with the HTML? It said there was no class.",
  ],
  es: [
    "¿Por qué el programador prefiere el modo oscuro? Porque la luz atrae a los bugs.",
    "Le conté un chiste sobre HTTP a mi web… tardó un rato en responder.",
    "Hay 10 tipos de personas: las que entienden binario y las que no.",
    "¿Por qué las webs nunca tienen frío? Porque están llenas de cookies.",
    "Mi negocio es tan moderno que hasta nuestra página 404 es un destino.",
    "Una consulta SQL entra a un bar, ve dos tablas y pregunta: '¿Puedo unirme?'",
    "¿Por qué rompió el CSS con el HTML? Dijo que no tenía clase.",
    "Cambié mi contraseña a 'incorrecta' para que el ordenador me la recuerde.",
  ],
  pt: [
    "Por que o programador prefere o modo escuro? Porque a luz atrai os bugs.",
    "Contei uma piada de HTTP pro meu site… ele demorou pra responder.",
    "Existem 10 tipos de pessoas: as que entendem binário e as que não.",
    "Por que os sites nunca sentem frio? Porque estão cheios de cookies.",
    "Meu negócio é tão moderno que até a nossa página 404 é um destino.",
    "Uma consulta SQL entra num bar, vê duas tabelas e pergunta: 'Posso me juntar?'",
    "Por que o CSS terminou com o HTML? Disse que ele não tinha classe.",
    "Mudei minha senha para 'incorreta' pro computador me lembrar dela.",
  ],
};

/** Instant, deterministic-ish pick (no AI call), in the viewer's language. */
export function cannedJoke(seed = 0, lang = 'en') {
  const list = FALLBACK[lang] || FALLBACK.en;
  return list[Math.abs(Math.floor(seed)) % list.length];
}

const AI_LANG = { en: 'English', es: 'Spanish', pt: 'Portuguese' };

/** Ask Workers AI for a fresh one-liner (in `lang`); falls back to a canned joke. */
export async function aiJoke(env, lang = 'en') {
  try {
    if (!env || !env.AI) return cannedJoke(Date.now(), lang);
    const language = AI_LANG[lang] || 'English';
    const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content:
            `You are a friendly comedian. Reply with exactly ONE short, clean, family-friendly one-liner joke (max 200 characters) written in ${language}. No preamble, no quotation marks, no emoji, no explanation — just the joke.`,
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
    return text && text.length > 6 ? text.slice(0, 220) : cannedJoke(Date.now(), lang);
  } catch {
    return cannedJoke(Date.now(), lang);
  }
}
