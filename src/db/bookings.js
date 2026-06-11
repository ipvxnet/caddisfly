// Booking engine D1 helpers — bridge-aware like blog-posts.js (rows key on
// ai_project_id XOR project_id via the {aiProjectId}|{projectId} projectKey).
// The critical piece is claimBooking(): a single INSERT … SELECT … WHERE NOT
// EXISTS statement, so two visitors racing for the same slot can never both
// succeed (SQLite executes the statement atomically — same idea as the
// domain-renewal claim pattern).

function keyWhere(projectKey) {
  return projectKey.aiProjectId != null
    ? { sql: 'ai_project_id = ?', val: projectKey.aiProjectId }
    : { sql: 'project_id = ?', val: projectKey.projectId };
}

function keyCols(projectKey) {
  return projectKey.aiProjectId != null
    ? { ai: projectKey.aiProjectId, p: null }
    : { ai: null, p: projectKey.projectId };
}

const nowSec = () => Math.floor(Date.now() / 1000);

// ---- services ----

export async function getServices(db, projectKey, { activeOnly = false } = {}) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(
    `SELECT * FROM booking_services WHERE ${k.sql}${activeOnly ? ' AND active = 1' : ''} ORDER BY sort_order, id`
  ).bind(k.val).all();
  return res.results || [];
}

export async function getServiceById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM booking_services WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

