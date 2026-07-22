import { describe, expect, it } from 'vitest';

import { buildWeeklyPivot } from '@/components/trip-calculator/FuelPricesManager';
import type { FuelPrice } from '@/hooks/useFuelPrices';

const makePrice = (
  id: string,
  fuelType: string,
  price: number,
  date: string,
): FuelPrice => ({
  id,
  fuel_type: fuelType,
  price_per_liter: price,
  price_date: date,
  region: 'Atacama',
  source: 'Bencina en Línea · COPEC Copiapó',
  is_current: true,
  currency: 'CLP',
  created_at: `${date}T12:00:00Z`,
  updated_by: null,
});

describe('buildWeeklyPivot', () => {
  it('carries the latest known price into a week without a new report', () => {
    const pivot = buildWeeklyPivot([
      makePrice('diesel-current', 'diesel', 1248, '2026-07-16'),
      makePrice('diesel-previous', 'diesel', 1247, '2026-07-09'),
      makePrice('gas-93', 'gasolina_93', 1474, '2026-07-09'),
      makePrice('gas-95', 'gasolina_95', 1508, '2026-07-09'),
    ]);

    expect(pivot.weeks).toEqual(['2026-07-13', '2026-07-06']);
    expect(pivot.matrix.diesel['2026-07-13']?.id).toBe('diesel-current');
    expect(pivot.matrix.gasolina_93['2026-07-13']?.id).toBe('gas-93');
    expect(pivot.matrix.gasolina_95['2026-07-13']?.id).toBe('gas-95');
  });

  it('does not backfill a price into weeks before it became effective', () => {
    const pivot = buildWeeklyPivot([
      makePrice('diesel-new', 'diesel', 1248, '2026-07-16'),
      makePrice('gas-older', 'gasolina_93', 1474, '2026-07-09'),
    ]);

    expect(pivot.matrix.diesel['2026-07-06']).toBeUndefined();
    expect(pivot.matrix.gasolina_93['2026-07-13']?.id).toBe('gas-older');
  });
});
