import { useEffect, useMemo, useState } from 'react';
import { Plus, Wrench, Search, Pencil, Trash2, ChevronDown, Clock, User, Download } from 'lucide-react';
import {
  supabase, type Equipment, type EquipmentMaintenance, BRL, formatDate, maintenanceTotal, fmtQty, downloadCsv,
} from '../lib/supabase';
import { loadEquipments, loadMaintenances } from '../lib/data';
import { Modal, Badge, EmptyState, PageHeader, Loading, ConfirmDelete } from './ui';
import MaintenanceForm from './MaintenanceForm';
import type { Go } from '../App';

export function MaintenanceList({
  items, onChanged, showEquipment = true, go,
}: {
  items: EquipmentMaintenance[];
  onChanged: () => void;
  showEquipment?: boolean;
  go?: Go;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<EquipmentMaintenance | null>(null);
  const [deleting, setDeleting] = useState<EquipmentMaintenance | null>(null);

  const remove = async () => {
    if (!deleting) return;
    await supabase.from('equipment_maintenances').delete().eq('id', deleting.id);
    setDeleting(null);
    onChanged();
  };

  if (items.length === 0) {
    return <EmptyState icon={Wrench} title="Nenhuma manutenção registrada" subtitle="Registre as manutenções para acompanhar histórico e custos." />;
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {items.map((m) => {
          const expanded = open === m.id;
          const items = m.items ?? [];
          return (
            <div key={m.id}>
              <button className="w-full text-left px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-slate-50/70 transition" onClick={() => setOpen(expanded ? null : m.id)}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.kind === 'preventiva' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  <Wrench size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{formatDate(m.performed_at)}</span>
                    <Badge tone={m.kind === 'preventiva' ? 'green' : 'amber'}>{m.kind === 'preventiva' ? 'Preventiva' : 'Corretiva'}</Badge>
                    {showEquipment && m.equipment && <span className="text-xs text-slate-500">· {m.equipment.nickname}</span>}
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5 line-clamp-2">{m.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900">{BRL(maintenanceTotal(m))}</div>
                  <div className="text-[11px] text-slate-400">{items.length} item(ns)</div>
                </div>
                <ChevronDown size={16} className={`text-slate-400 mt-1 shrink-0 transition ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="px-4 sm:px-5 pb-4 sm:pl-[4.25rem]">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 mb-3">
                    {m.provider && <span className="flex items-center gap-1"><User size={12} />{m.provider}</span>}
                    {Number(m.downtime_hours) > 0 && <span className="flex items-center gap-1"><Clock size={12} />{fmtQty(m.downtime_hours)} h parado</span>}
                    <span>Mão de obra {BRL(m.labor_cost)}</span>
                    {showEquipment && go && m.equipment && (
                      <button className="text-sky-600 font-semibold hover:underline" onClick={() => go('equipment', m.equipment!.id)}>Ver equipamento</button>
                    )}
                  </div>
                  {items.length > 0 && (
                    <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {items.map((i) => (
                            <tr key={i.id}>
                              <td className="px-3 py-2 text-slate-700">
                                {i.description}
                                {i.source === 'laser_tools' && <span className="ml-2 badge bg-sky-100 text-sky-700">Laser Tools</span>}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{fmtQty(i.quantity)} × {BRL(i.unit_cost)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{BRL(Number(i.quantity) * Number(i.unit_cost))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setEditing(m)}><Pencil size={13} /> Editar</button>
                    <button className="btn-danger !py-1.5 !px-3 text-xs" onClick={() => setDeleting(m)}><Trash2 size={13} /> Excluir</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <MaintenanceForm maintenance={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
      )}
      {deleting && (
        <Modal title="Excluir manutenção" onClose={() => setDeleting(null)}>
          <ConfirmDelete
            message={`Excluir a manutenção de ${formatDate(deleting.performed_at)} e todas as peças lançadas nela?`}
            onCancel={() => setDeleting(null)}
            onConfirm={remove}
          />
        </Modal>
      )}
    </>
  );
}

export default function Maintenances({ go }: { go: Go }) {
  const [items, setItems] = useState<EquipmentMaintenance[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [kind, setKind] = useState<'' | 'preventiva' | 'corretiva'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    const [m, e] = await Promise.all([loadMaintenances(), loadEquipments()]);
    setItems(m); setEquipments(e);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) =>
      (!equipmentId || m.equipment_id === equipmentId) &&
      (!kind || m.kind === kind) &&
      (!from || m.performed_at >= from) &&
      (!to || m.performed_at <= to) &&
      (!q || m.description.toLowerCase().includes(q) || (m.provider ?? '').toLowerCase().includes(q) ||
        (m.items ?? []).some((i) => i.description.toLowerCase().includes(q))),
    );
  }, [items, query, equipmentId, kind, from, to]);

  const total = filtered.reduce((s, m) => s + maintenanceTotal(m), 0);

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [['Data', 'Equipamento', 'Tipo', 'Descrição', 'Técnico', 'Item', 'Origem', 'Qtd', 'Custo unit.', 'Mão de obra', 'Horas parado']];
    for (const m of filtered) {
      const base = [formatDate(m.performed_at), m.equipment?.nickname ?? '', m.kind, m.description, m.provider ?? ''];
      if (!(m.items ?? []).length) rows.push([...base, '', '', '', '', Number(m.labor_cost), Number(m.downtime_hours)]);
      (m.items ?? []).forEach((i, idx) => rows.push([
        ...base, i.description, i.source === 'laser_tools' ? 'Laser Tools' : 'Manual', Number(i.quantity), Number(i.unit_cost),
        idx === 0 ? Number(m.labor_cost) : 0, idx === 0 ? Number(m.downtime_hours) : 0,
      ]));
    }
    downloadCsv(`manutencoes-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Manutenções"
        subtitle={`${filtered.length} registro(s) · ${BRL(total)}`}
        action={
          <div className="flex gap-2">
            {filtered.length > 0 && <button className="btn-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>}
            <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Registrar</button>
          </div>
        }
      />

      <div className="card p-4 mb-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Buscar descrição, peça, técnico…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          <option value="">Todos os equipamentos</option>
          {equipments.map((e) => <option key={e.id} value={e.id}>{e.nickname}</option>)}
        </select>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="">Preventivas e corretivas</option>
          <option value="preventiva">Preventivas</option>
          <option value="corretiva">Corretivas</option>
        </select>
        <div className="flex gap-2">
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <MaintenanceList items={filtered} onChanged={load} go={go} />
      </div>

      {creating && <MaintenanceForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}
