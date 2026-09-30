import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock, ShieldCheck, Info, CheckCheck } from 'lucide-react';
import { supabase, type Notification, formatDateTime } from '../lib/supabase';
import { PageHeader, EmptyState, Loading } from './ui';
import type { Go } from '../App';

export type NotificationsState = ReturnType<typeof useNotifications>;

export function useNotifications(customerId: string) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as Notification[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications:${customerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `customer_id=eq.${customerId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [customerId, load]);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    await supabase.from('notifications').update({ read_at: now }).in('id', ids);
  };

  const unread = items.filter((n) => !n.read_at);
  return { items, loading, unread, markRead, reload: load };
}

const ICONS: Record<string, { icon: typeof Bell; cls: string }> = {
  plan_due: { icon: CalendarClock, cls: 'bg-amber-100 text-amber-600' },
  plan_overdue: { icon: CalendarClock, cls: 'bg-red-100 text-red-600' },
  warranty_ending: { icon: ShieldCheck, cls: 'bg-sky-100 text-sky-600' },
};

// `link` is written server-side as "<view>" or "<view>:<id>".
const follow = (link: string | null, go: Go) => {
  if (!link) return;
  const [view, id] = link.split(':');
  go(view as Parameters<Go>[0], id);
};

function Row({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const meta = ICONS[n.type] ?? { icon: Info, cls: 'bg-slate-100 text-slate-500' };
  const Icon = meta.icon;
  return (
    <button onClick={onOpen} className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 transition ${n.read_at ? '' : 'bg-sky-50/50'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className={`text-sm ${n.read_at ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</div>
          {!n.read_at && <span className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />}
        </div>
        {n.body && <div className="text-xs text-slate-500 mt-0.5">{n.body}</div>}
        <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</div>
      </div>
    </button>
  );
}

export function NotificationBell({ state, go }: { state: NotificationsState; go: Go }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = state.unread.length;
  return (
    <div className="relative" ref={ref}>
      <button className="relative icon-btn w-10 h-10" onClick={() => setOpen(!open)} aria-label="Notificações">
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] card shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <span className="text-sm font-bold text-slate-900">Notificações</span>
            {count > 0 && (
              <button className="text-xs font-semibold text-sky-600 hover:text-sky-700" onClick={() => state.markRead(state.unread.map((n) => n.id))}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {state.items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Nenhuma notificação.</p>
            ) : (
              state.items.slice(0, 8).map((n) => (
                <Row key={n.id} n={n} onOpen={() => { state.markRead([n.id]); setOpen(false); follow(n.link, go); }} />
              ))
            )}
          </div>
          <button className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 border-t border-slate-200" onClick={() => { setOpen(false); go('notifications'); }}>
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotificationsScreen({ state, go }: { state: NotificationsState; go: Go }) {
  if (state.loading) return <Loading />;
  return (
    <div>
      <PageHeader
        title="Notificações"
        subtitle="Alertas de manutenção preventiva e garantia das suas peças."
        action={
          state.unread.length > 0 && (
            <button className="btn-secondary" onClick={() => state.markRead(state.unread.map((n) => n.id))}>
              <CheckCheck size={16} /> Marcar todas como lidas
            </button>
          )
        }
      />
      <div className="card overflow-hidden divide-y divide-slate-100">
        {state.items.length === 0 ? (
          <EmptyState icon={Bell} title="Tudo em dia" subtitle="Quando uma manutenção estiver chegando, avisamos aqui e por e-mail." />
        ) : (
          state.items.map((n) => <Row key={n.id} n={n} onOpen={() => { state.markRead([n.id]); follow(n.link, go); }} />)
        )}
      </div>
    </div>
  );
}
