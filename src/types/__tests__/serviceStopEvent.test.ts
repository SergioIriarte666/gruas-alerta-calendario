import { describe, expect, it } from 'vitest';
import {
  STOP_REASON_LABELS,
  STOP_REASON_MARKER_GLYPH,
  STOP_REASON_ORDER,
  isIncidentStopReason,
  isStopEventOverdue,
  stopEventMinutes,
} from '@/types/serviceStopEvent';

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

  it('NUNCA alerta por duración en ruta cortada ni falla mecánica', () => {
    // 26/07: la Ruta 5 estuvo cortada horas (km 499-657) y la grúa quedó en
    // panne. No existe una duración "típica" contra la cual alertar.
    expect(isStopEventOverdue('ruta_cortada', 600)).toBe(false);
    expect(isStopEventOverdue('falla_mecanica', 600)).toBe(false);
  });
});

describe('catálogo de motivos', () => {
  it('expone ruta cortada y falla mecánica como incidentes con etiqueta y glifo', () => {
    expect(STOP_REASON_ORDER).toContain('ruta_cortada');
    expect(STOP_REASON_ORDER).toContain('falla_mecanica');
    expect(STOP_REASON_LABELS.ruta_cortada).toBe('Ruta cortada');
    expect(STOP_REASON_LABELS.falla_mecanica).toBe('Falla mecánica');
    expect(STOP_REASON_MARKER_GLYPH.ruta_cortada).toBe('R');
    expect(STOP_REASON_MARKER_GLYPH.falla_mecanica).toBe('M');
    expect(isIncidentStopReason('ruta_cortada')).toBe(true);
    expect(isIncidentStopReason('falla_mecanica')).toBe(true);
  });

  it('una parada de rutina no es un incidente', () => {
    expect(isIncidentStopReason('descanso')).toBe(false);
    expect(isIncidentStopReason('combustible')).toBe(false);
  });

  it('todo motivo del catálogo tiene etiqueta y glifo', () => {
    for (const reason of STOP_REASON_ORDER) {
      expect(STOP_REASON_LABELS[reason]).toBeTruthy();
      expect(STOP_REASON_MARKER_GLYPH[reason]).toBeTruthy();
    }
  });
});
