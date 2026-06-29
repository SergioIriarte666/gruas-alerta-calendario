import { describe, expect, it } from 'vitest';

import type { Crane } from '@/types';
import type { ConsumptionRate } from '@/hooks/useConsumptionRates';
import { resolveEffectiveConsumptionRate } from '@/hooks/useTripCalculation';

const baseRate: ConsumptionRate = {
  id: 'rate-light',
  crane_type: 'light',
  fuel_type: 'diesel',
  base_consumption_per_km: 1 / 4.5,
  loaded_consumption_factor: 1.2,
  towing_consumption_factor: 1.3,
  toll_vehicle_category: 'CAMION_2_EJES',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const craneOverride: Crane = {
  id: 'crane-1',
  licensePlate: 'TLYF-23',
  brand: 'Chevrolet',
  model: 'FRR 1119',
  type: 'light',
  tollVehicleCategory: 'CAMION_2_EJES',
  fuelTypeOverride: 'diesel',
  baseConsumptionPerKmOverride: 1 / 5.7,
  loadedConsumptionFactorOverride: 1.12,
  towingConsumptionFactorOverride: 1.25,
  circulationPermitExpiry: '2026-12-31',
  insuranceExpiry: '2026-12-31',
  technicalReviewExpiry: '2026-12-31',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('resolveEffectiveConsumptionRate', () => {
  it('returns the generic type rate when the crane has no override', () => {
    const resolved = resolveEffectiveConsumptionRate([baseRate], 'light', null);

    expect(resolved).toMatchObject({
      crane_type: 'light',
      base_consumption_per_km: 1 / 4.5,
      loaded_consumption_factor: 1.2,
      towing_consumption_factor: 1.3,
      source: 'type_default',
    });
  });

  it('applies crane-specific override values when present', () => {
    const resolved = resolveEffectiveConsumptionRate([baseRate], 'light', craneOverride);

    expect(resolved).toMatchObject({
      crane_type: 'light',
      fuel_type: 'diesel',
      base_consumption_per_km: 1 / 5.7,
      loaded_consumption_factor: 1.12,
      towing_consumption_factor: 1.25,
      source: 'crane_override',
    });
  });
});
