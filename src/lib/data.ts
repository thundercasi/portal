import {
  supabase, type Equipment, type EquipmentMaintenance, type Plan, type Purchase,
  type CatalogPart, type ErrorLog,
} from './supabase';

export const MAINTENANCE_SELECT =
  '*, equipment:equipment_id(id, nickname, machine_model), items:equipment_maintenance_items(*)';

export async function loadEquipments(): Promise<Equipment[]> {
  const { data } = await supabase.from('customer_equipments').select('*').order('nickname');
  return (data as Equipment[]) ?? [];
}

export async function loadMaintenances(opts: { equipmentId?: string; from?: string; to?: string } = {}) {
  let q = supabase.from('equipment_maintenances').select(MAINTENANCE_SELECT).order('performed_at', { ascending: false });
  if (opts.equipmentId) q = q.eq('equipment_id', opts.equipmentId);
  if (opts.from) q = q.gte('performed_at', opts.from);
  if (opts.to) q = q.lte('performed_at', opts.to);
  const { data } = await q;
  return (data as EquipmentMaintenance[]) ?? [];
}

export async function loadPlans(equipmentId?: string): Promise<Plan[]> {
  let q = supabase.from('maintenance_plans').select('*, equipment:equipment_id(id, nickname, machine_model, status)').order('next_due_at');
  if (equipmentId) q = q.eq('equipment_id', equipmentId);
  const { data } = await q;
  return (data as Plan[]) ?? [];
}

export async function loadErrorLogs(equipmentId?: string): Promise<ErrorLog[]> {
  let q = supabase
    .from('equipment_error_logs')
    .select('*, equipment:equipment_id(id, nickname), error_code:error_code_id(id, code, title, severity)')
    .order('occurred_at', { ascending: false });
  if (equipmentId) q = q.eq('equipment_id', equipmentId);
  const { data } = await q;
  return (data as ErrorLog[]) ?? [];
}

export async function loadPurchases(): Promise<Purchase[]> {
  const { data } = await supabase.rpc('portal_my_purchases');
  return (data as Purchase[]) ?? [];
}

export async function loadParts(opts: { ids?: string[]; search?: string } = {}): Promise<CatalogPart[]> {
  const { data } = await supabase.rpc('portal_parts', {
    p_ids: opts.ids ?? null,
    p_search: opts.search?.trim() || null,
  });
  return (data as CatalogPart[]) ?? [];
}

/** Normalised model key, same rule the SQL uses (lower + trim). */
export const modelKey = (m: string | null | undefined) => (m ?? '').trim().toLowerCase();
