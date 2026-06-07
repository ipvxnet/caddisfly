#!/usr/bin/env node
// Namecheap fixed-IP relay for Caddisfly.
//
// WHY: the Namecheap API allowlists caller IPs, and Cloudflare Workers have no
// stable egress IP. This tiny forwarder runs on a static-IP box; the worker
// POSTs the API params here with a shared secret, and the relay forwards them
// to api.namecheap.com from its allowlisted IP. It holds NO Namecheap
// credentials — those stay in worker secrets and travel inside the params.
//
// Run:  RELAY_SECRET=<long-random> PORT=8088 node server.js
// (see README.md for the systemd unit + Caddy/nginx TLS front)

const http = require('http');
const { URLSearchParams } = require('url');

const SECRET = process.env.RELAY_SECRET || '';
const PORT = parseInt(process.env.PORT || '8088', 10);
// Default to production; the worker can override per-request for sandbox.
const ALLOWED_HOSTS = new Set(['api.namecheap.com', 'api.sandbox.namecheap.com']);

if (!SECRET || SECRET.length < 24) {
  console.error('Set RELAY_SECRET to a long random string (24+ chars).');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const deny = (code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain' }); res.end(msg); };

  if (req.method !== 'POST' || req.url !== '/nc') return deny(404, 'not found');
  if (req.headers['x-relay-secret'] !== SECRET) return deny(403, 'forbidden');

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 64 * 1024) req.destroy(); });
  req.on('end', async () => {
    try {
      const params = new URLSearchParams(body);
      const host = params.get('__host') || 'api.namecheap.com';
      params.delete('__host');
      if (!ALLOWED_HOSTS.has(host)) return deny(400, 'bad host');

      const upstream = await fetch(`https://${host}/xml.response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(25000),
      });
      const xml = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'text/xml; charset=utf-8' });
      res.end(xml);
    } catch (e) {
      console.error(new Date().toISOString(), 'relay error:', e.message);
      deny(502, 'upstream error');
    }
  });
});

server.listen(PORT, () => console.log(`nc-relay listening on :${PORT}`));
