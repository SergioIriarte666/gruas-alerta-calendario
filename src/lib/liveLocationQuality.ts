import { isCoordinateInChile } from '@/lib/chileCoordinates';

/**
 * Mismo umbral que la política SQL y el pipeline de Map Matching.
 *
 * Los puntos sobre este valor siguen siendo telemetría válida para auditoría,
 * pero no tienen autoridad para desplazar un marcador en vivo.
 */
export const LIVE_LOCATION_MAX_ACCURACY_METERS = 50;

interface LiveLocationCandidate {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
}

export const isTrustedLiveLocationPoint = ({
  latitude,
  longitude,
  accuracyMeters,
}: LiveLocationCandidate): boolean => (
  typeof latitude === 'number'
  && typeof longitude === 'number'
  && typeof accuracyMeters === 'number'
  && Number.isFinite(accuracyMeters)
  && accuracyMeters >= 0
  && accuracyMeters <= LIVE_LOCATION_MAX_ACCURACY_METERS
  && isCoordinateInChile(latitude, longitude)
);
