import { describe, expect, it } from 'vitest';
import { applyCraneToSelectedLines, isImportDateValid } from '../xmlInventoryWizard';

describe('asignación explícita de grúas en el asistente XML', () => {
  it('modifica solo los productos activos seleccionados y conserva cantidades parciales', () => {
    const original = {
      first: { immediate: true, quantity: 2, craneId: 'crane-1' },
      second: { immediate: false, quantity: 1, craneId: '' },
      tool: { immediate: false, quantity: 1, craneId: '' },
    };
    const result = applyCraneToSelectedLines([
      { key: 'first', quantity: 4 }, { key: 'second', quantity: 1 }, { key: 'tool', quantity: 1 },
    ], new Set(['first', 'second', 'discarded']), original, 'crane-2');
    expect(result.first).toEqual({ immediate: true, quantity: 2, craneId: 'crane-2' });
    expect(result.second).toEqual({ immediate: true, quantity: 1, craneId: 'crane-2' });
    expect(result.tool).toEqual(original.tool);
    expect(result).not.toHaveProperty('discarded');
    expect(original.first.craneId).toBe('crane-1');
  });

  it.each(['', '2026-02-30', '2026-13-01', '18/10/2026'])('rechaza fechas inválidas: %s', value => {
    expect(isImportDateValid(value)).toBe(false);
  });

  it('acepta fechas reales y años bisiestos', () => {
    expect(isImportDateValid('2026-10-18')).toBe(true);
    expect(isImportDateValid('2028-02-29')).toBe(true);
  });
});
