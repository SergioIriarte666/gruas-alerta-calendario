import { describe, expect, it } from 'vitest';
import {
  clusterRouteEndpoints,
  selectClusterLabel,
  type RouteEndpointCandidate,
} from '@/utils/routeEndpointClustering';

const endpoint = (
  key: string,
  longitude: number,
  latitude: number,
  overrides: Partial<RouteEndpointCandidate> = {},
): RouteEndpointCandidate => ({
  key,
  kind: 'start',
  longitude,
  latitude,
  color: '#65a30d',
  recordedAt: '2026-07-29T13:00:00.000Z',
  ...overrides,
});

describe('clusterRouteEndpoints', () => {
  it('agrupa la variación GPS de una misma base', () => {
    const clusters = clusterRouteEndpoints([
      endpoint('one', -70.33000, -27.37000),
      endpoint('two', -70.33020, -27.37020, { kind: 'end' }),
      endpoint('three', -70.32985, -27.36990),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].endpoints).toHaveLength(3);
  });

  it('mantiene separados lugares operativos distintos', () => {
    const clusters = clusterRouteEndpoints([
      endpoint('base', -70.33000, -27.37000),
      endpoint('client', -70.32000, -27.36000, { kind: 'end' }),
    ]);

    expect(clusters).toHaveLength(2);
  });

  it('prioriza el nombre autoritativo del catálogo', () => {
    const label = selectClusterLabel([
      endpoint('mapbox', -70.33, -27.37, {
        label: { name: 'Ruta 5 Norte', source: 'mapbox' },
      }),
      endpoint('catalog', -70.3301, -27.3701, {
        label: { name: 'Grúas 5 Norte', source: 'catalog' },
      }),
    ]);

    expect(label).toEqual({ name: 'Grúas 5 Norte', source: 'catalog' });
  });
});
