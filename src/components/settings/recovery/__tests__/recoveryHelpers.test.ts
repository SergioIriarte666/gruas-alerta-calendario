import { describe, expect, it } from 'vitest';
import type { RecoveryAuditEntry } from '@/types/recovery';
import { changedFields, groupRecoveryOperations, recoveryConfirmationPhrase } from '../recoveryHelpers';

const entry = (overrides: Partial<RecoveryAuditEntry> = {}): RecoveryAuditEntry => ({
  id: crypto.randomUUID(), operation_id: '11111111-1111-4111-8111-111111111111',
  organization_id: '22222222-2222-4222-8222-222222222222', user_id: '33333333-3333-4333-8333-333333333333',
  module: 'invoices', action_type: 'update', source: 'individual', record_id: crypto.randomUUID(), record_label: 'HIST-F-42',
  old_data: { status: 'sent', total: 100 }, new_data: { status: 'paid', total: 100 },
  created_at: '2026-06-21T12:00:00.000Z', reverted_at: null, reverted_by: null, reversal_operation_id: null,
  reversible: true, non_reversible_reason: null, metadata: {}, ...overrides,
});

describe('recovery helpers', () => {
  it('agrupa un lote bajo un operation_id compartido', () => {
    const rows = [entry(), entry()];
    const operations = groupRecoveryOperations(rows, { [rows[0].user_id!]: 'Admin' });
    expect(operations).toHaveLength(1);
    expect(operations[0].entries).toHaveLength(2);
    expect(operations[0].userName).toBe('Admin');
  });

  it('conserva old_data/new_data y detecta solo campos modificados', () => {
    expect(changedFields(entry())).toEqual(['status']);
  });

  it('distingue operaciones no reversibles y revertidas', () => {
    expect(groupRecoveryOperations([entry({ reversible: false })], {})[0].status).toBe('blocked');
    expect(groupRecoveryOperations([entry({ reverted_at: '2026-06-21T13:00:00Z' })], {})[0].status).toBe('reverted');
  });

  it('genera una confirmacion reforzada con cantidad exacta', () => {
    expect(recoveryConfirmationPhrase(36)).toBe('REVERTIR 36 REGISTROS');
  });
});
