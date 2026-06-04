-- 015_tickets.sql — basic support ticket system.
--
-- Customers open tickets (issues / feature requests) from /support; staff
-- triage + reply from /admin/tickets. Each ticket has a thread of messages
-- (the opening message is the first row). Additive migration; applied to
-- PREVIEW caddisfly-db, re-apply to caddisfly-db-prod at cutover.

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,            -- short token for URLs
  customer_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'issue',        -- issue | request
  status TEXT NOT NULL DEFAULT 'open',       -- open | in_progress | closed
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  is_staff INTEGER NOT NULL DEFAULT 0,       -- 1 = staff/admin reply
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tickets_email ON tickets(customer_email);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
