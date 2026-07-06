import { motion } from 'framer-motion';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES = {
  draft: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  sent: 'bg-blue-950/50 text-blue-300 border-blue-900/50',
  paid: 'bg-emerald-950/50 text-emerald-300 border-emerald-900/50',
  overdue: 'bg-red-950/50 text-red-300 border-red-900/50',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {status}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'default', delay = 0 }) {
  const tones = {
    default: 'text-zinc-100',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-red-300',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="card p-5 flex items-start gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-panel2 border border-edge flex items-center justify-center shrink-0">
        <Icon size={18} className="text-accent2" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{label}</div>
        <div className={`text-2xl font-semibold mt-0.5 truncate ${tones[tone]}`}>{value}</div>
      </div>
    </motion.div>
  );
}

export function Empty({ icon: Icon, title, hint, action }) {
  return (
    <div className="card p-12 text-center">
      <Icon size={32} className="mx-auto text-zinc-700" />
      <div className="mt-3 text-zinc-400 font-medium">{title}</div>
      {hint && <div className="text-sm text-zinc-600 mt-1">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`card p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[85vh] overflow-y-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h2>
        {children}
      </motion.div>
    </div>
  );
}
