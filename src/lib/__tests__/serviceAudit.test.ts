import { describe, expect, it } from 'vitest';
import { buildServiceAuditRows, filterServiceAuditRows, formatAuditValue, serviceAuditCsv, type ServiceAuditHistory, type CostAuditHistory, type CostAuditSnapshot } from '../serviceAudit';

const date = '2026-09-22T15:00:00Z';
const service = { id: 'service-1', folio: 'SRV-1052', license_plate: 'ABCD12', client_id: 'client-1' };
const user = { id: 'user-1', full_name: 'María', email: 'maria@example.test' };
const history = (overrides: Partial<ServiceAuditHistory> = {}): ServiceAuditHistory => ({ id: 'h1', event_id: 'event-1', service_id: service.id, service_folio: service.folio, changed_by: user.id, changed_at: date, change_type: 'UPDATE', field_name: 'value', old_value: '500000', new_value: '600000', change_summary: null, change_context: null, ...overrides });
const costHistory = (overrides: Partial<CostAuditHistory> = {}): CostAuditHistory => ({ id: 'c1', cost_id: 'cost-1', changed_by: user.id, changed_at: date, change_type: 'UPDATE', field_name: 'amount', old_value: '80000.00', new_value: '95000.00', change_summary: null, change_context: null, ...overrides });
const snapshot = (overrides: Partial<CostAuditSnapshot> = {}): CostAuditSnapshot => ({ id: 's1', record_id: 'cost-1', created_at: date, user_id: user.id, action_type: 'update', old_data: { service_id: service.id, service_folio: service.folio, description: 'Combustible', amount: 80000 }, new_data: { service_id: service.id, service_folio: service.folio, description: 'Combustible', amount: 95000 }, ...overrides });
const build = (h: ServiceAuditHistory[] = [], c: CostAuditHistory[] = [], s: CostAuditSnapshot[] = []) => buildServiceAuditRows(h, c, s, [service], [], [user]);

