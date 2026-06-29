import { describe, expect, it } from 'vitest';

import { resolveRoundTripTollCost } from '@/hooks/useTripCalculation';
import {
  canUseFallbackRange,
  hasAmbiguousKmReference,
  matchStationsByRouteGeometry,
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

describe('matchStationsByRouteGeometry', () => {
  it('matches only trunk tolls that sit on the actual route geometry', () => {
    const routeGeometry = {
      type: 'LineString',
      coordinates: [
        [-70.75, -33.25],
        [-70.99, -32.84],
        [-71.23, -32.64],
      ] as [number, number][],
    };

    const matched = matchStationsByRouteGeometry(routeGeometry, [
      {
        stationId: 'lampa',
        stationName: 'Lampa',
        concessionName: 'Ruta 5 Santiago - Los Vilos',
        highway: 'Ruta 5 Norte',
        stationType: 'TRONCAL',
        rateAmount: 1600,
        kmMarker: 26,
        latitude: -33.2355983,
        longitude: -70.7590362,
      },
      {
        stationId: 'lateral',
        stationName: 'Enlace Tongoy',
        concessionName: 'Ruta del Elqui',
        highway: 'Ruta 5 Norte',
        stationType: 'LATERAL',
        rateAmount: 2000,
        kmMarker: 440,
        latitude: -30.351581,
        longitude: -71.4294403,
      },
    ]);

    expect(matched).toHaveLength(1);
    expect(matched[0]).toMatchObject({
      stationId: 'lampa',
      stationName: 'Lampa',
      source: 'route_geometry',
    });
  });
});
