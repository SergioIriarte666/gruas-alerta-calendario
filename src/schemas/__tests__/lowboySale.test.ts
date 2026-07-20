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
  ...overrides,
});

const vehicle = (service_value: string, extra: Record<string, unknown> = {}) => ({
  plate: '', make: '', model: '', notes: '', service_value, ...extra,
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

  it('acepta una línea de ajuste negativa que reduce el neto', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({
        net_amount: 800000,
        vehicles: [
          vehicle('450000', { plate: 'GHKL22' }),
          vehicle('450000', { plate: 'JXYZ88' }),
          vehicle('-100000', { notes: 'Descuento cliente frecuente' }),
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('bloquea cuando la suma del desglose queda negativa', () => {
    const result = lowboySaleFormSchema.safeParse(
      baseFlete({ net_amount: -100000, vehicles: [vehicle('900000'), vehicle('-1000000', { notes: 'Ajuste' })] }),
    );
    expect(result.success).toBe(false);
    expect(netIssue(result)?.message).toBe('El neto no puede ser negativo. Revisa las líneas de ajuste.');
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
