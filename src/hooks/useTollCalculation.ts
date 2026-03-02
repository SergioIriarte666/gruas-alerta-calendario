import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface TollDetail {
  peaje: string;
  costo: number;
  autopista: string;
  type: string;
  direction: string;
}

export interface TollApiResponse {
  total: number;
  currency: string;
  tollsCount: number;
  details: TollDetail[];
  breakdown: Record<string, number>;
}

export interface TollResult {
  total_cost: number;
  tolls: Array<{
    name: string;
    cost: number;
    highway?: string;
  }>;
}

export function useTollLocations() {
  return useQuery({
    queryKey: ['toll-locations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('tollroutes-proxy', {
        body: { action: 'locations' },
      });
      if (error) throw error;
      // The API may return { data: [...] } or just an array
      const locations: string[] = Array.isArray(data) ? data : (data?.data ?? data?.locations ?? []);
      return locations;
    },
    staleTime: 60 * 60 * 1000, // 1 hour cache
  });
}

export function useTollCategories() {
  return useQuery({
    queryKey: ['toll-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('tollroutes-proxy', {
        body: { action: 'categories' },
      });
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Normalize a string for fuzzy matching: lowercase, remove accents, trim
 */
function normalize(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Find the best matching location from the API's valid locations list.
 * Tries: exact match, startsWith, includes, then first word match.
 */
export function matchTollLocation(cityName: string, locations: unknown[]): string | null {
  if (!cityName || !locations.length) return null;

  // Extract string names from locations (might be strings or objects with name/city property)
  const locationNames: string[] = locations
    .map((loc: unknown) => {
      if (typeof loc === 'string') return loc;
      if (loc && typeof loc === 'object') {
        const obj = loc as Record<string, unknown>;
        return (obj.name || obj.city || obj.location || '') as string;
      }
      return '';
    })
    .filter((n) => n.length > 0);

  const normalizedCity = normalize(cityName);
  if (!normalizedCity) return null;

  // 1. Exact match (normalized)
  const exact = locationNames.find(loc => normalize(loc) === normalizedCity);
  if (exact) return exact;

  // 2. Location starts with city name or vice-versa
  const startsWith = locationNames.find(
    loc => normalize(loc).startsWith(normalizedCity) || normalizedCity.startsWith(normalize(loc))
  );
  if (startsWith) return startsWith;

  // 3. City name is contained in a location or vice-versa
  const includes = locationNames.find(
    loc => normalize(loc).includes(normalizedCity) || normalizedCity.includes(normalize(loc))
  );
  if (includes) return includes;

  // 4. Match first word only
  const firstWord = normalizedCity.split(/\s+/)[0];
  if (firstWord.length >= 3) {
    const wordMatch = locationNames.find(loc => normalize(loc).startsWith(firstWord));
    if (wordMatch) return wordMatch;
  }

  return null;
}

export function useTollCalculation() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [tollResult, setTollResult] = useState<TollResult | null>(null);
  const [tollError, setTollError] = useState<string | null>(null);

  const calculateTolls = useCallback(
    async (origin: string, destination: string, category?: string) => {
      setIsCalculating(true);
      setTollError(null);
      setTollResult(null);

      try {
        const { data, error } = await supabase.functions.invoke('tollroutes-proxy', {
          body: { action: 'route-cost', origin, destination, category },
        });

        if (error) {
          setTollError('Error al calcular peajes. Puede ingresar el monto manualmente.');
          return null;
        }

        if (data?.error) {
          setTollError(data.error);
          return null;
        }

        // Map API response (total, details) to our TollResult format
        const apiData = data as TollApiResponse;
        const mapped: TollResult = {
          total_cost: apiData.total ?? 0,
          tolls: (apiData.details ?? []).map((d) => ({
            name: d.peaje,
            cost: d.costo,
            highway: d.autopista,
          })),
        };

        setTollResult(mapped);
        return mapped;
      } catch {
        setTollError('Error de conexión con API de peajes.');
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  const resetTolls = useCallback(() => {
    setTollResult(null);
    setTollError(null);
  }, []);

  return {
    calculateTolls,
    tollResult,
    tollError,
    isCalculating,
    resetTolls,
  };
}
