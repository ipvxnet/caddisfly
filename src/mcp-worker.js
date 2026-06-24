// caddisfly-mcp — a tiny, STANDALONE MCP (Model Context Protocol) server that
// exposes the Caddisfly inventory REST API (Phase 3) as MCP tools, so AI agents
// (Claude etc.) can read + update a store's inventory conversationally.
//
// Separate Worker (wrangler.mcp.toml) — NO DB/secrets. It only proxies tool calls
// to ${INVENTORY_API_BASE}/api/inventory/products, forwarding the caller's
// `Authorization: Bearer inv_…` token (generated in CRM → Stock → Import → API
// access). Transport: Streamable HTTP — JSON-RPC 2.0 over a single POST endpoint.

const PROTOCOL_VERSION = '2024-11-05';
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version',
};
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

const TOOLS = [
  {
    name: 'list_inventory',
    description: "List the connected store's products with prices and stock levels (including variants).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'upsert_products',
    description: 'Create or update products in bulk. Each product is matched by name — an existing product is updated (only the fields you provide), a new name is created. Stock is applied only if the store has the Advanced Store plugin. Returns counts of created/updated/skipped.',
    inputSchema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          description: 'Products to create or update.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Product name (required; also the match key).' },
              price: { type: 'number', description: 'Price in the store currency, e.g. 19.99.' },
              stock: { type: 'integer', description: 'Units in stock; omit for untracked/unlimited.' },
              category: { type: 'string', description: 'Optional catalogue grouping.' },
              type: { type: 'string', enum: ['physical', 'digital', 'service'] },
              description: { type: 'string' },
            },
            required: ['name'],
          },
        },
      },
      required: ['products'],
    },
  },
];

const toolText = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

function fmtMoney(cents, currency) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').toUpperCase() }).format((cents || 0) / 100); }
  catch { return '$' + ((cents || 0) / 100).toFixed(2); }
}

async function callInventory(env, auth, method, payload) {
  const res = await fetch(`${env.INVENTORY_API_BASE}/api/inventory/products`, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function runTool(name, args, env, auth) {
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return toolText('Missing inventory token. Configure your MCP client with header "Authorization: Bearer inv_…" — generate it in Caddisfly → CRM → Stock → Import → API access.', true);
  }
  if (name === 'list_inventory') {
    const { ok, status, data } = await callInventory(env, auth, 'GET');
    if (!ok) return toolText(`Inventory API error (${status}): ${data.error || 'request failed'}`, true);
    const lines = (data.products || []).map((p) => {
      let s = `• ${p.name} — ${fmtMoney(p.price_cents, data.currency)} — stock: ${p.stock == null ? '∞' : p.stock}${p.category ? ` [${p.category}]` : ''}`;
      for (const v of p.variants || []) s += `\n    ↳ ${v.label}${v.sku ? ` (${v.sku})` : ''} — stock: ${v.stock == null ? '∞' : v.stock}`;
      return s;
    });
    const header = `${data.count || 0} product(s), currency ${data.currency || 'USD'}:`;
    return toolText(lines.length ? `${header}\n${lines.join('\n')}` : 'No products yet.');
  }
  if (name === 'upsert_products') {
    const products = args && Array.isArray(args.products) ? args.products : null;
    if (!products || !products.length) return toolText('Provide a non-empty "products" array.', true);
    const { ok, status, data } = await callInventory(env, auth, 'POST', { products });
    if (!ok) return toolText(`Inventory API error (${status}): ${data.error || 'request failed'}`, true);
    let txt = `Done. Created ${data.created}, updated ${data.updated}, skipped ${data.skipped}, errors ${data.errors}.`;
    if (!data.stock_applied) txt += '\nNote: stock was not applied — the store needs the Advanced Store plugin.';
    const probs = (data.rows || []).filter((r) => r.action === 'error' || r.action === 'skipped');
    if (probs.length) txt += '\n' + probs.map((r) => `  row ${r.rowNum} (${r.name || '—'}): ${r.action}${r.error ? ' — ' + r.error : ''}`).join('\n');
    return toolText(txt);
  }
  return toolText(`Unknown tool: ${name}`, true);
}

async function handleRpc(msg, env, auth) {
  const { id, method, params } = msg || {};
  if (method && method.startsWith('notifications/')) return null; // notification → no response
  switch (method) {
    case 'initialize': {
      const reqVer = params && params.protocolVersion;
      return rpcResult(id, {
        protocolVersion: SUPPORTED.includes(reqVer) ? reqVer : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: env.MCP_SERVER_NAME || 'caddisfly-inventory', version: '1.0.0' },
        instructions: 'Inventory tools for a Caddisfly store. Authenticate with a Bearer inventory token.',
      });
    }
    case 'ping': return rpcResult(id, {});
    case 'tools/list': return rpcResult(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      try { return rpcResult(id, await runTool(name, args, env, auth)); }
      catch (e) { return rpcResult(id, toolText(`Tool error: ${e.message}`, true)); }
    }
    default:
      return rpcError(id == null ? null : id, -32601, `Method not found: ${method}`);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method === 'GET') {
      return json({ name: env.MCP_SERVER_NAME || 'caddisfly-inventory', transport: 'streamable-http', endpoint: '/mcp', tools: TOOLS.map((t) => t.name) });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const auth = request.headers.get('Authorization') || '';
    let body;
    try { body = await request.json(); } catch { return json(rpcError(null, -32700, 'Parse error')); }
    if (Array.isArray(body)) {
      const results = (await Promise.all(body.map((m) => handleRpc(m, env, auth)))).filter((r) => r !== null);
      return results.length ? json(results) : new Response(null, { status: 202, headers: CORS });
    }
    const result = await handleRpc(body, env, auth);
    return result === null ? new Response(null, { status: 202, headers: CORS }) : json(result);
  },
};
