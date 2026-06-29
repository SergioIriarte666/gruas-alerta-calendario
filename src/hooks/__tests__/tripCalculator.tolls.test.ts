import { describe, expect, it } from 'vitest';

import { resolveRoundTripTollCost } from '@/hooks/useTripCalculation';
import {
  canUseFallbackRange,
  hasAmbiguousKmReference,
  shouldExcludeFallbackStation,
} from '@/hooks/useTollCalculationV2';

describe('resolveRoundTripTollCost', () => {
  it('keeps automatic toll totals unchanged when they already include round trip', () => {
    expect(resolveRoundTripTollCost(130700, true)).toBe(130700);
  });

  it('duplicates manual one-way toll amounts for round-trip estimates', () => {
    expect(resolveRoundTripTollCost(65350, false)).toBe(130700);
  });
});

describe('shouldExcludeFallbackStation', () => {
  it('excludes Puerto Viejo for Copiapo to Santiago fallback routes', () => {
    expect(
      shouldExcludeFallbackStation(
        'Puerto Viejo',
        'Copiapó, Región de Atacama, Chile',
        'Santiago, Región Metropolitana de Santiago, Chile',
      ),
    ).toBe(true);
  });

  it('keeps Puerto Viejo when the route actually touches Caldera', () => {
    expect(
      shouldExcludeFallbackStation(
        'Puerto Viejo',
        'Caldera, Región de Atacama, Chile',
        'Santiago, Región Metropolitana de Santiago, Chile',
      ),
    ).toBe(false);
  });
});

describe('hasAmbiguousKmReference', () => {
  it('marks Copiapo as ambiguous because it shares km reference with Caldera', () => {
    expect(hasAmbiguousKmReference('Copiapó, Región de Atacama, Chile')).toBe(true);
  });

  it('keeps Santiago as a non-ambiguous corridor reference', () => {
    expect(hasAmbiguousKmReference('Santiago, Región Metropolitana de Santiago, Chile')).toBe(false);
  });
});

describe('canUseFallbackRange', () => {
  it('blocks fallback when the route starts from an ambiguous corridor city', () => {
    expect(
      canUseFallbackRange(
        'Copiapó, Región de Atacama, Chile',
        'Santiago, Región Metropolitana de Santiago, Chile',
        841,
        0,
      ),
    ).toBe(false);
  });

  it('allows fallback for non-ambiguous Ruta 5 corridor routes', () => {
    expect(
      canUseFallbackRange(
        'La Serena, Región de Coquimbo, Chile',
        'Santiago, Región Metropolitana de Santiago, Chile',
        472,
        0,
      ),
    ).toBe(true);
  });
});
