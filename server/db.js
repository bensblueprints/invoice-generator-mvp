import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'invoices.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT DEFAULT '',
  logo_path TEXT DEFAULT '',
  address TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  currency TEXT DEFAULT 'USD',
  payment_instructions TEXT DEFAULT '',
  invoice_prefix TEXT DEFAULT 'INV-',
  next_number INTEGER DEFAULT 1,
  smtp_host TEXT DEFAULT '',
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT DEFAULT '',
  smtp_pass TEXT DEFAULT '',
  smtp_from TEXT DEFAULT ''
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  tax_percent REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  recurring_id INTEGER,
  paid_at TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  items TEXT NOT NULL DEFAULT '[]',
  tax_percent REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  due_days INTEGER NOT NULL DEFAULT 14,
  next_run TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  auto_email INTEGER NOT NULL DEFAULT 0,
  last_created_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

export default db;

// ---------- helpers ----------

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Round to 2 decimals, avoiding float dust. */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Totals math (single source of truth, also asserted by the smoke test):
 *   subtotal = sum(qty * rate)
 *   discount = subtotal * discount_percent / 100
 *   tax      = (subtotal - discount) * tax_percent / 100
 *   total    = subtotal - discount + tax
 */
export function computeTotals(items, taxPercent = 0, discountPercent = 0) {
  const subtotal = round2(
    (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0)
  );
  const discount = round2(subtotal * (Number(discountPercent) || 0) / 100);
  const tax = round2((subtotal - discount) * (Number(taxPercent) || 0) / 100);
  const total = round2(subtotal - discount + tax);
  return { subtotal, discount, tax, total };
}

/** Effective status: 'sent' past its due date becomes 'overdue'. */
export function effectiveStatus(inv) {
  if (inv.status === 'sent' && inv.due_date && inv.due_date < today()) return 'overdue';
  return inv.status;
}

/** Serialize an invoice row for API responses (parsed items + totals + effective status). */
export function serializeInvoice(row) {
  const items = JSON.parse(row.items || '[]');
  return {
    ...row,
    items,
    status: effectiveStatus(row),
    stored_status: row.status,
    totals: computeTotals(items, row.tax_percent, row.discount_percent),
  };
}

export function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

/** Allocate the next invoice number atomically. */
export function nextInvoiceNumber() {
  const alloc = db.transaction(() => {
    const s = getSettings();
    db.prepare('UPDATE settings SET next_number = next_number + 1 WHERE id = 1').run();
    return `${s.invoice_prefix || ''}${String(s.next_number).padStart(4, '0')}`;
  });
  return alloc();
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}
