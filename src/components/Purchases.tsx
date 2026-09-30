import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, ShieldCheck, Search, Receipt } from 'lucide-react';
import { type Purchase, BRL, money, formatDate, daysUntil, fmtQty } from '../lib/supabase';
import { loadPurchases } from '../lib/data';
import { PageHeader, StatCard, Loading, EmptyState, Badge } from './ui';

const warranty = (p: Purchase) => {
  const d = daysUntil(p.warranty_until);
  if (d === null) return null;
  if (d < 0) return { label: 'Garantia encerrada', tone: 'slate' as const };
  if (d <= 30) return { label: `Garantia: ${d}d`, tone: 'amber' as const };
  return { label: `Garantia até ${formatDate(p.warranty_until)}`, tone: 'green' as const };
};

export default function Purchases() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadPurchases().then((r) => { setRows(r); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q || [r.part_name, r.sku, r.part_number, r.sale_code, r.serial_number].some((v) => (v ?? '').toLowerCase().includes(q)));
  }, [rows, query]);

  const orders = useMemo(() => {
    const map = new Map<string, { code: string; date: string; status: string; currency: string; items: Purchase[] }>();
    for (const r of filtered) {
      const cur = map.get(r.sale_id) ?? { code: r.sale_code, date: r.sale_date, status: r.sale_status, currency: r.currency, items: [] };
      cur.items.push(r);
      map.set(r.sale_id, cur);
    }
    return [...map.entries()];
  }, [filtered]);

  const totals = useMemo(() => {
    const year = String(new Date().getFullYear());
    const brl = rows.filter((r) => r.currency !== 'USD');
    return {
      all: brl.reduce((s, r) => s + r.quantity * r.unit_price, 0),
      year: brl.filter((r) => r.sale_date.startsWith(year)).reduce((s, r) => s + r.quantity * r.unit_price, 0),
      underWarranty: rows.filter((r) => (daysUntil(r.warranty_until) ?? -1) >= 0).length,
    };
  }, [rows]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Compras na Laser Tools" subtitle="Peças que você comprou conosco, com preço pago e garantia" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Comprado este ano" value={BRL(totals.year)} icon={Receipt} tone="blue" />
        <StatCard label="Comprado no total" value={BRL(totals.all)} icon={ShoppingBag} />
        <StatCard label="Itens em garantia" value={String(totals.underWarranty)} icon={ShieldCheck} tone="green" />
      </div>

      {rows.length === 0 ? (
        <div className="card"><EmptyState icon={ShoppingBag} title="Nenhuma compra encontrada" subtitle="Suas compras na Laser Tools aparecem aqui automaticamente." /></div>
      ) : (
        <>
          <div className="relative max-w-md mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Buscar peça, código, nº de série…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="space-y-4">
            {orders.map(([id, o]) => (
              <div key={id} className="card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">Pedido {o.code}</span>
                  <span className="text-xs text-slate-500">{formatDate(o.date)}</span>
                  <Badge tone={o.status === 'Concluída' ? 'green' : 'amber'}>{o.status}</Badge>
                  <span className="ml-auto text-sm font-semibold text-slate-800">
                    {money(o.items.reduce((s, i) => s + i.quantity * i.unit_price, 0), o.currency)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {o.items.map((i) => {
                    const w = warranty(i);
                    return (
                      <div key={i.sale_item_id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-800">{i.part_name}</div>
                          <div className="text-xs text-slate-400">
                            {[i.part_number && `PN ${i.part_number}`, i.condition, i.serial_number && `S/N ${i.serial_number}`].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {w && <Badge tone={w.tone}>{w.label}</Badge>}
                        {Number(i.used_quantity) > 0 && <Badge tone="blue">Usada {fmtQty(i.used_quantity)}/{fmtQty(i.quantity)}</Badge>}
                        <div className="text-right text-sm whitespace-nowrap">
                          <span className="text-slate-500">{fmtQty(i.quantity)} × </span>
                          <span className="font-semibold text-slate-900">{money(i.unit_price, i.currency)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
