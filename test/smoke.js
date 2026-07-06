// Smoke test — exercises the real API end to end:
//   business profile (incl. generated logo upload) → client → invoice →
//   PDF render (>5KB, %PDF magic) → public token route → totals math →
//   status flow + overdue computation → recurring run-now.
// Run with: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// isolated test database
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'invgen-test-'));
process.env.ADMIN_PASSWORD = 'test-password';

const { default: app } = await import('../server/index.js');

const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let cookie = '';
async function api(method, url, body, raw = false) {
  const opts = { method, headers: { cookie } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, opts);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  if (raw) return res;
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

// ---- generate a real PNG logo fixture (random pixels so it doesn't compress away) ----
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makePNG(w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    raw[row] = 0;
    for (let i = 1; i <= w * 3; i++) raw[row + i] = Math.floor(Math.random() * 256);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let failed = false;
async function step(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); }
  catch (err) { failed = true; console.error(`  FAIL  ${name}\n        ${err.message}`); }
}

console.log('Invoice Generator smoke test\n');

// ---- auth ----
await step('rejects wrong password / unauthorized access', async () => {
  assert.equal((await api('POST', '/api/login', { password: 'nope' })).status, 401);
  assert.equal((await api('GET', '/api/clients')).status, 401);
});

await step('logs in with ADMIN_PASSWORD', async () => {
  assert.equal((await api('POST', '/api/login', { password: 'test-password' })).status, 200);
  assert.equal((await api('GET', '/api/me')).data.authed, true);
});

// ---- business profile ----
await step('saves business profile', async () => {
  const res = await api('PUT', '/api/settings', {
    name: 'Acme Design Studio',
    address: '42 Galaxy Way\nPortland, OR 97201',
    tax_id: 'EIN 12-3456789',
    currency: 'USD',
    payment_instructions: 'Wire to IBAN DE00 1234 5678 9012 3456 00\nor PayPal billing@acme.test',
    invoice_prefix: 'ACME-',
    next_number: 101,
  });
  assert.equal(res.status, 200);
  const s = (await api('GET', '/api/settings')).data;
  assert.equal(s.name, 'Acme Design Studio');
  assert.equal(s.invoice_prefix, 'ACME-');
});

await step('uploads a real PNG logo', async () => {
  const png = makePNG(120, 120);
  fs.writeFileSync(path.join(OUT_DIR, 'logo.png'), png);
  const fd = new FormData();
  fd.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');
  const res = await api('POST', '/api/settings/logo', fd);
  assert.equal(res.status, 200);
  assert.equal((await api('GET', '/api/settings')).data.has_logo, true);
});

// ---- client ----
let client;
await step('creates a client', async () => {
  const res = await api('POST', '/api/clients', {
    name: 'Jane Freelance', company: 'Jane LLC', email: 'jane@example.test',
    address: '1 Client Rd\nAustin, TX',
  });
  assert.equal(res.status, 201);
  client = res.data;
  assert.ok(client.id);
});

// ---- invoice + totals math ----
let invoice;
const ITEMS = [
  { description: 'Design sprint', qty: 3, rate: 450.5 },
  { description: 'Landing page build', qty: 1, rate: 1200 },
  { description: 'Support retainer (hrs)', qty: 2.5, rate: 90 },
];
await step('creates an invoice with auto-numbering', async () => {
  const res = await api('POST', '/api/invoices', {
    client_id: client.id, items: ITEMS, tax_percent: 8.25, discount_percent: 10,
    due_date: '2099-01-01', notes: 'Thanks for your business!',
  });
  assert.equal(res.status, 201);
  invoice = res.data;
  assert.equal(invoice.number, 'ACME-0101');
  assert.ok(invoice.token?.length >= 32);
});

