import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatKm,
  formatSpeed,
  isEtaFresh,
  resolveSignalState,
} from '@/components/operator/ServiceProgressStrip';

const NOW = new Date('2026-07-31T18:00:00Z');
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe('resolveSignalState', () => {
  it('no alarma mientras siguen llegando puntos', () => {
    expect(resolveSignalState(minutesAgo(2), 88, NOW)).toBe('live');
    expect(resolveSignalState(minutesAgo(9), 0, NOW)).toBe('live');
  });

  it('un camión detenido deja de emitir y eso NO es una anomalía', () => {
    // El plugin emite por filtro de distancia: en el 3266844-1 hubo hasta 26
    // minutos de silencio con la grúa correctamente estacionada en faena.
    expect(resolveSignalState(minutesAgo(26), 0.2, NOW)).toBe('stopped');
    expect(resolveSignalState(minutesAgo(11), 2.9, NOW)).toBe('stopped');
  });

  it('venía rodando y dejó de reportar: eso sí es sin señal', () => {
    expect(resolveSignalState(minutesAgo(11), 3, NOW)).toBe('no_signal');
    expect(resolveSignalState(minutesAgo(40), 92, NOW)).toBe('no_signal');
  });

  it('sin velocidad conocida no se inventa una alarma', () => {
    expect(resolveSignalState(minutesAgo(30), null, NOW)).toBe('stopped');
  });

  it('sin ningún punto todavía no hay nada que declarar', () => {
    expect(resolveSignalState(null, null, NOW)).toBe('live');
  });
});

describe('isEtaFresh', () => {
  it('un ETA de más de 5 minutos no se muestra', () => {
    expect(isEtaFresh(minutesAgo(1), NOW)).toBe(true);
    expect(isEtaFresh(minutesAgo(6), NOW)).toBe(false);
    expect(isEtaFresh(null, NOW)).toBe(false);
  });
});

describe('formato chileno', () => {
  it('kilómetros con coma decimal', () => {
    expect(formatKm(137.54)).toBe('137,5 km');
    expect(formatKm(280)).toBe('280,0 km');
    expect(formatKm(null)).toBeNull();
  });

  it('duración en horas y minutos, sin horas cuando no llega a una', () => {
    expect(formatDuration(91)).toBe('1h 31m');
    expect(formatDuration(31)).toBe('31m');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(null)).toBeNull();
  });

  it('velocidad redondeada', () => {
    expect(formatSpeed(96.4)).toBe('96 km/h');
    expect(formatSpeed(null)).toBeNull();
  });
});
