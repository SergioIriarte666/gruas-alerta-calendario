import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FavoriteLocations');

export interface FavoriteLocation {
  id: string;
  name: string;
  aliases: string[];
  address: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  usage_count: number;
}

export function useFavoriteLocations() {
  return useQuery({
    queryKey: ['favorite-locations'],
    queryFn: async (): Promise<FavoriteLocation[]> => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('id, name, aliases, address, category, latitude, longitude, usage_count')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        logger.error('Error fetching favorite locations', error);
        throw error;
      }

      return (data ?? []).map((location) => ({
        ...location,
        aliases: location.aliases ?? [],
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function matchFavoriteLocations(
  query: string,
  locations: FavoriteLocation[],
): FavoriteLocation[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  return locations
    .map((location) => {
      const nameLower = location.name.toLowerCase();
      const aliasesLower = location.aliases.map((alias) => alias.toLowerCase());

      let score = 0;
      if (nameLower === trimmed) score = 100;
      else if (nameLower.startsWith(trimmed)) score = 80;
      else if (aliasesLower.some((alias) => alias === trimmed)) score = 75;
      else if (aliasesLower.some((alias) => alias.startsWith(trimmed))) score = 60;
      else if (nameLower.includes(trimmed)) score = 40;
      else if (aliasesLower.some((alias) => alias.includes(trimmed))) score = 30;

      return { location, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.location.usage_count - left.location.usage_count,
    )
    .slice(0, 8)
    .map((item) => item.location);
}
