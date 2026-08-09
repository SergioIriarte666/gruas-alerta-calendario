import { describe, expect, it } from 'vitest';
import {
  CLOSURE_CANDIDATE_STATUSES,
  getClosureValueKey,
  isClosureValueAvailable,
} from '@/utils/closureBilling';

const baseInput = {
  serviceId: 'service-1',
  hasExcess: true,
  thirdPartyClientId: 'third-party-1',
  excessAmount: 588_118,
};

describe('facturación separada de excedentes', () => {
  it('consulta servicios facturados para detectar una contraparte pendiente', () => {
    expect(CLOSURE_CANDIDATE_STATUSES).toContain('invoiced');
    expect(CLOSURE_CANDIDATE_STATUSES).toContain('partially_invoiced');
  });

  it('deja disponible el excedente cuando la cobertura ya está en un cierre', () => {
    const usedKeys = new Set([getClosureValueKey(baseInput.serviceId, 'covered')]);

    expect(isClosureValueAvailable({
      ...baseInput,
      status: 'invoiced',
      valueType: 'covered',
      usedKeys,
    })).toBe(false);

    expect(isClosureValueAvailable({
      ...baseInput,
      status: 'invoiced',
      valueType: 'excess',
      usedKeys,
    })).toBe(true);
  });

  it('deja disponible la cobertura cuando el excedente fue cerrado primero', () => {
    const usedKeys = new Set([getClosureValueKey(baseInput.serviceId, 'excess')]);

    expect(isClosureValueAvailable({
      ...baseInput,
      status: 'partially_invoiced',
      valueType: 'covered',
      usedKeys,
    })).toBe(true);
  });

  it('no reabre un servicio común ya facturado', () => {
    expect(isClosureValueAvailable({
      ...baseInput,
      status: 'invoiced',
      hasExcess: false,
      valueType: 'covered',
      usedKeys: new Set(),
    })).toBe(false);
  });

  it('no infiere la parte pendiente de un registro facturado sin trazabilidad', () => {
    expect(isClosureValueAvailable({
      ...baseInput,
      status: 'invoiced',
      valueType: 'excess',
      usedKeys: new Set(),
    })).toBe(false);
  });
});
