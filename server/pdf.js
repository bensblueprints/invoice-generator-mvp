import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import { computeTotals, effectiveStatus } from './db.js';

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', NZD: 'NZ$',
  JPY: '¥', CHF: 'CHF ', SEK: 'kr ', NOK: 'kr ', DKK: 'kr ', INR: '₹',
  SGD: 'S$', HKD: 'HK$', ZAR: 'R ', BRL: 'R$', MXN: 'MX$', PLN: 'zł ',
};

function money(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${sym}${Number(amount).toFixed(2)}`;
}

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const ACCENT = '#4f46e5';

const STATUS_COLORS = { paid: '#059669', overdue: '#dc2626', sent: '#2563eb', draft: '#6b7280' };

/**
 * Render an invoice to a PDF Buffer.
 * @param {object} invoice  invoice row (items as array)
 * @param {object} client   client row
 * @param {object} business settings row
 */
export function renderInvoicePDF(invoice, client, business) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const M = 50;
    const contentW = pageW - M * 2;
    const totals = computeTotals(invoice.items, invoice.tax_percent, invoice.discount_percent);
    const status = effectiveStatus(invoice);
    const cur = business.currency || 'USD';

    // ---- header band ----
    doc.rect(0, 0, pageW, 8).fill(ACCENT);

    let headerY = 40;
    let textX = M;
    if (business.logo_path && fs.existsSync(business.logo_path)) {
      try {
        doc.image(business.logo_path, M, headerY, { fit: [110, 60] });
        textX = M + 130;
      } catch { /* unreadable image — skip logo */ }
    }
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20)
      .text(business.name || 'Your Business', textX, headerY, { width: 300 });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (business.address) doc.text(business.address, textX, doc.y + 2, { width: 300 });
    if (business.tax_id) doc.text(`Tax ID: ${business.tax_id}`, textX, doc.y + 2);

    // right block: INVOICE + meta
    doc.font('Helvetica-Bold').fontSize(26).fillColor(ACCENT)
      .text('INVOICE', M, 40, { width: contentW, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(INK)
      .text(invoice.number, M, doc.y + 2, { width: contentW, align: 'right' });
    doc.fontSize(9).fillColor(MUTED)
      .text(`Issued: ${invoice.issue_date}`, M, doc.y + 6, { width: contentW, align: 'right' })
      .text(`Due: ${invoice.due_date}`, M, doc.y + 2, { width: contentW, align: 'right' });

    // status pill (right aligned)
    const pillLabel = status.toUpperCase();
    doc.font('Helvetica-Bold').fontSize(9);
    const pillW = doc.widthOfString(pillLabel) + 16;
    const pillX = pageW - M - pillW;
    const pillY = doc.y + 8;
    doc.roundedRect(pillX, pillY, pillW, 18, 9).fill(STATUS_COLORS[status] || MUTED);
    doc.fillColor('#ffffff').text(pillLabel, pillX + 8, pillY + 5);

    // ---- bill to ----
    let y = Math.max(doc.y, 150);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('BILLED TO', M, y);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(client.name, M, doc.y + 4);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (client.company) doc.text(client.company, M, doc.y + 2);
    if (client.address) doc.text(client.address, M, doc.y + 2, { width: 250 });
    if (client.email) doc.text(client.email, M, doc.y + 2);

    // ---- items table ----
    y = doc.y + 28;
    const col = {
      desc: M,
      qty: M + contentW * 0.58,
      rate: M + contentW * 0.72,
      amount: M + contentW * 0.86,
    };
    const rightEdge = M + contentW;

    doc.rect(M, y, contentW, 22).fill('#f3f4f6');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED);
    doc.text('DESCRIPTION', col.desc + 8, y + 7);
    doc.text('QTY', col.qty, y + 7, { width: col.rate - col.qty - 8, align: 'right' });
    doc.text('RATE', col.rate, y + 7, { width: col.amount - col.rate - 8, align: 'right' });
    doc.text('AMOUNT', col.amount, y + 7, { width: rightEdge - col.amount - 8, align: 'right' });
    y += 22;

    doc.font('Helvetica').fontSize(10);
    for (const it of invoice.items) {
      const qty = Number(it.qty) || 0;
      const rate = Number(it.rate) || 0;
      const descH = doc.heightOfString(it.description || '-', { width: col.qty - col.desc - 16 });
      const rowH = Math.max(24, descH + 12);
      if (y + rowH > doc.page.height - 220) { doc.addPage(); y = 50; }
      doc.fillColor(INK)
        .text(it.description || '-', col.desc + 8, y + 6, { width: col.qty - col.desc - 16 });
      doc.fillColor(MUTED)
        .text(String(qty), col.qty, y + 6, { width: col.rate - col.qty - 8, align: 'right' })
        .text(money(rate, cur), col.rate, y + 6, { width: col.amount - col.rate - 8, align: 'right' });
      doc.fillColor(INK).font('Helvetica-Bold')
        .text(money(qty * rate, cur), col.amount, y + 6, { width: rightEdge - col.amount - 8, align: 'right' });
      doc.font('Helvetica');
      y += rowH;
      doc.moveTo(M, y).lineTo(rightEdge, y).lineWidth(0.5).strokeColor(LINE).stroke();
    }

    // ---- totals ----
    y += 14;
    const labelX = col.rate - 30;
    const valX = col.amount - 10;
    const totalRow = (label, value, opts = {}) => {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 12 : 10)
        .fillColor(opts.color || (opts.bold ? INK : MUTED))
        .text(label, labelX, y, { width: valX - labelX, align: 'right' })
        .fillColor(opts.color || INK)
        .text(value, valX, y, { width: rightEdge - valX, align: 'right' });
      y += opts.bold ? 22 : 18;
    };
    totalRow('Subtotal', money(totals.subtotal, cur));
    if (totals.discount > 0) {
      totalRow(`Discount (${invoice.discount_percent}%)`, `-${money(totals.discount, cur)}`, { color: '#059669' });
    }
    if (totals.tax > 0) totalRow(`Tax (${invoice.tax_percent}%)`, money(totals.tax, cur));
    doc.moveTo(labelX, y).lineTo(rightEdge, y).lineWidth(1).strokeColor(INK).stroke();
    y += 8;
    totalRow('Total Due', money(totals.total, cur), { bold: true, color: ACCENT });

    // ---- notes + payment instructions ----
    let footY = Math.max(y + 20, doc.page.height - 200);
    if (invoice.notes) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('NOTES', M, footY);
      doc.font('Helvetica').fontSize(9).fillColor(INK)
        .text(invoice.notes, M, doc.y + 4, { width: contentW });
      footY = doc.y + 16;
    }
    if (business.payment_instructions) {
      doc.roundedRect(M, footY, contentW, 0.1).stroke(LINE);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('PAYMENT DETAILS', M, footY + 8);
      doc.font('Helvetica').fontSize(9).fillColor(INK)
        .text(business.payment_instructions, M, doc.y + 4, { width: contentW });
    }

    // footer on every page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor(MUTED)
        .text(
          `${business.name || ''}  •  ${invoice.number}  •  Thank you for your business`,
          M, doc.page.height - 40, { width: contentW, align: 'center', lineBreak: false }
        );
    }

    doc.end();
  });
}
