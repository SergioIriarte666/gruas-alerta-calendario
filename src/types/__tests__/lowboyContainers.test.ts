import { describe, expect, it } from 'vitest';
import { containerAdditionalCost, containerMargin, containerTotalCost, type LowboyContainerRow } from '@/types/lowboyContainers';

const container = {
  acquisition_net_cost: 2_360_000,
  sale_net_price: 3_200_000,
  costs: [
    { net_amount: 150_000 },
    { net_amount: 90_000 },
  ],
} as LowboyContainerRow;

describe('margen de contenedores Lowboy', () => {
  it('suma los costos adicionales netos', () => {
    expect(containerAdditionalCost(container)).toBe(240_000);
  });

  it('calcula costo total neto y margen por unidad', () => {
    expect(containerTotalCost(container)).toBe(2_600_000);
    expect(containerMargin(container)).toBe(600_000);
  });
});
