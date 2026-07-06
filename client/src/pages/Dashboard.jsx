import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, CheckCircle2, AlertTriangle, FileText, Plus } from 'lucide-react';
import { api, money } from '../api.js';
import { PageHeader, StatCard, StatusBadge, Empty } from '../components/ui.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get('/api/dashboard').then(setData).catch(console.error); }, []);
  if (!data) return null;
  const cur = data.currency;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="What's owed, what's paid, what needs chasing."
        action={<Link to="/invoices/new" className="btn-primary"><Plus size={15} /> New invoice</Link>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Wallet} label="Outstanding" value={money(data.outstanding_total, cur)} tone="warn" />
        <StatCard icon={CheckCircle2} label="Paid this month" value={money(data.paid_this_month_total, cur)} tone="good" delay={0.05} />
        <StatCard icon={AlertTriangle} label="Overdue" value={data.overdue.length} tone={data.overdue.length ? 'bad' : 'default'} delay={0.1} />
      </div>

      {data.overdue.length > 0 && (
        <div className="card p-5 mb-8 border-red-900/40">
          <h2 className="text-sm font-semibold text-red-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={15} /> Overdue invoices
          </h2>
          <div className="divide-y divide-edge">
            {data.overdue.map((inv) => (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center justify-between py-2.5 hover:bg-panel2 -mx-2 px-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-zinc-200">{inv.number}</span>
                  <span className="text-sm text-zinc-500">{inv.client_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-red-400">due {inv.due_date}</span>
                  <span className="font-semibold text-zinc-100">{money(inv.totals.total, cur)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent invoices</h2>
      {data.recent.length === 0 ? (
        <Empty
          icon={FileText}
          title="No invoices yet"
          hint="Create your first invoice to get paid."
          action={<Link to="/invoices/new" className="btn-primary"><Plus size={15} /> New invoice</Link>}
        />
      ) : (
        <div className="card divide-y divide-edge overflow-hidden">
          {data.recent.map((inv) => (
            <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-panel2 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium text-zinc-200">{inv.number}</span>
                <span className="text-sm text-zinc-500 truncate">{inv.client_name}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <StatusBadge status={inv.status} />
                <span className="font-semibold text-zinc-100 w-28 text-right">{money(inv.totals.total, cur)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
