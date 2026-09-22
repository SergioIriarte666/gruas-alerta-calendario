import type { Database, Json } from '@/integrations/supabase/types';
import { isMeaningfulServiceChange, serviceChangeIdentity } from './serviceChangeHistory';
import { FIELD_LABELS, formatValue } from './serviceHistoryPresentation';
import { formatCalendarDate, isCalendarDate } from '@/utils/calendarDate';

type Tables = Database['public']['Tables'];
export type ServiceAuditHistory = Tables['service_change_history']['Row'];
export type CostAuditHistory = Tables['cost_change_history']['Row'];
export type CostAuditSnapshot = Pick<Tables['recovery_audit_entries']['Row'], 'id' | 'record_id' | 'old_data' | 'new_data' | 'created_at' | 'user_id' | 'action_type'>;
export type AuditService = Pick<Tables['services']['Row'], 'id' | 'folio' | 'license_plate' | 'client_id'>;
export type AuditClient = Pick<Tables['clients']['Row'], 'id' | 'name' | 'rut' | 'department'>;
export type AuditCost = Pick<Tables['costs']['Row'], 'id' | 'service_id' | 'service_folio' | 'description'>;
export type AuditProfile = Pick<Tables['profiles']['Row'], 'id' | 'full_name' | 'email'>;

export interface ServiceAuditRow {
  id: string;
  date: string;
  userId: string | null;
  userName: string;
  serviceIds: string[];
  folios: string[];
  plates: string[];
  clients: { id: string; name: string }[];
  field: string;
  label: string;
  category: string;
  action: string;
  before: string | null;
  after: string | null;
  summary: string;
  costId?: string;
  currentAssociation?: boolean;
}

export const AUDIT_CATEGORIES = [
  ['all', 'Todos los cambios'], ['dates', 'Fechas y horarios'], ['folio', 'Folio'],
  ['plate', 'Patente'], ['costs', 'Costos y comisiones'], ['value', 'Valor del servicio'],
  ['status', 'Estado'], ['other', 'Otros cambios'],
] as const;
export const AUDIT_ACTIONS: Record<string, string> = {
  CREATE: 'Agregado', UPDATE: 'Modificado', DELETE: 'Eliminado', SNAPSHOT: 'Estado inicial',
};
const COST_LABELS: Record<string, string> = {
  amount: 'Monto', description: 'Descripción', date: 'Fecha', category_id: 'Categoría',
  subcategory: 'Subcategoría', service_id: 'Servicio asociado', service_folio: 'Folio asociado',
  operator_id: 'Operador', crane_id: 'Grúa', notes: 'Notas', payment_date: 'Fecha de pago',
  payment_batch_id: 'Lote de pago', document_number: 'N° documento', document_type: 'Tipo de documento',
  entity: 'Empresa', paid_by: 'Pagado por', supplier_id: 'Proveedor', cost_center_id: 'Centro de costo',
  supplier_invoice_id: 'Factura proveedor', purchase_quantity: 'Cantidad', purchase_unit_cost: 'Costo unitario',
  registro: 'Registro',
};

export function auditObject(value: Json | null | undefined): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function parseSnapshot(value: string | null): Record<string, Json> {
  try { return auditObject(JSON.parse(value || 'null')); } catch { return {}; }
}
const str = (value: unknown): string | null => value == null ? null : typeof value === 'object' ? JSON.stringify(value) : String(value);
const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

export function auditCategory(field: string): string {
  if (['operator_commission', 'resource_commission', 'outsourced_cost'].includes(field)) return 'costs';
  if (field.includes('date') || field.endsWith('_time')) return 'dates';
  if (field === 'folio') return 'folio';
  if (field === 'license_plate') return 'plate';
  if (['value', 'custody_total_amount', 'custody_daily_rate', 'excess_amount', 'client_covered_amount'].includes(field)) return 'value';
  return field === 'status' ? 'status' : 'other';
}