export async function countServices(db, projectKey) {
  const k = keyWhere(projectKey);
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM booking_services WHERE ${k.sql}`).bind(k.val).first();
  return (row && row.n) || 0;
}

export async function createService(db, projectKey, s) {
  const c = keyCols(projectKey);
  const res = await db.prepare(
    `INSERT INTO booking_services (ai_project_id, project_id, name, description, duration_min, buffer_min, price_cents, currency, active, sort_order, require_payment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(c.ai, c.p, s.name, s.description || null, s.duration_min, s.buffer_min || 0,
    s.price_cents != null ? s.price_cents : null, s.currency || null,
    s.active === 0 ? 0 : 1, s.sort_order || 0, s.require_payment ? 1 : 0, nowSec()).run();
  return res.meta.last_row_id;
}

const SERVICE_FIELDS = new Set(['name', 'description', 'duration_min', 'buffer_min', 'price_cents', 'currency', 'active', 'sort_order', 'require_payment']);

export async function updateService(db, projectKey, id, fields) {
  const k = keyWhere(projectKey);
  const sets = [];
  const vals = [];
  for (const [f, v] of Object.entries(fields || {})) {
    if (!SERVICE_FIELDS.has(f)) continue;
    sets.push(`${f} = ?`);
    vals.push(v);
  }
  if (!sets.length) return false;
  const res = await db.prepare(`UPDATE booking_services SET ${sets.join(', ')} WHERE ${k.sql} AND id = ?`)
    .bind(...vals, k.val, id).run();
  return res.meta.changes > 0;
}

export async function deleteService(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(`DELETE FROM booking_services WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
  return res.meta.changes > 0;
}

// ---- weekly hours ----

export async function getHours(db, projectKey) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(`SELECT * FROM booking_hours WHERE ${k.sql} ORDER BY weekday, start_min`).bind(k.val).all();
  return res.results || [];
}

/** Replace the whole weekly schedule (rows = [{weekday, start_min, end_min}]). */
export async function replaceHours(db, projectKey, rows) {
  const k = keyWhere(projectKey);
  const c = keyCols(projectKey);
  const stmts = [db.prepare(`DELETE FROM booking_hours WHERE ${k.sql}`).bind(k.val)];
  for (const r of rows) {
    stmts.push(db.prepare(
      'INSERT INTO booking_hours (ai_project_id, project_id, weekday, start_min, end_min) VALUES (?, ?, ?, ?, ?)'
    ).bind(c.ai, c.p, r.weekday, r.start_min, r.end_min));
  }
  await db.batch(stmts);
}

// ---- date overrides ----

export async function getOverrides(db, projectKey, { fromDate = null } = {}) {
  const k = keyWhere(projectKey);
  const res = fromDate
    ? await db.prepare(`SELECT * FROM booking_overrides WHERE ${k.sql} AND date >= ? ORDER BY date`).bind(k.val, fromDate).all()
    : await db.prepare(`SELECT * FROM booking_overrides WHERE ${k.sql} ORDER BY date`).bind(k.val).all();
  return res.results || [];
}

export async function upsertOverride(db, projectKey, { date, closed, start_min = null, end_min = null, label = null }) {
  const k = keyWhere(projectKey);
  const c = keyCols(projectKey);
  await db.prepare(`DELETE FROM booking_overrides WHERE ${k.sql} AND date = ?`).bind(k.val, date).run();
  await db.prepare(
    'INSERT INTO booking_overrides (ai_project_id, project_id, date, closed, start_min, end_min, label) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(c.ai, c.p, date, closed ? 1 : 0, start_min, end_min, label).run();
}

/** Insert CLOSED overrides for the given holidays, skipping dates that already
 *  have ANY override (don't clobber the owner's custom days). Returns added count. */
export async function addHolidayOverrides(db, projectKey, holidays) {
  const k = keyWhere(projectKey);
  const c = keyCols(projectKey);
  const res = await db.prepare(`SELECT date FROM booking_overrides WHERE ${k.sql}`).bind(k.val).all();
  const taken = new Set((res.results || []).map((r) => r.date));
  const fresh = (holidays || []).filter((h) => !taken.has(h.date));
  if (fresh.length) {
    await db.batch(fresh.map((h) => db.prepare(
      'INSERT INTO booking_overrides (ai_project_id, project_id, date, closed, start_min, end_min, label) VALUES (?, ?, ?, 1, NULL, NULL, ?)'
    ).bind(c.ai, c.p, h.date, h.label)));
  }
  return fresh.length;
}

export async function deleteOverride(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(`DELETE FROM booking_overrides WHERE ${k.sql} AND id = ?`).bind(k.val, id).run();
  return res.meta.changes > 0;
}

// ---- bookings ----

// A slot is BLOCKED by a confirmed booking or an unexpired pending-payment
// hold (paid bookings hold their slot during Stripe Checkout, ~30 min).
const BLOCKING = "(status = 'confirmed' OR (status = 'pending' AND expires_at > unixepoch()))";

export async function getBookingsInRange(db, projectKey, fromDate, toDate) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(
    `SELECT * FROM bookings WHERE ${k.sql} AND ${BLOCKING} AND date >= ? AND date <= ? ORDER BY date, start_min`
  ).bind(k.val, fromDate, toDate).all();
  return res.results || [];
}

/** Bookings for the owner's iCal feed: confirmed, recent past + all future. */
export async function getFeedBookings(db, projectKey, fromDate, limit = 500) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(
    `SELECT b.*, s.name AS service_name FROM bookings b
     LEFT JOIN booking_services s ON s.id = b.service_id
     WHERE b.${k.sql} AND b.status = 'confirmed' AND b.date >= ? ORDER BY b.date, b.start_min LIMIT ?`
  ).bind(k.val, fromDate, limit).all();
  return res.results || [];
}

/** Upcoming bookings for the owner inbox (joined with the service name). */
export async function getUpcomingBookings(db, projectKey, fromDate, limit = 100) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(
    `SELECT b.*, s.name AS service_name FROM bookings b
     LEFT JOIN booking_services s ON s.id = b.service_id
     WHERE b.${k.sql} AND b.date >= ? ORDER BY b.date, b.start_min LIMIT ?`
  ).bind(k.val, fromDate, limit).all();
  return res.results || [];
}

export async function getBookingById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  return db.prepare(`SELECT * FROM bookings WHERE ${k.sql} AND id = ?`).bind(k.val, id).first();
}

export async function getBookingByToken(db, token) {
  return db.prepare(
    `SELECT b.*, s.name AS service_name FROM bookings b
     LEFT JOIN booking_services s ON s.id = b.service_id
     WHERE b.cancel_token = ?`
  ).bind(token).first();
}

/** Confirmed bookings created this month (tier cap), month = 'YYYY-MM'. */
export async function countBookingsInMonth(db, projectKey, month) {
  const k = keyWhere(projectKey);
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE ${k.sql} AND date LIKE ?`
  ).bind(k.val, `${month}-%`).first();
  return (row && row.n) || 0;
}

/** Bookings created since a unix ts (any status) — site flood guard. */
export async function countBookingsCreatedSince(db, projectKey, sinceTs) {
  const k = keyWhere(projectKey);
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM bookings WHERE ${k.sql} AND created_at >= ?`).bind(k.val, sinceTs).first();
  return (row && row.n) || 0;
}

/** Bookings created by one email since a unix ts — per-visitor guard. */
export async function countBookingsByEmailSince(db, projectKey, email, sinceTs) {
  const k = keyWhere(projectKey);
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE ${k.sql} AND customer_email = ? AND created_at >= ?`
  ).bind(k.val, email, sinceTs).first();
  return (row && row.n) || 0;
}

