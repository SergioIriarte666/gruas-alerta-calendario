import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SavedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  created_by: string | null;
  created_at: string;
}

export function useSavedLocations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['saved-locations'],
    queryFn: async (): Promise<SavedLocation[]> => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
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
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-locations'] }),
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_locations').delete().eq('id', id);
      if (error) throw error;
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
