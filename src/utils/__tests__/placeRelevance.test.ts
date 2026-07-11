import { describe, expect, it } from 'vitest';
import { isRelevantPlaceResult } from '@/utils/placeRelevance';

describe('isRelevantPlaceResult', () => {
  it('matches when a query token appears in the place name or address', () => {
    expect(
      isRelevantPlaceResult(
        'salfa norte',
        'Salfa Camiones Copiapó',
        'Panamericana Norte Km 841, Copiapó, Chile',
      ),
    ).toBe(true);
  });

  it('rejects a nonsense query against an unrelated real place', () => {
    expect(
      isRelevantPlaceResult(
        'xyzz123',
        'Plaza de Armas de Copiapó',
        'Copiapó, Región de Atacama, Chile',
      ),
    ).toBe(false);
  });
});