/**
 * Atomically claim a slot: the INSERT only happens when no confirmed booking
 * overlaps [start_min, end_min) on that date. Returns true when the row was
 * created (meta.changes === 1) — a concurrent winner makes the loser a no-op.
 */
export async function claimBooking(db, projectKey, b) {
  const k = keyWhere(projectKey);
  const c = keyCols(projectKey);
  const pending = !!b.pendingHold; // paid flow: hold the slot during checkout
  const res = await db.prepare(
    `INSERT INTO bookings (ai_project_id, project_id, service_id, customer_name, customer_email, note, date, start_min, end_min, status, cancel_token, visitor_tz, payment_status, amount_cents, currency, expires_at, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM bookings
       WHERE ${k.sql} AND date = ? AND ${BLOCKING} AND start_min < ? AND end_min > ?
     )`
  ).bind(
    c.ai, c.p, b.service_id, b.customer_name, b.customer_email, b.note || null,
    b.date, b.start_min, b.end_min,
    pending ? 'pending' : 'confirmed', b.cancel_token, b.visitor_tz || null,
    pending ? 'pending' : 'none',
    b.amount_cents != null ? b.amount_cents : null, b.currency || null,
    pending ? nowSec() + (b.holdSeconds || 1860) : null,
    nowSec(),
    k.val, b.date, b.end_min, b.start_min
  ).run();
  if (res.meta.changes !== 1) return null;
  return db.prepare(`SELECT * FROM bookings WHERE ${k.sql} AND cancel_token = ?`).bind(k.val, b.cancel_token).first();
}

/** Attach the Stripe Checkout session to a pending hold. */
export async function setBookingSession(db, bookingId, sessionId) {
  await db.prepare("UPDATE bookings SET stripe_session_id = ? WHERE id = ? AND status = 'pending'").bind(sessionId, bookingId).run();
}

/** Drop a pending hold (checkout creation failed / visitor bailed). */
export async function releasePendingBooking(db, bookingId) {
  await db.prepare("UPDATE bookings SET status = 'cancelled', payment_status = 'expired' WHERE id = ? AND status = 'pending'").bind(bookingId).run();
}

export async function getBookingBySession(db, sessionId) {
  return db.prepare(
    `SELECT b.*, s.name AS service_name FROM bookings b
     LEFT JOIN booking_services s ON s.id = b.service_id
     WHERE b.stripe_session_id = ?`
  ).bind(sessionId).first();
}

/**
 * Flip a paid pending hold to confirmed — GUARDED against the expired-hold
 * race (hold lapsed, someone else took the slot, THEN the payment landed):
 * the UPDATE only succeeds when no OTHER blocking row overlaps. Returns
 * 'confirmed' | 'already' | 'conflict' | 'missing'; 'conflict' callers must
 * refund. Idempotent via status='pending' (receipt page + webhook both call).
 */
export async function confirmPaidBooking(db, bookingId, paymentIntent) {
  const b = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first();
  if (!b) return 'missing';
  if (b.status === 'confirmed') return 'already';
  if (b.status !== 'pending') return 'conflict'; // cancelled/expired under us
  const k = b.ai_project_id != null
    ? { sql: 'ai_project_id = ?', val: b.ai_project_id }
    : { sql: 'project_id = ?', val: b.project_id };
  const res = await db.prepare(
    `UPDATE bookings SET status = 'confirmed', payment_status = 'paid', payment_intent = ?, expires_at = NULL
     WHERE id = ? AND status = 'pending' AND NOT EXISTS (
       SELECT 1 FROM bookings
       WHERE ${k.sql} AND date = ? AND id != ? AND ${BLOCKING} AND start_min < ? AND end_min > ?
     )`
  ).bind(paymentIntent || null, bookingId, k.val, b.date, bookingId, b.end_min, b.start_min).run();
  return res.meta.changes === 1 ? 'confirmed' : 'conflict';
}

