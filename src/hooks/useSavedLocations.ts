import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useSavedLocations");

export interface SavedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_by: string | null;
  created_at: string;
}

const SAVED_LOCATIONS_SELECT = 'id, name, latitude, longitude, created_by, created_at';

export function useSavedLocations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['saved-locations'],
    queryFn: async (): Promise<SavedLocation[]> => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select(SAVED_LOCATIONS_SELECT)
        .order('name');
      if (error) throw error;
      return (data ?? []) as SavedLocation[];
    },
  });

  const addLocation = useMutation({
    mutationFn: async (loc: { name: string; latitude: number; longitude: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('saved_locations').insert({
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        created_by: user?.id ?? null,
      });
      if (error) {
        logger.error('[useSavedLocations] Error guardando ubicación:', error);
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-locations'] }),
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_locations').delete().eq('id', id);
      if (error) {
        logger.error('[useSavedLocations] Error eliminando ubicación:', error);
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-locations'] }),
  });

  const searchLocations = (query: string, locations: SavedLocation[], max = 5): SavedLocation[] => {
    if (!query || query.length < 2) return locations.slice(0, max);
    const lower = query.toLowerCase();
    return locations
      .filter((l) => l.name.toLowerCase().includes(lower))
      .slice(0, max);
  };

  return {
    locations: query.data ?? [],
    isLoading: query.isLoading,
    addLocation,
    deleteLocation,
    searchLocations,
  };
}
