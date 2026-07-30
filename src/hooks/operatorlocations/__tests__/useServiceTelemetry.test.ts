import { describe, expect, it } from 'vitest';
import { summarizeSpeedSamples } from '@/hooks/operatorlocations/useServiceTelemetry';

describe('summarizeSpeedSamples', () => {
  it('calculates movement average, p95, maximum and samples over the operational threshold', () => {
    const summary = summarizeSpeedSamples([0, 4, 10, 40, 80, 90, 100], 80);

    expect(summary.samplesCount).toBe(7);
    expect(summary.averageMovingSpeedKmh).toBe(64);
    expect(summary.percentile95SpeedKmh).toBe(100);
    expect(summary.maxSpeedKmh).toBe(100);
    expect(summary.overLimitSamples).toBe(2);
  });

  it('discards impossible GPS jumps and supports services without speed data', () => {
    expect(summarizeSpeedSamples([Number.NaN, -1, 151], 80)).toEqual({
      maxSpeedKmh: null,
      averageMovingSpeedKmh: null,
      percentile95SpeedKmh: null,
      overLimitSamples: 0,
      samplesCount: 0,
    });
  });

  it('calculates p95 from moving samples so idle readings do not dilute the result', () => {
    const summary = summarizeSpeedSamples(
      [...Array.from({ length: 100 }, () => 0), 50, 60, 70, 80],
      80,
    );

    expect(summary.averageMovingSpeedKmh).toBe(65);
    expect(summary.percentile95SpeedKmh).toBe(80);
    expect(summary.maxSpeedKmh).toBe(80);
  });
});
