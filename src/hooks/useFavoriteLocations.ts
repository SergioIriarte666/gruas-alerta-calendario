import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  routing_access_latitude: number | null;
  routing_access_longitude: number | null;
  usage_count: number;
}

export function useFavoriteLocations() {
  return useQuery({
    queryKey: ['favorite-locations'],
    queryFn: async (): Promise<FavoriteLocation[]> => {
      const { data, error } = await supabase
        .from('saved_locations')
        .select(`
          id, name, aliases, address, category, latitude, longitude,
          routing_access_latitude, routing_access_longitude, usage_count
        `)
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

export const prepareLocationAliases = ({
  name,
  previousName,
  aliases,
}: {
  name: string;
  previousName?: string | null;
  aliases: string[];
}): string[] => {
  const normalizedName = normalizeLocationText(name);
  const candidates = [
    ...aliases,
    ...(previousName && normalizeLocationText(previousName) !== normalizedName
      ? [previousName]
      : []),
  ];
  const seen = new Set<string>();

  return candidates
    .map((alias) => alias.trim())
    .filter(Boolean)
    .filter((alias) => normalizeLocationText(alias) !== normalizedName)
    .filter((alias) => {
      const key = normalizeLocationText(alias);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export function useUpdateFavoriteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      aliases,
      routingAccess,
    }: {
      id: string;
      name: string;
      aliases: string[];
      routingAccess: { lat: number; lng: number } | null;
    }) => {
      const { error } = await supabase
        .from('saved_locations')
        .update({
          name: name.trim(),
          aliases,
          routing_access_latitude: routingAccess?.lat ?? null,
          routing_access_longitude: routingAccess?.lng ?? null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['favorite-locations'] }),
        queryClient.invalidateQueries({ queryKey: ['saved-locations'] }),
      ]);
    },
  });
}

/**
 * Normaliza texto de ubicacion para comparar catalogo vs. lo tipeado: minusculas,
 * sin tildes/diacriticos (NFD + strip de marcas combinantes) y espacios colapsados.
 * "MANTOS DE ORO", "Mantos de Oro" y "  mantos  de oro " normalizan a "mantos de oro".
 */
export const normalizeLocationText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function matchFavoriteLocations(
  query: string,
  locations: FavoriteLocation[],
): FavoriteLocation[] {
  const trimmed = normalizeLocationText(query);
  if (trimmed.length < 2) return [];

  return locations
    .map((location) => {
      const nameLower = normalizeLocationText(location.name);
      const aliasesLower = location.aliases.map((alias) => normalizeLocationText(alias));

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

/**
 * Match determinista para la resolucion de origen en el submit: SOLO coincidencia
 * exacta (normalizada) contra el nombre o algun alias, y que la entrada tenga
 * coordenadas. Devuelve la de mayor usage_count ante empate. El catalogo debe ganar
 * SIEMPRE que haya match exacto, antes de tocar Places/Geocoding — a diferencia de
 * matchFavoriteLocations (usada para sugerir en el dropdown, con prefijos/substrings).
 */
export function findExactCatalogMatch(
  query: string,
  locations: FavoriteLocation[],
): FavoriteLocation | null {
  const normalized = normalizeLocationText(query);
  if (normalized.length < 2) return null;

  const exact = locations.filter(
    (location) =>
      location.latitude != null &&
      location.longitude != null &&
      (normalizeLocationText(location.name) === normalized ||
        location.aliases.some((alias) => normalizeLocationText(alias) === normalized)),
  );

  if (exact.length === 0) return null;

  return exact.sort((left, right) => right.usage_count - left.usage_count)[0];
}
