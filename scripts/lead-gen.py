#!/usr/bin/env python3
"""
Lead-gen for Caddisfly's outbound CRM.

Finds businesses via Google Places (per vertical x area), best-effort scrapes each
site for a contact email, and POSTs them into Caddisfly's /admin/leads CRM via the
token-authorized ingest endpoint. Heavy scraping runs HERE (not in the Worker).

The best Caddisfly targets are businesses with NO website (has_site=0) — they need
one. The script flags that.

Setup (env vars):
  GOOGLE_PLACES_API_KEY   your Places API key (billed per call — see caps below)
  LEADS_INGEST_TOKEN      the bearer token set on the Worker (LEADS_INGEST_TOKEN)
  CADDISFLY_BASE          target origin (default: the preview worker URL)

Usage:
  python3 scripts/lead-gen.py                      # defaults: Orlando+Melbourne FL, target verticals
  python3 scripts/lead-gen.py --max-leads 150 --dry-run
  python3 scripts/lead-gen.py --verticals "restaurant,dentist" --areas "Orlando, FL"
  python3 scripts/lead-gen.py --no-email           # skip the per-site email scrape (faster/cheaper)

Cost: each Places text-search page ~= 1 call; each Place Details ~= 1 call. The
--max-leads cap bounds how many Details calls (the priced part) you make.
"""
import argparse, os, re, sys, time, json, urllib.parse, urllib.request

PLACES_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
INGEST_TOKEN = os.environ.get("LEADS_INGEST_TOKEN", "")
BASE = os.environ.get("CADDISFLY_BASE", "https://caddisfly-preview.fabianodevtools.workers.dev").rstrip("/")

DEFAULT_AREAS = ["Orlando, FL", "Melbourne, FL"]
# Caddisfly's template verticals — the businesses our designs serve best.
DEFAULT_VERTICALS = [
    "restaurant", "cafe", "hair salon", "barbershop", "dentist", "law firm",
    "contractor", "auto repair", "gym", "real estate agency", "photographer",
    "pet grooming", "landscaping",
]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Junk emails / providers we never want as a "contact".
EMAIL_JUNK = re.compile(r"(example\.|sentry|wixpress|\.png|\.jpg|@sentry|godaddy|@2x|no-?reply|@.*\.wix)", re.I)


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def places_text_search(query, max_pages=2):
    """Legacy Places Text Search. Returns up to ~20*max_pages results (name, place_id, address, rating)."""
    out, token = [], None
    for _ in range(max_pages):
        params = {"query": query, "key": PLACES_KEY}
        if token:
            params["pagetoken"] = token
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" + urllib.parse.urlencode(params)
        # A fresh next_page_token isn't valid immediately — Google returns
        # INVALID_REQUEST until it ripens. Wait + retry a few times before giving up.
        d = {}
        for attempt in range(4):
            if token:
                time.sleep(2.5)
            d = http_json(url)
            if d.get("status") == "INVALID_REQUEST" and token:
                continue
            break
        if d.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"  ! Places error: {d.get('status')} {d.get('error_message','')}", file=sys.stderr)
            break
        out.extend(d.get("results", []))
        token = d.get("next_page_token")
        if not token:
            break
    return out


def place_details(place_id):
    """Phone + website + address for one place (the priced call)."""
    params = {"place_id": place_id, "fields": "name,formatted_phone_number,website,formatted_address,rating", "key": PLACES_KEY}
    url = "https://maps.googleapis.com/maps/api/place/details/json?" + urllib.parse.urlencode(params)
    try:
        return http_json(url).get("result", {})
    except Exception as e:
        print(f"  ! details failed: {e}", file=sys.stderr)
        return {}


def scrape_email(website):
    """Best-effort: fetch homepage + /contact, return the first non-junk email."""
    if not website:
        return ""
    for path in ("", "/contact", "/contact-us", "/contacto"):
        try:
            req = urllib.request.Request(website.rstrip("/") + path, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=12) as r:
                html = r.read(600000).decode("utf-8", "ignore")
            for m in EMAIL_RE.findall(html):
                if not EMAIL_JUNK.search(m) and len(m) < 80:
                    return m.lower()
        except Exception:
            continue
    return ""


def caddisfly_get(path):
    req = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + INGEST_TOKEN, "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def caddisfly_post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + INGEST_TOKEN, "User-Agent": UA,
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def enrich_emails(limit):
    """2nd pass: read existing leads that have a site but no email, scrape, update.
    Makes NO Google Places calls (free) — only fetches each business's own site."""
    pending = caddisfly_get(f"/api/admin/leads/need-email?limit={limit}").get("leads", [])
    print(f"{len(pending)} leads with a site but no email — scraping…")
    updates = []
    for l in pending:
        em = scrape_email(l.get("website", ""))
        if em:
            updates.append({"id": l["id"], "email": em})
            print(f"    ✓ {em}", flush=True)
    if not updates:
        print("No new emails found.")
        return
    r = caddisfly_post("/api/admin/leads/enrich", {"updates": updates})
    print(f"Updated {r.get('updated')} of {len(updates)} found.")


