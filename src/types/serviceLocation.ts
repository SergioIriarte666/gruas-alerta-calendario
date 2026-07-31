/**
 * Procedencia del par lat/lng de un servicio. Se persiste en
 * services.origin_location_source / destination_location_source (CHECK con
 * estos mismos valores).
 *
 * La etiqueta y la coordenada son independientes: el texto lo escribe quien
 * toma el servicio ("camino a Mantoverde, km 12, poste 45") y la coordenada
 * llega por alguna de estas vias — o no llega, y el servicio se guarda igual.
 */
export const SERVICE_LOCATION_SOURCES = [
  'catalog',
  'places',
  'client_link',
  'plus_code',
  'manual_pin',
  'coords',
] as const;

export type ServiceLocationSource = (typeof SERVICE_LOCATION_SOURCES)[number];

export const isServiceLocationSource = (value: unknown): value is ServiceLocationSource =>
  typeof value === 'string' && (SERVICE_LOCATION_SOURCES as readonly string[]).includes(value);

/** Vias en las que la coordenada es un punto exacto y no el centroide de un lugar. */
export const EXACT_LOCATION_SOURCES: ReadonlySet<ServiceLocationSource> = new Set([
  'client_link',
  'plus_code',
  'manual_pin',
  'coords',
]);