describe('service audit report', () => {
  it('filters both service and cost changes by client and exports only those results', () => {
    const clients = [
      { id: 'client-1', name: 'Cliente Norte', rut: '1-9', department: 'Operaciones' },
      { id: 'client-2', name: 'Cliente Sur', rut: '2-7', department: null },
    ];
    const rows = buildServiceAuditRows([history(), history({ id: 'h2', service_id: 'service-2', service_folio: 'SRV-2000' })], [], [snapshot()], [service, { id: 'service-2', folio: 'SRV-2000', license_plate: 'EFGH34', client_id: 'client-2' }], [], [user], clients);
    const filtered = filterServiceAuditRows(rows, '', 'all', 'all', 'client-1');
    expect(filtered).toHaveLength(2);
    expect(filtered.some(row => row.costId)).toBe(true);
    expect(filterServiceAuditRows(rows, '', 'costs', user.id, 'client-1')).toHaveLength(1);
    const csv = serviceAuditCsv(filtered, date => date);
    expect(csv).toContain('Cliente Norte');
    expect(csv).not.toContain('Cliente Sur');
  });
  it('finds a client reassignment through either endpoint and preserves unidentified records', () => {
    const rows = build([history({ field_name: 'client_id', old_value: 'previous-client', new_value: 'client-1' }), history({ id: 'deleted', service_id: null })]);
    expect(filterServiceAuditRows(rows, '', 'all', 'all', 'previous-client')).toHaveLength(1);
    expect(filterServiceAuditRows(rows, '', 'all', 'all', 'client-1')).toHaveLength(1);
    expect(filterServiceAuditRows(rows, '', 'all', 'all', 'unknown')).toHaveLength(1);
    expect(filterServiceAuditRows(rows, '', 'all')).toHaveLength(2);
  });
  it('preserves real before/after values and suppresses duplicate service trigger entries', () => {
    const rows = build([history(), history({ id: 'duplicate' }), history({ id: 'noop', field_name: 'operator_commission', old_value: null, new_value: '0' })]);
    expect(rows).toHaveLength(1);
    expect(formatAuditValue(rows[0], rows[0].before)).toBe('$500.000');
    expect(rows[0].userName).toBe('María');
  });
  it('counts cost amount edits once across both historical sources', () => {
    const rows = build([], [costHistory()], [snapshot()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'costs', before: '80000', after: '95000', folios: ['SRV-1052'] });
  });
  it('does not duplicate automated cost creations with different actor fallbacks', () => {
    const rows = build([], [costHistory({ change_type: 'CREATE', field_name: 'registro', old_value: null, new_value: 'Combustible' })], [snapshot({ action_type: 'insert', old_data: null, user_id: null })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].userName).toBe('Sistema');
  });
  it('retains a deleted cost and its original amount without a live cost or service', () => {
    const rows = buildServiceAuditRows([], [costHistory({ change_type: 'DELETE', field_name: 'registro', old_value: JSON.stringify({ service_id: service.id, service_folio: service.folio, description: 'Peaje', amount: 5000 }), new_value: null })], [], [], [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].folios).toEqual([service.folio]);
    expect(formatAuditValue(rows[0], rows[0].before)).toContain('$5.000');
    expect(formatAuditValue(rows[0], rows[0].after)).toBe('—');
  });
  it('finds a reassigned or unlinked cost from either historical service', () => {
    const rows = buildServiceAuditRows([], [costHistory({ field_name: 'service_id', old_value: service.id, new_value: 'service-2' })], [], [service, { id: 'service-2', folio: 'SRV-1053', license_plate: 'EFGH34', client_id: 'client-2' }], [], [user]);
    expect(filterServiceAuditRows(rows, '1052', 'costs')).toHaveLength(1);
    expect(filterServiceAuditRows(rows, '1053', 'costs')).toHaveLength(1);
    const unlinked = build([], [costHistory({ field_name: 'service_id', old_value: service.id, new_value: null })]);
    expect(unlinked[0]).toMatchObject({ before: service.folio, after: null, currentAssociation: false });
  });
  it('labels a reference association instead of pretending it is historical', () => {
    const rows = buildServiceAuditRows([], [costHistory()], [], [service], [{ id: 'cost-1', service_id: service.id, service_folio: service.folio, description: 'Combustible' }], []);
    expect(rows[0].currentAssociation).toBe(true);
  });
  it('does not associate an explicitly unrelated historical cost with its current service', () => {
    const rows = buildServiceAuditRows([], [costHistory()], [snapshot({ old_data: { service_id: null, amount: 80000 }, new_data: { service_id: null, amount: 95000 } })], [service], [{ id: 'cost-1', service_id: service.id, service_folio: service.folio, description: '' }], []);
    expect(rows).toHaveLength(0);
  });
  it('searches old and new folios and plates, including punctuation', () => {
    const rows = build([history({ field_name: 'folio', old_value: 'SRV-0001', new_value: service.folio }), history({ id: 'plate', field_name: 'license_plate', old_value: 'WXYZ99', new_value: service.license_plate })]);
    expect(filterServiceAuditRows(rows, '#SRV 0001', 'folio')).toHaveLength(1);
    expect(filterServiceAuditRows(rows, 'WX.YZ-99', 'plate', user.id)).toHaveLength(1);
    expect(filterServiceAuditRows(rows, 'WX.YZ-99', 'plate', 'different-user')).toHaveLength(0);
  });
  it('includes meaningful additional cost fields from complete snapshots', () => {
    const rows = build([], [], [snapshot({ old_data: { service_id: service.id, cost_center_id: 'center-1', updated_at: 'old' }, new_data: { service_id: service.id, cost_center_id: 'center-2', updated_at: 'new' } })]);
    expect(rows.map(r => r.field)).toEqual(['cost_center_id']);
  });
  it('exports every supplied row with escaped CSV cells and neutralized formulas', () => {
    const rows = build([history({ field_name: 'observations', old_value: 'Texto; "original"', new_value: '=HYPERLINK("x")' })]);
    const csv = serviceAuditCsv(rows, () => '22/09/2026 12:00:00');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Texto; ""original"""');
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('22/09/2026 12:00:00');
  });
});