def post_leads(leads):
    body = json.dumps({"leads": leads}).encode()
    # A real User-Agent is required — Cloudflare's bot protection 403s the default
    # "Python-urllib/x.y" UA before the request reaches the Worker.
    req = urllib.request.Request(BASE + "/api/admin/leads/ingest", data=body, headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + INGEST_TOKEN, "User-Agent": UA,
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--areas", default=",".join(DEFAULT_AREAS))
    ap.add_argument("--verticals", default=",".join(DEFAULT_VERTICALS))
    ap.add_argument("--max-leads", type=int, default=300, help="hard cap on Place Details calls / leads collected")
    ap.add_argument("--pages", type=int, default=2, help="Places search pages per query (20 results each)")
    ap.add_argument("--no-email", action="store_true", help="skip the per-site email scrape (collect leads only)")
    ap.add_argument("--enrich-emails", action="store_true", help="2nd pass: scrape emails for EXISTING leads missing one (no Places calls)")
    ap.add_argument("--no-skip", action="store_true", help="don't skip businesses already in the CRM (default: skip them)")
    ap.add_argument("--dry-run", action="store_true", help="collect + print, do NOT post to Caddisfly")
    args = ap.parse_args()

    # Enrich pass needs only the ingest token (no Places billing).
    if args.enrich_emails:
        if not INGEST_TOKEN:
            sys.exit("Set LEADS_INGEST_TOKEN")
        enrich_emails(args.max_leads)
        return

    if not PLACES_KEY:
        sys.exit("Set GOOGLE_PLACES_API_KEY")
    if not args.dry_run and not INGEST_TOKEN:
        sys.exit("Set LEADS_INGEST_TOKEN (or use --dry-run)")

    areas = [a.strip() for a in args.areas.split(",") if a.strip()]
    verticals = [v.strip() for v in args.verticals.split(",") if v.strip()]
    seen, leads = set(), []

    # Skip businesses already in the CRM — BEFORE the priced Place Details call and
    # before they count toward --max-leads — so each run surfaces only NEW leads.
    known = set()
    if INGEST_TOKEN and not args.no_skip:
        try:
            known = set(caddisfly_get("/api/admin/leads/place-ids").get("place_ids", []))
            print(f"Already in CRM: {len(known)} businesses — will skip those.")
        except Exception as e:
            print(f"  ! couldn't fetch existing place_ids ({e}) — proceeding without skip", file=sys.stderr)

    print(f"Target: {len(verticals)} verticals x {len(areas)} areas → cap {args.max_leads} NEW leads. base={BASE}")
    for area in areas:
        for vert in verticals:
            if len(leads) >= args.max_leads:
                break
            print(f"· {vert} in {area} …", flush=True)
            for res in places_text_search(f"{vert} in {area}", args.pages):
                pid = res.get("place_id")
                if not pid or pid in seen or pid in known:
                    continue
                seen.add(pid)
                if len(leads) >= args.max_leads:
                    break
                det = place_details(pid)
                website = det.get("website", "")
                lead = {
                    "business": det.get("name") or res.get("name", ""),
                    "website": website,
                    "phone": det.get("formatted_phone_number", ""),
                    "email": "" if (args.no_email or not website) else scrape_email(website),
                    "address": det.get("formatted_address") or res.get("formatted_address", ""),
                    "area": area, "vertical": vert, "place_id": pid,
                    "rating": det.get("rating") or res.get("rating"),
                    "has_site": 1 if website else 0,
                    "source": "places",
                }
                leads.append(lead)
                tag = "NO SITE" if not website else ("email✓" if lead["email"] else "site")
                print(f"    + {lead['business'][:40]:40} {tag}", flush=True)

    print(f"\nCollected {len(leads)} leads ({sum(1 for l in leads if not l['has_site'])} with no site, "
          f"{sum(1 for l in leads if l['email'])} with email).")
    if args.dry_run:
        print(json.dumps(leads[:5], indent=2))
        print("(dry-run — nothing posted)")
        return
    for i in range(0, len(leads), 100):
        r = post_leads(leads[i:i + 100])
        print(f"posted batch {i//100+1}: inserted {r.get('inserted')} / received {r.get('received')}")


if __name__ == "__main__":
    main()
