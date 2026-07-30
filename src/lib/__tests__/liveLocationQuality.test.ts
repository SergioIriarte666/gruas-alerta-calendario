import { describe, expect, it } from 'vitest';
import {
  LIVE_LOCATION_MAX_ACCURACY_METERS,
  isTrustedLiveLocationPoint,
} from '@/lib/liveLocationQuality';

describe('liveLocationQuality', () => {
  it('accepts a precise point in Chile, including the threshold boundary', () => {
    expect(isTrustedLiveLocationPoint({
      latitude: -27.3464,
      longitude: -70.6313,
      accuracyMeters: 8,
    })).toBe(true);
    expect(isTrustedLiveLocationPoint({
      latitude: -33.45,
      longitude: -70.66,
      accuracyMeters: LIVE_LOCATION_MAX_ACCURACY_METERS,
    })).toBe(true);
  });

  it('rejects the low-precision point without rejecting it from storage', () => {
    expect(isTrustedLiveLocationPoint({
      latitude: -27.332,
      longitude: -70.5754,
      accuracyMeters: 139.7,
    })).toBe(false);
  });

  it('rejects missing, negative and non-finite accuracy', () => {
    const base = { latitude: -27.37, longitude: -70.33 };

    expect(isTrustedLiveLocationPoint({ ...base, accuracyMeters: null })).toBe(false);
    expect(isTrustedLiveLocationPoint({ ...base, accuracyMeters: -1 })).toBe(false);
    expect(isTrustedLiveLocationPoint({ ...base, accuracyMeters: Number.NaN })).toBe(false);
  });

  it('rejects invalid or swapped coordinates even with good accuracy', () => {
    expect(isTrustedLiveLocationPoint({
      latitude: -70.33,
      longitude: -27.37,
      accuracyMeters: 5,
    })).toBe(false);
    expect(isTrustedLiveLocationPoint({
      latitude: null,
      longitude: -70.33,
      accuracyMeters: 5,
    })).toBe(false);
  });
});
