import { useEffect, useRef, useState } from 'react';
import { Save, Upload, Trash2, Building2, Hash, Mail } from 'lucide-react';
import { api } from '../api.js';
import { PageHeader } from '../components/ui.jsx';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'INR', 'SGD', 'HKD', 'ZAR', 'BRL', 'MXN', 'PLN'];

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [logoBust, setLogoBust] = useState(0);
  const fileRef = useRef();

  useEffect(() => { api.get('/api/settings').then(setS).catch(console.error); }, []);
  if (!s) return null;

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setError('');
    try {
      await api.put('/api/settings', s);
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (err) { setError(err.message); }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    try {
      await api.post('/api/settings/logo', fd);
      setS({ ...s, has_logo: true });
      setLogoBust(Date.now());
    } catch (err) { setError(err.message); }
  };

  const removeLogo = async () => {
    await api.del('/api/settings/logo');
    setS({ ...s, has_logo: false });
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your business profile appears on every invoice and PDF." />
      <form onSubmit={save} className="space-y-6 max-w-3xl">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
            <Building2 size={15} className="text-accent2" /> Business profile
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-xl border-2 border-dashed border-edge hover:border-accent transition-colors
                  flex items-center justify-center cursor-pointer bg-panel2 overflow-hidden shrink-0"
                onClick={() => fileRef.current?.click()}
                title="Upload logo (PNG or JPEG)"
              >
                {s.has_logo
                  ? <img src={`/api/settings/logo?t=${logoBust}`} alt="logo" className="max-w-full max-h-full object-contain" />
                  : <Upload size={20} className="text-zinc-600" />}
              </div>
              <div>
                <div className="text-sm text-zinc-300 font-medium">Logo</div>
                <div className="text-xs text-zinc-500 mt-0.5">PNG or JPEG, up to 5 MB. Shown on invoices and PDFs.</div>
                {s.has_logo && (
                  <button type="button" className="btn-danger mt-2 !py-1 !px-2 text-xs" onClick={removeLogo}>
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg" className="hidden"
                onChange={(e) => uploadLogo(e.target.files?.[0])} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Business name</label><input value={s.name} onChange={set('name')} placeholder="Acme Studio LLC" /></div>
              <div><label className="label">Tax ID / VAT</label><input value={s.tax_id} onChange={set('tax_id')} placeholder="EIN 12-3456789" /></div>
            </div>
            <div><label className="label">Address</label><textarea rows={3} value={s.address} onChange={set('address')} placeholder={'123 Main St\nSpringfield, USA'} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Currency</label>
                <select value={s.currency} onChange={set('currency')}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Payment instructions / bank details</label>
              <textarea rows={4} value={s.payment_instructions} onChange={set('payment_instructions')}
                placeholder={'Bank transfer to:\nIBAN …\nor PayPal: you@example.com'} />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
            <Hash size={15} className="text-accent2" /> Invoice numbering
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Prefix</label><input value={s.invoice_prefix} onChange={set('invoice_prefix')} placeholder="INV-" /></div>
            <div><label className="label">Next number</label><input type="number" min="1" value={s.next_number} onChange={set('next_number')} /></div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Next invoice: <span className="text-zinc-300 font-mono">{s.invoice_prefix}{String(s.next_number).padStart(4, '0')}</span>
          </p>
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-1">
            <Mail size={15} className="text-accent2" /> Email (BYO SMTP)
          </h2>
          <p className="text-xs text-zinc-500 mb-4">Optional. Lets you email invoices and auto-send recurring ones. Works with any SMTP provider (Gmail app password, Mailgun, Postmark…).</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2"><label className="label">SMTP host</label><input value={s.smtp_host} onChange={set('smtp_host')} placeholder="smtp.example.com" /></div>
            <div><label className="label">Port</label><input type="number" value={s.smtp_port} onChange={set('smtp_port')} /></div>
            <div><label className="label">Username</label><input value={s.smtp_user} onChange={set('smtp_user')} /></div>
            <div><label className="label">Password</label><input type="password" value={s.smtp_pass} onChange={set('smtp_pass')} /></div>
            <div><label className="label">From address</label><input value={s.smtp_from} onChange={set('smtp_from')} placeholder="billing@you.com" /></div>
          </div>
        </section>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button className="btn-primary">
          <Save size={15} /> {saved ? 'Saved!' : 'Save settings'}
        </button>
      </form>
    </>
  );
}
