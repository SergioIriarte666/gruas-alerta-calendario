import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { parseLocationInput, startsWithPlusCode } from '@/lib/locationParser';
import { findExactCatalogMatch, useFavoriteLocations } from '@/hooks/useFavoriteLocations';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { geocodeAddressFallback, searchPlaceForOrigin } from '@/services/originResolutionService';
import { isRelevantPlaceResult } from '@/utils/placeRelevance';
import { formatChileAddress, formatChileLocationLabel } from '@/utils/chileLocationLabel';
import type { ServiceLocationSource } from '@/types/serviceLocation';

const logger = createLogger('LocationInputResolver');

// Base G5N: sesgo del text_search cuando el catalogo y el autocomplete no
// resolvieron. El radio se pide lo mas amplio posible (las faenas estan
// repartidas por toda Atacama), pero Places New rechaza cualquier circle.radius
// sobre 50 km con INVALID_ARGUMENT: searchPlaceForOrigin lo acota.
const G5N_BASE_BIAS = { lat: -27.3464, lng: -70.6339, radius: 150000 };

/** Etiqueta de ultimo recurso: nunca un plus code pelado. */
export const formatMapPointLabel = (lat: number, lng: number) =>
  `Punto en mapa (${lat.toFixed(6)}, ${lng.toFixed(6)})`;

/**
 * La resolucion automatica nunca produce 'manual_pin': ese valor lo pone el
 * picker del mapa.
 */
export type LocationResolutionSource = Exclude<ServiceLocationSource, 'manual_pin'>;

export interface LocationResolution {
  lat: number;
  lng: number;
  label: string;
  catalogId: string | null;
  source: LocationResolutionSource;
}

export type LocationResolutionFailure =
  | { error: 'link_unresolvable' }
  | { error: 'plus_code_unresolvable' }
  | { error: 'not_found' };

export type LocationResolutionResult = LocationResolution | LocationResolutionFailure;

export const isResolutionFailure = (
  result: LocationResolutionResult,
): result is LocationResolutionFailure => 'error' in result;

interface UseLocationInputResolverOptions {
  department?: string | null;
}

