-- 032: credit-pack purchase ledger. billing_accounts.ai_credits_purchased is a
-- running BALANCE (decremented as spent), so it can't tell us credit-pack
-- revenue or history. This append-only ledger records each purchase for the
-- admin revenue panel. Idempotent via the Stripe session id.
CREATE TABLE IF NOT EXISTS credit_pack_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  credits INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_credit_pack_created ON credit_pack_purchases(created_at DESC);
