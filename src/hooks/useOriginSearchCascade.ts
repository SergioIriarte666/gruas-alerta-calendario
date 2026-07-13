import { useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { searchPlaceForOrigin, geocodeAddressFallback } from '@/services/originResolutionService';

const logger = createLogger('OriginSearchCascade');
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 450;

export interface OriginSearchResult {
  lat: number;
  lng: number;
  source: 'places' | 'geocoding';
  formattedAddress: string | null;
}

interface UseOriginSearchCascadeOptions {
  enabled?: boolean;
  department?: string | null;
}

/**
 * Nivel 2/3 del origen (Places Text Search -> Geocoding fallback), en vivo
 * mientras el usuario escribe. Misma cascada que resolveOriginCoordinates usa
 * en el submit (src/services/originResolutionService.ts), solo que aqui se
 * expone cada intento por separado para poder mostrar/ocultar el resultado.
 */
export function useOriginSearchCascade(
  query: string,
  options: UseOriginSearchCascadeOptions = {},
) {
  const { enabled = true, department } = options;
  const [result, setResult] = useState<OriginSearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || query.trim().length < MIN_QUERY_LENGTH) {
      setResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const placeResult = await searchPlaceForOrigin(query.trim(), department);
        if (cancelled) return;

        if (placeResult) {
          setResult({
            lat: placeResult.lat,
            lng: placeResult.lng,
            source: 'places',
            formattedAddress: placeResult.formattedAddress,
          });
          return;
        }

        const fallbackResult = await geocodeAddressFallback(query.trim(), department);
        if (cancelled) return;

        if (fallbackResult.lat != null && fallbackResult.lng != null) {
          setResult({
            lat: fallbackResult.lat,
            lng: fallbackResult.lng,
            source: 'geocoding',
            formattedAddress: fallbackResult.formattedAddress,
          });
        } else {
          setResult(null);
        }
      } catch (error) {
        if (!cancelled) {
          logger.warn('Origin search cascade failed', error);
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, query, department]);

  return { result, loading };
}