export function useLocationInputResolver({ department }: UseLocationInputResolverOptions = {}) {
  const { data: favoriteLocations = [] } = useFavoriteLocations();
  const { autocomplete, getPlaceDetails } = useGoogleMaps();

  /**
   * Etiqueta visible del campo. Orden: nombre preferido (catalogo/Places) ->
   * reverse_geocode -> "Punto en mapa". Un plus code nunca queda visible: en
   * puntos remotos es justo lo que Google devuelve como "direccion".
   */
  const resolveLabel = useCallback(
    async (lat: number, lng: number, preferred?: string | null): Promise<string> => {
      if (preferred && !startsWithPlusCode(preferred)) {
        return formatChileAddress(preferred);
      }

      try {
        const { data, error } = await supabase.functions.invoke('maps-proxy', {
          body: { action: 'reverse_geocode', lat, lng },
        });

        if (!error) {
          const address = typeof data?.address === 'string' ? data.address : null;
          if (address && !startsWithPlusCode(address)) {
            return formatChileAddress(address);
          }
        }
      } catch (reverseError) {
        logger.warn('No se pudo obtener la direccion del punto', reverseError);
      }

      return formatMapPointLabel(lat, lng);
    },
    [],
  );

  const resolveShortLink = useCallback(async (url: string) => {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: { action: 'resolve_link', url },
    });

    if (error || typeof data?.lat !== 'number' || typeof data?.lng !== 'number') {
      logger.warn('resolve_link no devolvio coordenadas', { error, data });
      return null;
    }

    return { lat: data.lat as number, lng: data.lng as number };
  }, []);

  const resolvePlusCode = useCallback(async (code: string) => {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: { action: 'geocode', address: code },
    });

    if (error) {
      logger.warn('geocode de plus code fallo', error);
      return null;
    }

    const first = (data?.results ?? [])[0] as
      | { coordinates?: [number, number]; name?: string | null }
      | undefined;
    if (!first?.coordinates) return null;

    const [lng, lat] = first.coordinates;
    return { lat, lng, name: first.name ?? null };
  }, []);

  /**
   * Cascada de texto libre: catalogo -> autocomplete (Places) -> text_search
   * -> geocode. El catalogo gana siempre que haya match exacto y jamas se
   * re-geocodifica: sus coordenadas pueden estar verificadas en terreno
   * (coordinate_locked).
   */
  const resolveText = useCallback(
    async (query: string): Promise<LocationResolutionResult> => {
      const catalogMatch = findExactCatalogMatch(query, favoriteLocations);
      if (catalogMatch?.latitude != null && catalogMatch.longitude != null) {
        return {
          lat: catalogMatch.latitude,
          lng: catalogMatch.longitude,
          label: formatChileAddress(catalogMatch.name),
          catalogId: catalogMatch.id,
          source: 'catalog',
        };
      }

      try {
        const suggestions = await autocomplete(department ? `${query}, ${department}` : query);
        // Solo sugerencias de Places: useGoogleMaps ya cae a Geocoding por su
        // cuenta cuando Places no devuelve nada, y ese resultado debe pasar
        // antes por text_search (que sabe descartar calles homonimas).
        const placeSuggestion = suggestions.find(
          (suggestion) =>
            suggestion.source === 'places' &&
            suggestion.placeId &&
            isRelevantPlaceResult(query, suggestion.mainText, suggestion.text || suggestion.secondaryText),
        );

        if (placeSuggestion?.placeId) {
          const place = await getPlaceDetails(placeSuggestion.placeId);
          if (place) {
            return {
              lat: place.lat,
              lng: place.lng,
              label: formatChileLocationLabel({
                mainText: placeSuggestion.mainText,
                secondaryText: placeSuggestion.secondaryText,
                formattedAddress: place.formattedAddress || placeSuggestion.text,
              }),
              catalogId: null,
              source: 'places',
            };
          }
        }
      } catch (autocompleteError) {
        logger.warn('Autocomplete fallo, se sigue con text_search', autocompleteError);
      }

      const placeResult = await searchPlaceForOrigin(query, department, G5N_BASE_BIAS);
      if (placeResult) {
        return {
          lat: placeResult.lat,
          lng: placeResult.lng,
          label: await resolveLabel(placeResult.lat, placeResult.lng, placeResult.formattedAddress),
          catalogId: null,
          source: 'places',
        };
      }

      const geocoded = await geocodeAddressFallback(query, department);
      if (geocoded.lat != null && geocoded.lng != null) {
        return {
          lat: geocoded.lat,
          lng: geocoded.lng,
          label: await resolveLabel(geocoded.lat, geocoded.lng, geocoded.formattedAddress),
          catalogId: null,
          // Geocoding es el ultimo escalon de la misma cascada de texto escrito:
          // se registra como 'places' porque el enum persistido distingue la VIA
          // (texto tipeado vs. link vs. pin), no el proveedor concreto.
          source: 'places',
        };
      }

      return { error: 'not_found' };
    },
    [autocomplete, department, favoriteLocations, getPlaceDetails, resolveLabel],
  );

  /**
   * Resolucion unica del campo de direccion. Se dispara al pegar o al perder
   * el foco (nunca en cada tecla) y baja por la cascada segun lo que el texto
   * realmente sea.
   */
  const resolve = useCallback(
    async (raw: string): Promise<LocationResolutionResult> => {
      const parsed = parseLocationInput(raw);

      switch (parsed.kind) {
        case 'coords':
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            label: await resolveLabel(parsed.lat, parsed.lng),
            catalogId: null,
            source: 'coords',
          };

        case 'long_url': {
          const coords = parsed.lat != null && parsed.lng != null
            ? { lat: parsed.lat, lng: parsed.lng }
            : await resolveShortLink(parsed.url);
          if (!coords) return { error: 'link_unresolvable' };
          return {
            lat: coords.lat,
            lng: coords.lng,
            label: await resolveLabel(coords.lat, coords.lng),
            catalogId: null,
            source: 'client_link',
          };
        }

        case 'short_link': {
          const coords = await resolveShortLink(parsed.url);
          if (!coords) return { error: 'link_unresolvable' };
          return {
            lat: coords.lat,
            lng: coords.lng,
            label: await resolveLabel(coords.lat, coords.lng),
            catalogId: null,
            source: 'client_link',
          };
        }

        case 'plus_code_global':
        case 'plus_code_local': {
          // El plus code puede estar guardado como alias de un punto del
          // catalogo: ese nombre es mas util que cualquier direccion de Google.
          const catalogMatch = findExactCatalogMatch(parsed.code, favoriteLocations);
          if (catalogMatch?.latitude != null && catalogMatch.longitude != null) {
            return {
              lat: catalogMatch.latitude,
              lng: catalogMatch.longitude,
              label: formatChileAddress(catalogMatch.name),
              catalogId: catalogMatch.id,
              source: 'catalog',
            };
          }

          const resolved = await resolvePlusCode(parsed.code);
          if (!resolved) return { error: 'plus_code_unresolvable' };
          return {
            lat: resolved.lat,
            lng: resolved.lng,
            label: await resolveLabel(resolved.lat, resolved.lng, resolved.name),
            catalogId: null,
            source: 'plus_code',
          };
        }

        case 'text':
        default:
          if (!parsed.value) return { error: 'not_found' };
          return resolveText(parsed.value);
      }
    },
    [favoriteLocations, resolveLabel, resolvePlusCode, resolveShortLink, resolveText],
  );

  return { resolve };
}
