import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeocodingResult {
  name: string;
  coordinates: [number, number];
}

interface DirectionsResult {
  distance_km: number;
  estimated_time_hours: number;
  geometry: any;
}

export const useMapboxRoute = () => {
  const [isLoading, setIsLoading] = useState(false);

  const geocode = async (query: string): Promise<GeocodingResult[]> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
        body: { action: 'geocode', query },
      });
      if (error) throw error;
      return data.results || [];
    } finally {
      setIsLoading(false);
    }
  };

  const getDirections = async (
    origin: [number, number],
    destination: [number, number]
  ): Promise<DirectionsResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
        body: { action: 'directions', origin, destination },
      });
      if (error) throw error;
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  return { geocode, getDirections, isLoading };
};
