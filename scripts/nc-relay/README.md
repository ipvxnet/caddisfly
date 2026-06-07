# Namecheap fixed-IP relay

The Namecheap API only accepts calls from allowlisted IPs; Cloudflare Workers
have no stable egress IP. This tiny forwarder runs on any static-IP box (your
VPS) and forwards API calls from the worker. It holds **no Namecheap
credentials** — those live in worker secrets and travel inside each request;
the relay just provides the allowlisted IP. Requires Node 18+ (built-in fetch).

## Setup (once, ~5 minutes)

1. Copy `server.js` to the VPS, e.g. `/opt/nc-relay/server.js`.

2. Generate a long secret and create the systemd unit:

```bash
openssl rand -hex 32   # → this is RELAY_SECRET (also goes in worker secrets)

sudo tee /etc/systemd/system/nc-relay.service > /dev/null <<'EOF'
[Unit]
Description=Namecheap fixed-IP relay (Caddisfly)
After=network.target

[Service]
Environment=RELAY_SECRET=PASTE_SECRET_HERE
Environment=PORT=8088
ExecStart=/usr/bin/node /opt/nc-relay/server.js
Restart=always
RestartSec=3
User=nobody
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload && sudo systemctl enable --now nc-relay
```

3. **TLS**: put your existing Caddy/nginx in front (the secret must not travel
   over plain HTTP). Caddy example:

```
nc-relay.yourdomain.com {
    reverse_proxy 127.0.0.1:8088
}
```

   (nginx: a `location /nc` → `proxy_pass http://127.0.0.1:8088;` block in an
   existing TLS server works too. If the VPS has no domain, a self-signed cert
   won't work with Workers fetch — give it any subdomain you control.)

4. **Allowlist the VPS IP at Namecheap**: Profile → Tools → API Access →
   Whitelisted IPs → add the VPS public IP (`curl -4 ifconfig.me` on the box).

5. Smoke test from anywhere (expect Namecheap XML, an auth error is fine —
   it proves the path works):

```bash
curl -s -X POST https://nc-relay.yourdomain.com/nc \
  -H "X-Relay-Secret: <RELAY_SECRET>" \
  -d "ApiUser=x&ApiKey=x&UserName=x&ClientIp=1.2.3.4&Command=namecheap.domains.check&DomainList=example.com"
```

6. Worker secrets (both envs):

```bash
npx wrangler secret put NC_RELAY_URL --env production      # https://nc-relay.yourdomain.com/nc
npx wrangler secret put NC_RELAY_SECRET --env production   # the openssl value
npx wrangler secret put NAMECHEAP_API_USER --env production
npx wrangler secret put NAMECHEAP_API_KEY --env production
npx wrangler secret put NAMECHEAP_CLIENT_IP --env production  # the VPS IP (Namecheap wants it in each call)
# repeat with --env preview
```

## Security notes

- The relay only answers `POST /nc` with the exact `X-Relay-Secret` header and
  only forwards to `api.namecheap.com` / `api.sandbox.namecheap.com` — it can't
  be used as an open proxy.
- Rotate `RELAY_SECRET` any time: update the unit file + the two worker secrets.
- Logs: `journalctl -u nc-relay -f` (errors only; no request bodies are logged).
