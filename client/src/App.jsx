import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, FileText, Repeat, Settings as SettingsIcon, LogOut, Receipt,
} from 'lucide-react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceEditor from './pages/InvoiceEditor.jsx';
import Recurring from './pages/Recurring.jsx';
import Settings from './pages/Settings.jsx';
import PublicInvoice from './pages/PublicInvoice.jsx';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/recurring', icon: Repeat, label: 'Recurring' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

function Shell({ children, desktop, onLogout }) {
  const location = useLocation();
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-edge bg-panel/60 backdrop-blur flex flex-col fixed inset-y-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-edge">
          <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
            <Receipt size={18} className="text-accent2" />
          </div>
          <div>
            <div className="font-semibold text-zinc-100 leading-tight">Invoice Generator</div>
            <div className="text-[11px] text-zinc-500">Pay once. Own it forever.</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent/15 text-accent2 border border-accent/20'
                           : 'text-zinc-400 hover:text-zinc-200 hover:bg-panel2 border border-transparent'
                }`
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        {!desktop && (
          <button onClick={onLogout} className="m-3 btn-ghost justify-center">
            <LogOut size={15} /> Log out
          </button>
        )}
        {desktop && (
          <div className="m-3 text-center text-[11px] text-zinc-600">Desktop mode · data stays on this machine</div>
        )}
      </aside>
      <main className="flex-1 ml-60 p-8 max-w-6xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null); // null=loading, {authed, desktop}
  const location = useLocation();
  const isPublic = location.pathname.startsWith('/inv/');

  useEffect(() => {
    if (isPublic) return;
    api.get('/api/me').then(setAuth).catch(() => setAuth({ authed: false }));
    const onUnauth = () => setAuth((a) => ({ ...a, authed: false }));
    window.addEventListener('ig:unauthorized', onUnauth);
    return () => window.removeEventListener('ig:unauthorized', onUnauth);
  }, [isPublic]);

  if (isPublic) {
    return (
      <Routes>
        <Route path="/inv/:token" element={<PublicInvoice />} />
      </Routes>
    );
  }

  if (!auth) return <div className="min-h-screen grid place-items-center text-zinc-500">Loading…</div>;
  if (!auth.authed) return <Login onLogin={() => setAuth({ ...auth, authed: true })} />;

  const logout = async () => { await api.post('/api/logout'); setAuth({ ...auth, authed: false }); };

  return (
    <Shell desktop={auth.desktop} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceEditor />} />
        <Route path="/invoices/:id" element={<InvoiceEditor />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/recurring" element={<Recurring />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Shell>
  );
}
