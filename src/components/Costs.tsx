import { useEffect, useMemo, useState } from 'react';
import { Wallet, Package, HardHat, Clock, Download, PieChart } from 'lucide-react';
import {
  type Equipment, type EquipmentMaintenance, BRL, fmtQty, itemsTotal, maintenanceTotal, downloadCsv, formatDate, today,
} from '../lib/supabase';
import { loadEquipments, loadMaintenances } from '../lib/data';
import { PageHeader, StatCard, Loading, BarList, MonthlyChart, EmptyState, Tabs } from './ui';
import type { Go } from '../App';

type Period = '12m' | 'year' | 'all';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const periodStart = (p: Period) => {
  const d = new Date();
  if (p === 'year') return `${d.getFullYear()}-01-01`;
  if (p === '12m') {
    d.setMonth(d.getMonth() - 11, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return null;
};

const monthsBetween = (from: string, to: string) => {
  const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1);
};

export default function Costs({ go }: { go: Go }) {
  const [maint, setMaint] = useState<EquipmentMaintenance[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('12m');
  const [equipmentId, setEquipmentId] = useState('');
  const [view, setView] = useState<'parts' | 'equipments' | 'tco'>('parts');

  useEffect(() => {
    (async () => {
      const [m, e] = await Promise.all([loadMaintenances(), loadEquipments()]);
      setMaint(m); setEquipments(e);
      setLoading(false);
    })();
  }, []);

  const start = periodStart(period);
  const filtered = useMemo(
    () => maint.filter((m) => (!start || m.performed_at >= start) && (!equipmentId || m.equipment_id === equipmentId)),
    [maint, start, equipmentId],
  );

  const stats = useMemo(() => {
    const parts = filtered.reduce((s, m) => s + itemsTotal(m.items), 0);
    const labor = filtered.reduce((s, m) => s + Number(m.labor_cost), 0);
    const downtime = filtered.reduce((s, m) => s + Number(m.downtime_hours), 0);
    const lt = filtered.reduce((s, m) => s + (m.items ?? []).filter((i) => i.source === 'laser_tools').reduce((a, i) => a + i.quantity * i.unit_cost, 0), 0);
    const preventive = filtered.filter((m) => m.kind === 'preventiva').reduce((s, m) => s + maintenanceTotal(m), 0);
    return { parts, labor, total: parts + labor, downtime, lt, preventive };
  }, [filtered]);

  const monthly = useMemo(() => {
    const keys: string[] = [];
    const first = start ?? (filtered.length ? filtered[filtered.length - 1].performed_at.slice(0, 7) + '-01' : today());
    const d = new Date(first + 'T00:00:00');
    const end = new Date();
    while (d <= end && keys.length < 36) {
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() + 1);
    }
    const map = new Map(keys.map((k) => [k, { parts: 0, labor: 0 }]));
    for (const m of filtered) {
      const b = map.get(m.performed_at.slice(0, 7));
      if (!b) continue;
      b.parts += itemsTotal(m.items);
      b.labor += Number(m.labor_cost);
    }
    return keys.map((k) => ({
      key: k,
      label: MONTHS[Number(k.slice(5)) - 1] + (keys.length > 12 ? `/${k.slice(2, 4)}` : ''),
      ...map.get(k)!,
    }));
  }, [filtered, start]);

  const byPart = useMemo(() => {
    const map = new Map<string, { label: string; qty: number; total: number; lt: boolean; last: string }>();
    for (const m of filtered) {
      for (const i of m.items ?? []) {
        const key = i.part_id ?? 'd:' + i.description.trim().toLowerCase();
        const cur = map.get(key) ?? { label: i.description, qty: 0, total: 0, lt: false, last: m.performed_at };
        cur.qty += Number(i.quantity);
        cur.total += Number(i.quantity) * Number(i.unit_cost);
        cur.lt ||= i.source === 'laser_tools';
        if (m.performed_at > cur.last) cur.last = m.performed_at;
        map.set(key, cur);
      }
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byEquipment = useMemo(() => {
    return equipments
      .filter((e) => !equipmentId || e.id === equipmentId)
      .map((e) => {
        const list = filtered.filter((m) => m.equipment_id === e.id);
        const all = maint.filter((m) => m.equipment_id === e.id);
        const lifetime = all.reduce((s, m) => s + maintenanceTotal(m), 0);
        const since = e.acquired_at ?? all[all.length - 1]?.performed_at ?? today();
        const months = monthsBetween(since, today());
        return {
          e,
          period: list.reduce((s, m) => s + maintenanceTotal(m), 0),
          downtime: list.reduce((s, m) => s + Number(m.downtime_hours), 0),
          count: list.length,
          lifetime,
          tco: Number(e.acquisition_cost) + lifetime,
          months,
          perMonth: (Number(e.acquisition_cost) + lifetime) / months,
        };
      })
      .sort((a, b) => b.period - a.period);
  }, [equipments, filtered, maint, equipmentId]);

  const exportCsv = () => {
    if (view === 'parts') {
      downloadCsv('custos-por-peca.csv', [
        ['Peça / item', 'Quantidade', 'Custo médio', 'Total', 'Último uso'],
        ...byPart.map((p) => [p.label, p.qty, +(p.total / p.qty).toFixed(2), +p.total.toFixed(2), formatDate(p.last)]),
      ]);
    } else {
      downloadCsv('custos-por-equipamento.csv', [
        ['Equipamento', 'Modelo', 'Gasto no período', 'Horas paradas', 'Manutenções', 'Aquisição', 'Manutenção total', 'Custo total', 'Custo/mês'],
        ...byEquipment.map((r) => [r.e.nickname, r.e.machine_model, +r.period.toFixed(2), r.downtime, r.count, Number(r.e.acquisition_cost), +r.lifetime.toFixed(2), +r.tco.toFixed(2), +r.perMonth.toFixed(2)]),
      ]);
    }
  };

  if (loading) return <Loading />;

  if (maint.length === 0) {
    return (
      <div>
        <PageHeader title="Custos" />
        <div className="card">
          <EmptyState icon={PieChart} title="Ainda não há custos" subtitle="Os custos aparecem aqui assim que você registrar manutenções com peças e mão de obra."
            action={<button className="btn-primary" onClick={() => go('maintenances')}>Ir para manutenções</button>} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Custos"
        subtitle="Quanto você gasta com cada equipamento e cada peça"
        action={<button className="btn-secondary" onClick={exportCsv}><Download size={16} /> Exportar CSV</button>}
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tabs value={period} onChange={setPeriod} tabs={[
          { id: '12m', label: 'Últimos 12 meses' },
          { id: 'year', label: 'Este ano' },
          { id: 'all', label: 'Tudo' },
        ]} />
        <select className="input !w-auto" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
          <option value="">Todos os equipamentos</option>
          {equipments.map((e) => <option key={e.id} value={e.id}>{e.nickname}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Gasto total" value={BRL(stats.total)} icon={Wallet} tone="blue" sub={`${filtered.length} manutenção(ões)`} />
        <StatCard label="Peças" value={BRL(stats.parts)} icon={Package} sub={`${BRL(stats.lt)} comprado na Laser Tools`} />
        <StatCard label="Mão de obra" value={BRL(stats.labor)} icon={HardHat} sub={stats.total ? `${Math.round((stats.preventive / stats.total) * 100)}% do gasto foi preventivo` : undefined} />
        <StatCard label="Tempo parado" value={`${fmtQty(stats.downtime)} h`} icon={Clock} tone={stats.downtime > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="card p-5 mb-5">
        <div className="text-sm font-bold text-slate-900 mb-4">Gasto por mês</div>
        <MonthlyChart data={monthly} format={BRL} />
      </div>

      <div className="mb-4">
        <Tabs value={view} onChange={setView} tabs={[
          { id: 'parts', label: 'Por peça' },
          { id: 'equipments', label: 'Por equipamento' },
          { id: 'tco', label: 'Custo total de propriedade' },
        ]} />
      </div>

      {view === 'parts' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="text-sm font-bold text-slate-900 mb-4">Onde está o dinheiro</div>
            <BarList rows={byPart.slice(0, 10).map((p) => ({ key: p.key, label: p.label, sub: `${fmtQty(p.qty)} un`, value: p.total }))} format={BRL} />
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><th className="th">Peça / item</th><th className="th text-right">Qtd</th><th className="th text-right">Médio</th><th className="th text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byPart.map((p) => (
                    <tr key={p.key}>
                      <td className="td">
                        <div className="font-medium text-slate-800">{p.label}</div>
                        <div className="text-[11px] text-slate-400">Último uso {formatDate(p.last)}{p.lt ? ' · Laser Tools' : ''}</div>
                      </td>
                      <td className="td text-right">{fmtQty(p.qty)}</td>
                      <td className="td text-right whitespace-nowrap">{BRL(p.total / p.qty)}</td>
                      <td className="td text-right font-semibold whitespace-nowrap">{BRL(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'equipments' && (
        <div className="card p-5">
          <BarList
            rows={byEquipment.map((r) => ({
              key: r.e.id, label: r.e.nickname,
              sub: `${r.count} manutenção(ões)${r.downtime ? ` · ${fmtQty(r.downtime)} h parado` : ''}`,
              value: r.period,
            }))}
            format={BRL}
          />
        </div>
      )}

      {view === 'tco' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th">Equipamento</th>
                  <th className="th text-right">Aquisição</th>
                  <th className="th text-right">Manutenção (total)</th>
                  <th className="th text-right">Custo total</th>
                  <th className="th text-right">Custo / mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byEquipment.map((r) => (
                  <tr key={r.e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => go('equipment', r.e.id)}>
                    <td className="td">
                      <div className="font-medium text-slate-800">{r.e.nickname}</div>
                      <div className="text-[11px] text-slate-400">{r.months} mês(es) de uso</div>
                    </td>
                    <td className="td text-right whitespace-nowrap">{BRL(Number(r.e.acquisition_cost))}</td>
                    <td className="td text-right whitespace-nowrap">{BRL(r.lifetime)}</td>
                    <td className="td text-right font-semibold whitespace-nowrap">{BRL(r.tco)}</td>
                    <td className="td text-right whitespace-nowrap">{BRL(r.perMonth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 px-5 py-3 border-t border-slate-100">
            Custo total = valor de aquisição + todas as manutenções registradas. Informe a data e o valor de aquisição no cadastro do equipamento para um cálculo preciso.
          </p>
        </div>
      )}
    </div>
  );
}
