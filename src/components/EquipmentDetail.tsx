import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Cpu, Pencil, Trash2, Plus, Hash, MapPin, CalendarDays, Wallet, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  supabase, type Equipment, type EquipmentMaintenance, type Plan, type ErrorLog, type ErrorCode,
  BRL, formatDate, EQUIPMENT_STATUS, maintenanceTotal, fmtQty, today,
} from '../lib/supabase';
import { loadMaintenances, loadPlans, loadErrorLogs, loadEquipments } from '../lib/data';
import { Badge, Loading, Tabs, StatCard, Modal, ConfirmDelete, EmptyState, BarList } from './ui';
import { EquipmentForm } from './Equipments';
import { MaintenanceList } from './Maintenances';
import { PlanList } from './Plans';
import { ErrorLogList, loadErrorCodes } from './Errors';
import MaintenanceForm from './MaintenanceForm';
import type { Go } from '../App';

export default function EquipmentDetail({ id, go }: { id: string; go: Go }) {
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [maint, setMaint] = useState<EquipmentMaintenance[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [codes, setCodes] = useState<ErrorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'history' | 'plans' | 'errors' | 'parts'>('history');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const [eqs, m, p, l, c] = await Promise.all([loadEquipments(), loadMaintenances({ equipmentId: id }), loadPlans(id), loadErrorLogs(id), loadErrorCodes()]);
    setEquipments(eqs);
    setEquipment(eqs.find((e) => e.id === id) ?? null);
    setMaint(m); setPlans(p); setLogs(l); setCodes(c);
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const stats = useMemo(() => {
    const total = maint.reduce((s, m) => s + maintenanceTotal(m), 0);
    const downtime = maint.reduce((s, m) => s + Number(m.downtime_hours), 0);
    const corrective = maint.filter((m) => m.kind === 'corretiva').length;
    const since = equipment?.acquired_at ?? maint[maint.length - 1]?.performed_at ?? today();
    const a = new Date(since + 'T00:00:00'), b = new Date();
    const months = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
    const tco = Number(equipment?.acquisition_cost ?? 0) + total;
    return { total, downtime, corrective, tco, perMonth: tco / months };
  }, [maint, equipment]);

  const byPart = useMemo(() => {
    const map = new Map<string, { label: string; qty: number; total: number }>();
    for (const m of maint) for (const i of m.items ?? []) {
      const key = i.part_id ?? 'd:' + i.description.trim().toLowerCase();
      const cur = map.get(key) ?? { label: i.description, qty: 0, total: 0 };
      cur.qty += Number(i.quantity);
      cur.total += Number(i.quantity) * Number(i.unit_cost);
      map.set(key, cur);
    }
    return [...map.entries()].map(([key, v]) => ({ key, label: v.label, sub: `${fmtQty(v.qty)} un`, value: v.total })).sort((a, b) => b.value - a.value);
  }, [maint]);

  const remove = async () => {
    await supabase.from('customer_equipments').delete().eq('id', id);
    go('equipments');
  };

  if (loading) return <Loading />;
  if (!equipment) {
    return <EmptyState icon={Cpu} title="Equipamento não encontrado" action={<button className="btn-secondary" onClick={() => go('equipments')}>Voltar</button>} />;
  }

  const st = EQUIPMENT_STATUS[equipment.status];
  const openErrors = logs.filter((l) => !l.resolved_at).length;

  return (
    <div>
      <button className="btn-ghost !px-2 -ml-2 mb-3 text-slate-500" onClick={() => go('equipments')}>
        <ArrowLeft size={16} /> Equipamentos
      </button>

      <div className="card p-5 sm:p-6 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Cpu size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{equipment.nickname}</h2>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <div className="text-sm text-slate-500">{[equipment.brand, equipment.machine_model].filter(Boolean).join(' · ') || 'Modelo não informado'}</div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              {equipment.serial_number && <span className="flex items-center gap-1"><Hash size={12} />S/N {equipment.serial_number}</span>}
              {equipment.location && <span className="flex items-center gap-1"><MapPin size={12} />{equipment.location}</span>}
              {equipment.acquired_at && <span className="flex items-center gap-1"><CalendarDays size={12} />Desde {formatDate(equipment.acquired_at)}</span>}
            </div>
            {equipment.notes && <p className="text-sm text-slate-500 mt-3">{equipment.notes}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Manutenção</button>
            <button className="icon-btn" title="Editar" onClick={() => setEditing(true)}><Pencil size={16} /></button>
            <button className="icon-btn" title="Excluir" onClick={() => setDeleting(true)}><Trash2 size={16} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Gasto em manutenção" value={BRL(stats.total)} icon={Wallet} tone="blue" sub={`${maint.length} registro(s) · ${stats.corrective} corretiva(s)`} />
        <StatCard label="Custo total" value={BRL(stats.tco)} icon={TrendingUp} sub={`${BRL(stats.perMonth)}/mês com aquisição`} />
        <StatCard label="Tempo parado" value={`${fmtQty(stats.downtime)} h`} icon={Clock} tone={stats.downtime ? 'amber' : 'slate'} />
        <StatCard label="Erros em aberto" value={String(openErrors)} icon={AlertTriangle} tone={openErrors ? 'red' : 'green'} sub={`${logs.length} no total`} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'history', label: 'Histórico', count: maint.length },
          { id: 'plans', label: 'Preventivas', count: plans.length },
          { id: 'errors', label: 'Erros', count: logs.length },
          { id: 'parts', label: 'Custo por peça' },
        ]} />
      </div>

      {tab === 'history' && <div className="card overflow-hidden"><MaintenanceList items={maint} onChanged={load} showEquipment={false} /></div>}
      {tab === 'plans' && <PlanList plans={plans} equipments={equipments} onChanged={load} showEquipment={false} defaultEquipmentId={id} />}
      {tab === 'errors' && <ErrorLogList logs={logs} equipments={equipments} codes={codes} onChanged={load} showEquipment={false} defaultEquipmentId={id} />}
      {tab === 'parts' && <div className="card p-5"><BarList rows={byPart} format={BRL} empty="Nenhuma peça lançada nas manutenções deste equipamento." /></div>}

      {editing && <EquipmentForm equipment={equipment} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {adding && <MaintenanceForm equipmentId={id} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {deleting && (
        <Modal title="Excluir equipamento" onClose={() => setDeleting(false)}>
          <ConfirmDelete
            message={`Excluir "${equipment.nickname}"? Todo o histórico de manutenções, planos e erros dele também será excluído. Se ele só saiu de uso, prefira mudar o status para Inativo.`}
            onCancel={() => setDeleting(false)}
            onConfirm={remove}
          />
        </Modal>
      )}
    </div>
  );
}
