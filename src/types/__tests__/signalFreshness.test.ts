import { describe, expect, it } from 'vitest';
import { describeSignalFreshness } from '@/types/operatorLocations';

const now = new Date('2026-07-25T18:00:00Z');
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();

describe('describeSignalFreshness', () => {
  it('es "en vivo" bajo 3 minutos', () => {
    const freshness = describeSignalFreshness(minutesAgo(1), now);
    expect(freshness.level).toBe('live');
    expect(freshness.label).toBe('En vivo');
  });

  it('pasa a ámbar entre 3 y 10 minutos, diciendo cuánto hace', () => {
    const freshness = describeSignalFreshness(minutesAgo(7), now);
    expect(freshness.level).toBe('stale');
    expect(freshness.label).toBe('Última señal hace 7 min');
  });

  it('nunca reporta "en vivo" con un punto de 93 minutos (el bug original)', () => {
    const freshness = describeSignalFreshness(minutesAgo(93), now);
    expect(freshness.level).toBe('lost');
    expect(freshness.label).toMatch(/^Sin señal desde \d{2}:\d{2}$/);
  });

  it('siempre expone la hora del último punto', () => {
    expect(describeSignalFreshness(minutesAgo(1), now).atLabel).toMatch(/^\d{2}:\d{2}$/);
  });

  it('marca como desconocido al operador que nunca reportó', () => {
    const freshness = describeSignalFreshness(null, now);
    expect(freshness.level).toBe('unknown');
    expect(freshness.minutes).toBeNull();
    expect(freshness.atLabel).toBeNull();
  });
});
