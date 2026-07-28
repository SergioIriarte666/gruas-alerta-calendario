import { describe, expect, it } from 'vitest';
import { buildPublicTrackingUrl } from '@/utils/trackingUrl';

describe('buildPublicTrackingUrl', () => {
  it('always produces a client-accessible URL instead of the Capacitor origin', () => {
    expect(buildPublicTrackingUrl('abc123')).toBe(
      'https://app.gruas5norte.cl/track/abc123',
    );
  });

  it('escapes unexpected token characters', () => {
    expect(buildPublicTrackingUrl('abc/123')).toBe(
      'https://app.gruas5norte.cl/track/abc%2F123',
    );
  });
});
