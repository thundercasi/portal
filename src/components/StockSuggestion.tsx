import { useEffect, useMemo, useState } from 'react';
import { PackageSearch, Send, Info, CheckCircle2 } from 'lucide-react';
import { supabase, type StockSuggestion as Row, fmtQty } from '../lib/supabase';
import { PageHeader, Loading, EmptyState, Tabs, Modal, Field, ErrorText, Badge } from './ui';

const BASIS: Record<Row['basis'], { label: string; tone: 'blue' | 'violet' | 'slate'; hint: string }> = {
  recomendacao: { label: 'Recomendação LT', tone: 'blue', hint: 'Consumo recomendado pela Laser Tools para os seus modelos × quantidade de equipamentos.' },
  historico: { label: 'Seu histórico', tone: 'violet', hint: 'Baseado no que você realmente consumiu nos últimos 12 meses.' },
  estoque: { label: 'Estoque', tone: 'slate', hint: 'Item que você informou ter em estoque.' },
};

export default function StockSuggestion() {
  const [coverage, setCoverage] = useState<'90' | '180' | '365'>('180');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [quoting, setQuoting] = useState(false);
  const [sent, setSent] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc('portal_stock_suggestion', { p_coverage_days: Number(coverage) });
    const list = (data as Row[]) ?? [];
    setRows(list);
    setSelected(Object.fromEntries(list.filter((r) => r.suggested_qty > 0).map((r) => [r.part_id, Number(r.suggested_qty)])));
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [coverage]);

  const saveOnHand = async (partId: string, qty: number) => {
    const quantity = Math.max(0, qty || 0);
    setRows((prev) => prev.map((r) => r.part_id === partId
      ? { ...r, on_hand: quantity, suggested_qty: Math.max(0, Math.ceil(Math.max(r.expected_qty, r.historical_qty) - quantity)) }
      : r));
    await supabase.from('customer_stock').upsert(
      { part_id: partId, quantity, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id,part_id' },
    );
  };

  const selectedRows = useMemo(() => rows.filter((r) => selected[r.part_id] > 0), [rows, selected]);
  const needing = rows.filter((r) => r.suggested_qty > 0).length;

  return (
    <div>
      <PageHeader
        title="Estoque sugerido"
        subtitle="Quantas peças manter em estoque para não parar, com base nos seus equipamentos"
        action={
          selectedRows.length > 0 && (
            <button className="btn-primary" onClick={() => setQuoting(true)}>
              <Send size={16} /> Solicitar orçamento ({selectedRows.length})
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-sm text-slate-500">Cobrir os próximos</span>
        <Tabs value={coverage} onChange={setCoverage} tabs={[
          { id: '90', label: '3 meses' },
          { id: '180', label: '6 meses' },
          { id: '365', label: '12 meses' },
        ]} />
      </div>

      {sent && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3 mb-4">
          <CheckCircle2 size={16} /> Solicitação enviada! A equipe Laser Tools vai retornar com o orçamento.
        </div>
      )}

      {loading ? <Loading /> : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={PackageSearch} title="Ainda sem sugestões"
            subtitle="As sugestões aparecem quando seus equipamentos têm o modelo informado (e a Laser Tools tem recomendação para ele) ou quando você registra manutenções com peças do catálogo." />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th w-10"></th>
                    <th className="th">Peça</th>
                    <th className="th text-right">Equip.</th>
                    <th className="th text-right">Consumo previsto</th>
                    <th className="th text-right">Tenho</th>
                    <th className="th text-right">Comprar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const b = BASIS[r.basis];
                    const need = Math.max(r.expected_qty, r.historical_qty);
                    return (
                      <tr key={r.part_id} className={r.suggested_qty > 0 ? '' : 'opacity-60'}>
                        <td className="td">
                          <input
                            type="checkbox" className="rounded"
                            checked={(selected[r.part_id] ?? 0) > 0}
                            onChange={(e) => setSelected({ ...selected, [r.part_id]: e.target.checked ? Math.max(1, Number(r.suggested_qty)) : 0 })}
                          />
                        </td>
                        <td className="td">
                          <div className="font-medium text-slate-800">{r.part_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400">{r.part_number ?? r.sku}</span>
                            <span title={b.hint}><Badge tone={b.tone}>{b.label}</Badge></span>
                          </div>
                        </td>
                        <td className="td text-right">{r.equipment_count || '—'}</td>
                        <td className="td text-right whitespace-nowrap">
                          {fmtQty(need)}
                          {r.expected_qty > 0 && r.historical_qty > 0 && (
                            <div className="text-[11px] text-slate-400">rec. {fmtQty(r.expected_qty)} · hist. {fmtQty(r.historical_qty)}</div>
                          )}
                        </td>
                        <td className="td text-right">
                          <input
                            type="number" min={0} className="input !w-20 !py-1.5 text-right ml-auto"
                            defaultValue={r.on_hand}
                            onBlur={(e) => Number(e.target.value) !== Number(r.on_hand) && saveOnHand(r.part_id, Number(e.target.value))}
                            aria-label="Quantidade em estoque"
                          />
                        </td>
                        <td className="td text-right">
                          <span className={`text-base font-bold ${r.suggested_qty > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{fmtQty(r.suggested_qty)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-slate-400 mt-3">
            <Info size={14} className="shrink-0 mt-0.5" />
            {needing} peça(s) abaixo do recomendado. Usamos o maior valor entre a recomendação da Laser Tools para seus modelos e o seu consumo real dos últimos 12 meses, descontando o que você já tem.
          </p>
        </>
      )}

      {quoting && (
        <QuoteModal
          rows={selectedRows.map((r) => ({ ...r, qty: selected[r.part_id] }))}
          onClose={() => setQuoting(false)}
          onSent={() => { setQuoting(false); setSent(true); }}
        />
      )}
    </div>
  );
}

function QuoteModal({
  rows, onClose, onSent,
}: {
  rows: (Row & { qty: number })[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [qtys, setQtys] = useState<Record<string, number>>(Object.fromEntries(rows.map((r) => [r.part_id, r.qty])));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setError('');
    const items = rows
      .filter((r) => qtys[r.part_id] > 0)
      .map((r) => ({ part_id: r.part_id, part_name: r.part_name, sku: r.sku, part_number: r.part_number, quantity: qtys[r.part_id] }));
    if (!items.length) { setError('Informe a quantidade de pelo menos uma peça.'); return; }
    setSaving(true);
    const { error: e } = await supabase.from('quote_requests').insert({ items, notes: notes.trim() || null });
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSent();
  };

  return (
    <Modal title="Solicitar orçamento" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.part_id} className="flex items-center gap-3 px-3 py-2">
              <span className="text-sm text-slate-700 flex-1">{r.part_name}</span>
              <input type="number" min={0} className="input !w-20 !py-1.5 text-right" value={qtys[r.part_id]} onChange={(e) => setQtys({ ...qtys, [r.part_id]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <Field label="Observações" hint="(opcional)">
          <textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prazo desejado, forma de pagamento…" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={send}><Send size={16} /> {saving ? 'Enviando...' : 'Enviar'}</button>
        </div>
      </div>
    </Modal>
  );
}
