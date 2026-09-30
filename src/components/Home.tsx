import { useEffect, useMemo, useState } from 'react';
import { Cpu, CalendarClock, Wallet, AlertTriangle, ChevronRight, Wrench, ShieldCheck, Plus } from 'lucide-react';
import {
  type Equipment, type Plan, type EquipmentMaintenance, type ErrorLog, type Purchase,
  BRL, formatDate, planState, maintenanceTotal, daysUntil,
} from '../lib/supabase';
import { loadEquipments, loadPlans, loadMaintenances, loadErrorLogs, loadPurchases } from '../lib/data';
import { StatCard, Loading, Badge, EmptyState } from './ui';
import { EquipmentForm } from './Equipments';
import type { Go } from '../App';

export default function Home({ go, customerName }: { go: Go; customerName: string }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [maint, setMaint] = useState<EquipmentMaintenance[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingEquipment, setCreatingEquipment] = useState(false);

  useEffect(() => {
    (async () => {
      const [e, p, m, er, pu] = await Promise.all([loadEquipments(), loadPlans(), loadMaintenances(), loadErrorLogs(), loadPurchases()]);
      setEquipments(e); setPlans(p); setMaint(m); setErrors(er); setPurchases(pu);
      setLoading(false);
    })();
  }, []);

  const data = useMemo(() => {
    const year = String(new Date().getFullYear());
    const activePlans = plans.filter((p) => p.active && p.equipment?.status !== 'inativo');
    const withState = activePlans.map((p) => ({ p, s: planState(p) })).sort((a, b) => (a.s.days ?? 1e9) - (b.s.days ?? 1e9));
    return {
      active: equipments.filter((e) => e.status === 'ativo').length,
      stopped: equipments.filter((e) => e.status === 'parado').length,
      overdue: withState.filter((x) => x.s.tone === 'red').length,
      soon: withState.filter((x) => x.s.tone === 'amber').length,
      upcoming: withState.slice(0, 6),
      spentYear: maint.filter((m) => m.performed_at.startsWith(year)).reduce((s, m) => s + maintenanceTotal(m), 0),
      openErrors: errors.filter((e) => !e.resolved_at),
      recent: maint.slice(0, 5),
      warrantyEnding: purchases.filter((p) => { const d = daysUntil(p.warranty_until); return d !== null && d >= 0 && d <= 30; }),
    };
  }, [equipments, plans, maint, errors, purchases]);

  if (loading) return <Loading />;

  const firstName = customerName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  if (equipments.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{greeting}, {firstName}!</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">Bem-vindo ao Portal do Cliente Laser Tools.</p>
        <div className="card">
          <EmptyState
            icon={Cpu}
            title="Comece cadastrando seus equipamentos"
            subtitle="Depois disso você registra manutenções, cria planos preventivos com alertas por e-mail, acompanha custos por peça e recebe sugestões de estoque."
            action={<button className="btn-primary" onClick={() => setCreatingEquipment(true)}><Plus size={16} /> Cadastrar equipamento</button>}
          />
        </div>
        {creatingEquipment && <EquipmentForm onClose={() => setCreatingEquipment(false)} onSaved={(id) => go('equipment', id)} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{greeting}, {firstName}!</h2>
        <p className="text-sm text-slate-500 mt-1">
          {data.overdue > 0
            ? `Você tem ${data.overdue} manutenção(ões) preventiva(s) atrasada(s).`
            : data.soon > 0
              ? `${data.soon} manutenção(ões) preventiva(s) vencendo em breve.`
              : 'Tudo em dia com seus equipamentos.'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Equipamentos" value={String(data.active)} icon={Cpu} tone="blue" sub={data.stopped ? `${data.stopped} parado(s)` : 'operando'} onClick={() => go('equipments')} />
        <StatCard label="Preventivas" value={String(data.overdue + data.soon)} icon={CalendarClock} tone={data.overdue ? 'red' : data.soon ? 'amber' : 'green'} sub={data.overdue ? `${data.overdue} atrasada(s)` : 'precisam de atenção'} onClick={() => go('plans')} />
        <StatCard label={`Gasto em ${new Date().getFullYear()}`} value={BRL(data.spentYear)} icon={Wallet} sub="em manutenções" onClick={() => go('costs')} />
        <StatCard label="Erros em aberto" value={String(data.openErrors.length)} icon={AlertTriangle} tone={data.openErrors.length ? 'red' : 'green'} onClick={() => go('errors')} />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <span className="text-sm font-bold text-slate-900">Próximas preventivas</span>
            <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center" onClick={() => go('plans')}>Ver todas <ChevronRight size={14} /></button>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nenhum plano preventivo" subtitle="Crie planos para receber alertas antes do vencimento." action={<button className="btn-secondary" onClick={() => go('plans')}>Criar plano</button>} />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.upcoming.map(({ p, s }) => (
                <button key={p.id} onClick={() => go('plans', p.id)} className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 truncate">{p.title}</div>
                    <div className="text-xs text-slate-400">{p.equipment?.nickname} · {formatDate(p.next_due_at)}</div>
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {data.openErrors.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 text-sm font-bold text-slate-900">Erros em aberto</div>
              <div className="divide-y divide-slate-100">
                {data.openErrors.slice(0, 4).map((e) => (
                  <button key={e.id} onClick={() => go('errors')} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{e.error_code ? `${e.error_code.code} — ${e.error_code.title}` : e.custom_code}</div>
                      <div className="text-xs text-slate-400">{e.equipment?.nickname}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {data.warrantyEnding.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3"><ShieldCheck size={16} className="text-sky-600" /> Garantias terminando</div>
              <div className="space-y-2">
                {data.warrantyEnding.slice(0, 4).map((p) => (
                  <div key={p.sale_item_id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700 truncate">{p.part_name}</span>
                    <span className="text-xs text-amber-700 shrink-0">até {formatDate(p.warranty_until)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900">Últimas manutenções</span>
              <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center" onClick={() => go('maintenances')}>Ver todas <ChevronRight size={14} /></button>
            </div>
            {data.recent.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhuma manutenção registrada ainda.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recent.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-center gap-3">
                    <Wrench size={15} className={m.kind === 'preventiva' ? 'text-emerald-500' : 'text-amber-500'} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800 truncate">{m.description}</div>
                      <div className="text-xs text-slate-400">{m.equipment?.nickname} · {formatDate(m.performed_at)}</div>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 shrink-0">{BRL(maintenanceTotal(m))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
