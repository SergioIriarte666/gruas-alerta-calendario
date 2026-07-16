import { describe, expect, it } from 'vitest';
import type { LowboyContainerRow } from '@/types/lowboyContainers';
import {
  composeLowboyContainerDescription,
  distributeLowboySaleNet,
  recalculateLowboyAssignmentDefaults,
} from '@/utils/lowboyContainerAssignments';

describe('lowboy container sale assignments', () => {
  it('reparte el neto sin perder pesos por redondeo', () => {
    expect(distributeLowboySaleNet(3_300_000, 2)).toEqual([1_650_000, 1_650_000]);
    expect(distributeLowboySaleNet(10, 3)).toEqual([4, 3, 3]);
  });

  it('recalcula sólo precios que no fueron editados manualmente', () => {
    expect(recalculateLowboyAssignmentDefaults([
      { container_id: 'a', sale_net_price: 1_600_000, manuallyEdited: true },
      { container_id: 'b', sale_net_price: 1_650_000, manuallyEdited: false },
    ], 4_000_000)).toEqual([
      { container_id: 'a', sale_net_price: 1_600_000, manuallyEdited: true },
      { container_id: 'b', sale_net_price: 2_000_000, manuallyEdited: false },
    ]);
  });

  it('compone descripción para una o varias unidades', () => {
    const base = { size: '20', serial_number: 'LATU300134-5' } as LowboyContainerRow;
    expect(composeLowboyContainerDescription([base])).toBe("Contenedor 20' LATU300134-5");
    expect(composeLowboyContainerDescription([base, { ...base, id: 'b', serial_number: null }])).toBe('2 contenedores: LATU300134-5, Sin serie');
  });
});
