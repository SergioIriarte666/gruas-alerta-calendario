import { describe, expect, it } from 'vitest';
import { getCraneStatusLabel, isCranePermanentlyLocked } from '../craneStatus';

describe('craneStatus', () => {
  it.each(['sold', 'written_off'] as const)('locks terminal status %s', (status) => {
    expect(isCranePermanentlyLocked({ status })).toBe(true);
  });

  it.each(['active', 'inactive'] as const)('keeps operational status %s editable', (status) => {
    expect(isCranePermanentlyLocked({ status })).toBe(false);
  });

  it('uses the user-facing terminal labels', () => {
    expect(getCraneStatusLabel('sold')).toBe('Vendida');
    expect(getCraneStatusLabel('written_off')).toBe('Dada de baja');
  });
});
