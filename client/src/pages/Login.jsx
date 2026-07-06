import { useState } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Lock } from 'lucide-react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/api/login', { password });
      onLogin();
    } catch {
      setError('Wrong password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="card p-8 w-full max-w-sm"
      >
        <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto">
          <Receipt size={22} className="text-accent2" />
        </div>
        <h1 className="text-xl font-semibold text-center mt-4 text-zinc-100">Invoice Generator</h1>
        <p className="text-sm text-zinc-500 text-center mt-1 mb-6">Self-hosted invoicing. Your data, your server.</p>
        <label className="label">Admin password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoFocus
        />
        {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
        <button className="btn-primary w-full justify-center mt-4" disabled={busy || !password}>
          <Lock size={15} /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </motion.form>
    </div>
  );
}
