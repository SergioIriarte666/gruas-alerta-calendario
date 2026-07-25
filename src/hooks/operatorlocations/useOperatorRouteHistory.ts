import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fromZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { hasValidChileCoordinates } from '@/lib/chileCoordinates';
import type { OperatorRoutePoint, OperatorRouteSession } from '@/types/operatorLocations';
import type { ServiceStopEvent } from '@/types/serviceStopEvent';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useOperatorRouteHistory');
const ROUTE_QUERY_KEY = ['operator-route-history'];
const INVALIDATE_DEBOUNCE_MS = 2000;

interface OperatorRouteHistoryResult {
  points: OperatorRoutePoint[];
  sessions: OperatorRouteSession[];
  /** Detenciones declaradas del día: distinguen la parada con motivo del hueco sin explicar. */
  stopEvents: ServiceStopEvent[];
}

const getChileDayRangeUtc = (dateISO: string) => {
  const tz = businessClock.timezone();
  const startUtc = fromZonedTime(`${dateISO}T00:00:00`, tz);
  const endUtc = fromZonedTime(`${dateISO}T23:59:59.999`, tz);
  return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() };
};

const fetchRouteHistory = async (
  operatorId: string,
  dateISO: string,
): Promise<OperatorRouteHistoryResult> => {
  const { startUtc, endUtc } = getChileDayRangeUtc(dateISO);

  const [pointsResult, sessionsResult, stopEventsResult] = await Promise.all([
    supabase
      .from('operator_location_points')
      .select('session_id, latitude, longitude, accuracy_meters, speed_mps, heading_degrees, recorded_at')
      .eq('operator_id', operatorId)
      .gte('recorded_at', startUtc)
      .lte('recorded_at', endUtc)
      .order('recorded_at', { ascending: true }),
    supabase
      .from('operator_location_sessions')
      .select('id, status, started_reason, ended_reason, service_id, started_at, ended_at')
      .eq('operator_id', operatorId)
      .gte('started_at', startUtc)
      .lte('started_at', endUtc)
      .order('started_at', { ascending: true }),
    supabase
      .from('service_stop_events')
      .select('id, service_id, operator_id, reason, note, started_at, ended_at, ended_by_source')
      .eq('operator_id', operatorId)
      .gte('started_at', startUtc)
      .lte('started_at', endUtc)
      .order('started_at', { ascending: true }),
  ]);

  if (pointsResult.error) {
    throw new Error(pointsResult.error.message || 'No se pudo cargar el historial de puntos');
  }
  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message || 'No se pudo cargar el historial de sesiones');
  }
  // Las detenciones son contexto, no el historial: si fallan, la ruta se
  // muestra igual en vez de dejar la pantalla en error.
  if (stopEventsResult.error) {
    logger.warn('No se pudieron cargar las detenciones declaradas', stopEventsResult.error);
  }

  return {
    points: ((pointsResult.data ?? []) as OperatorRoutePoint[]).filter(hasValidChileCoordinates),
    sessions: (sessionsResult.data ?? []) as OperatorRouteSession[],
    stopEvents: (stopEventsResult.data ?? []) as ServiceStopEvent[],
  };
};

export const useOperatorRouteHistory = (operatorId: string | null, dateISO: string | null) => {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: [...ROUTE_QUERY_KEY, operatorId, dateISO],
    queryFn: () => fetchRouteHistory(operatorId as string, dateISO as string),
    enabled: Boolean(operatorId && dateISO),
    staleTime: 30 * 1000,
    refetchInterval: operatorId ? 30 * 1000 : false,
  });

  useEffect(() => {
    if (!operatorId) return;

    const scheduleInvalidate = () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void queryClient.invalidateQueries({
          queryKey: [...ROUTE_QUERY_KEY, operatorId],
        });
      }, INVALIDATE_DEBOUNCE_MS);
    };

    const handleChange = (payload: unknown) => {
      logger.debug('Operator route realtime change', payload);
      scheduleInvalidate();
    };

    const channel = supabase
      .channel(`operator-route-history-${operatorId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'operator_location_points', filter: `operator_id=eq.${operatorId}` },
        handleChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operator_location_sessions', filter: `operator_id=eq.${operatorId}` },
        handleChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_stop_events', filter: `operator_id=eq.${operatorId}` },
        handleChange,
      )
      .subscribe();

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [operatorId, queryClient]);

  return {
    points: query.data?.points ?? [],
    sessions: query.data?.sessions ?? [],
    stopEvents: query.data?.stopEvents ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
};
