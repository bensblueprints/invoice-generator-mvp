import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { api, money } from '../api.js';
import { PageHeader, StatusBadge, Empty } from '../components/ui.jsx';

const FILTERS = ['all', 'draft', 'sent', 'overdue', 'paid'];

export default function Invoices() {
  const [invoices, setInvoices] = useState(null);
  const [filter, setFilter] = useState('all');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    api.get('/api/invoices').then(setInvoices).catch(console.error);
    api.get('/api/settings').then((s) => setCurrency(s.currency)).catch(() => {});
  }, []);

  const shown = useMemo(
    () => (invoices || []).filter((i) => filter === 'all' || i.status === filter),
    [invoices, filter]
  );

  if (!invoices) return null;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total`}
        action={<Link to="/invoices/new" className="btn-primary"><Plus size={15} /> New invoice</Link>}
      />

      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f ? 'bg-accent/20 text-accent2 border border-accent/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty
          icon={FileText}
          title={filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}
          action={filter === 'all' && <Link to="/invoices/new" className="btn-primary"><Plus size={15} /> New invoice</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-edge">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-3 py-3 font-medium">Client</th>
                <th className="px-3 py-3 font-medium">Issued</th>
                <th className="px-3 py-3 font-medium">Due</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {shown.map((inv) => (
                <tr key={inv.id} className="hover:bg-panel2 transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-medium text-zinc-100 hover:text-accent2">{inv.number}</Link>
                  </td>
                  <td className="px-3 py-3 text-zinc-400">{inv.client_name}</td>
                  <td className="px-3 py-3 text-zinc-500">{inv.issue_date}</td>
                  <td className="px-3 py-3 text-zinc-500">{inv.due_date}</td>
                  <td className="px-3 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-3 text-right font-semibold text-zinc-100">{money(inv.totals.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