/**
 * Move a CONFIRMED booking to a new slot — guarded like confirmPaidBooking:
 * the UPDATE only succeeds when no OTHER blocking row overlaps the target.
 * Resets reminded_at so the reminder cron re-arms for the new time. Payment
 * fields are untouched (same service, same price). Returns 'moved' |
 * 'conflict' | 'missing'.
 */
export async function rescheduleBooking(db, booking, { date, start_min, end_min }) {
  if (!booking || booking.status !== 'confirmed') return 'missing';
  const k = booking.ai_project_id != null
    ? { sql: 'ai_project_id = ?', val: booking.ai_project_id }
    : { sql: 'project_id = ?', val: booking.project_id };
  const res = await db.prepare(
    `UPDATE bookings SET date = ?, start_min = ?, end_min = ?, reminded_at = NULL
     WHERE id = ? AND status = 'confirmed' AND NOT EXISTS (
       SELECT 1 FROM bookings
       WHERE ${k.sql} AND date = ? AND id != ? AND ${BLOCKING} AND start_min < ? AND end_min > ?
     )`
  ).bind(date, start_min, end_min, booking.id, k.val, date, booking.id, end_min, start_min).run();
  return res.meta.changes === 1 ? 'moved' : 'conflict';
}

/** Mark the refund outcome on a booking (cancel/conflict paths). */
export async function setPaymentStatus(db, bookingId, paymentStatus) {
  await db.prepare('UPDATE bookings SET payment_status = ? WHERE id = ?').bind(paymentStatus, bookingId).run();
}

/** Hygiene: cancel pending holds that expired over 2h ago (cron piggyback).
 *  A late webhook still can't double-book — confirmPaidBooking requires
 *  status='pending', so a cancelled hold routes to the refund path. */
export async function cancelStalePendingBookings(db) {
  const res = await db.prepare(
    "UPDATE bookings SET status = 'cancelled', payment_status = 'expired' WHERE status = 'pending' AND expires_at < unixepoch() - 7200"
  ).run();
  return res.meta.changes;
}

/** GLOBAL reminder candidates (all projects): confirmed, not yet reminded,
 *  date within the given list. The hourly cron filters by each site's
 *  owner-timezone window; LIMIT is a runaway guard, not a page size. */
export async function getReminderCandidates(db, dates, limit = 500) {
  if (!dates || !dates.length) return [];
  const qs = dates.map(() => '?').join(',');
  const res = await db.prepare(
    `SELECT b.*, s.name AS service_name FROM bookings b
     LEFT JOIN booking_services s ON s.id = b.service_id
     WHERE b.status = 'confirmed' AND b.reminded_at IS NULL AND b.date IN (${qs})
     ORDER BY b.date, b.start_min LIMIT ?`
  ).bind(...dates, limit).all();
  return res.results || [];
}

/** Atomic reminder claim — true exactly once per booking. */
export async function claimReminder(db, bookingId) {
  const res = await db.prepare(
    "UPDATE bookings SET reminded_at = unixepoch() WHERE id = ? AND reminded_at IS NULL AND status = 'confirmed'"
  ).bind(bookingId).run();
  return res.meta.changes === 1;
}

/** Cancel by token (visitor link) or by id (owner). Returns the row or null. */
export async function cancelBookingByToken(db, token) {
  const res = await db.prepare(
    "UPDATE bookings SET status = 'cancelled' WHERE cancel_token = ? AND status = 'confirmed'"
  ).bind(token).run();
  if (res.meta.changes === 0) return null;
  return getBookingByToken(db, token);
}

export async function cancelBookingById(db, projectKey, id) {
  const k = keyWhere(projectKey);
  const res = await db.prepare(
    `UPDATE bookings SET status = 'cancelled' WHERE ${k.sql} AND id = ? AND status = 'confirmed'`
  ).bind(k.val, id).run();
  return res.meta.changes > 0;
}
