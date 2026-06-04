// Customer support API (form POST → redirect; magic-link auth).
//   POST /api/support/ticket                  (create)
//   POST /api/support/ticket/:public_id/reply (reply)

import { redirect } from '../../utils/response.js';
import { createTicket, getTicketByPublicId, addMessage } from '../../db/tickets.js';
import { sendTicketEmail } from '../../utils/email.js';

// Where staff notifications go: first ADMIN_EMAILS entry, else ADMIN_EMAIL.
function adminInbox(env) {
  if (env.ADMIN_EMAILS) {
    const first = String(env.ADMIN_EMAILS).split(',')[0].trim();
    if (first) return first;
  }
  return env.ADMIN_EMAIL || '';
}

async function formData(request) {
  try {
    const f = await request.formData();
    return Object.fromEntries(f.entries());
  } catch {
    return {};
  }
}

/** POST /api/support/ticket */
export async function handleCreateTicket(ctx) {
  const { env, request, url } = ctx;
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/support', 303);

  const body = await formData(request);
  const subject = String(body.subject || '').trim().slice(0, 200);
  const type = body.type === 'request' ? 'request' : 'issue';
  const message = String(body.body || '').trim();
  if (!subject || !message) return redirect('/support?error=1', 303);

  const ticket = await createTicket(env.DB, { email, subject, type, body: message });

  // Notify staff (best-effort).
  const inbox = adminInbox(env);
  if (inbox) {
    await sendTicketEmail(env, {
      to: inbox,
      subject: `[Ticket] ${subject}`,
      heading: `New ${type} from ${email}`,
      intro: `${email} opened a support ticket.`,
      body: message,
      linkUrl: `${url.origin}/admin/tickets?t=${ticket.public_id}`,
      linkLabel: 'Open in admin',
    });
  }

  return redirect(`/support?t=${ticket.public_id}`, 303);
}

/** POST /api/support/ticket/:public_id/reply */
export async function handleReplyTicket(ctx) {
  const { env, request, params, url } = ctx;
  const email = ctx.billingEmail;
  if (!email) return redirect('/billing?next=/support', 303);

  const ticket = await getTicketByPublicId(env.DB, params.public_id);
  if (!ticket || ticket.customer_email !== email) return redirect('/support', 303);

  const body = await formData(request);
  const message = String(body.body || '').trim();
  if (!message) return redirect(`/support?t=${ticket.public_id}`, 303);

  await addMessage(env.DB, ticket, { authorEmail: email, isStaff: false, body: message });

  const inbox = adminInbox(env);
  if (inbox) {
    await sendTicketEmail(env, {
      to: inbox,
      subject: `[Ticket reply] ${ticket.subject}`,
      heading: `${email} replied`,
      intro: `New reply on ticket "${ticket.subject}".`,
      body: message,
      linkUrl: `${url.origin}/admin/tickets?t=${ticket.public_id}`,
      linkLabel: 'Open in admin',
    });
  }

  return redirect(`/support?t=${ticket.public_id}&replied=1`, 303);
}
