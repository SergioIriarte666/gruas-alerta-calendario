import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import type { ServiceStopEvent, StopReason } from '@/types/serviceStopEvent';

const logger = createLogger('Tracking');

const TABLE = 'service_stop_events';
const SELECT = 'id, service_id, operator_id, reason, note, started_at, ended_at, ended_by_source';

/** Detención abierta del servicio, si hay. Un índice único garantiza que sea a lo más una. */
export const fetchOpenStopEvent = async (serviceId: string): Promise<ServiceStopEvent | null> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .eq('service_id', serviceId)
    .is('ended_at', null)
    .maybeSingle();

  if (error) {
    logger.warn('No se pudo consultar la detención activa', error);
    return null;
  }

  return (data as ServiceStopEvent | null) ?? null;
};

export const fetchStopEventsForServices = async (
  serviceIds: string[],
): Promise<ServiceStopEvent[]> => {
  if (serviceIds.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT)
    .in('service_id', serviceIds)
    .order('started_at', { ascending: true });

  if (error) {
    logger.warn('No se pudieron cargar las detenciones del servicio', error);
    return [];
  }

  return (data as ServiceStopEvent[]) ?? [];
};

/**
 * Abre una detención. Si ya hay una abierta, la devuelve en vez de fallar: el
 * índice único la rechazaría y un error aquí solo confundiría al operador.
 */
export const openStopEvent = async (
  serviceId: string,
  operatorId: string | null,
  reason: StopReason,
  note?: string | null,
): Promise<ServiceStopEvent> => {
  const existing = await fetchOpenStopEvent(serviceId);
  if (existing) {
    if (existing.reason === reason) return existing;

    // Cambio de motivo sobre la marcha (p. ej. "Peaje" → "Descanso"): se
    // corrige el evento abierto en vez de encadenar dos detenciones.
    const { data, error } = await supabase
      .from(TABLE)
      .update({ reason, note: note ?? existing.note })
      .eq('id', existing.id)
      .select(SELECT)
      .single();

    if (error) throw new Error(error.message || 'No se pudo cambiar el motivo de la detención');
    return data as ServiceStopEvent;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      service_id: serviceId,
      operator_id: operatorId,
      reason,
      note: note ?? null,
      started_at: businessClock.nowISO(),
    })
    .select(SELECT)
    .single();

  if (error) throw new Error(error.message || 'No se pudo registrar la detención');

  logger.debug('Detención abierta', { serviceId, reason });
  return data as ServiceStopEvent;
};

/**
 * Cierra la detención abierta del servicio.
 * `source` distingue el cierre a mano del automático por velocidad sostenida.
 */
export const closeStopEvent = async (
  serviceId: string,
  source: 'manual' | 'auto_speed',
): Promise<void> => {
  const { error } = await supabase
    .from(TABLE)
    .update({ ended_at: businessClock.nowISO(), ended_by_source: source })
    .eq('service_id', serviceId)
    .is('ended_at', null);

  if (error) throw new Error(error.message || 'No se pudo cerrar la detención');

  logger.debug('Detención cerrada', { serviceId, source });
};
