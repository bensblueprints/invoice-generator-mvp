import { useEffect, useState } from 'react';
import { Repeat, Plus, Trash2, Play, Pencil } from 'lucide-react';
import { api, money, computeTotals } from '../api.js';
import { PageHeader, Empty, Modal } from '../components/ui.jsx';

const BLANK = {
  client_id: '', items: [{ description: '', qty: 1, rate: 0 }],
  tax_percent: 0, discount_percent: 0, notes: '', due_days: 14,
  next_run: new Date().toISOString().slice(0, 10), auto_email: false, active: true,
};

export default function Recurring() {
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/api/recurring').then(setRows).catch(console.error);
  useEffect(() => {
    load();
    api.get('/api/clients').then(setClients).catch(console.error);
    api.get('/api/settings').then((s) => setCurrency(s.currency)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault(); setError('');
    try {
      const body = { ...editing, client_id: Number(editing.client_id) };
      if (editing.id) await api.put(`/api/recurring/${editing.id}`, body);
      else await api.post('/api/recurring', body);
      setEditing(null); load();
    } catch (err) { setError(err.message); }
  };

  const runNow = async (r) => {
    const created = await api.post(`/api/recurring/${r.id}/run`);
    alert(`Created draft invoice ${created.number}`);
    load();
  };

  const remove = async (r) => {
    if (!confirm('Delete this recurring template? Existing invoices are kept.')) return;
    await api.del(`/api/recurring/${r.id}`); load();
  };

  const toggleActive = async (r) => { await api.put(`/api/recurring/${r.id}`, { active: !r.active }); load(); };

  const setItem = (i, k, v) =>
    setEditing({ ...editing, items: editing.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });

  return (
    <>
      <PageHeader
        title="Recurring"
        subtitle="Monthly invoices, created automatically as drafts (emailed too, if you enable SMTP)."
        action={<button className="btn-primary" onClick={() => setEditing({ ...BLANK, items: [{ description: '', qty: 1, rate: 0 }] })}><Plus size={15} /> New template</button>}
      />

      {rows.length === 0 ? (
        <Empty icon={Repeat} title="No recurring templates" hint="Perfect for retainers — invoice the same client every month, hands-free." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className={`card p-5 flex items-center justify-between gap-4 ${r.active ? '' : 'opacity-50'}`}>
              <div className="min-w-0">
                <div className="font-semibold text-zinc-100">{r.client_name}</div>
                <div className="text-sm text-zinc-500 mt-0.5">
                  {money(computeTotals(r.items, r.tax_percent, r.discount_percent).total, currency)} / month
                  · next run {r.next_run}
                  · due {r.due_days} days after issue
                  {r.auto_email ? ' · auto-emails' : ''}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-ghost" onClick={() => toggleActive(r)}>{r.active ? 'Pause' : 'Resume'}</button>
                <button className="btn-ghost" title="Create this month's invoice now" onClick={() => runNow(r)}><Play size={14} /> Run now</button>
                <button className="btn-ghost !p-2" onClick={() => setEditing({ ...r, active: !!r.active, auto_email: !!r.auto_email })}><Pencil size={14} /></button>
                <button className="btn-danger !p-2" onClick={() => remove(r)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit template' : 'New recurring template'} wide>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="label">Client *</label>
                <select value={editing.client_id} onChange={(e) => setEditing({ ...editing, client_id: e.target.value })} required>
                  <option value="">Select…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label">Next run</label><input type="date" value={editing.next_run} onChange={(e) => setEditing({ ...editing, next_run: e.target.value })} /></div>
              <div><label className="label">Due (days)</label><input type="number" min="1" value={editing.due_days} onChange={(e) => setEditing({ ...editing, due_days: e.target.value })} /></div>
            </div>

            <div>
              <label className="label">Line items</label>
              {editing.items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center mb-2">
                  <input className="flex-1" placeholder="Description" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                  <input className="!w-16 text-right" type="number" min="0" step="any" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                  <input className="!w-24 text-right" type="number" min="0" step="any" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
                  <button type="button" className="btn-ghost !p-2" disabled={editing.items.length === 1}
                    onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={() => setEditing({ ...editing, items: [...editing.items, { description: '', qty: 1, rate: 0 }] })}>
                <Plus size={13} /> Add line
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Tax %</label><input type="number" min="0" step="any" value={editing.tax_percent} onChange={(e) => setEditing({ ...editing, tax_percent: e.target.value })} /></div>
              <div><label className="label">Discount %</label><input type="number" min="0" step="any" value={editing.discount_percent} onChange={(e) => setEditing({ ...editing, discount_percent: e.target.value })} /></div>
            </div>
            <div><label className="label">Notes</label><textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" className="!w-4 h-4" checked={!!editing.auto_email}
                onChange={(e) => setEditing({ ...editing, auto_email: e.target.checked })} />
              Auto-email the invoice when created (requires SMTP in Settings)
            </label>

            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary">{editing.id ? 'Save' : 'Create template'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
