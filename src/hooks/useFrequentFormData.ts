import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Suggestion } from '@/components/common/AutocompleteInput';

function buildSuggestions(values: string[]): Suggestion[] {
  const counts = new Map<string, number>();
  values.forEach(v => {
    if (v && v.trim()) {
      const normalized = v.trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function useFrequentCostDescriptions() {
  const { data: costs = [] } = useQuery({
    queryKey: ['costs_descriptions_autocomplete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('costs')
        .select('description')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () => buildSuggestions(costs.map(c => c.description).filter(Boolean)),
    [costs]
  );

  return suggestions;
}

export function useFrequentCostLocations() {
  const { data: values = [] } = useQuery({
    queryKey: ['costs_locations_autocomplete'],
    queryFn: async () => {
      const [costsResult, servicesResult] = await Promise.all([
        supabase
          .from('costs')
          .select('location_text')
          .not('location_text', 'is', null)
          .not('location_text', 'eq', '')
          .order('created_at', { ascending: false })
          .limit(500),

        supabase
          .from('services')
          .select('origin, destination')
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (costsResult.error) throw costsResult.error;
      if (servicesResult.error) throw servicesResult.error;

      const costLocations = (costsResult.data || []).map((c: any) => c.location_text).filter(Boolean);
      const serviceLocations = (servicesResult.data || [])
        .flatMap((s: any) => [s.origin, s.destination])
        .filter(Boolean);

      return [...costLocations, ...serviceLocations];
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () => buildSuggestions((values as any[]).filter(Boolean)),
    [values]
  );

  return suggestions;
}

export function useFrequentObservations() {
  const { data: services = [] } = useQuery({
    queryKey: ['services_observations_autocomplete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('observations')
        .not('observations', 'is', null)
        .not('observations', 'eq', '')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () => buildSuggestions(services.map(s => s.observations).filter(Boolean) as string[]),
    [services]
  );

  return suggestions;
}

export function useFrequentQuickEntryDescriptions() {
  const { data: entries = [] } = useQuery({
    queryKey: ['quick_entries_descriptions_autocomplete'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_entries')
        .select('description')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () => buildSuggestions(entries.map(e => e.description).filter(Boolean)),
    [entries]
  );

  return suggestions;
}
