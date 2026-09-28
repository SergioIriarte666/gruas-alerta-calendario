import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn() }, functions: { invoke: vi.fn() } },
}));

import { parseVehiclePayload } from '@/services/vehiclePatentLookup';

const withRtDate = (rtDate: unknown) =>
  parseVehiclePayload({ success: true, data: { marca: 'TOYOTA', modelo: 'HILUX', rtDate, rtResult: 'Aprobado' } });

describe('parseVehiclePayload — rtFecha normalizado a fecha calendario', () => {
  it('recorta timestamp con offset de GetAPI ("2026-02-25 00:00:00.000 +00:00")', () => {
    expect(withRtDate('2026-02-25 00:00:00.000 +00:00')?.rtFecha).toBe('2026-02-25');
  });

  it('recorta timestamp sin offset ("2026-05-14 00:00:00")', () => {
    expect(withRtDate('2026-05-14 00:00:00')?.rtFecha).toBe('2026-05-14');
  });

  it('conserva una fecha calendario limpia', () => {
    expect(withRtDate('2026-05-05')?.rtFecha).toBe('2026-05-05');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['texto libre', 'sin información'],
    ['fecha imposible', '2026-13-40 00:00:00'],
    ['número', 20260505],
  ])('devuelve null cuando rtDate es %s', (_label, value) => {
    expect(withRtDate(value)?.rtFecha).toBeNull();
  });

  it('acepta el alias rtFecha (check-vehicle-patent) con el mismo normalizador', () => {
    const result = parseVehiclePayload({ data: { marca: 'X', modelo: 'Y', rtFecha: '2026-02-25 00:00:00.000 +00:00' } });
    expect(result?.rtFecha).toBe('2026-02-25');
  });

  it('no altera los demás campos', () => {
    const result = withRtDate('2026-05-05');
    expect(result).toMatchObject({ marca: 'TOYOTA', modelo: 'HILUX', rtResultado: 'Aprobado' });
  });
});
