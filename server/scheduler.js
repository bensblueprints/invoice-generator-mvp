import crypto from 'node:crypto';
import db, { getSettings, nextInvoiceNumber, addMonths, today, serializeInvoice } from './db.js';
import { renderInvoicePDF } from './pdf.js';
import { sendInvoiceEmail, smtpConfigured } from './mailer.js';

/**
 * Create an invoice from a recurring template. Exported so the API's
 * "run now" endpoint and the scheduler share one code path.
 */
export function createInvoiceFromRecurring(rec) {
  const issue = today();
  const due = new Date(Date.now() + rec.due_days * 86400000).toISOString().slice(0, 10);
  const number = nextInvoiceNumber();
  const token = crypto.randomBytes(16).toString('hex');
  const info = db.prepare(`
    INSERT INTO invoices (number, client_id, token, status, issue_date, due_date, items, tax_percent, discount_percent, notes, recurring_id)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
  `).run(number, rec.client_id, token, issue, due, rec.items, rec.tax_percent, rec.discount_percent, rec.notes, rec.id);
  db.prepare('UPDATE recurring SET next_run = ?, last_created_at = ? WHERE id = ?')
    .run(addMonths(rec.next_run, 1), new Date().toISOString(), rec.id);
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
}

async function maybeEmail(invoiceRow) {
  if (!smtpConfigured()) return;
  const business = getSettings();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(invoiceRow.client_id);
  const inv = serializeInvoice(invoiceRow);
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5303}`;
  try {
    const pdf = await renderInvoicePDF(inv, client, business);
    const sent = await sendInvoiceEmail({
      invoice: inv, client, business, pdfBuffer: pdf,
      publicUrl: `${base}/inv/${inv.token}`,
    });
    if (sent) {
      db.prepare(`UPDATE invoices SET status = 'sent', sent_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), invoiceRow.id);
      console.log(`[recurring] emailed invoice ${invoiceRow.number}`);
    }
  } catch (err) {
    console.error(`[recurring] email failed for ${invoiceRow.number}: ${err.message}`);
  }
}

/** One scheduler pass: create draft invoices for every recurring template that is due. */
export async function runRecurringPass() {
  const due = db.prepare('SELECT * FROM recurring WHERE active = 1 AND next_run <= ?').all(today());
  for (const rec of due) {
    // catch up at most 3 missed cycles to avoid runaway creation after long downtime
    let guard = 0;
    let current = rec;
    while (current.next_run <= today() && guard < 3) {
      const created = createInvoiceFromRecurring(current);
      console.log(`[recurring] created draft ${created.number} for template #${rec.id}`);
      if (rec.auto_email) await maybeEmail(created);
      current = db.prepare('SELECT * FROM recurring WHERE id = ?').get(rec.id);
      guard++;
    }
  }
  return due.length;
}

/** Start the in-process scheduler: run at boot, then hourly. */
export function startScheduler() {
  const tick = () => runRecurringPass().catch((e) => console.error('[recurring] pass failed:', e));
  setTimeout(tick, 3000);
  const timer = setInterval(tick, 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}
