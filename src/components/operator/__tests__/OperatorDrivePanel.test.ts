import { describe, expect, it } from 'vitest';
import {
  getSpeedometerState,
  speedMpsToKmh,
} from '@/components/operator/OperatorDrivePanel';

describe('speedMpsToKmh', () => {
  it('converts GPS meters per second to rounded kilometers per hour', () => {
    expect(speedMpsToKmh(10)).toBe(36);
    expect(speedMpsToKmh(1.5)).toBe(5);
    expect(speedMpsToKmh(0)).toBe(0);
  });

  it('does not display invalid GPS speed readings', () => {
    expect(speedMpsToKmh(null)).toBeNull();
    expect(speedMpsToKmh(-1)).toBeNull();
    expect(speedMpsToKmh(Number.NaN)).toBeNull();
  });
});

describe('getSpeedometerState', () => {
  it.each([
    { kmh: 0, rotation: -90 },
    { kmh: 30, rotation: -45 },
    { kmh: 60, rotation: 0 },
    { kmh: 120, rotation: 90 },
  ])('simulates the gauge at $kmh km/h', ({ kmh, rotation }) => {
    const state = getSpeedometerState(kmh / 3.6);

    expect(state.speedKmh).toBe(kmh);
    expect(state.gaugeProgress).toBe(kmh / 120);
    expect(state.needleRotation).toBe(rotation);
  });

  it('shows a clean zero state while GPS has no speed reading', () => {
    expect(getSpeedometerState(null)).toEqual({
      speedKmh: 0,
      gaugeProgress: 0,
      needleRotation: -90,
    });
  });
});
