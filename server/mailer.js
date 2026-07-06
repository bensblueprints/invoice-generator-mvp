import nodemailer from 'nodemailer';
import { getSettings } from './db.js';

export function smtpConfigured() {
  const s = getSettings();
  return Boolean(s.smtp_host && s.smtp_from);
}

/**
 * Send an invoice email with the PDF attached. Requires BYO SMTP settings.
 * Returns true when sent, false when SMTP is not configured or the client has no email.
 */
export async function sendInvoiceEmail({ invoice, client, business, pdfBuffer, publicUrl }) {
  const s = getSettings();
  if (!s.smtp_host || !s.smtp_from || !client.email) return false;

  const transporter = nodemailer.createTransport({
    host: s.smtp_host,
    port: Number(s.smtp_port) || 587,
    secure: Number(s.smtp_port) === 465,
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
  });

  await transporter.sendMail({
    from: s.smtp_from,
    to: client.email,
    subject: `Invoice ${invoice.number} from ${business.name || 'your vendor'}`,
    text:
      `Hi ${client.name},\n\n` +
      `Please find invoice ${invoice.number} attached.\n` +
      (publicUrl ? `You can also view it online: ${publicUrl}\n` : '') +
      `\nDue date: ${invoice.due_date}\n\n` +
      (business.payment_instructions ? `Payment details:\n${business.payment_instructions}\n\n` : '') +
      `Thank you,\n${business.name || ''}`,
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdfBuffer }],
  });
  return true;
}
