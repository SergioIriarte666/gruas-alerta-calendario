const CHILE_MAINLAND_BOUNDS = {
  minLatitude: -56.5,
  maxLatitude: -17,
  minLongitude: -76,
  maxLongitude: -66,
};

export const isCoordinateInChile = (latitude: number, longitude: number): boolean => (
  Number.isFinite(latitude)
  && Number.isFinite(longitude)
  && latitude >= CHILE_MAINLAND_BOUNDS.minLatitude
  && latitude <= CHILE_MAINLAND_BOUNDS.maxLatitude
  && longitude >= CHILE_MAINLAND_BOUNDS.minLongitude
  && longitude <= CHILE_MAINLAND_BOUNDS.maxLongitude
);

export const hasValidChileCoordinates = (
  value: { latitude: number | null; longitude: number | null },
): value is { latitude: number; longitude: number } => (
  typeof value.latitude === 'number'
  && typeof value.longitude === 'number'
  && isCoordinateInChile(value.latitude, value.longitude)
);
