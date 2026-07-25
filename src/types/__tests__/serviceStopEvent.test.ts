import { describe, expect, it } from 'vitest';
import { isStopEventOverdue, stopEventMinutes } from '@/types/serviceStopEvent';

const now = new Date('2026-07-25T18:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();

describe('stopEventMinutes', () => {
  it('mide un evento cerrado por su ventana', () => {
    expect(stopEventMinutes(
      { started_at: minutesAgo(50), ended_at: minutesAgo(20) },
      now,
    )).toBe(30);
  });

  it('mide un evento abierto contra ahora', () => {
    expect(stopEventMinutes({ started_at: minutesAgo(12), ended_at: null }, now)).toBe(12);
  });
});

describe('isStopEventOverdue', () => {
  it('marca una carga de combustible que excede lo típico', () => {
    // Estanques de 200 L, llenado ~5 min: 45 min no es una carga.
    expect(isStopEventOverdue('combustible', 45)).toBe(true);
    expect(isStopEventOverdue('combustible', 18)).toBe(false);
  });

  it('NUNCA alerta sobre descanso: su duración es libre por diseño', () => {
    expect(isStopEventOverdue('descanso', 480)).toBe(false);
  });

  it('marca alimentación larga y peaje largo', () => {
    expect(isStopEventOverdue('alimentacion', 55)).toBe(true);
    expect(isStopEventOverdue('peaje', 40)).toBe(true);
  });
});
