import { describe, expect, it } from 'vitest';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

describe('getDisplayServiceValue', () => {
  const excessService = {
    value: 650000,
    hasExcess: true,
    client: { id: 'auxilia' },
    clientCoveredAmount: 412073,
    thirdPartyClientId: 'mpm',
    excessAmount: 237927,
  };

  it('muestra al cliente principal sólo el monto cubierto', () => {
    expect(getDisplayServiceValue(excessService, 'auxilia')).toBe(412073);
  });

  it('muestra al tercero sólo el excedente que le corresponde', () => {
    expect(getDisplayServiceValue(excessService, 'mpm')).toBe(237927);
  });

  it('mantiene el valor total cuando no existe contexto de cliente', () => {
    expect(getDisplayServiceValue(excessService)).toBe(650000);
  });

  it('admite registros crudos de Supabase y montos cubiertos en cero', () => {
    expect(getDisplayServiceValue({
      value: 650000,
      has_excess: true,
      client_id: 'auxilia',
      client_covered_amount: 0,
      third_party_client_id: 'mpm',
      excess_amount: 650000,
    }, 'auxilia')).toBe(0);
  });
});
