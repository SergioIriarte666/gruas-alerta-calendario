import { describe, expect, it } from 'vitest';
import { lowboySaleFormSchema } from '../lowboySale';

// RUT válido de LowBoy Chile SpA, usado como cliente de prueba.
const VALID_RUT = '78.387.656-6';

const baseFlete = (overrides: Record<string, unknown> = {}) => ({
  sale_type: 'flete' as const,
  client_rut: VALID_RUT,
  client_name: 'Cliente Demo',
  description: 'Flete estructura',
  origin: 'Santiago',
  destination: 'Copiapó',
  scheduled_date: '',
  net_amount: 0,
  notes: '',
  vehicles: [],
  adjustment: '',
  ...overrides,
});

const vehicle = (service_value: string, extra: Record<string, unknown> = {}) => ({
  plate: '', make: '', model: '', service_value, ...extra,
});

const netIssue = (result: { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } }) =>
  result.success ? undefined : result.error!.issues.find((i) => i.path[0] === 'net_amount');

describe('lowboySaleFormSchema — desglose de flete', () => {
  it('acepta un flete con dos vehículos y su suma como neto', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({ net_amount: 900000, vehicles: [vehicle('450000', { plate: 'GHKL22' }), vehicle('450000', { plate: 'JXYZ88' })] }),
    );
    expect(result.success).toBe(true);
  });

  it('acepta un ajuste negativo que reduce el neto (2 vehículos + ajuste)', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({
        net_amount: 70000,
        vehicles: [vehicle('50000', { plate: 'GHKL22' }), vehicle('30000', { plate: 'JXYZ88' })],
        adjustment: '-10000',
      }),
    );
    expect(result.success).toBe(true);
  });

  it('acepta un flete con solo ajuste positivo, sin valores de vehículos', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({ net_amount: 5000, vehicles: [vehicle('', { plate: 'GHKL22' })], adjustment: '5000' }),
    );
    expect(result.success).toBe(true);
  });

  it('bloquea cuando la suma (valores + ajuste) queda negativa', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({ net_amount: 0, vehicles: [vehicle('900000')], adjustment: '-1000000' }),
    );
    expect(result.success).toBe(false);
    expect(netIssue(result)?.message).toBe('El neto no puede ser negativo. Revisa las líneas de ajuste.');
  });

  it('bloquea un flete con solo ajuste negativo (sin valores de vehículos)', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({ net_amount: 0, vehicles: [], adjustment: '-10000' }),
    );
    expect(result.success).toBe(false);
    expect(netIssue(result)?.message).toBe('El neto no puede ser negativo. Revisa las líneas de ajuste.');
  });

  it('rechaza un ajuste no entero', () => {
    const result = lowboySaleFormSchema.safeParse(baseFlete({ net_amount: 10, adjustment: '10.5' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === 'adjustment')).toBe(true);
  });

  it('sin valores en las filas, el neto es manual y no puede ser negativo', () => {
    const negative = lowboySaleFormSchema.safeParse(baseFlete({ net_amount: -1, vehicles: [vehicle('', { plate: 'GHKL22' })] }));
    expect(negative.success).toBe(false);
    expect(netIssue(negative)?.message).toBe('El monto no puede ser negativo');

    const manual = lowboySaleFormSchema.safeParse(baseFlete({ net_amount: 500000, vehicles: [vehicle('', { plate: 'GHKL22' })] }));
    expect(manual.success).toBe(true);
  });

  it('rechaza un valor de servicio no entero', () => {
    const result = lowboySaleFormSchema.safeParse(baseFlete({ net_amount: 12, vehicles: [vehicle('12.5')] }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === 'Ingrese un monto entero (puede ser negativo)')).toBe(true);
  });
});
