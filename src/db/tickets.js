// Support ticket data layer (see migrations/015_tickets.sql). Pure D1 access.

import { generateToken } from '../utils/crypto.js';

const nowSec = () => Math.floor(Date.now() / 1000);

/** Create a ticket + its opening message. Returns the ticket row. */
export async function createTicket(db, { email, subject, type = 'issue', body }) {
  const publicId = generateToken(10);
  const t = await db
    .prepare(
      `INSERT INTO tickets (public_id, customer_email, subject, type, status)
       VALUES (?, ?, ?, ?, 'open') RETURNING *`
    )
    .bind(publicId, email, subject, type === 'request' ? 'request' : 'issue')
    .first();
  await db
    .prepare('INSERT INTO ticket_messages (ticket_id, author_email, is_staff, body) VALUES (?, ?, 0, ?)')
    .bind(t.id, email, body)
    .run();
  return t;
}

export async function getTicketByPublicId(db, publicId) {
  return db.prepare('SELECT * FROM tickets WHERE public_id = ?').bind(publicId).first();
}

export async function getTicketsByEmail(db, email) {
  const { results } = await db
    .prepare('SELECT * FROM tickets WHERE customer_email = ? ORDER BY updated_at DESC')
    .bind(email)
    .all();
  return results || [];
}

/** All tickets for the admin queue, optionally filtered by status. */
export async function getAllTickets(db, status = '') {
  const sql = status
    ? 'SELECT * FROM tickets WHERE status = ? ORDER BY updated_at DESC'
    : 'SELECT * FROM tickets ORDER BY (status != \'closed\') DESC, updated_at DESC';
  const stmt = status ? db.prepare(sql).bind(status) : db.prepare(sql);
  const { results } = await stmt.all();
  return results || [];
}

export async function getMessages(db, ticketId) {
  const { results } = await db
    .prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC')
    .bind(ticketId)
    .all();
  return results || [];
}

/**
 * Append a message and bump the ticket. A customer reply re-opens the ticket;
 * a staff reply moves it to in_progress (unless already closed).
 */
export async function addMessage(db, ticket, { authorEmail, isStaff, body }) {
  await db
    .prepare('INSERT INTO ticket_messages (ticket_id, author_email, is_staff, body) VALUES (?, ?, ?, ?)')
    .bind(ticket.id, authorEmail, isStaff ? 1 : 0, body)
    .run();
  let status = ticket.status;
  if (ticket.status !== 'closed') status = isStaff ? 'in_progress' : 'open';
  await db
    .prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, nowSec(), ticket.id)
    .run();
}

export async function setStatus(db, ticketId, status) {
  const s = ['open', 'in_progress', 'closed'].includes(status) ? status : 'open';
  await db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?').bind(s, nowSec(), ticketId).run();
}

/** Count tickets needing attention (not closed) — for the admin badge. */
export async function countOpenTickets(db) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status != 'closed'").first();
  return (r && r.n) || 0;
}
