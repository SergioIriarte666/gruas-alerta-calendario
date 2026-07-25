import { describe, expect, it } from 'vitest';
import { SustainedMovementTracker } from '@/utils/sustainedMovement';

const BASE = new Date('2026-07-25T18:00:00Z').getTime();
const at = (seconds: number) => BASE + seconds * 1000;

/** Muestra quieta en un punto fijo, con la velocidad indicada. */
const sample = (seconds: number, kmh: number) => ({
  speedMps: kmh / 3.6,
  latitude: -27.37,
  longitude: -70.33,
  atMs: at(seconds),
});

describe('SustainedMovementTracker', () => {
  it('no dispara con un solo fix rápido: exige velocidad sostenida', () => {
    const tracker = new SustainedMovementTracker();
    expect(tracker.push(sample(0, 90))).toBe(false);
    expect(tracker.push(sample(10, 90))).toBe(false);
  });

  it('dispara al cumplir los 60 s sobre el umbral', () => {
    const tracker = new SustainedMovementTracker();
    expect(tracker.push(sample(0, 40))).toBe(false);
    expect(tracker.push(sample(30, 40))).toBe(false);
    expect(tracker.push(sample(60, 40))).toBe(true);
  });

  it('considera "rodando" a 12-15 km/h: en faenas hay restricciones de hasta 15', () => {
    const tracker = new SustainedMovementTracker();
    tracker.push(sample(0, 13));
    expect(tracker.push(sample(60, 13))).toBe(true);
  });

  it('detenerse reinicia el contador', () => {
    const tracker = new SustainedMovementTracker();
    tracker.push(sample(0, 40));
    tracker.push(sample(30, 40));
    tracker.push(sample(40, 2)); // se detuvo
    expect(tracker.push(sample(70, 40))).toBe(false);
    expect(tracker.push(sample(130, 40))).toBe(true);
  });

  it('dispara una sola vez por tramo, no en cada fix posterior', () => {
    const tracker = new SustainedMovementTracker();
    tracker.push(sample(0, 40));
    expect(tracker.push(sample(60, 40))).toBe(true);
    expect(tracker.push(sample(120, 40))).toBe(false);
    expect(tracker.push(sample(300, 40))).toBe(false);
  });

  it('deriva la velocidad de la distancia cuando el dispositivo no la reporta', () => {
    const tracker = new SustainedMovementTracker();
    // ~0.01° de latitud ≈ 1.11 km; en 30 s son ~133 km/h.
    tracker.push({ speedMps: null, latitude: -27.37, longitude: -70.33, atMs: at(0) });
    tracker.push({ speedMps: null, latitude: -27.38, longitude: -70.33, atMs: at(30) });
    expect(tracker.push({ speedMps: null, latitude: -27.40, longitude: -70.33, atMs: at(90) })).toBe(true);
  });

  it('no dispara si el dispositivo no reporta velocidad y no hay desplazamiento', () => {
    const tracker = new SustainedMovementTracker();
    tracker.push({ speedMps: null, latitude: -27.37, longitude: -70.33, atMs: at(0) });
    tracker.push({ speedMps: null, latitude: -27.37, longitude: -70.33, atMs: at(60) });
    expect(tracker.push({ speedMps: null, latitude: -27.37, longitude: -70.33, atMs: at(120) })).toBe(false);
  });

  it('reset() rearma el detector por completo', () => {
    const tracker = new SustainedMovementTracker();
    tracker.push(sample(0, 40));
    tracker.reset();
    expect(tracker.push(sample(60, 40))).toBe(false);
  });
});
