import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { MatchedRouteResult } from '@/types/operatorLocations';

const logger = createLogger('MatchedRoute');

const STALE_TIME_MS = 5 * 60 * 1000;

export const fetchMatchedRoute = async (
  sessionId: string,
): Promise<MatchedRouteResult> => {
  const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
    body: { action: 'map_matching', session_id: sessionId },
  });

  if (error) {
    logger.error('Map matching invoke failed', error);
    throw error;
  }
  if (!data || !Array.isArray(data.segments)) {
    const message = 'Respuesta de matching inválida';
    logger.error(message, data);
    throw new Error(message);
  }

  return data as MatchedRouteResult;
};

/**
 * Ruta ajustada a calles (Map Matching) de una sesión. Solo se dispara cuando el
 * toggle "Ruta ajustada" está activo (`enabled`). Las sesiones cerradas responden
 * desde la caché matched_routes; las activas se recalculan en la edge function.
 */
export const useMatchedRoute = (sessionId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ['matched-route', sessionId],
    queryFn: () => fetchMatchedRoute(sessionId as string),
    enabled: Boolean(sessionId) && enabled,
    staleTime: STALE_TIME_MS,
    retry: false,
  });

export interface MatchedRoutesBatch {
  /** sessionId → resultado matcheado (solo sesiones ya resueltas con éxito). */
  bySession: Map<string, MatchedRouteResult>;
  isFetching: boolean;
  /** true si al menos una sesión falló y ninguna respondió con éxito. */
  allFailed: boolean;
}

/**
 * Variante en lote para el historial, que dibuja todas las sesiones del día en un
 * único mapa. Comparte queryKey/fetcher con useMatchedRoute, así la caché de
 * react-query se reutiliza entre ambos.
 */
export const useMatchedRoutes = (
  sessionIds: string[],
  enabled: boolean,
): MatchedRoutesBatch => {
  const queries = useQueries({
    queries: sessionIds.map((sessionId) => ({
      queryKey: ['matched-route', sessionId],
      queryFn: () => fetchMatchedRoute(sessionId),
      enabled: enabled && Boolean(sessionId),
      staleTime: STALE_TIME_MS,
      retry: false,
    })),
  });

  const isFetching = queries.some((query) => query.isFetching);
  const anyError = queries.some((query) => query.isError);
  const anySuccess = queries.some((query) => query.isSuccess);

  // Firma estable: cada resultado matcheado es inmutable una vez resuelto, así
  // que basta con qué sesiones ya tienen datos para memoizar el Map y evitar
  // redibujar el mapa en renders no relacionados.
  const signature = queries
    .map((query, index) => `${sessionIds[index]}:${query.data ? '1' : '0'}`)
    .join('|');

  const bySession = useMemo(() => {
    const map = new Map<string, MatchedRouteResult>();
    queries.forEach((query, index) => {
      if (query.data) map.set(sessionIds[index], query.data);
    });
    return map;
  }, [signature]);

  return {
    bySession,
    isFetching,
    allFailed: enabled && anyError && !anySuccess,
  };
};
