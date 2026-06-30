import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('MapboxGeocode');

export interface MapboxResult {
  name: string;
  coordinates: [number, number];
}

interface UseMapboxGeocodeOptions {
  enabled?: boolean;
  proximity?: [number, number];
}

export function useMapboxGeocode(
  query: string,
  options: UseMapboxGeocodeOptions = {},
) {
  const { enabled = true, proximity } = options;
  const [results, setResults] = useState<MapboxResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || query.trim().length < 3) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('mapbox-proxy', {
          body: {
            action: 'geocode',
            query: query.trim(),
            ...(proximity ? { proximity } : {}),
          },
        });

        if (fnError) throw fnError;

        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (err) {
        logger.error('Geocode error', err);
        setError('No se pudo buscar la direccion');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [enabled, proximity, query]);

  return { results, loading, error };
}
