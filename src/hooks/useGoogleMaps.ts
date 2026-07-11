import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useGoogleMaps');

export interface PlaceSuggestion {
  placeId: string | null;
  text: string;
  mainText: string;
  secondaryText: string;
  source: 'places' | 'geocode';
  coordinates?: [number, number];
}

export interface PlaceResult {
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  comuna: string | null;
  region: string | null;
}

export interface RouteResult {
  distance_km: number;
  estimated_time_hours: number;
  geometry: { type: string; coordinates: [number, number][] };
}

export interface GeoResult {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  types?: string[];
  locationType?: string | null;
}

/**
 * Session tokens group autocomplete + place_details into a single billing event.
 * The token is generated once per "typing session" and discarded after place_details.
 * See: https://developers.google.com/maps/documentation/places/web-service/session-tokens
 */
export function useGoogleMaps() {
  // One token per autocomplete session; reset after place_details resolves
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const refreshToken = useCallback(() => {
    sessionTokenRef.current = crypto.randomUUID();
  }, []);

  const geocodeLookup = useCallback(async (address: string): Promise<GeoResult[]> => {
    logger.debug('geocode', { address });

    try {
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: { action: 'geocode', address },
      });

      if (error) throw error;
      return (data?.results ?? []) as GeoResult[];
    } catch (err) {
      logger.warn('geocode error', err);
      return [];
    }
  }, []);

  const autocomplete = useCallback(
    async (input: string): Promise<PlaceSuggestion[]> => {
      if (!input || input.length < 2) return [];

      logger.debug('autocomplete', { input });

      try {
        const { data, error } = await supabase.functions.invoke('maps-proxy', {
          body: {
            action: 'autocomplete',
            input,
            sessionToken: sessionTokenRef.current,
          },
        });

        if (error) throw error;

        const suggestions: PlaceSuggestion[] = (data?.suggestions ?? []).map(
          (s: {
            placePrediction: {
              placeId: string;
              text?: { text: string };
              structuredFormat?: {
                mainText?: { text: string };
                secondaryText?: { text: string };
              };
            };
          }) => ({
            placeId: s.placePrediction.placeId,
            text: s.placePrediction.text?.text ?? '',
            mainText: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text ?? '',
            secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
            source: 'places',
          }),
        );

        if (suggestions.length > 0) {
          return suggestions;
        }

        const geoResults = await geocodeLookup(input);
        return geoResults.slice(0, 5).map((result) => ({
          placeId: null,
          text: result.name,
          mainText: result.name,
          secondaryText: 'Ciudad o dirección encontrada',
          source: 'geocode',
          coordinates: result.coordinates,
        }));
      } catch (err) {
        logger.warn('autocomplete error', err);

        const geoResults = await geocodeLookup(input);
        return geoResults.slice(0, 5).map((result) => ({
          placeId: null,
          text: result.name,
          mainText: result.name,
          secondaryText: 'Ciudad o dirección encontrada',
          source: 'geocode',
          coordinates: result.coordinates,
        }));
      }
    },
    [geocodeLookup],
  );

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceResult | null> => {
      logger.debug('getPlaceDetails', { placeId });

      try {
        const { data, error } = await supabase.functions.invoke('maps-proxy', {
          body: {
            action: 'place_details',
            placeId,
            sessionToken: sessionTokenRef.current,
          },
        });

        // Session is consumed — start a new one for the next autocomplete flow
        refreshToken();

        if (error) throw error;
        if (!data?.location) return null;

        const addressComponents: Array<{ types: string[]; longText: string }> =
          data.addressComponents ?? [];

        const findComponent = (type: string): string | null =>
          addressComponents.find((c) => c.types.includes(type))?.longText ?? null;

        return {
          placeId: data.id ?? placeId,
          formattedAddress: data.formattedAddress ?? '',
          lat: Number(data.location.latitude),
          lng: Number(data.location.longitude),
          comuna: findComponent('locality') ?? findComponent('administrative_area_level_3'),
          region: findComponent('administrative_area_level_1'),
        };
      } catch (err) {
        logger.warn('getPlaceDetails error', err);
        refreshToken();
        return null;
      }
    },
    [refreshToken],
  );

  const computeRoute = useCallback(
    async (
      originCoords: [number, number],
      destCoords: [number, number],
    ): Promise<RouteResult | null> => {
      // originCoords/destCoords are [lng, lat] (GeoJSON format)
      logger.debug('computeRoute', { originCoords, destCoords });

      try {
        const { data, error } = await supabase.functions.invoke('maps-proxy', {
          body: {
            action: 'route',
            origin: { lat: originCoords[1], lng: originCoords[0] },
            destination: { lat: destCoords[1], lng: destCoords[0] },
          },
        });

        if (error) throw error;
        if (!data?.distance_km) return null;

        return data as RouteResult;
      } catch (err) {
        logger.warn('computeRoute error', err);
        return null;
      }
    },
    [],
  );

  const geocode = useCallback(async (address: string): Promise<GeoResult[]> => {
    return geocodeLookup(address);
  }, [geocodeLookup]);

  return { autocomplete, getPlaceDetails, computeRoute, geocode };
}
