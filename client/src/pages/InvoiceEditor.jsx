import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Download, Link2, Mail, CheckCircle2, Send, Copy,
} from 'lucide-react';
import { api, money, computeTotals } from '../api.js';
import { StatusBadge } from '../components/ui.jsx';

const BLANK_ITEM = { description: '', qty: 1, rate: 0 };

export default function InvoiceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [clients, setClients] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/api/clients').then(setClients).catch(console.error);
    api.get('/api/settings').then((s) => setCurrency(s.currency)).catch(() => {});
    if (isNew) {
      setInv({
        client_id: '', status: 'draft',
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        items: [{ ...BLANK_ITEM }], tax_percent: 0, discount_percent: 0, notes: '',
      });
    } else {
      api.get(`/api/invoices/${id}`).then(setInv).catch(() => navigate('/invoices'));
    }
  }, [id]);

  if (!inv) return null;

  const totals = computeTotals(inv.items, inv.tax_percent, inv.discount_percent);
  const set = (k) => (e) => setInv({ ...inv, [k]: e.target.value });
  const setItem = (i, k, v) => {
    const items = inv.items.map((it, j) => (j === i ? { ...it, [k]: v } : it));
    setInv({ ...inv, items });
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body = { ...inv, client_id: Number(inv.client_id) };
      if (isNew) {
        const created = await api.post('/api/invoices', body);
        navigate(`/invoices/${created.id}`, { replace: true });
      } else {
        setInv(await api.put(`/api/invoices/${id}`, body));
      }
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const setStatus = async (status) => {
    try { setInv(await api.post(`/api/invoices/${id}/status`, { status })); }
    catch (err) { setError(err.message); }
  };

  const sendEmail = async () => {
    setError('');
    try {
      await api.post(`/api/invoices/${id}/email`);
      setInv(await api.get(`/api/invoices/${id}`));
      alert('Invoice emailed.');
    } catch (err) { setError(err.message); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${location.origin}/inv/${inv.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const remove = async () => {
    if (!confirm(`Delete invoice ${inv.number}?`)) return;
    await api.del(`/api/invoices/${id}`);
    navigate('/invoices');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/invoices" className="btn-ghost !p-2"><ArrowLeft size={16} /></Link>
          <h1 className="text-2xl font-semibold text-zinc-100">{isNew ? 'New invoice' : inv.number}</h1>
          {!isNew && <StatusBadge status={inv.status} />}
        </div>
        {!isNew && (
          <div className="flex gap-2">
            {inv.status !== 'paid' && (
              <button className="btn-ghost text-emerald-300" onClick={() => setStatus('paid')}>
                <CheckCircle2 size={15} /> Mark paid
              </button>
            )}
            {inv.stored_status === 'draft' && (
              <button className="btn-ghost text-blue-300" onClick={() => setStatus('sent')}>
                <Send size={15} /> Mark sent
              </button>
            )}
            <button className="btn-ghost" onClick={sendEmail}><Mail size={15} /> Email</button>
            <a className="btn-ghost" href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer">
              <Download size={15} /> PDF
            </a>
            <button className="btn-danger !px-3" onClick={remove}><Trash2 size={15} /></button>
          </div>
        )}
      </div>

      <div className="card p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="label">Client *</label>
            <select value={inv.client_id} onChange={set('client_id')}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
            {clients.length === 0 && (
              <div className="text-xs text-amber-400 mt-1">No clients yet — <Link to="/clients" className="underline">add one first</Link>.</div>
            )}
          </div>
          <div><label className="label">Issue date</label><input type="date" value={inv.issue_date} onChange={set('issue_date')} /></div>
          <div><label className="label">Due date</label><input type="date" value={inv.due_date} onChange={set('due_date')} /></div>
        </div>

        <div>
          <label className="label">Line items</label>
          <div className="space-y-2">
            {inv.items.map((it, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="flex-1" placeholder="Description of work…"
                  value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)}
                />
                <input
                  className="!w-20 text-right" type="number" min="0" step="any" placeholder="Qty"
                  value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)}
                />
                <input
                  className="!w-28 text-right" type="number" min="0" step="any" placeholder="Rate"
                  value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)}
                />
                <div className="w-24 text-right text-sm text-zinc-400 tabular-nums">
                  {money((Number(it.qty) || 0) * (Number(it.rate) || 0), currency)}
                </div>
                <button
                  className="btn-ghost !p-2" disabled={inv.items.length === 1}
                  onClick={() => setInv({ ...inv, items: inv.items.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-ghost mt-2" onClick={() => setInv({ ...inv, items: [...inv.items, { ...BLANK_ITEM }] })}>
            <Plus size={14} /> Add line
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Tax %</label><input type="number" min="0" step="any" value={inv.tax_percent} onChange={set('tax_percent')} /></div>
              <div><label className="label">Discount %</label><input type="number" min="0" step="any" value={inv.discount_percent} onChange={set('discount_percent')} /></div>
            </div>
            <div><label className="label">Notes (shown on invoice)</label><textarea rows={3} value={inv.notes} onChange={set('notes')} /></div>
          </div>
          <div className="bg-panel2 border border-edge rounded-xl p-5 self-start">
            <Row label="Subtotal" value={money(totals.subtotal, currency)} />
            {totals.discount > 0 && <Row label={`Discount (${inv.discount_percent}%)`} value={`−${money(totals.discount, currency)}`} tone="text-emerald-300" />}
            {totals.tax > 0 && <Row label={`Tax (${inv.tax_percent}%)`} value={money(totals.tax, currency)} />}
            <div className="border-t border-edge mt-3 pt-3 flex justify-between items-baseline">
              <span className="text-sm font-medium text-zinc-300">Total due</span>
              <span className="text-2xl font-semibold text-accent2 tabular-nums">{money(totals.total, currency)}</span>
            </div>
          </div>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <div className="flex items-center justify-between pt-2 border-t border-edge">
          {!isNew ? (
            <button className="btn-ghost" onClick={copyLink}>
              {copied ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Link2 size={15} />}
              {copied ? 'Copied!' : 'Copy public link'}
            </button>
          ) : <span />}
          <button className="btn-primary" onClick={save} disabled={saving || !inv.client_id}>
            {saving ? 'Saving…' : isNew ? 'Create invoice' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, tone = 'text-zinc-200' }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
