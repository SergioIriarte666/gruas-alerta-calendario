import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { isRelevantPlaceResult } from '@/utils/placeRelevance';
import { findExactCatalogMatch, normalizeLocationText, type FavoriteLocation } from '@/hooks/useFavoriteLocations';

const geocodingLogger = createLogger('ServiceGeocoding');

// Granularidad demasiado amplia para servir como ubicacion de un servicio:
// Google devuelve el centroide del pais/region cuando no encuentra la direccion.
const LOW_QUALITY_GEOCODE_TYPES = new Set([
  'country',
  'administrative_area_level_1',
  'administrative_area_level_2',
]);

// Solo estas granularidades son suficientemente precisas para ubicar una grua.
const USEFUL_GEOCODE_TYPES = new Set([
  'street_address',
  'route',
  'premise',
  'establishment',
  'point_of_interest',
  'locality',
]);

// Centro de Copiapo (Atacama, Chile): sesgo por defecto para Places Text Search
// cuando no se conocen coordenadas del departamento del cliente.
const DEFAULT_PLACE_BIAS = { lat: -27.366, lng: -70.332 };
const PLACE_BIAS_RADIUS_METERS = 50000;

export const resolveClientDepartment = async (clientId?: string | null): Promise<string | null> => {
  if (!clientId) return null;

  const { data } = await supabase
    .from('clients')
    .select('department')
    .eq('id', clientId)
    .maybeSingle();

  return data?.department || null;
};

// Nivel 0 (catalogo): saved_locations es la fuente autoritativa de los origenes
// recurrentes del negocio (faenas, minas). Debe GANAR SIEMPRE ante un match exacto
// (normalizado) de nombre o alias, antes de gastar llamadas a Places/Geocoding, que
// para nombres coloquiales homonimos ("Mantos de Oro") devuelven un punto equivocado
// en otra ciudad. Devuelve tambien el id para poder incrementar usage_count.
export const resolveOriginFromCatalog = async (
  address: string,
): Promise<{ lat: number; lng: number; catalogId: string } | null> => {
  if (normalizeLocationText(address).length < 2) return null;

  const { data, error } = await supabase
    .from('saved_locations')
    .select('id, name, aliases, address, category, latitude, longitude, usage_count')
    .eq('is_active', true);

  if (error) {
    geocodingLogger.warn('[resolveOriginFromCatalog] No se pudo consultar el catalogo:', error);
    return null;
  }

  const locations: FavoriteLocation[] = (data ?? []).map((location) => ({
    ...location,
    aliases: location.aliases ?? [],
  }));

  const match = findExactCatalogMatch(address, locations);
  if (!match || match.latitude == null || match.longitude == null) return null;

  return { lat: match.latitude, lng: match.longitude, catalogId: match.id };
};

// Indicadores de que el texto tipeado ES una direccion de calle (y no un nombre
// de localidad/lugar): si aparecen, un resultado tipo route/street es legitimo.
const STREET_QUERY_REGEX = /(\bcalle\b|\bavenida\b|\bav\.?\b|\bpasaje\b|\bpsje\.?\b|\bcamino\b|\bruta\b|\bcarretera\b|\bkm\b|\bkil[oó]metro\b|#|n[°º]|\d)/i;

// Tipos de Places que representan un LUGAR (localidad, comuna, POI) vs. una CALLE.
const PLACE_LIKE_TYPES = new Set([
  'locality', 'sublocality', 'neighborhood', 'colloquial_area',
  'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3',
  'point_of_interest', 'establishment', 'premise', 'tourist_attraction', 'natural_feature',
]);
const STREET_LIKE_TYPES = new Set(['route', 'street_address', 'intersection']);

const isStreetLikeResult = (types: string[]): boolean =>
  types.some((type) => STREET_LIKE_TYPES.has(type)) &&
  !types.some((type) => PLACE_LIKE_TYPES.has(type));

interface PlaceSearchResult {
  coordinates?: [number, number];
  displayName?: string | null;
  formattedAddress?: string | null;
  types?: string[];
}

// Nivel 1: Places Text Search. Los origenes del negocio son nombres coloquiales
// de lugares ("Salfa Norte"), no direcciones postales, y Places resuelve
// establecimientos donde Geocoding falla. Places nunca devuelve centroides de
// pais/region: si hay resultado, es un lugar concreto y no necesita quality gate.
export const searchPlaceForOrigin = async (
  address: string,
  department?: string | null,
): Promise<{ lat: number; lng: number; formattedAddress: string | null } | null> => {
  const textQuery = department ? `${address}, ${department}` : address;

  try {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: {
        action: 'text_search',
        textQuery,
        locationBias: { ...DEFAULT_PLACE_BIAS, radius: PLACE_BIAS_RADIUS_METERS },
        regionCode: 'CL',
      },
    });

    if (error) {
      geocodingLogger.warn('[searchPlaceForOrigin] Places text search failed, falling back to geocoding:', error);
      return null;
    }

    const results = (data?.results ?? []) as PlaceSearchResult[];
    const withCoords = results.filter(
      (result): result is PlaceSearchResult & { coordinates: [number, number] } =>
        Array.isArray(result.coordinates) && result.coordinates.length === 2,
    );
    if (withCoords.length === 0) return null;

    const isStreetQuery = STREET_QUERY_REGEX.test(address);

    // Guard de relevancia por tokens: ante un origin sin sentido, Places casi nunca
    // devuelve cero resultados, sino su mejor adivinanza dentro del locationBias.
    const relevant = withCoords.filter((result) =>
      isRelevantPlaceResult(address, result.displayName, result.formattedAddress),
    );
    const pool = relevant.length > 0 ? relevant : withCoords;

    // Preferir un resultado de LUGAR (localidad/POI) sobre una CALLE: con el sesgo a
    // Copiapo (radio 50 km), Places devuelve calles homonimas locales ("calle Iquique",
    // "sector Mantos de Oro") que le ganan al lugar real. Entre los candidatos se elige
    // primero uno place-like.
    const chosen = pool.find((result) => !isStreetLikeResult(result.types ?? [])) ?? pool[0];
    const chosenTypes = chosen.types ?? [];

    // El texto es un nombre de lugar (sin indicadores de calle) pero el mejor resultado
    // sesgado es solo una calle homonima: se descarta para que Geocoding (sin sesgo)
    // resuelva el lugar real (p. ej. "Iquique" -> ciudad, no la calle Iquique de Copiapo).
    if (!isStreetQuery && isStreetLikeResult(chosenTypes)) {
      geocodingLogger.warn(
        `Places devolvio calle homonima para lugar '${address}': '${chosen.displayName ?? chosen.formattedAddress ?? ''}' — descartado, se usa Geocoding`,
      );
      return null;
    }

    if (!isRelevantPlaceResult(address, chosen.displayName, chosen.formattedAddress)) {
      geocodingLogger.warn(
        `Places irrelevante para '${address}': '${chosen.displayName ?? chosen.formattedAddress ?? ''}' — descartado`,
      );
      return null;
    }

    const [lng, lat] = chosen.coordinates;
    return { lat, lng, formattedAddress: chosen.formattedAddress ?? chosen.displayName ?? null };
  } catch (placesError) {
    geocodingLogger.warn('[searchPlaceForOrigin] Places text search threw, falling back to geocoding:', placesError);
    return null;
  }
};

