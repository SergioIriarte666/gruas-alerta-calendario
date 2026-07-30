import type { ReverseGeocodeLabel } from '@/hooks/ubicaciones/useReverseGeocode';

export type RouteEndpointKind = 'start' | 'end';

export interface RouteEndpointCandidate {
  key: string;
  kind: RouteEndpointKind;
  longitude: number;
  latitude: number;
  color: string;
  recordedAt: string;
  label?: ReverseGeocodeLabel;
}

export interface RouteEndpointCluster {
  longitude: number;
  latitude: number;
  endpoints: RouteEndpointCandidate[];
}

const EARTH_RADIUS_METERS = 6371000;

const coordinateDistanceMeters = (
  a: Pick<RouteEndpointCandidate, 'latitude' | 'longitude'>,
  b: Pick<RouteEndpointCandidate, 'latitude' | 'longitude'>,
): number => {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Agrupa inicios y finales que corresponden al mismo lugar operativo.
 *
 * El GPS detenido puede variar varias decenas de metros entre sesiones. Sin
 * esta tolerancia, la base se llena de marcadores y etiquetas idénticas aunque
 * para el usuario representen un solo punto.
 */
export const clusterRouteEndpoints = (
  endpoints: RouteEndpointCandidate[],
  radiusMeters = 75,
): RouteEndpointCluster[] => {
  const clusters: RouteEndpointCluster[] = [];

  for (const endpoint of endpoints) {
    const cluster = clusters.find((candidate) =>
      coordinateDistanceMeters(endpoint, candidate) <= radiusMeters,
    );

    if (!cluster) {
      clusters.push({
        longitude: endpoint.longitude,
        latitude: endpoint.latitude,
        endpoints: [endpoint],
      });
      continue;
    }

    cluster.endpoints.push(endpoint);
    const count = cluster.endpoints.length;
    cluster.longitude += (endpoint.longitude - cluster.longitude) / count;
    cluster.latitude += (endpoint.latitude - cluster.latitude) / count;
  }

  return clusters;
};

export const selectClusterLabel = (
  endpoints: RouteEndpointCandidate[],
): ReverseGeocodeLabel | undefined => {
  const labeled = endpoints.filter(
    (endpoint): endpoint is RouteEndpointCandidate & { label: ReverseGeocodeLabel } =>
      Boolean(endpoint.label?.name),
  );

  return labeled.find((endpoint) => endpoint.label.source === 'catalog')?.label
    ?? labeled[0]?.label;
};
