-- 031: persist a per-domain DNS-records cache so the DNS manager renders
-- instantly from D1, then background-syncs with the registrar (Namecheap
-- getHosts is slow/cold ~30s; we don't want to block the UI on it).
--   dns_cache       JSON array of host records last seen at the registrar
--   dns_synced_at   unix ts of that fetch (drives the "synced ✓ / stale" badge)
ALTER TABLE domain_orders ADD COLUMN dns_cache TEXT;
ALTER TABLE domain_orders ADD COLUMN dns_synced_at INTEGER;
