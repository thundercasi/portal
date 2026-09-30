import { useEffect, useMemo, useState } from 'react';
import { Plus, AlertTriangle, Search, BookOpen, CheckCircle2, Wrench, Trash2, Package } from 'lucide-react';
import {
  supabase, type Equipment, type ErrorCode, type ErrorLog, type CatalogPart, formatDateTime,
} from '../lib/supabase';
import { loadEquipments, loadErrorLogs, loadParts, modelKey } from '../lib/data';
import { Modal, Field, Badge, EmptyState, PageHeader, Loading, ErrorText, Tabs, ConfirmDelete } from './ui';
import MaintenanceForm from './MaintenanceForm';
import type { Go } from '../App';

const SEVERITY = {
  baixa: { label: 'Baixa', tone: 'slate' as const },
  media: { label: 'Média', tone: 'amber' as const },
  alta: { label: 'Alta', tone: 'red' as const },
};

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function ErrorCodeDetail({ code, onClose }: { code: ErrorCode; onClose: () => void }) {
  const [parts, setParts] = useState<CatalogPart[]>([]);
  useEffect(() => {
    if (code.related_part_ids.length) loadParts({ ids: code.related_part_ids }).then(setParts);
  }, [code]);
  const sev = SEVERITY[code.severity];
  return (
    <Modal title={`Erro ${code.code}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-slate-900">{code.title}</span>
            <Badge tone={sev.tone}>Gravidade {sev.label.toLowerCase()}</Badge>
          </div>
          <div className="text-xs text-slate-500 mt-1">{[code.brand, code.machine_model].filter(Boolean).join(' · ') || 'Todos os modelos'}</div>
        </div>
        {code.description && <p className="text-sm text-slate-600 whitespace-pre-line">{code.description}</p>}
        {code.causes && (
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Causas prováveis</div>
            <p className="text-sm text-amber-900 whitespace-pre-line">{code.causes}</p>
          </div>
        )}
        {code.solution && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Como resolver</div>
            <p className="text-sm text-emerald-900 whitespace-pre-line">{code.solution}</p>
          </div>
        )}
        {parts.length > 0 && (
          <div>
            <div className="label">Peças relacionadas</div>
            <div className="space-y-1.5">
              {parts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <Package size={14} className="text-slate-400" />
                  {p.name}
                  {p.part_number && <span className="text-xs text-slate-400">· {p.part_number}</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Precisa de alguma? Solicite um orçamento em Estoque sugerido ou fale com seu vendedor.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ErrorLogForm({
  equipments, codes, defaultEquipmentId, onClose, onSaved,
}: {
  equipments: Equipment[];
  codes: ErrorCode[];
  defaultEquipmentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    equipment_id: defaultEquipmentId ?? (equipments.length === 1 ? equipments[0].id : ''),
    error_code_id: '',
    custom_code: '',
    occurred_at: nowLocal(),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const equipment = equipments.find((e) => e.id === form.equipment_id);
  const options = codes.filter((c) => !c.machine_model || !equipment?.machine_model || modelKey(c.machine_model) === modelKey(equipment.machine_model));

  const save = async () => {
    setError('');
    if (!form.equipment_id) { setError('Selecione o equipamento.'); return; }
    if (!form.error_code_id && !form.custom_code.trim()) { setError('Selecione o código do erro ou digite o que apareceu no equipamento.'); return; }
    setSaving(true);
    const { error: e } = await supabase.from('equipment_error_logs').insert({
      equipment_id: form.equipment_id,
      error_code_id: form.error_code_id || null,
      custom_code: form.custom_code.trim() || null,
      occurred_at: new Date(form.occurred_at).toISOString(),
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSaved();
  };

  return (
    <Modal title="Registrar ocorrência de erro" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Equipamento">
          <select className="input" value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value, error_code_id: '' })}>
            <option value="">Selecione…</option>
            {equipments.map((e) => <option key={e.id} value={e.id}>{e.nickname}{e.machine_model ? ` — ${e.machine_model}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Código do erro" hint="(da base Laser Tools)">
          <select className="input" value={form.error_code_id} onChange={(e) => setForm({ ...form, error_code_id: e.target.value })}>
            <option value="">Não encontrei na lista</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </Field>
        {!form.error_code_id && (
          <Field label="O que apareceu no equipamento">
            <input className="input" value={form.custom_code} onChange={(e) => setForm({ ...form, custom_code: e.target.value })} placeholder="Ex.: E-204 / mensagem de alarme" />
          </Field>
        )}
        <Field label="Quando ocorreu">
          <input type="datetime-local" className="input" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
        </Field>
        <Field label="Observações" hint="(opcional)">
          <textarea className="input min-h-[70px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Registrar'}</button>
        </div>
      </div>
    </Modal>
  );
}

export function ErrorLogList({
  logs, equipments, codes, onChanged, showEquipment = true, defaultEquipmentId,
}: {
  logs: ErrorLog[];
  equipments: Equipment[];
  codes: ErrorCode[];
  onChanged: () => void;
  showEquipment?: boolean;
  defaultEquipmentId?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState<ErrorLog | null>(null);
  const [viewing, setViewing] = useState<ErrorCode | null>(null);
  const [deleting, setDeleting] = useState<ErrorLog | null>(null);

  const markResolved = async (l: ErrorLog) => {
    await supabase.from('equipment_error_logs').update({ resolved_at: new Date().toISOString() }).eq('id', l.id);
    onChanged();
  };
  const remove = async () => {
    if (!deleting) return;
    await supabase.from('equipment_error_logs').delete().eq('id', deleting.id);
    setDeleting(null);
    onChanged();
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <button className="btn-secondary" onClick={() => setCreating(true)}><Plus size={16} /> Registrar erro</button>
      </div>
      {logs.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Nenhum erro registrado" subtitle="Registre os erros que aparecem no equipamento para ter histórico e identificar falhas recorrentes." />
      ) : (
        <div className="grid gap-3">
          {logs.map((l) => {
            const code = l.error_code_id ? codes.find((c) => c.id === l.error_code_id) : null;
            const sev = l.error_code ? SEVERITY[l.error_code.severity] : null;
            return (
              <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${l.resolved_at ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {l.resolved_at ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-slate-900">{l.error_code?.code ?? l.custom_code}</span>
                    {l.error_code && <span className="text-sm text-slate-700">{l.error_code.title}</span>}
                    {sev && <Badge tone={sev.tone}>{sev.label}</Badge>}
                    <Badge tone={l.resolved_at ? 'green' : 'red'}>{l.resolved_at ? 'Resolvido' : 'Em aberto'}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {showEquipment && l.equipment && <>{l.equipment.nickname} · </>}
                    {formatDateTime(l.occurred_at)}
                    {l.resolved_at && <> · resolvido em {formatDateTime(l.resolved_at)}</>}
                  </div>
                  {l.notes && <div className="text-xs text-slate-400 mt-1">{l.notes}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  {code && <button className="btn-ghost !py-2 !px-3 text-xs" onClick={() => setViewing(code)}><BookOpen size={14} /> Como resolver</button>}
                  {!l.resolved_at && (
                    <>
                      <button className="btn-secondary !py-2 !px-3 text-xs" onClick={() => setResolving(l)}><Wrench size={14} /> Registrar correção</button>
                      <button className="icon-btn" title="Marcar como resolvido" onClick={() => markResolved(l)}><CheckCircle2 size={15} /></button>
                    </>
                  )}
                  <button className="icon-btn" title="Excluir" onClick={() => setDeleting(l)}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && (
        <ErrorLogForm
          equipments={equipments.filter((e) => e.status !== 'inativo')}
          codes={codes}
          defaultEquipmentId={defaultEquipmentId}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); onChanged(); }}
        />
      )}
      {resolving && (
        <MaintenanceForm
          equipmentId={resolving.equipment_id}
          errorLogId={resolving.id}
          onClose={() => setResolving(null)}
          onSaved={() => { setResolving(null); onChanged(); }}
        />
      )}
      {viewing && <ErrorCodeDetail code={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <Modal title="Excluir ocorrência" onClose={() => setDeleting(null)}>
          <ConfirmDelete message="Excluir este registro de erro?" onCancel={() => setDeleting(null)} onConfirm={remove} />
        </Modal>
      )}
    </>
  );
}

export async function loadErrorCodes(): Promise<ErrorCode[]> {
  const { data } = await supabase.from('error_codes').select('*').order('code');
  return (data as ErrorCode[]) ?? [];
}

export default function Errors(_: { go: Go }) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [codes, setCodes] = useState<ErrorCode[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'logs' | 'codes'>('logs');
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [viewing, setViewing] = useState<ErrorCode | null>(null);

  const load = async () => {
    const [l, c, e] = await Promise.all([loadErrorLogs(), loadErrorCodes(), loadEquipments()]);
    setLogs(l); setCodes(c); setEquipments(e);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const myModels = useMemo(() => new Set(equipments.map((e) => modelKey(e.machine_model)).filter(Boolean)), [equipments]);

  const filteredCodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return codes.filter((c) =>
      (!onlyMine || !c.machine_model || myModels.has(modelKey(c.machine_model))) &&
      (!q || [c.code, c.title, c.description, c.causes].some((v) => (v ?? '').toLowerCase().includes(q))),
    );
  }, [codes, query, onlyMine, myModels]);

  // Most frequent errors — helps spot recurring failures.
  const recurring = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const l of logs) {
      const key = l.error_code?.code ?? l.custom_code ?? '?';
      const cur = map.get(key) ?? { label: l.error_code ? `${l.error_code.code} — ${l.error_code.title}` : key, count: 0 };
      cur.count++;
      map.set(key, cur);
    }
    return [...map.values()].filter((r) => r.count > 1).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [logs]);

  if (loading) return <Loading />;
  const open = logs.filter((l) => !l.resolved_at).length;

  return (
    <div>
      <PageHeader title="Erros dos equipamentos" subtitle={open ? `${open} ocorrência(s) em aberto` : 'Nenhuma ocorrência em aberto'} />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'logs', label: 'Ocorrências', count: logs.length },
          { id: 'codes', label: 'Base de códigos', count: codes.length },
        ]} />
      </div>

      {tab === 'logs' ? (
        <>
          {recurring.length > 0 && (
            <div className="card p-4 mb-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Erros recorrentes</div>
              <div className="flex flex-wrap gap-2">
                {recurring.map((r) => (
                  <span key={r.label} className="badge bg-red-50 text-red-700">{r.label} · {r.count}×</span>
                ))}
              </div>
            </div>
          )}
          <ErrorLogList logs={logs} equipments={equipments} codes={codes} onChanged={load} />
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" placeholder="Código ou descrição (ex.: E-204, temperatura)" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="rounded" />
              Só dos meus modelos
            </label>
          </div>
          {filteredCodes.length === 0 ? (
            <div className="card"><EmptyState icon={BookOpen} title="Nenhum código encontrado" subtitle="A base é mantida pela Laser Tools e cresce continuamente." /></div>
          ) : (
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {filteredCodes.map((c) => (
                <button key={c.id} onClick={() => setViewing(c)} className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50">
                  <span className="font-mono text-sm font-bold text-slate-900 w-20 shrink-0">{c.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800 truncate">{c.title}</div>
                    <div className="text-xs text-slate-400 truncate">{[c.brand, c.machine_model].filter(Boolean).join(' · ') || 'Todos os modelos'}</div>
                  </div>
                  <Badge tone={SEVERITY[c.severity].tone}>{SEVERITY[c.severity].label}</Badge>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {viewing && <ErrorCodeDetail code={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
