import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { isRelevantPlaceResult } from '@/utils/placeRelevance';

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

// Nivel 1: Places Text Search. Los origenes del negocio son nombres coloquiales
// de lugares ("Salfa Norte"), no direcciones postales, y Places resuelve
// establecimientos donde Geocoding falla. Places nunca devuelve centroides de
// pais/region: si hay resultado, es un lugar concreto y no necesita quality gate.
export const searchPlaceForOrigin = async (
  address: string,
  department?: string | null,
): Promise<{ lat: number; lng: number } | null> => {
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

    const result = data?.results?.[0] as
      | {
          coordinates?: [number, number];
          displayName?: string | null;
          formattedAddress?: string | null;
        }
      | undefined;

    if (!result?.coordinates) return null;

    // Guard de relevancia: ante un origin sin sentido, Places casi nunca
    // devuelve cero resultados, sino su mejor adivinanza dentro del
    // locationBias (un POI aleatorio cercano). Si ningun token del origin
    // aparece en el nombre/direccion del resultado, se descarta y se cae
    // al fallback de Geocoding API.
    if (!isRelevantPlaceResult(address, result.displayName, result.formattedAddress)) {
      geocodingLogger.warn(
        `Places irrelevante para '${address}': '${result.displayName ?? result.formattedAddress ?? ''}' — descartado`,
      );
      return null;
    }

    const [lng, lat] = result.coordinates;
    return { lat, lng };
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
): Promise<{ lat: number | null; lng: number | null }> => {
  const query = department ? `${address}, ${department}, Chile` : `${address}, Chile`;

  try {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: { action: 'geocode', address: query },
    });

    if (error) {
      geocodingLogger.warn('[geocodeAddressFallback] Geocoding failed, continuing without coordinates:', error);
      return { lat: null, lng: null };
    }

    const result = data?.results?.[0] as
      | { coordinates?: [number, number]; types?: string[]; locationType?: string | null }
      | undefined;

    if (!result?.coordinates) {
      return { lat: null, lng: null };
    }

    const types = result.types ?? [];
    const isLowQuality = types.some((type) => LOW_QUALITY_GEOCODE_TYPES.has(type));
    const hasUsefulType = types.some((type) => USEFUL_GEOCODE_TYPES.has(type));
    if (isLowQuality || !hasUsefulType) {
      return { lat: null, lng: null };
    }

    const [lng, lat] = result.coordinates;
    return { lat, lng };
  } catch (geoError) {
    geocodingLogger.warn('[geocodeAddressFallback] Geocoding threw, continuing without coordinates:', geoError);
    return { lat: null, lng: null };
  }
};

// Cascada completa Places -> Geocoding, usada como red de seguridad en el
// submit del formulario cuando no hubo confirmacion de pin (ediciones
// antiguas, actualizaciones masivas). La UI en vivo usa searchPlaceForOrigin/
// geocodeAddressFallback por separado para poder mostrar cada nivel.
export const resolveOriginCoordinates = async (
  address: string,
  department?: string | null,
): Promise<{ lat: number | null; lng: number | null }> => {
  const placeResult = await searchPlaceForOrigin(address, department);
  if (placeResult) {
    return placeResult;
  }

  const fallbackResult = await geocodeAddressFallback(address, department);
  if (fallbackResult.lat === null || fallbackResult.lng === null) {
    geocodingLogger.warn(`Geocoding de baja calidad para '${address}', se omiten coordenadas`);
  }

  return fallbackResult;
};
