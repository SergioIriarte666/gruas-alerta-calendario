import { describe, expect, it } from 'vitest';
import { hasValidChileCoordinates, isCoordinateInChile } from '@/lib/chileCoordinates';

describe('chileCoordinates', () => {
  it('accepts mainland Chile coordinates', () => {
    expect(isCoordinateInChile(-27.37, -70.33)).toBe(true);
    expect(hasValidChileCoordinates({ latitude: -33.45, longitude: -70.66 })).toBe(true);
  });

  it('rejects points near Africa and swapped Chilean coordinates', () => {
    expect(isCoordinateInChile(4.4, 18.5)).toBe(false);
    expect(hasValidChileCoordinates({ latitude: -70.33, longitude: -27.37 })).toBe(false);
  });

  it('rejects null or non-finite coordinates', () => {
    expect(hasValidChileCoordinates({ latitude: null, longitude: -70.33 })).toBe(false);
    expect(isCoordinateInChile(Number.NaN, -70.33)).toBe(false);
  });
});
