import { describe, expect, it } from 'vitest';
import { buildTripChildFinance, buildTripParentFinance } from '../tripFinance';
import type { TripChildService } from '@/hooks/services/useTripServices';

// Viaje real SRV-7129: $300.000 de costos repartidos por pesos 600K / 1M / 1M.
const child = (over: Partial<TripChildService> & { id: string; folio: string }): TripChildService => ({
  licensePlate: '',
  vehicleBrand: '',
  vehicleModel: '',
  value: 0,
  status: 'quoted',
  purchaseOrder: '',
  incidentNumber: '',
  clientId: 'c',
  clientName: '',
  weight: 0,
  allocatedAmount: 0,
  ...over,
});

const children = [
  child({ id: 'a', folio: '3315185-4', clientName: 'Auxilia', value: 600000, weight: 600000 / 2600000, allocatedAmount: 69231 }),
  child({ id: 'b', folio: 'SRV-7130', clientName: 'Mutual', value: 1000000, weight: 1000000 / 2600000, allocatedAmount: 115384 }),
  child({ id: 'c', folio: 'SRV-7131', clientName: 'Mutual', value: 1000000, weight: 1000000 / 2600000, allocatedAmount: 115385 }),
];

describe('buildTripParentFinance', () => {
  it('valor del viaje = suma de hijos y utilidad = viaje − costos del padre', () => {
    const totals = { a: 69231, b: 115384, c: 115385 };
    const finance = buildTripParentFinance(children, totals, 300000);
    expect(finance.tripValue).toBe(2600000);
    expect(finance.vehicleCount).toBe(3);
    expect(finance.profit).toBe(2300000);
    expect(finance.vehicles.map(v => v.allocatedAmount)).toEqual([69231, 115384, 115385]);
    expect(finance.vehicles.reduce((s, v) => s + v.allocatedAmount, 0)).toBe(300000);
  });

  it('separa costos directos del hijo del prorrateo y calcula su utilidad', () => {
    const totals = { a: 69231 + 20000, b: 115384, c: 115385 };
    const finance = buildTripParentFinance(children, totals, 300000);
    expect(finance.vehicles[0].directCosts).toBe(20000);
    expect(finance.vehicles[0].totalCosts).toBe(89231);
    expect(finance.vehicles[0].profit).toBe(600000 - 89231);
  });

  it('sin totales cargados usa el prorrateo como costo del hijo', () => {
    const finance = buildTripParentFinance(children, {}, 300000);
    expect(finance.vehicles[1].directCosts).toBe(0);
    expect(finance.vehicles[1].totalCosts).toBe(115384);
  });
});

describe('buildTripChildFinance', () => {
  it('costos = directos + prorrateo; utilidad = valor − total', () => {
    const finance = buildTripChildFinance(600000, 0, {
      parentId: 'p', parentFolio: 'SRV-7129', tripValue: 2600000, weight: 0.2308, allocatedAmount: 69231,
    });
    expect(finance.parentFolio).toBe('SRV-7129');
    expect(finance.totalCosts).toBe(69231);
    expect(finance.profit).toBe(530769);
  });

  it('mientras no llega el prorrateo no rompe: asigna 0', () => {
    const finance = buildTripChildFinance(600000, 15000, undefined);
    expect(finance.allocatedAmount).toBe(0);
    expect(finance.totalCosts).toBe(15000);
    expect(finance.parentFolio).toBe('');
  });
});
