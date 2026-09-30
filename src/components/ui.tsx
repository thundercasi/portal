import { type ReactNode, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Modal({
  title, onClose, children, wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:p-8 overflow-y-auto bg-slate-900/50 backdrop-blur-sm animate-in">
      <div className={`card w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} sm:my-auto rounded-b-none sm:rounded-2xl max-h-[92vh] sm:max-h-none overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="icon-btn"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}{hint && <span className="ml-1 text-slate-400 normal-case font-normal">{hint}</span>}</span>
      {children}
    </label>
  );
}

export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet';

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, subtitle, action }: { icon: typeof X; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="text-slate-400" size={26} />
      </div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, tone = 'slate', sub, onClick,
}: {
  label: string;
  value: string;
  icon: typeof X;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue';
  sub?: string;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-sky-100 text-sky-600',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`card p-5 text-left w-full ${onClick ? 'hover:border-slate-300 hover:shadow transition' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </Tag>
  );
}

export function ConfirmDelete({
  message, onConfirm, onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="btn-danger" onClick={onConfirm}>Excluir</button>
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={22} className="animate-spin text-slate-400" />
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{children}</p>;
}

export function Tabs<T extends string>({
  tabs, value, onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
            value === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Horizontal bar list — used for "cost by part / by equipment". */
export function BarList({
  rows, format, empty = 'Sem dados no período.',
}: {
  rows: { key: string; label: string; sub?: string; value: number }[];
  format: (v: number) => string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-slate-400 py-6 text-center">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700 truncate">
              {r.label}
              {r.sub && <span className="ml-2 text-xs font-normal text-slate-400">{r.sub}</span>}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums shrink-0">{format(r.value)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Monthly column chart in plain SVG with hover tooltip. */
export function MonthlyChart({
  data, format,
}: {
  data: { key: string; label: string; parts: number; labor: number }[];
  format: (v: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.parts + d.labor));
  const W = 640, H = 200, pad = 24;
  const colW = (W - pad) / Math.max(1, data.length);
  const barW = Math.min(36, colW * 0.6);
  const h = (v: number) => (v / max) * (H - pad);
  const hovered = data.find((d) => d.key === hover);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full h-auto" role="img" aria-label="Gasto mensal">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={W} y1={H - (H - pad) * f} y2={H - (H - pad) * f} stroke="#e2e8f0" strokeDasharray="3 4" />
        ))}
        <line x1={pad} x2={W} y1={H} y2={H} stroke="#cbd5e1" />
        {data.map((d, i) => {
          const x = pad + i * colW + (colW - barW) / 2;
          const hp = h(d.parts), hl = h(d.labor);
          const active = hover === d.key;
          return (
            <g key={d.key} onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)}>
              <rect x={pad + i * colW} y={0} width={colW} height={H} fill="transparent" />
              {hp > 0 && <rect x={x} y={H - hp} width={barW} height={hp} rx={3} fill={active ? '#0369a1' : '#0ea5e9'} />}
              {hl > 0 && <rect x={x} y={H - hp - hl} width={barW} height={hl} rx={3} fill={active ? '#334155' : '#94a3b8'} />}
              <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="#94a3b8">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="absolute top-0 right-0 card px-3 py-2 text-xs shadow-md pointer-events-none">
          <div className="font-semibold text-slate-900 mb-1">{hovered.label}</div>
          <div className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-sky-500" />Peças {format(hovered.parts)}</div>
          <div className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-400" />Mão de obra {format(hovered.labor)}</div>
          <div className="font-semibold text-slate-900 mt-1">Total {format(hovered.parts + hovered.labor)}</div>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-500" />Peças</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />Mão de obra / serviço</span>
      </div>
    </div>
  );
}
