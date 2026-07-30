import { describe, expect, it } from 'vitest';
import {
  getTelemetryModeLabel,
  isInternalTelemetryMode,
  TELEMETRY_MODES,
} from '@/utils/telemetryMode';

describe('telemetryMode', () => {
  it('distinguishes internal coverage from external and non-trackable services', () => {
    expect(TELEMETRY_MODES).toEqual(['none', 'operator', 'crane', 'external']);
    expect(isInternalTelemetryMode('operator')).toBe(true);
    expect(isInternalTelemetryMode('crane')).toBe(true);
    expect(isInternalTelemetryMode('external')).toBe(false);
    expect(isInternalTelemetryMode('none')).toBe(false);
  });

  it('provides human-readable labels for administration screens', () => {
    expect(getTelemetryModeLabel('crane')).toBe('GPS de grúa');
    expect(getTelemetryModeLabel('none')).toBe('Sin telemetría');
  });
});
