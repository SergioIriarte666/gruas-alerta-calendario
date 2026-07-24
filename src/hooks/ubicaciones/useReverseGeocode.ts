import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ReverseGeocode');

// 5 decimales ≈ 1 m: suficiente para reutilizar caché entre puntos casi idénticos.
const roundCoord = (value: number) => Math.round(value * 1e5) / 1e5;

export interface ReverseGeocodeLabel {
  name: string;
  /** 'catalog' = nombre operativo autoritativo; 'mapbox' = dirección aproximada. */
  source: 'catalog' | 'mapbox';
}

const fetchReverseGeocode = async (lng: number, lat: number): Promise<ReverseGeocodeLabel> => {
  const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
    body: { action: 'reverse_geocode', coordinates: [lng, lat] },
  });
  if (error) {
    logger.error('Reverse geocode invoke failed', error);
    throw error;
  }
  return {
    name: (data?.name as string) || (data?.place_name as string) || '',
    source: data?.source === 'catalog' ? 'catalog' : 'mapbox',
  };
};

export interface ReverseGeocodeTarget {
  /** Clave estable del consumidor (p.ej. session_id). */
  key: string;
  lng: number;
  lat: number;
}

/**
 * Resuelve la dirección legible de un conjunto de coordenadas (una por target).
 * Comparte fetcher/queryKey por coordenada redondeada, así puntos repetidos no
 * se vuelven a pedir. Devuelve un Map key→nombre memoizado por firma.
 */
export const useReverseGeocodedLabels = (
  targets: ReverseGeocodeTarget[],
  enabled: boolean,
): Map<string, ReverseGeocodeLabel> => {
  const queries = useQueries({
    queries: targets.map(({ lng, lat }) => {
      const rLng = roundCoord(lng);
      const rLat = roundCoord(lat);
      return {
        queryKey: ['reverse-geocode', rLng, rLat],
        queryFn: () => fetchReverseGeocode(rLng, rLat),
        enabled,
        staleTime: 24 * 60 * 60 * 1000,
        retry: false,
      };
    }),
  });

  const signature = queries
    .map((query, index) => `${targets[index].key}:${query.data ? '1' : '0'}`)
    .join('|');

  return useMemo(() => {
    const map = new Map<string, ReverseGeocodeLabel>();
    queries.forEach((query, index) => {
      if (query.data?.name) map.set(targets[index].key, query.data);
    });
    return map;
  }, [signature]);
};