/** Reuses immutable snapshots; current links are explicitly identified as a fallback. */
export function buildServiceAuditRows(
  histories: ServiceAuditHistory[], costHistories: CostAuditHistory[], snapshots: CostAuditSnapshot[],
  services: AuditService[], costs: AuditCost[], profiles: AuditProfile[], clients: AuditClient[] = [],
): ServiceAuditRow[] {
  const serviceMap = new Map(services.map(s => [s.id, s]));
  const clientMap = new Map(clients.map(client => [client.id, [client.name, client.department, client.rut].filter(Boolean).join(' · ')]));
  const resolveClients = (ids: (string | null | undefined)[]) => unique(ids).map(id => ({ id, name: clientMap.get(id) || `Cliente no disponible (${id})` }));
  const costMap = new Map(costs.map(c => [c.id, c]));
  const users = new Map(profiles.map(p => [p.id, p.full_name || p.email || 'Usuario sin nombre']));
  const userName = (id: string | null) => id ? users.get(id) || 'Usuario no disponible' : 'Sistema';
  const rows: ServiceAuditRow[] = [];
  const seen = new Set<string>();
  for (const h of histories) {
    const comparable = { id: h.id, eventId: h.event_id, serviceId: h.service_id, changeType: h.change_type, fieldName: h.field_name, oldValue: h.old_value, newValue: h.new_value };
    const identity = serviceChangeIdentity(comparable);
    if (!isMeaningfulServiceChange(comparable) || seen.has(identity)) continue;
    seen.add(identity);
    const current = serviceMap.get(h.service_id);
    const initial = h.field_name === 'servicio' ? parseSnapshot(h.new_value || h.old_value) : {};
    rows.push({
      id: `service:${h.id}`, date: h.changed_at, userId: h.changed_by, userName: userName(h.changed_by),
      serviceIds: unique([h.service_id]), folios: unique([h.service_folio, current?.folio, h.field_name === 'folio' ? h.old_value : null, h.field_name === 'folio' ? h.new_value : null]),
      plates: unique([current?.license_plate, str(initial.license_plate), h.field_name === 'license_plate' ? h.old_value : null, h.field_name === 'license_plate' ? h.new_value : null]),
      clients: resolveClients([current?.client_id, ...(h.field_name === 'client_id' ? [h.old_value, h.new_value] : [])]),
      field: h.field_name, label: FIELD_LABELS[h.field_name] || h.field_name, category: auditCategory(h.field_name),
      action: h.change_type, before: h.old_value, after: h.new_value, summary: h.change_summary || '',
    });
  }

  // Full cost snapshots cover fields omitted by older cost-history triggers.
  // Match by cost + transaction time, never just by current service. Automated
  // inserts may use created_by in one source and a null actor in the other.
  // Preserve microseconds so distinct transactions are not merged.
  const eventKey = (id: string, date: string) => `${id}|${Math.floor(Date.parse(date) / 1000)}|${(date.match(/\.(\d+)/)?.[1] || '').padEnd(6, '0')}`;
  const snapshotEvents = new Map<string, CostAuditSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = eventKey(snapshot.record_id, snapshot.created_at);
    snapshotEvents.set(key, [...(snapshotEvents.get(key) || []), snapshot]);
  }
  const represented = new Set<string>();
  const comparableValue = (field: string, value: string | null) => ['amount', 'purchase_unit_cost', 'purchase_quantity'].includes(field) && value !== null && value !== '' && Number.isFinite(Number(value)) ? String(Number(value)) : value ?? '';
  const changeKey = (key: string, action: string, field: string, before: string | null, after: string | null) => `${key}|${action}|${field}|${comparableValue(field, before)}|${comparableValue(field, after)}`;

  function appendCost(id: string, costId: string, date: string, actor: string | null, action: string, field: string, before: string | null, after: string | null, oldData: Record<string, Json>, newData: Record<string, Json>, summary: string, currentAssociation = false) {
    const ids = unique([str(oldData.service_id), str(newData.service_id), field === 'service_id' ? before : null, field === 'service_id' ? after : null]);
    const folios = unique([str(oldData.service_folio), str(newData.service_folio), ...ids.map(serviceId => serviceMap.get(serviceId)?.folio)]);
    if (!ids.length && !folios.length) return; // Expense unrelated to any service.
    const displayLink = (value: string | null) => value ? serviceMap.get(value)?.folio || value : null;
    rows.push({
      id, date, userId: actor, userName: userName(actor), serviceIds: ids, folios,
      plates: unique(ids.map(serviceId => serviceMap.get(serviceId)?.license_plate)),
      clients: resolveClients(ids.map(serviceId => serviceMap.get(serviceId)?.client_id)),
      field, label: `Costo · ${COST_LABELS[field] || field}`, category: 'costs', action,
      before: field === 'service_id' ? displayLink(before) : before,
      after: field === 'service_id' ? displayLink(after) : after,
      summary, costId, currentAssociation,
    });
  }
  for (const s of snapshots) {
    const oldData = auditObject(s.old_data), newData = auditObject(s.new_data);
    const key = eventKey(s.record_id, s.created_at);
    const action = s.action_type === 'insert' ? 'CREATE' : s.action_type === 'delete' ? 'DELETE' : 'UPDATE';
    const fields = action === 'UPDATE' ? Object.keys(COST_LABELS).filter(f => f !== 'registro' && str(oldData[f]) !== str(newData[f])) : ['registro'];
    for (const field of fields) {
      const before = field === 'registro' ? (s.old_data ? JSON.stringify(oldData) : null) : str(oldData[field]);
      const after = field === 'registro' ? (s.new_data ? JSON.stringify(newData) : null) : str(newData[field]);
      represented.add(changeKey(key, action, field, before, after));
      if (field === 'registro') represented.add(`${key}|${action}|registro`);
      appendCost(`cost-snapshot:${s.id}:${field}`, s.record_id, s.created_at, s.user_id, action, field, before, after, oldData, newData, str(newData.description || oldData.description) || '');
    }
  }
  for (const h of costHistories) {
    const key = eventKey(h.cost_id, h.changed_at);
    if (represented.has(changeKey(key, h.change_type, h.field_name, h.old_value, h.new_value)) || (h.field_name === 'registro' && represented.has(`${key}|${h.change_type}|registro`))) continue;
    if (!isMeaningfulServiceChange({ changeType: h.change_type, fieldName: h.field_name, oldValue: h.old_value, newValue: h.new_value })) continue;
    const matching = snapshotEvents.get(key) || [];
    // Multiple changes in one transaction may have several snapshots. Only
    // use a unique snapshot; don't guess a historical service association.
    const snapshot = matching.length === 1 ? matching[0] : undefined;
    let oldData = snapshot ? auditObject(snapshot.old_data) : parseSnapshot(h.old_value);
    let newData = snapshot ? auditObject(snapshot.new_data) : parseSnapshot(h.new_value);
    let currentAssociation = false;
    if (!('service_id' in oldData) && !('service_id' in newData) && h.field_name !== 'service_id') {
      newData = { ...costMap.get(h.cost_id) };
      currentAssociation = true;
    }
    // A reassignment has explicit historical endpoints, including unlinking.
    if (h.field_name === 'service_id') {
      oldData = { service_id: h.old_value }; newData = { service_id: h.new_value };
    }
    appendCost(`cost-history:${h.id}`, h.cost_id, h.changed_at, h.changed_by, h.change_type, h.field_name, h.old_value, h.new_value, oldData, newData, h.change_summary || '', currentAssociation);
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function formatAuditValue(row: ServiceAuditRow, value: string | null): string {
  if (value == null || value === '') return '—';
  if (row.field === 'registro' || row.field === 'servicio' || row.action === 'SNAPSHOT') {
    const snapshot = parseSnapshot(value);
    if (Object.keys(snapshot).length) return Object.entries(snapshot)
      .filter(([key, v]) => v != null && v !== '' && (row.costId ? ['description', 'amount', 'date', 'service_folio'].includes(key) : key in FIELD_LABELS))
      .map(([key, v]) => `${COST_LABELS[key] || FIELD_LABELS[key] || key}: ${formatAuditValue({ ...row, field: key, action: 'UPDATE' }, str(v))}`).join(' · ') || 'Registro guardado';
  }
  if (isCalendarDate(value)) return formatCalendarDate(value);
  if (['amount', 'purchase_unit_cost'].includes(row.field) && Number.isFinite(Number(value))) return `$${Number(value).toLocaleString('es-CL')}`;
  return formatValue(row.field, value);
}

export function filterServiceAuditRows(rows: ServiceAuditRow[], search: string, category: string, userId = 'all', clientId = 'all'): ServiceAuditRow[] {
  const term = search.toLocaleLowerCase().replace(/[\s#.-]/g, '');
  return rows.filter(row => (category === 'all' || row.category === category)
    && (clientId === 'all' || (clientId === 'unknown' ? !row.clients.length : row.clients.some(client => client.id === clientId)))
    && (userId === 'all' || (row.userId || 'system') === userId)
    && (!term || [...row.folios, ...row.plates].some(value => value.toLocaleLowerCase().replace(/[\s#.-]/g, '').includes(term))));
}

/** Excel-compatible CSV; neutralize formulas in user-controlled descriptions. */
export function serviceAuditCsv(rows: ServiceAuditRow[], formatDate: (date: string) => string): string {
  const cells = (values: string[]) => values.map(value => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`).join(';');
  return '\uFEFF' + [cells(['Fecha de modificación', 'Responsable', 'Folios', 'Patentes de referencia', 'Clientes de referencia', 'Acción', 'Campo', 'Antes', 'Después', 'Detalle', 'Vínculo del costo']),
    ...rows.map(r => cells([formatDate(r.date), r.userName, r.folios.join(' / '), r.plates.join(' / '), r.clients.map(client => client.name).join(' / ') || 'Cliente no identificado', AUDIT_ACTIONS[r.action] || r.action, r.label, formatAuditValue(r, r.before), formatAuditValue(r, r.after), r.summary, r.currentAssociation ? 'Asociación de referencia; vínculo histórico no disponible' : 'Registro histórico']))].join('\r\n');
}
