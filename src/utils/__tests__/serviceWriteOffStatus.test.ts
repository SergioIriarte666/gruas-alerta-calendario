import { describe, expect, it } from 'vitest';
import { SERVICE_STATUS_CONFIG, getServiceStatusLabel } from '@/utils/statusHelpers';

describe('estado Castigado', () => {
  it('tiene etiqueta y tono propios, distintos de cancelado y vencido', () => {
    expect(getServiceStatusLabel('written_off')).toBe('Castigado');
    expect(SERVICE_STATUS_CONFIG.written_off.tone).toBe('written_off');
    expect(SERVICE_STATUS_CONFIG.written_off.tone).not.toBe(SERVICE_STATUS_CONFIG.cancelled.tone);
    expect(SERVICE_STATUS_CONFIG.written_off.tone).not.toBe(SERVICE_STATUS_CONFIG.failed.tone);
  });

  it('no se confunde con un estado desconocido', () => {
    expect(getServiceStatusLabel('sin_estado')).toBe('Desconocido');
  });
});
