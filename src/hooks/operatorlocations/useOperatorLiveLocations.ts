import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OperatorLiveLocation } from '@/types/operatorLocations';
import { createLogger } from '@/lib/logger';
import { hasValidChileCoordinates } from '@/lib/chileCoordinates';

const logger = createLogger('useOperatorLiveLocations');

const QUERY_KEY = ['operator-live-locations'];
const INVALIDATE_DEBOUNCE_MS = 2000;

const fetchLiveLocations = async (): Promise<OperatorLiveLocation[]> => {
  const { data, error } = await supabase.rpc('get_operator_live_locations');

  if (error) {
    throw new Error(error.message || 'No se pudieron cargar las ubicaciones en vivo');
  }

  return ((data ?? []) as OperatorLiveLocation[]).map((location) => (
    hasValidChileCoordinates(location)
      ? location
      : {
          ...location,
          latitude: null,
          longitude: null,
        }
  ));
};

export const useOperatorLiveLocations = () => {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchLiveLocations,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const scheduleInvalidate = () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }, INVALIDATE_DEBOUNCE_MS);
    };

    const handleChange = (payload: unknown) => {
      logger.debug('Operator location realtime change', payload);
      scheduleInvalidate();
    };

    const channel = supabase
      .channel('operator-locations-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'operator_location_points' }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operator_location_sessions' }, handleChange)
      .subscribe();

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