// Nivel 2 (fallback): Geocoding API, solo si Places no encontro nada. Conserva
// el quality gate: Geocoding si devuelve centroides de pais/region para
// direcciones que no reconoce.
export const geocodeAddressFallback = async (
  address: string,
  department?: string | null,
): Promise<{ lat: number | null; lng: number | null; formattedAddress: string | null }> => {
  const query = department ? `${address}, ${department}, Chile` : `${address}, Chile`;

  try {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: { action: 'geocode', address: query },
    });

    if (error) {
      geocodingLogger.warn('[geocodeAddressFallback] Geocoding failed, continuing without coordinates:', error);
      return { lat: null, lng: null, formattedAddress: null };
    }

    const result = data?.results?.[0] as
      | { coordinates?: [number, number]; types?: string[]; locationType?: string | null; name?: string | null }
      | undefined;

    if (!result?.coordinates) {
      return { lat: null, lng: null, formattedAddress: null };
    }

    const types = result.types ?? [];
    const isLowQuality = types.some((type) => LOW_QUALITY_GEOCODE_TYPES.has(type));
    const hasUsefulType = types.some((type) => USEFUL_GEOCODE_TYPES.has(type));
    if (isLowQuality || !hasUsefulType) {
      return { lat: null, lng: null, formattedAddress: null };
    }

    const [lng, lat] = result.coordinates;
    return { lat, lng, formattedAddress: result.name ?? null };
  } catch (geoError) {
    geocodingLogger.warn('[geocodeAddressFallback] Geocoding threw, continuing without coordinates:', geoError);
    return { lat: null, lng: null, formattedAddress: null };
  }
};

// Cascada completa Places -> Geocoding, usada como red de seguridad en el
// submit del formulario cuando no hubo confirmacion de pin (ediciones
// antiguas, actualizaciones masivas). La UI en vivo usa searchPlaceForOrigin/
// geocodeAddressFallback por separado para poder mostrar cada nivel.
export const resolveOriginCoordinates = async (
  address: string,
  department?: string | null,
): Promise<{ lat: number | null; lng: number | null; catalogId?: string | null }> => {
  // Nivel 0: catalogo. Gana ante cualquier match exacto, antes de tocar Places/Geocoding.
  const catalogMatch = await resolveOriginFromCatalog(address);
  if (catalogMatch) {
    geocodingLogger.debug(`Origen '${address}' resuelto por catalogo (${catalogMatch.catalogId})`);
    return { lat: catalogMatch.lat, lng: catalogMatch.lng, catalogId: catalogMatch.catalogId };
  }

  const placeResult = await searchPlaceForOrigin(address, department);
  if (placeResult) {
    return { ...placeResult, catalogId: null };
  }

  const fallbackResult = await geocodeAddressFallback(address, department);
  if (fallbackResult.lat === null || fallbackResult.lng === null) {
    geocodingLogger.warn(`Geocoding de baja calidad para '${address}', se omiten coordenadas`);
  }

  return { ...fallbackResult, catalogId: null };
};
