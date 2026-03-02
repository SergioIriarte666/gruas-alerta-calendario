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
      return data;
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
