#!/usr/bin/env bash
# Create the Caddisfly Stripe catalog (3 products × 2 recurring prices) in the
# account the provided key belongs to. Works for TEST (sk_test/rk_test) or LIVE
# (sk_live/rk_live) — the mode is whatever the key is.
#
# The key needs Products:write + Prices:write (a restricted key is enough).
#
# Usage:
#   STRIPE_KEY="$(tr -d '[:space:]' < .stripe-rk)" bash scripts/stripe-catalog.sh
#
# Pricing (annual = 10× monthly = 2 months free):
#   Starter $9/mo  $90/yr   Pro $19/mo  $190/yr   Agency $49/mo  $490/yr
#
# Prints the 6 STRIPE_PRICE_* values and writes them to .stripe-prices.env
# (gitignored) so the secrets can be set from that file afterward. The tier→price
# mapping in src/utils/stripe.js keys off these env vars, so they are the source
# of truth; metadata[plan]/[interval] are set too for readability in the dashboard.
set -euo pipefail

KEY="${STRIPE_KEY:-}"
[ -z "$KEY" ] && { echo "ERROR: set STRIPE_KEY (e.g. STRIPE_KEY=\"\$(tr -d '[:space:]' < .stripe-rk)\")" >&2; exit 1; }

API="https://api.stripe.com/v1"
sapi() { curl -sS -u "$KEY:" "$@"; }

# plan : product name : monthly cents : annual cents
PLANS=(
  "starter:Caddisfly Starter:900:9000"
  "pro:Caddisfly Pro:1900:19000"
  "agency:Caddisfly Agency:4900:49000"
)

OUT=".stripe-prices.env"
: > "$OUT"

mode="test"; case "$KEY" in *_live_*) mode="LIVE";; esac
echo ">>> Creating catalog in ${mode} mode..."

for row in "${PLANS[@]}"; do
  IFS=: read -r plan name mo yr <<< "$row"

  presp=$(sapi -X POST "$API/products" --data-urlencode "name=$name" -d "metadata[plan]=$plan")
  pid=$(echo "$presp" | jq -r '.id // empty')
  [ -z "$pid" ] && { echo "ERROR creating product $name:" >&2; echo "$presp" | jq -r '.error.message' >&2; exit 1; }

  mresp=$(sapi -X POST "$API/prices" -d "product=$pid" -d currency=usd -d "unit_amount=$mo" \
    -d "recurring[interval]=month" -d "metadata[plan]=$plan" -d "metadata[interval]=month")
  mprice=$(echo "$mresp" | jq -r '.id // empty')
  [ -z "$mprice" ] && { echo "ERROR creating $plan monthly price:" >&2; echo "$mresp" | jq -r '.error.message' >&2; exit 1; }

  yresp=$(sapi -X POST "$API/prices" -d "product=$pid" -d currency=usd -d "unit_amount=$yr" \
    -d "recurring[interval]=year" -d "metadata[plan]=$plan" -d "metadata[interval]=year")
  yprice=$(echo "$yresp" | jq -r '.id // empty')
  [ -z "$yprice" ] && { echo "ERROR creating $plan annual price:" >&2; echo "$yresp" | jq -r '.error.message' >&2; exit 1; }

  U=$(echo "$plan" | tr '[:lower:]' '[:upper:]')
  printf 'STRIPE_PRICE_%s_MONTHLY=%s\n' "$U" "$mprice" | tee -a "$OUT"
  printf 'STRIPE_PRICE_%s_ANNUAL=%s\n'  "$U" "$yprice" | tee -a "$OUT"
done

echo ">>> Done. 6 price IDs written to $OUT"
