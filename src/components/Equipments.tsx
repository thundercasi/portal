import { useEffect, useMemo, useState } from 'react';
import { Plus, Cpu, Search, MapPin, Hash, ChevronRight } from 'lucide-react';
import {
  supabase, type Equipment, type EquipmentStatus, type Plan, type EquipmentMaintenance,
  BRL, EQUIPMENT_STATUS, planState, maintenanceTotal,
} from '../lib/supabase';
import { loadEquipments, loadPlans, loadMaintenances } from '../lib/data';
import { Modal, Field, Badge, EmptyState, PageHeader, Loading, ErrorText } from './ui';
import type { Go } from '../App';

const emptyForm = {
  nickname: '', brand: '', machine_model: '', serial_number: '', acquired_at: '',
  acquisition_cost: 0, location: '', status: 'ativo' as EquipmentStatus, notes: '',
};

export function EquipmentForm({
  equipment, onClose, onSaved,
}: {
  equipment?: Equipment | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState(() =>
    equipment
      ? {
          nickname: equipment.nickname, brand: equipment.brand ?? '', machine_model: equipment.machine_model ?? '',
          serial_number: equipment.serial_number ?? '', acquired_at: equipment.acquired_at ?? '',
          acquisition_cost: Number(equipment.acquisition_cost), location: equipment.location ?? '',
          status: equipment.status, notes: equipment.notes ?? '',
        }
      : emptyForm,
  );
  const [models, setModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Suggest the models Laser Tools already knows (templates / error codes),
  // so the customer's equipment matches plans and stock recommendations.
  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: e }] = await Promise.all([
        supabase.from('maintenance_plan_templates').select('machine_model'),
        supabase.from('error_codes').select('machine_model'),
      ]);
      const set = new Set<string>();
      for (const r of [...(t ?? []), ...(e ?? [])] as { machine_model: string | null }[]) {
        if (r.machine_model) set.add(r.machine_model);
      }
      setModels([...set].sort());
    })();
  }, []);

  const save = async () => {
    setError('');
    if (!form.nickname.trim()) { setError('Dê um nome para identificar o equipamento.'); return; }
    setSaving(true);
    const payload = {
      nickname: form.nickname.trim(),
      brand: form.brand.trim() || null,
      machine_model: form.machine_model.trim() || null,
      serial_number: form.serial_number.trim() || null,
      acquired_at: form.acquired_at || null,
      acquisition_cost: Number(form.acquisition_cost) || 0,
      location: form.location.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const res = equipment
      ? await supabase.from('customer_equipments').update(payload).eq('id', equipment.id).select('id').single()
      : await supabase.from('customer_equipments').insert(payload).select('id').single();
    setSaving(false);
    if (res.error) { setError(res.error.message); return; }
    onSaved(res.data.id as string);
  };

  return (
    <Modal title={equipment ? 'Editar equipamento' : 'Novo equipamento'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome / apelido">
            <input className="input" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Ex.: Laser sala 2" />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentStatus })}>
              {Object.entries(EQUIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Marca">
            <input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label="Modelo" hint="(usado nos planos e sugestões)">
            <input className="input" list="known-models" value={form.machine_model} onChange={(e) => setForm({ ...form, machine_model: e.target.value })} />
            <datalist id="known-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="Nº de série">
            <input className="input" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          </Field>
          <Field label="Localização">
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Unidade, sala…" />
          </Field>
          <Field label="Data de aquisição">
            <input type="date" className="input" value={form.acquired_at} onChange={(e) => setForm({ ...form, acquired_at: e.target.value })} />
          </Field>
          <Field label="Valor de aquisição (R$)" hint="(para custo total)">
            <input type="number" min={0} step="0.01" className="input" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Observações">
          <textarea className="input min-h-[70px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

export default function Equipments({ go }: { go: Go }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [maint, setMaint] = useState<EquipmentMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const [e, p, m] = await Promise.all([loadEquipments(), loadPlans(), loadMaintenances()]);
      setItems(e); setPlans(p); setMaint(m);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((e) => showInactive || e.status !== 'inativo')
      .filter((e) => !q || [e.nickname, e.brand, e.machine_model, e.serial_number, e.location].some((v) => (v ?? '').toLowerCase().includes(q)))
      .map((e) => {
        const ePlans = plans.filter((p) => p.equipment_id === e.id && p.active);
        const next = ePlans.map((p) => ({ p, s: planState(p) })).sort((a, b) => (a.s.days ?? 1e9) - (b.s.days ?? 1e9))[0];
        const eMaint = maint.filter((m) => m.equipment_id === e.id);
        return {
          e,
          next,
          spent: eMaint.reduce((s, m) => s + maintenanceTotal(m), 0),
          count: eMaint.length,
        };
      });
  }, [items, plans, maint, query, showInactive]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Meus equipamentos"
        subtitle={`${items.filter((e) => e.status !== 'inativo').length} equipamento(s) em uso`}
        action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Novo equipamento</button>}
      />

      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Buscar por nome, modelo, série…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Mostrar inativos
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Cpu}
            title={items.length ? 'Nenhum equipamento encontrado' : 'Cadastre seu primeiro equipamento'}
            subtitle={items.length ? undefined : 'Com os equipamentos cadastrados você registra manutenções, recebe alertas de preventiva e vê o custo de cada máquina.'}
            action={!items.length && <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Novo equipamento</button>}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map(({ e, next, spent, count }) => {
            const st = EQUIPMENT_STATUS[e.status];
            return (
              <button key={e.id} onClick={() => go('equipment', e.id)} className="card p-5 text-left hover:border-slate-300 hover:shadow-md transition group">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Cpu size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{e.nickname}</div>
                    <div className="text-xs text-slate-500 truncate">{[e.brand, e.machine_model].filter(Boolean).join(' · ') || 'Modelo não informado'}</div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {e.serial_number && <span className="flex items-center gap-1"><Hash size={12} />{e.serial_number}</span>}
                  {e.location && <span className="flex items-center gap-1"><MapPin size={12} />{e.location}</span>}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Gasto em manutenção</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{BRL(spent)}</div>
                    <div className="text-[11px] text-slate-400">{count} registro(s)</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Próxima preventiva</div>
                    {next ? (
                      <>
                        <div className="mt-1"><Badge tone={next.s.tone}>{next.s.label}</Badge></div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{next.p.title}</div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 mt-1">Sem plano</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs font-semibold text-slate-400 group-hover:text-slate-700">
                  Ver detalhes <ChevronRight size={14} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <EquipmentForm onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); go('equipment', id); }} />
      )}
    </div>
  );
}
