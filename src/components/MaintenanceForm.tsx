import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, ShoppingBag, PenLine, Cpu } from 'lucide-react';
import {
  supabase, type Equipment, type EquipmentMaintenance, type Plan, type Purchase, type CatalogPart,
  BRL, money, formatDate, today, fmtQty,
} from '../lib/supabase';
import { loadEquipments, loadPlans, loadPurchases, loadParts } from '../lib/data';
import { Modal, Field, ErrorText, EmptyState } from './ui';

type ItemDraft = {
  key: string;
  source: 'manual' | 'laser_tools';
  sale_item_id: string | null;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
};

const newKey = () => Math.random().toString(36).slice(2);

export default function MaintenanceForm({
  maintenance, equipmentId, planId, errorLogId, onClose, onSaved,
}: {
  maintenance?: EquipmentMaintenance | null;
  equipmentId?: string;
  planId?: string;
  errorLogId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(false);

  const [form, setForm] = useState({
    equipment_id: maintenance?.equipment_id ?? equipmentId ?? '',
    plan_id: maintenance?.plan_id ?? planId ?? '',
    performed_at: maintenance?.performed_at ?? today(),
    kind: maintenance?.kind ?? (planId ? 'preventiva' : errorLogId ? 'corretiva' : 'corretiva'),
    description: maintenance?.description ?? '',
    provider: maintenance?.provider ?? '',
    labor_cost: Number(maintenance?.labor_cost ?? 0),
    downtime_hours: Number(maintenance?.downtime_hours ?? 0),
  });
  const [items, setItems] = useState<ItemDraft[]>(
    (maintenance?.items ?? []).map((i) => ({
      key: i.id, source: i.source, sale_item_id: i.sale_item_id, part_id: i.part_id,
      description: i.description, quantity: Number(i.quantity), unit_cost: Number(i.unit_cost),
    })),
  );

  useEffect(() => {
    (async () => {
      const [eq, pl, pu, ca] = await Promise.all([loadEquipments(), loadPlans(), loadPurchases(), loadParts()]);
      setEquipments(eq.filter((e) => e.status !== 'inativo' || e.id === form.equipment_id));
      setPlans(pl);
      setPurchases(pu);
      setCatalog(ca);
      if (!form.equipment_id && eq.length === 1) setForm((f) => ({ ...f, equipment_id: eq[0].id }));
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equipmentPlans = plans.filter((p) => p.equipment_id === form.equipment_id && p.active);

  // Quantity of each purchase already used elsewhere (excluding this maintenance's own items).
  const available = useMemo(() => {
    const ownUse = new Map<string, number>();
    for (const i of maintenance?.items ?? []) {
      if (i.sale_item_id) ownUse.set(i.sale_item_id, (ownUse.get(i.sale_item_id) ?? 0) + Number(i.quantity));
    }
    const draftUse = new Map<string, number>();
    for (const i of items) {
      if (i.sale_item_id) draftUse.set(i.sale_item_id, (draftUse.get(i.sale_item_id) ?? 0) + Number(i.quantity));
    }
    return purchases.map((p) => ({
      ...p,
      remaining: Number(p.quantity) - (Number(p.used_quantity) - (ownUse.get(p.sale_item_id) ?? 0)) - (draftUse.get(p.sale_item_id) ?? 0),
    }));
  }, [purchases, items, maintenance]);

  const partsTotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const total = partsTotal + Number(form.labor_cost || 0);

  const addPurchase = (p: Purchase) => {
    setItems((prev) => [...prev, {
      key: newKey(), source: 'laser_tools', sale_item_id: p.sale_item_id, part_id: p.part_id,
      description: p.part_name, quantity: 1, unit_cost: Number(p.unit_price),
    }]);
    setPicker(false);
  };

  const addManual = () => {
    setItems((prev) => [...prev, {
      key: newKey(), source: 'manual', sale_item_id: null, part_id: null, description: '', quantity: 1, unit_cost: 0,
    }]);
  };

  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const save = async () => {
    setError('');
    if (!form.equipment_id) { setError('Selecione o equipamento.'); return; }
    if (!form.description.trim()) { setError('Descreva o que foi feito.'); return; }
    if (items.some((i) => !i.description.trim())) { setError('Preencha a descrição de todos os itens.'); return; }
    if (items.some((i) => !(i.quantity > 0))) { setError('Quantidade dos itens deve ser maior que zero.'); return; }

    setSaving(true);
    try {
      const payload = {
        equipment_id: form.equipment_id,
        plan_id: form.plan_id || null,
        performed_at: form.performed_at,
        kind: form.kind,
        description: form.description.trim(),
        provider: form.provider.trim() || null,
        labor_cost: Number(form.labor_cost) || 0,
        downtime_hours: Number(form.downtime_hours) || 0,
      };

      let id = maintenance?.id;
      if (id) {
        const { error: e } = await supabase.from('equipment_maintenances').update(payload).eq('id', id);
        if (e) throw e;
        const { error: d } = await supabase.from('equipment_maintenance_items').delete().eq('maintenance_id', id);
        if (d) throw d;
      } else {
        const { data, error: e } = await supabase.from('equipment_maintenances').insert(payload).select('id').single();
        if (e) throw e;
        id = data.id as string;
      }

      if (items.length) {
        const { error: e } = await supabase.from('equipment_maintenance_items').insert(
          items.map((i) => ({
            maintenance_id: id,
            source: i.source,
            sale_item_id: i.sale_item_id,
            part_id: i.part_id,
            description: i.description.trim(),
            quantity: i.quantity,
            unit_cost: i.unit_cost,
          })),
        );
        if (e) throw e;
      }

      if (errorLogId) {
        await supabase.from('equipment_error_logs')
          .update({ maintenance_id: id, resolved_at: new Date(form.performed_at + 'T12:00:00').toISOString() })
          .eq('id', errorLogId);
      }

      onSaved();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loaded && equipments.length === 0) {
    return (
      <Modal title="Registrar manutenção" onClose={onClose}>
        <EmptyState icon={Cpu} title="Cadastre um equipamento primeiro" subtitle="As manutenções são registradas por equipamento. Vá em Meus equipamentos para cadastrar." />
      </Modal>
    );
  }

  return (
    <Modal title={maintenance ? 'Editar manutenção' : 'Registrar manutenção'} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Equipamento">
            <select className="input" value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value, plan_id: '' })}>
              <option value="">Selecione…</option>
              {equipments.map((e) => (
                <option key={e.id} value={e.id}>{e.nickname}{e.machine_model ? ` — ${e.machine_model}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" className="input" value={form.performed_at} max={today()} onChange={(e) => setForm({ ...form, performed_at: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {(['preventiva', 'corretiva'] as const).map((k) => (
                <button
                  key={k} type="button"
                  onClick={() => setForm({ ...form, kind: k, plan_id: k === 'corretiva' ? '' : form.plan_id })}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition ${
                    form.kind === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {k === 'preventiva' ? 'Preventiva' : 'Corretiva'}
                </button>
              ))}
            </div>
          </Field>
          {form.kind === 'preventiva' && (
            <Field label="Plano preventivo" hint="(opcional)">
              <select className="input" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
                <option value="">Nenhum</option>
                {equipmentPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} (a cada {p.interval_days} dias)</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="O que foi feito">
          <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: troca do espelho de saída e limpeza das lentes" />
        </Field>

        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Técnico / empresa">
            <input className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </Field>
          <Field label="Mão de obra (R$)">
            <input type="number" min={0} step="0.01" className="input" value={form.labor_cost} onChange={(e) => setForm({ ...form, labor_cost: Number(e.target.value) })} />
          </Field>
          <Field label="Tempo parado (h)">
            <input type="number" min={0} step="0.5" className="input" value={form.downtime_hours} onChange={(e) => setForm({ ...form, downtime_hours: Number(e.target.value) })} />
          </Field>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <span className="label mb-0">Peças e materiais</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={() => setPicker(true)} disabled={!loaded}>
                <ShoppingBag size={15} /> Comprada na Laser Tools
              </button>
              <button type="button" className="btn-secondary !py-2 !px-3" onClick={addManual}>
                <PenLine size={15} /> Lançar manualmente
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">Nenhuma peça lançada nesta manutenção.</p>
          ) : (
            <div className="space-y-2">
              {items.map((i) => (
                <div key={i.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge ${i.source === 'laser_tools' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                      {i.source === 'laser_tools' ? 'Laser Tools' : 'Manual'}
                    </span>
                    <button type="button" className="icon-btn ml-auto" onClick={() => setItems(items.filter((x) => x.key !== i.key))} aria-label="Remover item">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {i.source === 'laser_tools' ? (
                      <div className="col-span-6 sm:col-span-3 text-sm font-medium text-slate-800 self-center">{i.description}</div>
                    ) : (
                      <div className="col-span-6 sm:col-span-3 space-y-2">
                        <input className="input" placeholder="Descrição (peça, serviço, material)" value={i.description} onChange={(e) => updateItem(i.key, { description: e.target.value })} />
                        <select
                          className="input text-xs"
                          value={i.part_id ?? ''}
                          onChange={(e) => {
                            const part = catalog.find((c) => c.id === e.target.value);
                            updateItem(i.key, { part_id: e.target.value || null, description: i.description || part?.name || '' });
                          }}
                        >
                          <option value="">Vincular a uma peça do catálogo (opcional)</option>
                          {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}{c.part_number ? ` · ${c.part_number}` : ''}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="col-span-2 sm:col-span-1">
                      <input type="number" min={0.001} step="1" className="input" value={i.quantity} onChange={(e) => updateItem(i.key, { quantity: Number(e.target.value) })} aria-label="Quantidade" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      {i.source === 'laser_tools' ? (
                        <div className="input bg-slate-50 text-slate-600">{BRL(i.unit_cost)} <span className="text-xs text-slate-400">/un</span></div>
                      ) : (
                        <input type="number" min={0} step="0.01" className="input" value={i.unit_cost} onChange={(e) => updateItem(i.key, { unit_cost: Number(e.target.value) })} aria-label="Custo unitário" placeholder="Custo unitário" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">Peças {BRL(partsTotal)} · Mão de obra {BRL(Number(form.labor_cost) || 0)}</span>
          <span className="font-bold text-slate-900">Total {BRL(total)}</span>
        </div>

        <ErrorText>{error}</ErrorText>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Salvar manutenção'}</button>
        </div>
      </div>

      {picker && (
        <Modal title="Peças compradas na Laser Tools" onClose={() => setPicker(false)} wide>
          {available.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Nenhuma compra encontrada" subtitle="As peças que você compra da Laser Tools aparecem aqui automaticamente." />
          ) : (
            <div className="divide-y divide-slate-100 -my-2">
              {available.map((p) => (
                <button
                  key={p.sale_item_id}
                  disabled={p.remaining <= 0}
                  onClick={() => addPurchase(p)}
                  className="w-full text-left py-3 flex items-center gap-3 disabled:opacity-40 hover:bg-slate-50 rounded-lg px-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 truncate">{p.part_name}</div>
                    <div className="text-xs text-slate-400">
                      Pedido {p.sale_code} · {formatDate(p.sale_date)}{p.serial_number ? ` · S/N ${p.serial_number}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-slate-900">{money(p.unit_price, p.currency)}</div>
                    <div className="text-xs text-slate-400">{p.remaining > 0 ? `${fmtQty(p.remaining)} disponível` : 'já utilizada'}</div>
                  </div>
                  <Plus size={16} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </Modal>
  );
}
