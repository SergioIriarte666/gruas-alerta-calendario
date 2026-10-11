import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export async function fetchServiceSearchIds(search: string, signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>();
  const batchSize = 1000;
  let from = 0;
  while (true) {
    let query = supabase.rpc('search_service_ids', { p_search: search })
      .order('id').range(from, from + batchSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const row of data || []) ids.add(row.id);
    if (!data || data.length < batchSize) return ids;
    from += data.length;
  }
}

export function useServiceSearch(search: string, services: unknown) {
  const term = search.trim();
  const [debouncedTerm, setDebouncedTerm] = useState(term);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(timeout);
  }, [term]);
  const result = useQuery({
    queryKey: ['service-search', debouncedTerm],
    queryFn: ({ signal }) => fetchServiceSearchIds(debouncedTerm, signal),
    enabled: !!debouncedTerm,
    staleTime: 30000,
  });
  const previousServices = useRef(services);
  // Refrescar coincidencias después de crear o editar un servicio.
  useEffect(() => {
    if (previousServices.current !== services) {
      previousServices.current = services;
      if (debouncedTerm) void result.refetch();
    }
  }, [services, debouncedTerm, result.refetch]);
  return {
    ids: result.data,
    loading: !!term && (term !== debouncedTerm || result.isFetching),
    error: term && term === debouncedTerm ? result.error : null,
  };
}
