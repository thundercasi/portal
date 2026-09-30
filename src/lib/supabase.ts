import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Me = {
  customer_id: string;
  customer_name: string;
  full_name: string | null;
  email: string;
  email_notifications: boolean;
};

export type EquipmentStatus = 'ativo' | 'parado' | 'inativo';

export type Equipment = {
  id: string;
  customer_id: string;
  nickname: string;
  brand: string | null;
  machine_model: string | null;
  serial_number: string | null;
  acquired_at: string | null;
  acquisition_cost: number;
  location: string | null;
  status: EquipmentStatus;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
};

export type MaintenanceItem = {
  id: string;
  maintenance_id: string;
  source: 'manual' | 'laser_tools';
  part_id: string | null;
  sale_item_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
};

export type EquipmentMaintenance = {
  id: string;
  equipment_id: string;
  plan_id: string | null;
  performed_at: string;
  kind: 'preventiva' | 'corretiva';
  description: string;
  provider: string | null;
  labor_cost: number;
  downtime_hours: number;
  created_at: string;
  equipment?: Pick<Equipment, 'id' | 'nickname' | 'machine_model'> | null;
  items?: MaintenanceItem[];
};

export type Plan = {
  id: string;
  equipment_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  interval_days: number;
  remind_days_before: number;
  start_date: string;
  last_done_at: string | null;
  next_due_at: string | null;
  active: boolean;
  equipment?: Pick<Equipment, 'id' | 'nickname' | 'machine_model' | 'status'> | null;
};

export type PlanTemplate = {
  id: string;
  brand: string | null;
  machine_model: string;
  title: string;
  description: string | null;
  interval_days: number;
  part_ids: string[];
};

export type ErrorCode = {
  id: string;
  brand: string | null;
  machine_model: string | null;
  code: string;
  title: string;
  description: string | null;
  causes: string | null;
  solution: string | null;
  severity: 'baixa' | 'media' | 'alta';
  related_part_ids: string[];
};

export type ErrorLog = {
  id: string;
  equipment_id: string;
  error_code_id: string | null;
  custom_code: string | null;
  occurred_at: string;
  notes: string | null;
  resolved_at: string | null;
  maintenance_id: string | null;
  equipment?: Pick<Equipment, 'id' | 'nickname'> | null;
  error_code?: Pick<ErrorCode, 'id' | 'code' | 'title' | 'severity'> | null;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type Purchase = {
  sale_item_id: string;
  sale_id: string;
  sale_code: string;
  sale_date: string;
  sale_status: string;
  currency: string;
  part_id: string;
  part_name: string;
  sku: string;
  part_number: string | null;
  brand: string | null;
  machine_model: string | null;
  condition: string;
  quantity: number;
  unit_price: number;
  serial_number: string | null;
  warranty_months: number | null;
  warranty_until: string | null;
  used_quantity: number;
};

export type CatalogPart = {
  id: string;
  sku: string;
  part_number: string | null;
  name: string;
  brand: string | null;
  machine_model: string | null;
  category: string | null;
  photo_url: string | null;
};

export type StockSuggestion = {
  part_id: string;
  part_name: string;
  sku: string;
  part_number: string | null;
  brand: string | null;
  equipment_count: number;
  expected_qty: number;
  historical_qty: number;
  on_hand: number;
  suggested_qty: number;
  basis: 'recomendacao' | 'historico' | 'estoque';
};

export const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

export const USD = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0);

export const money = (v: number, currency: string) => (currency === 'USD' ? USD(v) : BRL(v));

const parseDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d));

export const formatDate = (d: string | null) => {
  if (!d) return '—';
  // Treat date-only strings (YYYY-MM-DD) as local, not UTC, to avoid timezone shifts.
  const dt = parseDate(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
};

export const formatDateTime = (d: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Whole days from today until `d` (negative = in the past). */
export const daysUntil = (d: string | null) => {
  if (!d) return null;
  const t = parseDate(today()).getTime();
  return Math.round((parseDate(d).getTime() - t) / 86_400_000);
};

export const itemsTotal = (items: MaintenanceItem[] | undefined) =>
  (items ?? []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0);

export const maintenanceTotal = (m: EquipmentMaintenance) => Number(m.labor_cost) + itemsTotal(m.items);

export const fmtQty = (n: number) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2));

export const EQUIPMENT_STATUS: Record<EquipmentStatus, { label: string; tone: 'green' | 'amber' | 'slate' }> = {
  ativo: { label: 'Operando', tone: 'green' },
  parado: { label: 'Parado', tone: 'amber' },
  inativo: { label: 'Inativo', tone: 'slate' },
};

export type PlanState = { label: string; tone: 'green' | 'amber' | 'red' | 'slate'; days: number | null };

export const planState = (p: Pick<Plan, 'active' | 'next_due_at' | 'remind_days_before'>): PlanState => {
  if (!p.active) return { label: 'Pausado', tone: 'slate', days: null };
  const days = daysUntil(p.next_due_at);
  if (days === null) return { label: '—', tone: 'slate', days };
  if (days < 0) return { label: `Atrasado ${-days}d`, tone: 'red', days };
  if (days === 0) return { label: 'Vence hoje', tone: 'amber', days };
  if (days <= p.remind_days_before) return { label: `Vence em ${days}d`, tone: 'amber', days };
  return { label: `Em dia · ${days}d`, tone: 'green', days };
};

export const downloadCsv = (filename: string, rows: (string | number | null)[][]) => {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ; separator + BOM so Excel pt-BR opens it correctly
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