await step('totals math is correct (subtotal/discount/tax/total)', async () => {
  // subtotal = 3*450.50 + 1200 + 2.5*90 = 1351.50 + 1200 + 225 = 2776.50
  // discount 10% = 277.65 → taxable 2498.85; tax 8.25% = 206.155… → 206.16
  // total = 2498.85 + 206.16 = 2705.01
  const t = invoice.totals;
  assert.equal(t.subtotal, 2776.5);
  assert.equal(t.discount, 277.65);
  assert.equal(t.tax, 206.16);
  assert.equal(t.total, 2705.01);
});

// ---- PDF ----
const pdfPath = path.join(OUT_DIR, 'invoice.pdf');
await step('renders PDF (exists, >5KB, starts with %PDF)', async () => {
  const res = await api('GET', `/api/invoices/${invoice.id}/pdf`, undefined, true);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(pdfPath, buf);
  assert.ok(fs.existsSync(pdfPath), 'pdf file missing');
  const size = fs.statSync(pdfPath).size;
  assert.ok(size > 5 * 1024, `pdf too small: ${size} bytes`);
  assert.equal(buf.subarray(0, 4).toString('ascii'), '%PDF');
});

// ---- public token route ----
await step('public token route returns the invoice without auth', async () => {
  const res = await fetch(`${BASE}/api/public/${invoice.token}`); // no cookie
  assert.equal(res.status, 200);
  const pub = await res.json();
  assert.equal(pub.invoice.number, invoice.number);
  assert.equal(pub.invoice.totals.total, 2705.01);
  assert.equal(pub.business.name, 'Acme Design Studio');
  assert.equal(pub.client.name, 'Jane Freelance');
  // and its PDF endpoint too
  const pdfRes = await fetch(`${BASE}/inv/${invoice.token}/pdf`);
  assert.equal(pdfRes.status, 200);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  assert.equal(pdfBuf.subarray(0, 4).toString('ascii'), '%PDF');
});

await step('bogus public token 404s', async () => {
  assert.equal((await fetch(`${BASE}/api/public/deadbeef`)).status, 404);
});

// ---- status flow + overdue ----
await step('status flow: sent → overdue (computed) → paid', async () => {
  let r = await api('POST', `/api/invoices/${invoice.id}/status`, { status: 'sent' });
  assert.equal(r.data.status, 'sent');
  // past due date ⇒ effective status becomes overdue
  r = await api('PUT', `/api/invoices/${invoice.id}`, { due_date: '2020-01-01' });
  assert.equal(r.data.status, 'overdue');
  assert.equal(r.data.stored_status, 'sent');
  r = await api('POST', `/api/invoices/${invoice.id}/status`, { status: 'paid' });
  assert.equal(r.data.status, 'paid');
  assert.ok(r.data.paid_at);
});

await step('dashboard reflects paid invoice', async () => {
  const d = (await api('GET', '/api/dashboard')).data;
  assert.equal(d.paid_this_month_count, 1);
  assert.equal(d.paid_this_month_total, 2705.01);
  assert.equal(d.overdue.length, 0);
});

// ---- recurring ----
await step('recurring template creates a draft invoice and advances next_run', async () => {
  const rec = (await api('POST', '/api/recurring', {
    client_id: client.id,
    items: [{ description: 'Monthly retainer', qty: 1, rate: 500 }],
    tax_percent: 0, discount_percent: 0, due_days: 14,
    next_run: '2020-01-31', auto_email: false,
  })).data;
  const created = (await api('POST', `/api/recurring/${rec.id}/run`)).data;
  assert.equal(created.status, 'draft');
  assert.equal(created.totals.total, 500);
  assert.equal(created.number, 'ACME-0102');
  const after = (await api('GET', '/api/recurring')).data.find((r) => r.id === rec.id);
  assert.equal(after.next_run, '2020-02-29'); // month-end clamping (leap year)
});

server.close();
try {
  (await import('../server/db.js')).default.close(); // release SQLite lock (Windows)
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
} catch { /* best-effort temp cleanup */ }

console.log('');
if (failed) { console.error('SMOKE TEST FAILED'); process.exit(1); }
console.log(`All smoke tests passed. Artifacts in ${OUT_DIR}`);
