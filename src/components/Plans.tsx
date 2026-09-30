import { useEffect, useMemo, useState } from 'react';
import { Plus, CalendarClock, CheckCircle2, Pause, Play, Pencil, Trash2, Sparkles } from 'lucide-react';
import {
  supabase, type Equipment, type Plan, type PlanTemplate, formatDate, planState, today,
} from '../lib/supabase';
import { loadEquipments, loadPlans, modelKey } from '../lib/data';
import { Modal, Field, Badge, EmptyState, PageHeader, Loading, ErrorText, ConfirmDelete, Tabs } from './ui';
import MaintenanceForm from './MaintenanceForm';
import type { Go } from '../App';

function PlanForm({
  plan, equipments, defaultEquipmentId, onClose, onSaved,
}: {
  plan?: Plan | null;
  equipments: Equipment[];
  defaultEquipmentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [form, setForm] = useState({
    equipment_id: plan?.equipment_id ?? defaultEquipmentId ?? (equipments.length === 1 ? equipments[0].id : ''),
    template_id: plan?.template_id ?? '',
    title: plan?.title ?? '',
    description: plan?.description ?? '',
    interval_days: plan?.interval_days ?? 90,
    remind_days_before: plan?.remind_days_before ?? 7,
    start_date: plan?.start_date ?? today(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('maintenance_plan_templates').select('*').order('title')
      .then(({ data }) => setTemplates((data as PlanTemplate[]) ?? []));
  }, []);

  const equipment = equipments.find((e) => e.id === form.equipment_id);
  const matching = templates.filter((t) => equipment && modelKey(t.machine_model) === modelKey(equipment.machine_model));

  const applyTemplate = (t: PlanTemplate) =>
    setForm({ ...form, template_id: t.id, title: t.title, description: t.description ?? '', interval_days: t.interval_days });

  const save = async () => {
    setError('');
    if (!form.equipment_id) { setError('Selecione o equipamento.'); return; }
    if (!form.title.trim()) { setError('Dê um nome ao plano.'); return; }
    if (!(form.interval_days > 0)) { setError('Intervalo deve ser maior que zero.'); return; }
    setSaving(true);
    const payload = {
      equipment_id: form.equipment_id,
      template_id: form.template_id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      interval_days: Number(form.interval_days),
      remind_days_before: Number(form.remind_days_before) || 0,
      start_date: form.start_date,
    };
    const res = plan
      ? await supabase.from('maintenance_plans').update(payload).eq('id', plan.id)
      : await supabase.from('maintenance_plans').insert(payload);
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    onSaved();
  };

  return (
    <Modal title={plan ? 'Editar plano preventivo' : 'Novo plano preventivo'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Equipamento">
          <select className="input" value={form.equipment_id} disabled={!!plan} onChange={(e) => setForm({ ...form, equipment_id: e.target.value, template_id: '' })}>
            <option value="">Selecione…</option>
            {equipments.map((e) => <option key={e.id} value={e.id}>{e.nickname}{e.machine_model ? ` — ${e.machine_model}` : ''}</option>)}
          </select>
        </Field>

        {!plan && matching.length > 0 && (
          <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-700 uppercase tracking-wide mb-2">
              <Sparkles size={14} /> Recomendados pela Laser Tools para {equipment?.machine_model}
            </div>
            <div className="flex flex-wrap gap-2">
              {matching.map((t) => (
                <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    form.template_id === t.id ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-100'
                  }`}>
                  {t.title} · {t.interval_days}d
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Nome do plano">
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Limpeza de lentes e espelhos" />
        </Field>
        <Field label="Descrição / checklist" hint="(opcional)">
          <textarea className="input min-h-[70px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Repetir a cada (dias)">
            <input type="number" min={1} className="input" value={form.interval_days} onChange={(e) => setForm({ ...form, interval_days: Number(e.target.value) })} />
          </Field>
          <Field label="Avisar antes (dias)">
            <input type="number" min={0} className="input" value={form.remind_days_before} onChange={(e) => setForm({ ...form, remind_days_before: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label={plan ? 'Início do plano' : 'Última vez feita (ou início)'}>
          <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}

export function PlanList({
  plans, equipments, onChanged, showEquipment = true, focusId, defaultEquipmentId,
}: {
  plans: Plan[];
  equipments: Equipment[];
  onChanged: () => void;
  showEquipment?: boolean;
  focusId?: string;
  defaultEquipmentId?: string;
}) {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [doing, setDoing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);

  const toggle = async (p: Plan) => {
    await supabase.from('maintenance_plans').update({ active: !p.active }).eq('id', p.id);
    onChanged();
  };
  const remove = async () => {
    if (!deleting) return;
    await supabase.from('maintenance_plans').delete().eq('id', deleting.id);
    setDeleting(null);
    onChanged();
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <button className="btn-secondary" onClick={() => setCreating(true)}><Plus size={16} /> Novo plano</button>
      </div>
      {plans.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nenhum plano preventivo" subtitle="Crie planos (ex.: limpeza a cada 30 dias) e avisaremos por e-mail e aqui no portal antes do vencimento." />
      ) : (
        <div className="grid gap-3">
          {plans.map((p) => {
            const s = planState(p);
            return (
              <div key={p.id} className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${focusId === p.id ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200'} ${p.active ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{p.title}</span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {showEquipment && p.equipment && <>{p.equipment.nickname} · </>}
                    A cada {p.interval_days} dias · Última: {formatDate(p.last_done_at)} · Próxima: <span className="font-semibold text-slate-700">{formatDate(p.next_due_at)}</span>
                  </div>
                  {p.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.active && (
                    <button className="btn-primary !py-2 !px-3 text-xs" onClick={() => setDoing(p)}>
                      <CheckCircle2 size={14} /> Registrar execução
                    </button>
                  )}
                  <button className="icon-btn" title={p.active ? 'Pausar' : 'Reativar'} onClick={() => toggle(p)}>{p.active ? <Pause size={15} /> : <Play size={15} />}</button>
                  <button className="icon-btn" title="Editar" onClick={() => setEditing(p)}><Pencil size={15} /></button>
                  <button className="icon-btn" title="Excluir" onClick={() => setDeleting(p)}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <PlanForm
          plan={editing}
          equipments={equipments.filter((e) => e.status !== 'inativo')}
          defaultEquipmentId={defaultEquipmentId}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); onChanged(); }}
        />
      )}
      {doing && (
        <MaintenanceForm
          equipmentId={doing.equipment_id}
          planId={doing.id}
          onClose={() => setDoing(null)}
          onSaved={() => { setDoing(null); onChanged(); }}
        />
      )}
      {deleting && (
        <Modal title="Excluir plano" onClose={() => setDeleting(null)}>
          <ConfirmDelete
            message={`Excluir o plano "${deleting.title}"? As manutenções já registradas continuam no histórico.`}
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
          />
        </Modal>
      )}
    </>
  );
}

export default function Plans({ focusId }: { go: Go; focusId?: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'attention' | 'all' | 'paused'>('attention');

  const load = async () => {
    const [p, e] = await Promise.all([loadPlans(), loadEquipments()]);
    setPlans(p); setEquipments(e);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    const active = plans.filter((p) => p.active && p.equipment?.status !== 'inativo');
    const attention = active.filter((p) => { const s = planState(p); return s.tone === 'red' || s.tone === 'amber'; });
    return { attention, all: active, paused: plans.filter((p) => !p.active) };
  }, [plans]);

  // Opening from a notification: show the tab that contains the plan.
  useEffect(() => {
    if (!focusId || loading) return;
    if (groups.attention.some((p) => p.id === focusId)) setTab('attention');
    else if (groups.paused.some((p) => p.id === focusId)) setTab('paused');
    else setTab('all');
  }, [focusId, loading, groups]);

  if (loading) return <Loading />;

  const overdue = groups.attention.filter((p) => planState(p).tone === 'red').length;

  return (
    <div>
      <PageHeader
        title="Manutenções preventivas"
        subtitle={overdue ? `${overdue} plano(s) atrasado(s)` : 'Planos periódicos dos seus equipamentos'}
      />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'attention', label: 'Precisam de atenção', count: groups.attention.length },
            { id: 'all', label: 'Todos ativos', count: groups.all.length },
            { id: 'paused', label: 'Pausados', count: groups.paused.length },
          ]}
        />
      </div>
      <PlanList plans={groups[tab]} equipments={equipments} onChanged={load} focusId={focusId} />
    </div>
  );
}
