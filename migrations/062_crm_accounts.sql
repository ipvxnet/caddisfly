-- CRM Accounts (Phase 1) — a structured company/account record that sits ALONGSIDE
-- the existing auto-aggregated contact list (crm_contacts). An account holds many
-- contacts (crm_account_contacts). Contact emails are what link an account to its
-- financials in Phase 2 (orders + accepted quotes matched by email).
--
-- Bridge pattern: ai_project_id XOR project_id (mirrors crm_contacts/site tables).

CREATE TABLE IF NOT EXISTS crm_accounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_project_id      INTEGER,
  project_id         INTEGER,
  account_name       TEXT NOT NULL DEFAULT '',
  account_owner      TEXT NOT NULL DEFAULT '',   -- internal owner (free text / team email)
  email              TEXT NOT NULL DEFAULT '',   -- general company email
  phone              TEXT NOT NULL DEFAULT '',   -- general phone
  cellphone          TEXT NOT NULL DEFAULT '',
  billing_address    TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  num_employees      INTEGER,
  industry           TEXT NOT NULL DEFAULT '',
  vertical           TEXT NOT NULL DEFAULT '',
  desired_start_date TEXT NOT NULL DEFAULT '',    -- 'YYYY-MM-DD'
  desired_end_date   TEXT NOT NULL DEFAULT '',    -- 'YYYY-MM-DD'
  status             TEXT NOT NULL DEFAULT 'new',  -- new|contacted|qualified|won|lost
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_ai ON crm_accounts (ai_project_id) WHERE ai_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_accounts_rg ON crm_accounts (project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_account_contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL DEFAULT '',   -- role / position
  email       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_crm_acct_contacts ON crm_account_contacts (account_id);
