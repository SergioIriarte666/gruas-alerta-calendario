import { describe, expect, it } from 'vitest';
import { buildLineConsumptionPayload, resolveLineConsumption, validateLineConsumption } from '../xmlInventoryConsumption';

describe('destino por línea de compra XML', () => {
  it('mantiene en bodega por defecto aunque exista una grúa sugerida', () => {
    const value = resolveLineConsumption(4, undefined, 'crane-1');
    expect(buildLineConsumptionPayload(value, 'crane-1')).toEqual({ consumption_quantity: 0, consumption_crane_id: null });
  });

  it('consume solo las líneas marcadas y permite cantidades parciales y distintas grúas', () => {
    const selections = [
      { immediate: true, quantity: 2, craneId: '' },
      { immediate: true, quantity: 1, craneId: 'crane-2' },
      { immediate: false, quantity: 1, craneId: 'crane-1' },
    ];
    expect(selections.map(value => buildLineConsumptionPayload(value, 'crane-1'))).toEqual([
      { consumption_quantity: 2, consumption_crane_id: 'crane-1' },
      { consumption_quantity: 1, consumption_crane_id: 'crane-2' },
      { consumption_quantity: 0, consumption_crane_id: null },
    ]);
  });

  it.each([0, -1, 1.5, 5, NaN, Infinity])('rechaza una cantidad inválida: %s', quantity => {
    expect(validateLineConsumption(4, { immediate: true, quantity, craneId: 'crane-1' })).toBeTruthy();
  });

  it('exige grúa únicamente para las líneas con consumo', () => {
    expect(validateLineConsumption(4, { immediate: true, quantity: 2, craneId: '' })).toBeTruthy();
    expect(validateLineConsumption(4, { immediate: true, quantity: 2, craneId: '' }, 'crane-1')).toBeNull();
    expect(validateLineConsumption(4, { immediate: false, quantity: 2, craneId: '' })).toBeNull();
  });
});
