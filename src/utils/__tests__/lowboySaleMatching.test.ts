import { describe, expect, it } from 'vitest';
import { lowboySaleInitialStateSchema } from '@/schemas/lowboySale';
import { getLowboySaleMatch } from '@/utils/lowboySaleMatching';

describe('getLowboySaleMatch', () => {
  it('prioriza una factura que coincide por RUT normalizado y neto', () => {
    expect(getLowboySaleMatch('77.095.981-0', 3_300_000, '770959810', 3_300_000)).toEqual({
      rutMatches: true,
      amountMatches: true,
      score: 0,
    });
  });

  it('penaliza primero RUT distinto y luego monto distinto', () => {
    expect(getLowboySaleMatch('77.095.981-0', 3_300_000, '76.000.000-0', 3_300_000).score).toBe(2);
    expect(getLowboySaleMatch('77.095.981-0', 3_300_000, '77.095.981-0', 3_200_000).score).toBe(1);
  });
});

describe('lowboySaleInitialStateSchema', () => {
  it('exige fecha para estados retroactivos', () => {
    expect(lowboySaleInitialStateSchema.safeParse({ status: 'facturada', executed_date: '' }).success).toBe(false);
    expect(lowboySaleInitialStateSchema.safeParse({ status: 'facturada', executed_date: '2026-07-15' }).success).toBe(true);
  });
});
