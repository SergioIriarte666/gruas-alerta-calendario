export type RouteCoordinate = [number, number];

const METERS_PER_DEGREE_LATITUDE = 110_540;
const METERS_PER_DEGREE_LONGITUDE = 111_320;
const MAX_ROUTE_SNAP_METERS = 150;

interface ProjectedPoint {
  coordinate: RouteCoordinate;
  distanceSquared: number;
  segmentIndex: number;
}

/**
 * Recorta una ruta cacheada desde la posición GPS actual. El backend puede
 * reutilizar una polyline durante varios polls mientras el marcador avanza;
 * dibujarla completa deja un tramo violeta detrás de la grúa.
 */
export const trimRouteFromPosition = (
  route: RouteCoordinate[],
  position: RouteCoordinate | null,
): RouteCoordinate[] => {
  if (!position || route.length < 2) return route;

  const [positionLng, positionLat] = position;
  const metersPerDegreeLongitude =
    METERS_PER_DEGREE_LONGITUDE * Math.cos((positionLat * Math.PI) / 180);

  const toLocalMeters = ([lng, lat]: RouteCoordinate): [number, number] => [
    (lng - positionLng) * metersPerDegreeLongitude,
    (lat - positionLat) * METERS_PER_DEGREE_LATITUDE,
  ];
  const fromLocalMeters = ([x, y]: [number, number]): RouteCoordinate => [
    positionLng + x / metersPerDegreeLongitude,
    positionLat + y / METERS_PER_DEGREE_LATITUDE,
  ];

  let nearest: ProjectedPoint | null = null;

  for (let index = 0; index < route.length - 1; index += 1) {
    const [startX, startY] = toLocalMeters(route[index]);
    const [endX, endY] = toLocalMeters(route[index + 1]);
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;
    const projection = segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, (-(startX * deltaX + startY * deltaY)) / segmentLengthSquared),
        );
    const projectedX = startX + projection * deltaX;
    const projectedY = startY + projection * deltaY;
    const distanceSquared = projectedX * projectedX + projectedY * projectedY;

    if (!nearest || distanceSquared < nearest.distanceSquared) {
      nearest = {
        coordinate: fromLocalMeters([projectedX, projectedY]),
        distanceSquared,
        segmentIndex: index,
      };
    }
  }

  if (!nearest || Math.sqrt(nearest.distanceSquared) > MAX_ROUTE_SNAP_METERS) {
    return route;
  }

  const remaining = route.slice(nearest.segmentIndex + 1);
  const startsAtPosition =
    Math.sqrt(nearest.distanceSquared) <= 20;

  return startsAtPosition
    ? [position, ...remaining]
    : [position, nearest.coordinate, ...remaining];
};
