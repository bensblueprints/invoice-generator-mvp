import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// tiny .env loader (no dependency): KEY=VALUE lines, existing env wins
try {
  const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env — use defaults */ }

import db, {
  UPLOADS_DIR, getSettings, nextInvoiceNumber, serializeInvoice, today,
} from './db.js';
import { renderInvoicePDF } from './pdf.js';
import { sendInvoiceEmail, smtpConfigured } from './mailer.js';
import { startScheduler, runRecurringPass, createInvoiceFromRecurring } from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5303;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const DESKTOP_MODE = process.env.DESKTOP_MODE === '1';

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- auth (simple session tokens, in-memory) ----------
const sessions = new Set();

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => {
      const i = c.indexOf('=');
      return i === -1 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
    })
  );
}

function isAuthed(req) {
  if (DESKTOP_MODE) return true; // local desktop app: single trusted user
  return sessions.has(parseCookies(req).ig_session || '');
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'unauthorized' });
}

app.post('/api/login', (req, res) => {
  if ((req.body?.password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'wrong password' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  res.setHeader('Set-Cookie', `ig_session=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(parseCookies(req).ig_session || '');
  res.setHeader('Set-Cookie', 'ig_session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ authed: isAuthed(req), desktop: DESKTOP_MODE }));

// ---------- settings / business profile ----------
app.get('/api/settings', requireAuth, (req, res) => {
  const s = getSettings();
  res.json({ ...s, smtp_pass: s.smtp_pass ? '********' : '', has_logo: Boolean(s.logo_path && fs.existsSync(s.logo_path)) });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const b = req.body || {};
  const cur = getSettings();
  const smtpPass = b.smtp_pass === '********' ? cur.smtp_pass : (b.smtp_pass ?? cur.smtp_pass);
  db.prepare(`
    UPDATE settings SET name=?, address=?, tax_id=?, currency=?, payment_instructions=?,
      invoice_prefix=?, next_number=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, smtp_from=?
    WHERE id = 1
  `).run(
    b.name ?? cur.name, b.address ?? cur.address, b.tax_id ?? cur.tax_id,
    b.currency ?? cur.currency, b.payment_instructions ?? cur.payment_instructions,
    b.invoice_prefix ?? cur.invoice_prefix, Number(b.next_number) || cur.next_number,
    b.smtp_host ?? cur.smtp_host, Number(b.smtp_port) || cur.smtp_port,
    b.smtp_user ?? cur.smtp_user, smtpPass, b.smtp_from ?? cur.smtp_from
  );
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, 'logo' + (path.extname(file.originalname).toLowerCase() || '.png')),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.png', '.jpg', '.jpeg'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only PNG/JPEG logos are supported (pdfkit-compatible)'), ok);
  },
});

app.post('/api/settings/logo', requireAuth, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  db.prepare('UPDATE settings SET logo_path = ? WHERE id = 1').run(req.file.path);
  res.json({ ok: true });
});

app.delete('/api/settings/logo', requireAuth, (req, res) => {
  const s = getSettings();
  if (s.logo_path && fs.existsSync(s.logo_path)) fs.unlinkSync(s.logo_path);
  db.prepare(`UPDATE settings SET logo_path = '' WHERE id = 1`).run();
  res.json({ ok: true });
});

app.get('/api/settings/logo', requireAuth, (req, res) => {
  const s = getSettings();
  if (!s.logo_path || !fs.existsSync(s.logo_path)) return res.status(404).end();
  res.sendFile(path.resolve(s.logo_path));
});

// ---------- clients ----------
app.get('/api/clients', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM clients ORDER BY name COLLATE NOCASE').all());
});

app.post('/api/clients', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.name?.trim()) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare(`
    INSERT INTO clients (name, company, email, address, phone, notes) VALUES (?, ?, ?, ?, ?, ?)
  `).run(b.name.trim(), b.company || '', b.email || '', b.address || '', b.phone || '', b.notes || '');
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/clients/:id', requireAuth, (req, res) => {
  const cur = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  db.prepare(`
    UPDATE clients SET name=?, company=?, email=?, address=?, phone=?, notes=? WHERE id=?
  `).run(b.name ?? cur.name, b.company ?? cur.company, b.email ?? cur.email,
    b.address ?? cur.address, b.phone ?? cur.phone, b.notes ?? cur.notes, cur.id);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(cur.id));
});

app.delete('/api/clients/:id', requireAuth, (req, res) => {
  const used = db.prepare('SELECT COUNT(*) n FROM invoices WHERE client_id = ?').get(req.params.id).n;
  if (used) return res.status(409).json({ error: 'client has invoices; delete those first' });
  db.prepare('DELETE FROM recurring WHERE client_id = ?').run(req.params.id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- invoices ----------
function validItems(items) {
  return Array.isArray(items) && items.every(
    (it) => typeof it === 'object' && it !== null && 'description' in it
  );
}

app.get('/api/invoices', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.name AS client_name, c.company AS client_company
    FROM invoices i JOIN clients c ON c.id = i.client_id
    ORDER BY i.id DESC
  `).all();
  res.json(rows.map(serializeInvoice));
});

app.post('/api/invoices', requireAuth, (req, res) => {
  const b = req.body || {};
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(b.client_id);
  if (!client) return res.status(400).json({ error: 'valid client_id is required' });
  if (!validItems(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'at least one line item is required' });
  }
  const number = b.number?.trim() || nextInvoiceNumber();
  const token = crypto.randomBytes(16).toString('hex');
  const info = db.prepare(`
    INSERT INTO invoices (number, client_id, token, status, issue_date, due_date, items, tax_percent, discount_percent, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    number, client.id, token,
    ['draft', 'sent', 'paid'].includes(b.status) ? b.status : 'draft',
    b.issue_date || today(),
    b.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    JSON.stringify(b.items), Number(b.tax_percent) || 0, Number(b.discount_percent) || 0, b.notes || ''
  );
  res.status(201).json(serializeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid)));
});

app.get('/api/invoices/:id', requireAuth, (req, res) => {
  const row = db.prepare(`
    SELECT i.*, c.name AS client_name FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(serializeInvoice(row));
});

app.put('/api/invoices/:id', requireAuth, (req, res) => {
  const cur = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  if (b.items !== undefined && (!validItems(b.items) || b.items.length === 0)) {
    return res.status(400).json({ error: 'invalid items' });
  }
  if (b.client_id !== undefined && !db.prepare('SELECT id FROM clients WHERE id = ?').get(b.client_id)) {
    return res.status(400).json({ error: 'invalid client_id' });
  }
  const status = ['draft', 'sent', 'paid'].includes(b.status) ? b.status : cur.status;
  db.prepare(`
    UPDATE invoices SET number=?, client_id=?, status=?, issue_date=?, due_date=?, items=?,
      tax_percent=?, discount_percent=?, notes=?,
      paid_at = CASE WHEN ? = 'paid' AND status != 'paid' THEN ? ELSE paid_at END,
      sent_at = CASE WHEN ? = 'sent' AND status = 'draft' THEN ? ELSE sent_at END
    WHERE id = ?
  `).run(
    b.number ?? cur.number, b.client_id ?? cur.client_id, status,
    b.issue_date ?? cur.issue_date, b.due_date ?? cur.due_date,
    b.items !== undefined ? JSON.stringify(b.items) : cur.items,
    b.tax_percent !== undefined ? Number(b.tax_percent) || 0 : cur.tax_percent,
    b.discount_percent !== undefined ? Number(b.discount_percent) || 0 : cur.discount_percent,
    b.notes ?? cur.notes,
    status, new Date().toISOString(), status, new Date().toISOString(),
    cur.id
  );
  res.json(serializeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(cur.id)));
});

app.post('/api/invoices/:id/status', requireAuth, (req, res) => {
  const cur = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  const status = req.body?.status;
  if (!['draft', 'sent', 'paid'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE invoices SET status = ?,
      paid_at = CASE WHEN ? = 'paid' THEN ? ELSE NULL END,
      sent_at = CASE WHEN ? = 'sent' AND sent_at IS NULL THEN ? ELSE sent_at END
    WHERE id = ?
  `).run(status, status, now, status, now, cur.id);
  res.json(serializeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(cur.id)));
});

app.delete('/api/invoices/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

async function invoicePdfBuffer(invoiceRow) {
  const inv = serializeInvoice(invoiceRow);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(invoiceRow.client_id);
  const business = getSettings();
  return { buffer: await renderInvoicePDF(inv, client, business), inv, client, business };
}

app.get('/api/invoices/:id/pdf', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  try {
    const { buffer } = await invoicePdfBuffer(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${row.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: `pdf render failed: ${err.message}` });
  }
});

app.post('/api/invoices/:id/email', requireAuth, async (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  if (!smtpConfigured()) return res.status(400).json({ error: 'SMTP is not configured (Settings → Email)' });
  try {
    const { buffer, inv, client, business } = await invoicePdfBuffer(row);
    if (!client.email) return res.status(400).json({ error: 'client has no email address' });
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    await sendInvoiceEmail({ invoice: inv, client, business, pdfBuffer: buffer, publicUrl: `${base}/inv/${row.token}` });
    const now = new Date().toISOString();
    db.prepare(`UPDATE invoices SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?) WHERE id = ?`).run(now, row.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `email failed: ${err.message}` });
  }
});

// ---------- dashboard ----------
app.get('/api/dashboard', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.name AS client_name FROM invoices i JOIN clients c ON c.id = i.client_id
  `).all().map(serializeInvoice);
  const month = today().slice(0, 7);
  const outstanding = rows.filter((r) => r.status === 'sent' || r.status === 'overdue');
  const paidThisMonth = rows.filter((r) => r.status === 'paid' && (r.paid_at || '').slice(0, 7) === month);
  const overdue = rows.filter((r) => r.status === 'overdue')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  res.json({
    outstanding_total: outstanding.reduce((s, r) => s + r.totals.total, 0),
    outstanding_count: outstanding.length,
    paid_this_month_total: paidThisMonth.reduce((s, r) => s + r.totals.total, 0),
    paid_this_month_count: paidThisMonth.length,
    draft_count: rows.filter((r) => r.status === 'draft').length,
    overdue,
    recent: rows.sort((a, b) => b.id - a.id).slice(0, 8),
    currency: getSettings().currency,
  });
});

// ---------- recurring ----------
app.get('/api/recurring', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, c.name AS client_name FROM recurring r JOIN clients c ON c.id = r.client_id ORDER BY r.id DESC
  `).all();
  res.json(rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') })));
});

app.post('/api/recurring', requireAuth, (req, res) => {
  const b = req.body || {};
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(b.client_id)) {
    return res.status(400).json({ error: 'valid client_id is required' });
  }
  if (!validItems(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'at least one line item is required' });
  }
  const info = db.prepare(`
    INSERT INTO recurring (client_id, items, tax_percent, discount_percent, notes, due_days, next_run, active, auto_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    b.client_id, JSON.stringify(b.items), Number(b.tax_percent) || 0, Number(b.discount_percent) || 0,
    b.notes || '', Number(b.due_days) || 14, b.next_run || today(), b.auto_email ? 1 : 0
  );
  res.status(201).json(db.prepare('SELECT * FROM recurring WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/recurring/:id', requireAuth, (req, res) => {
  const cur = db.prepare('SELECT * FROM recurring WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  db.prepare(`
    UPDATE recurring SET items=?, tax_percent=?, discount_percent=?, notes=?, due_days=?, next_run=?, active=?, auto_email=? WHERE id=?
  `).run(
    b.items !== undefined ? JSON.stringify(b.items) : cur.items,
    b.tax_percent !== undefined ? Number(b.tax_percent) || 0 : cur.tax_percent,
    b.discount_percent !== undefined ? Number(b.discount_percent) || 0 : cur.discount_percent,
    b.notes ?? cur.notes, Number(b.due_days) || cur.due_days, b.next_run ?? cur.next_run,
    b.active !== undefined ? (b.active ? 1 : 0) : cur.active,
    b.auto_email !== undefined ? (b.auto_email ? 1 : 0) : cur.auto_email,
    cur.id
  );
  res.json(db.prepare('SELECT * FROM recurring WHERE id = ?').get(cur.id));
});

app.delete('/api/recurring/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE invoices SET recurring_id = NULL WHERE recurring_id = ?').run(req.params.id);
  db.prepare('DELETE FROM recurring WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/recurring/:id/run', requireAuth, (req, res) => {
  const rec = db.prepare('SELECT * FROM recurring WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'not found' });
  const created = createInvoiceFromRecurring(rec);
  res.status(201).json(serializeInvoice(created));
});

app.post('/api/recurring/run-pass', requireAuth, async (req, res) => {
  const n = await runRecurringPass();
  res.json({ ok: true, templates_processed: n });
});

// ---------- public invoice (no auth) ----------
function publicInvoice(token) {
  const row = db.prepare('SELECT * FROM invoices WHERE token = ?').get(token);
  if (!row) return null;
  const inv = serializeInvoice(row);
  const client = db.prepare('SELECT name, company, email, address FROM clients WHERE id = ?').get(row.client_id);
  const s = getSettings();
  return {
    invoice: {
      number: inv.number, status: inv.status, issue_date: inv.issue_date, due_date: inv.due_date,
      items: inv.items, tax_percent: inv.tax_percent, discount_percent: inv.discount_percent,
      notes: inv.notes, totals: inv.totals, token: inv.token,
    },
    client,
    business: {
      name: s.name, address: s.address, tax_id: s.tax_id, currency: s.currency,
      payment_instructions: s.payment_instructions,
      has_logo: Boolean(s.logo_path && fs.existsSync(s.logo_path)),
    },
  };
}

app.get('/api/public/:token', (req, res) => {
  const data = publicInvoice(req.params.token);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

app.get('/api/public/:token/logo', (req, res) => {
  const row = db.prepare('SELECT id FROM invoices WHERE token = ?').get(req.params.token);
  const s = getSettings();
  if (!row || !s.logo_path || !fs.existsSync(s.logo_path)) return res.status(404).end();
  res.sendFile(path.resolve(s.logo_path));
});

app.get('/inv/:token/pdf', async (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE token = ?').get(req.params.token);
  if (!row) return res.status(404).send('Not found');
  try {
    const { buffer } = await invoicePdfBuffer(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${row.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).send('PDF render failed');
  }
});

// ---------- static frontend ----------
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get(/^(?!\/api\/).*/, (req, res) => {
  const index = path.join(distDir, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(503).send('Frontend not built. Run: npm run build');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

// NO_LISTEN=1 lets an embedder (tests, Electron wrapper) import the app and listen itself.
if (process.env.NODE_ENV !== 'test' && process.env.NO_LISTEN !== '1') {
  app.listen(PORT, () => {
    console.log(`Invoice Generator running on http://localhost:${PORT}${DESKTOP_MODE ? ' (desktop mode)' : ''}`);
    if (ADMIN_PASSWORD === 'changeme' && !DESKTOP_MODE) {
      console.log('WARNING: using default admin password. Set ADMIN_PASSWORD in .env');
    }
  });
  startScheduler();
}

export default app;
