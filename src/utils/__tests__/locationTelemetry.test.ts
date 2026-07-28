import { describe, expect, it } from 'vitest';
import { isNewHighSpeedPeak } from '@/utils/locationTelemetry';

describe('isNewHighSpeedPeak', () => {
  it('forces persistence when an over-limit reading exceeds the saved maximum', () => {
    expect(isNewHighSpeedPeak(118 / 3.6, 117 / 3.6)).toBe(true);
    expect(isNewHighSpeedPeak(130 / 3.6, 118 / 3.6)).toBe(true);
  });

  it('does not force duplicate, lower, below-threshold or invalid readings', () => {
    expect(isNewHighSpeedPeak(117 / 3.6, 117 / 3.6)).toBe(false);
    expect(isNewHighSpeedPeak(116 / 3.6, 117 / 3.6)).toBe(false);
    expect(isNewHighSpeedPeak(80 / 3.6, 70 / 3.6)).toBe(false);
    expect(isNewHighSpeedPeak(null, 117 / 3.6)).toBe(false);
    expect(isNewHighSpeedPeak(Number.NaN, 117 / 3.6)).toBe(false);
  });
});
