import { describe, expect, it } from 'vitest';
import { computeFleteNeto, hasFleteServiceValue, parseFleteAdjustment } from '../lowboyFleteNeto';

const row = (service_value: string) => ({ service_value });

describe('computeFleteNeto', () => {
  it('suma los valores de los vehículos (sin ajuste)', () => {
    const result = computeFleteNeto([row('50000'), row('30000')]);
    expect(result).toMatchObject({ vehicleCount: 2, vehiclesSum: 80000, adjustment: 0, hasAdjustment: false, hasBreakdown: true, sum: 80000 });
  });

  it('resta un ajuste negativo (caso: 2 vehículos + ajuste −10.000)', () => {
    const result = computeFleteNeto([row('50000'), row('30000')], '-10000');
    expect(result).toMatchObject({ vehicleCount: 2, vehiclesSum: 80000, adjustment: -10000, hasAdjustment: true, hasBreakdown: true, sum: 70000 });
  });

  it('suma un ajuste positivo (recargo)', () => {
    expect(computeFleteNeto([row('50000')], '10000').sum).toBe(60000);
  });

  it('permite un neto negativo (el bloqueo vive en la validación, no aquí)', () => {
    expect(computeFleteNeto([], '-10000')).toMatchObject({ vehicleCount: 0, hasAdjustment: true, hasBreakdown: true, sum: -10000 });
  });

  it('marca desglose cuando solo hay ajuste, sin vehículos', () => {
    expect(computeFleteNeto([], '5000')).toMatchObject({ vehicleCount: 0, hasBreakdown: true, sum: 5000 });
  });

  it('un ajuste vacío o 0 no es desglose', () => {
    expect(computeFleteNeto([], '')).toMatchObject({ hasBreakdown: false, adjustment: 0, sum: 0 });
    expect(computeFleteNeto([], '0')).toMatchObject({ hasBreakdown: false, adjustment: 0, sum: 0 });
    expect(computeFleteNeto([row('')], '0')).toMatchObject({ hasBreakdown: false, vehicleCount: 0, sum: 0 });
  });

  it('recalcula al instante si se elimina un valor', () => {
    expect(computeFleteNeto([row('50000'), row('30000')], '-10000').sum).toBe(70000);
    expect(computeFleteNeto([row('50000')], '-10000').sum).toBe(40000);
  });

  it('ignora un ajuste parcial "-" (evita NaN)', () => {
    expect(parseFleteAdjustment('-')).toBe(0);
    expect(hasFleteServiceValue('-')).toBe(false);
    expect(computeFleteNeto([row('50000')], '-').sum).toBe(50000);
  });

  it('acepta números además de strings', () => {
    expect(computeFleteNeto([{ service_value: 50000 }], -10000).sum).toBe(40000);
  });
});
