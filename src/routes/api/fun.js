// GET /api/fun/joke
// Returns a short, clean joke (Workers AI, with a canned fallback). Used by the
// "building your site" page to rotate jokes while the customer waits.

import { aiJoke } from '../../utils/jokes.js';

export async function handleJoke(ctx) {
  const joke = await aiJoke(ctx.env);
  return new Response(JSON.stringify({ joke }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
