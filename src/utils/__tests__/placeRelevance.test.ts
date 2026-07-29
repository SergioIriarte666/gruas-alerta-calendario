import { describe, expect, it } from 'vitest';
import { isRelevantPlaceResult } from '@/utils/placeRelevance';

describe('isRelevantPlaceResult', () => {
  it('matches a multi-token query only when the result preserves its identity', () => {
    expect(
      isRelevantPlaceResult(
        'salfa norte',
        'Salfa Camiones Copiapó',
        'Panamericana Norte Km 841, Copiapó, Chile',
      ),
    ).toBe(true);
  });

  it('rejects a weak partial match for a private business name', () => {
    expect(
      isRelevantPlaceResult(
        'Custodia G5N',
        'Custodia El Palomar',
        'Camilo Henríquez, Copiapó, Chile',
      ),
    ).toBe(false);
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
