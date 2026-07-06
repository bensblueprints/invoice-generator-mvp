import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Receipt } from 'lucide-react';
import { api, money } from '../api.js';
import { StatusBadge } from '../components/ui.jsx';

export default function PublicInvoice() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/api/public/${token}`).then(setData).catch(() => setNotFound(true));
  }, [token]);

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center text-center p-4">
        <div>
          <Receipt size={40} className="mx-auto text-zinc-700" />
          <div className="mt-3 text-zinc-400 font-medium">Invoice not found</div>
          <div className="text-sm text-zinc-600">This link may have been removed.</div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { invoice: inv, client, business } = data;
  const cur = business.currency;

  return (
    <div className="min-h-screen py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <StatusBadge status={inv.status} />
          <a className="btn-primary" href={`/inv/${token}/pdf`} target="_blank" rel="noreferrer">
            <Download size={15} /> Download PDF
          </a>
        </div>

        <div className="card overflow-hidden">
          <div className="h-1.5 bg-accent" />
          <div className="p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                {business.has_logo && (
                  <img src={`/api/public/${token}/logo`} alt="" className="w-16 h-16 object-contain rounded-lg bg-white/5 p-1" />
                )}
                <div>
                  <div className="text-lg font-semibold text-zinc-100">{business.name || 'Invoice'}</div>
                  {business.address && <div className="text-xs text-zinc-500 whitespace-pre-line mt-1">{business.address}</div>}
                  {business.tax_id && <div className="text-xs text-zinc-600 mt-1">Tax ID: {business.tax_id}</div>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-accent2">INVOICE</div>
                <div className="text-sm text-zinc-300 mt-1">{inv.number}</div>
                <div className="text-xs text-zinc-500 mt-2">Issued {inv.issue_date}</div>
                <div className="text-xs text-zinc-500">Due {inv.due_date}</div>
              </div>
            </div>

            <div className="mt-8">
              <div className="label">Billed to</div>
              <div className="font-medium text-zinc-200">{client.name}</div>
              {client.company && <div className="text-sm text-zinc-500">{client.company}</div>}
              {client.address && <div className="text-xs text-zinc-500 whitespace-pre-line mt-1">{client.address}</div>}
            </div>

            <table className="w-full text-sm mt-8">
              <thead>
                <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-edge">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium text-right">Qty</th>
                  <th className="py-2 font-medium text-right">Rate</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {inv.items.map((it, i) => (
                  <tr key={i}>
                    <td className="py-3 text-zinc-200">{it.description}</td>
                    <td className="py-3 text-right text-zinc-400 tabular-nums">{it.qty}</td>
                    <td className="py-3 text-right text-zinc-400 tabular-nums">{money(it.rate, cur)}</td>
                    <td className="py-3 text-right text-zinc-100 font-medium tabular-nums">{money((Number(it.qty) || 0) * (Number(it.rate) || 0), cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mt-6">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><span className="text-zinc-200 tabular-nums">{money(inv.totals.subtotal, cur)}</span></div>
                {inv.totals.discount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">Discount ({inv.discount_percent}%)</span><span className="text-emerald-300 tabular-nums">−{money(inv.totals.discount, cur)}</span></div>
                )}
                {inv.totals.tax > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">Tax ({inv.tax_percent}%)</span><span className="text-zinc-200 tabular-nums">{money(inv.totals.tax, cur)}</span></div>
                )}
                <div className="flex justify-between items-baseline border-t border-edge pt-2 mt-2">
                  <span className="text-sm font-medium text-zinc-300">Total due</span>
                  <span className="text-xl font-semibold text-accent2 tabular-nums">{money(inv.totals.total, cur)}</span>
                </div>
              </div>
            </div>

            {inv.notes && (
              <div className="mt-8">
                <div className="label">Notes</div>
                <div className="text-sm text-zinc-400 whitespace-pre-line">{inv.notes}</div>
              </div>
            )}
            {business.payment_instructions && (
              <div className="mt-6 bg-panel2 border border-edge rounded-xl p-4">
                <div className="label">Payment details</div>
                <div className="text-sm text-zinc-300 whitespace-pre-line">{business.payment_instructions}</div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-zinc-600 mt-6">
          Powered by Invoice Generator — self-hosted invoicing
        </div>
      </motion.div>
    </div>
  );
}
