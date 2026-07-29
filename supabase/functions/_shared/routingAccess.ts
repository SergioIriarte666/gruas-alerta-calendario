export type RouteCoordinate = [number, number];

export type RoutingAccessLocation = {
  name: string;
  aliases: string[] | null;
  latitude: number | null;
  longitude: number | null;
  routing_access_latitude: number | null;
  routing_access_longitude: number | null;
};

export type RoutingAccessPoint = {
  lat: number;
  lng: number;
  locationName: string;
};

const EARTH_RADIUS_METERS = 6_371_000;

export const normalizeRoutingLocationText = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const routingDistanceMeters = (
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
};

const hasUsableAccess = (
  location: RoutingAccessLocation,
): location is RoutingAccessLocation & {
  latitude: number;
  longitude: number;
  routing_access_latitude: number;
  routing_access_longitude: number;
} =>
  location.latitude != null &&
  location.longitude != null &&
  location.routing_access_latitude != null &&
  location.routing_access_longitude != null;

const toAccessPoint = (
  location: RoutingAccessLocation & {
    routing_access_latitude: number;
    routing_access_longitude: number;
  },
): RoutingAccessPoint => ({
  lat: location.routing_access_latitude,
  lng: location.routing_access_longitude,
  locationName: location.name,
});

/**
 * Encuentra un acceso vial de salida sólo cuando el GPS está físicamente cerca
 * del pin real del lugar. No depende del folio, del nombre del servicio ni de
 * casos especiales: cualquier lugar frecuente puede definir el suyo.
 */
export const findDepartureRoutingAccess = (
  locations: RoutingAccessLocation[],
  position: { lat: number; lng: number },
  maxDistanceMeters = 300,
): RoutingAccessPoint | null => {
  const candidates = locations
    .filter(hasUsableAccess)
    .map((location) => ({
      location,
      distance: routingDistanceMeters(
        position.lat,
        position.lng,
        location.latitude,
        location.longitude,
      ),
    }))
    .filter(({ distance }) => distance <= maxDistanceMeters)
    .sort((left, right) => left.distance - right.distance);

  return candidates[0] ? toAccessPoint(candidates[0].location) : null;
};

/**
 * Para llegar a un lugar usa su acceso vial sólo si coincide el nombre/alias
 * del objetivo y el snapshot del servicio sigue cerca del pin catalogado.
 * Así un alias duplicado o un catálogo desactualizado no mueve una ruta.
 */
export const findTargetRoutingAccess = (
  locations: RoutingAccessLocation[],
  target: { label: string | null; lat: number; lng: number },
  maxSnapshotDistanceMeters = 500,
): RoutingAccessPoint | null => {
  const normalizedLabel = normalizeRoutingLocationText(target.label);
  if (!normalizedLabel) return null;

  const candidates = locations
    .filter(hasUsableAccess)
    .filter((location) => {
      const labels = [location.name, ...(location.aliases ?? [])]
        .map(normalizeRoutingLocationText);
      return labels.includes(normalizedLabel);
    })
    .map((location) => ({
      location,
      distance: routingDistanceMeters(
        target.lat,
        target.lng,
        location.latitude,
        location.longitude,
      ),
    }))
    .filter(({ distance }) => distance <= maxSnapshotDistanceMeters)
    .sort((left, right) => left.distance - right.distance);

  return candidates[0] ? toAccessPoint(candidates[0].location) : null;
};

export const decodeGooglePolyline = (encoded: string): RouteCoordinate[] => {
  const coordinates: RouteCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }

  return coordinates;
};

export const encodeGooglePolyline = (coordinates: RouteCoordinate[]): string => {
  let previousLatitude = 0;
  let previousLongitude = 0;
  let encoded = "";

  const encodeSigned = (value: number): string => {
    let shifted = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (shifted >= 0x20) {
      chunk += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
      shifted >>= 5;
    }
    return chunk + String.fromCharCode(shifted + 63);
  };

  for (const [longitude, latitude] of coordinates) {
    const latitudeE5 = Math.round(latitude * 1e5);
    const longitudeE5 = Math.round(longitude * 1e5);
    encoded += encodeSigned(latitudeE5 - previousLatitude);
    encoded += encodeSigned(longitudeE5 - previousLongitude);
    previousLatitude = latitudeE5;
    previousLongitude = longitudeE5;
  }

  return encoded;
};

const appendIfDistinct = (
  coordinates: RouteCoordinate[],
  coordinate: RouteCoordinate,
): void => {
  const previous = coordinates.at(-1);
  if (
    !previous ||
    routingDistanceMeters(previous[1], previous[0], coordinate[1], coordinate[0]) > 2
  ) {
    coordinates.push(coordinate);
  }
};

/**
 * Une el GPS y/o el pin real con la ruta calculada desde/hasta un acceso vial.
 * Los conectores son deliberadamente cortos: la selección de acceso ya exige
 * proximidad al lugar real.
 */
export const connectRouteAccess = ({
  encodedPolyline,
  actualOrigin,
  routedOrigin,
  routedDestination,
  actualDestination,
}: {
  encodedPolyline: string;
  actualOrigin: { lat: number; lng: number };
  routedOrigin: { lat: number; lng: number };
  routedDestination: { lat: number; lng: number };
  actualDestination: { lat: number; lng: number };
}): {
  polyline: string;
  connectorDistanceMeters: number;
} => {
  const route = decodeGooglePolyline(encodedPolyline);
  const connected: RouteCoordinate[] = [];

  appendIfDistinct(connected, [actualOrigin.lng, actualOrigin.lat]);
  appendIfDistinct(connected, [routedOrigin.lng, routedOrigin.lat]);
  for (const coordinate of route) appendIfDistinct(connected, coordinate);
  appendIfDistinct(connected, [routedDestination.lng, routedDestination.lat]);
  appendIfDistinct(connected, [actualDestination.lng, actualDestination.lat]);

  const connectorDistanceMeters =
    routingDistanceMeters(
      actualOrigin.lat,
      actualOrigin.lng,
      routedOrigin.lat,
      routedOrigin.lng,
    ) +
    routingDistanceMeters(
      routedDestination.lat,
      routedDestination.lng,
      actualDestination.lat,
      actualDestination.lng,
    );

  return {
    polyline: encodeGooglePolyline(connected),
    connectorDistanceMeters,
  };
};
