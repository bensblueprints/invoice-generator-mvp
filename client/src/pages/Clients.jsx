import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader, Empty, Modal } from '../components/ui.jsx';

const BLANK = { name: '', company: '', email: '', address: '', phone: '', notes: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [editing, setEditing] = useState(null); // null | {…client}
  const [error, setError] = useState('');

  const load = () => api.get('/api/clients').then(setClients).catch(console.error);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing.id) await api.put(`/api/clients/${editing.id}`, editing);
      else await api.post('/api/clients', editing);
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (c) => {
    if (!confirm(`Delete client "${c.name}"?`)) return;
    try { await api.del(`/api/clients/${c.id}`); load(); }
    catch (err) { alert(err.message); }
  };

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length === 1 ? '' : 's'}`}
        action={<button className="btn-primary" onClick={() => setEditing({ ...BLANK })}><Plus size={15} /> Add client</button>}
      />

      {clients.length === 0 ? (
        <Empty icon={Users} title="No clients yet" hint="Add the people and companies you bill." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((c) => (
            <div key={c.id} className="card p-5 group">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-100 truncate">{c.name}</div>
                  {c.company && <div className="text-sm text-zinc-500">{c.company}</div>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="btn-ghost !p-2" onClick={() => setEditing({ ...c })}><Pencil size={14} /></button>
                  <button className="btn-danger !p-2" onClick={() => remove(c)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-zinc-400">
                {c.email && <div className="flex items-center gap-2"><Mail size={13} className="text-zinc-600" /> {c.email}</div>}
                {c.phone && <div className="flex items-center gap-2"><Phone size={13} className="text-zinc-600" /> {c.phone}</div>}
                {c.address && <div className="text-zinc-500 whitespace-pre-line text-xs mt-2">{c.address}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit client' : 'Add client'}>
        {editing && (
          <form onSubmit={save} className="space-y-3">
            <div><label className="label">Name *</label><input value={editing.name} onChange={set('name')} required autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Company</label><input value={editing.company} onChange={set('company')} /></div>
              <div><label className="label">Phone</label><input value={editing.phone} onChange={set('phone')} /></div>
            </div>
            <div><label className="label">Email</label><input type="email" value={editing.email} onChange={set('email')} /></div>
            <div><label className="label">Billing address</label><textarea rows={3} value={editing.address} onChange={set('address')} /></div>
            <div><label className="label">Notes</label><textarea rows={2} value={editing.notes} onChange={set('notes')} /></div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary">{editing.id ? 'Save changes' : 'Add client'}</button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
