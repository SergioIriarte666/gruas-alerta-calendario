import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import {
  closeStopEvent,
  fetchOpenStopEvent,
  openStopEvent,
} from '@/services/serviceStopEventService';
import { SustainedMovementTracker } from '@/utils/sustainedMovement';
import type { ServiceStopEvent, StopReason } from '@/types/serviceStopEvent';
import { STOP_REASON_LABELS } from '@/types/serviceStopEvent';
import type { OperatorLocationPoint } from '@/types/operatorLocation';

const logger = createLogger('Tracking');

/**
 * Cadencia con la que se relee la detención abierta desde la BD.
 *
 * Quien CIERRA por velocidad sostenida es el servidor (trigger sobre
 * operator_location_points): el evaluador de abajo es solo un espejo optimista
 * para que la UI no espere. Sin esta relectura, una detención cerrada por el
 * servidor seguiría pintada como abierta en el teléfono.
 */
const STOP_EVENT_REFRESH_MS = 30000;

interface UseServiceStopEventOptions {
  serviceId?: string | null;
  operatorId?: string | null;
  /** Último fix recibido; alimenta la reanudación automática por velocidad. */
  lastPoint?: OperatorLocationPoint | null;
}

/**
 * Detención declarada del servicio en curso.
 *
 * La reanudación tiene doble vía a propósito: el botón "Rodando" y el cierre
 * automático por velocidad sostenida. El operador que olvida cerrar no puede
 * dejar al cliente viendo "en descanso" mientras la grúa rueda.
 */
export const useServiceStopEvent = ({
  serviceId,
  operatorId,
  lastPoint,
}: UseServiceStopEventOptions) => {
  const [stopEvent, setStopEvent] = useState<ServiceStopEvent | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const movementRef = useRef(new SustainedMovementTracker());
  const stopEventRef = useRef<ServiceStopEvent | null>(null);
  stopEventRef.current = stopEvent;

  useEffect(() => {
    let cancelled = false;
    if (!serviceId) {
      setStopEvent(null);
      return;
    }

    const refresh = () => {
      void fetchOpenStopEvent(serviceId).then((event) => {
        if (!cancelled) setStopEvent(event);
      });
    };

    refresh();
    const intervalId = window.setInterval(refresh, STOP_EVENT_REFRESH_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [serviceId]);

  const declareStop = useCallback(async (reason: StopReason) => {
    if (!serviceId) return;
    setIsBusy(true);
    try {
      const event = await openStopEvent(serviceId, operatorId ?? null, reason);
      setStopEvent(event);
      // Rearmado: el tramo que venía antes de detenerse no debe contar para
      // cerrar esta detención recién abierta.
      movementRef.current.reset();
      toast.success(`Detenido · ${STOP_REASON_LABELS[reason]}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar la detención';
      logger.warn('No se pudo abrir la detención', error);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [operatorId, serviceId]);

  const resume = useCallback(async (source: 'manual' | 'auto_speed' = 'manual') => {
    if (!serviceId || !stopEventRef.current) return;
    setIsBusy(true);
    try {
      await closeStopEvent(serviceId, source);
      setStopEvent(null);
      movementRef.current.reset();
      if (source === 'auto_speed') {
        toast.info('Detención cerrada automáticamente: la grúa está rodando');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo reanudar';
      logger.warn('No se pudo cerrar la detención', error);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [serviceId]);

  // Reanudación automática: solo tiene sentido con una detención abierta.
  useEffect(() => {
    if (!lastPoint || !stopEvent) return;

    const sustained = movementRef.current.push({
      speedMps: lastPoint.speedMps,
      latitude: lastPoint.latitude,
      longitude: lastPoint.longitude,
      atMs: new Date(lastPoint.recordedAt).getTime(),
    });

    if (sustained) {
      logger.debug('Movimiento sostenido con detención abierta: se cierra sola');
      void resume('auto_speed');
    }
  }, [lastPoint, resume, stopEvent]);

  const minutesStopped = stopEvent
    ? Math.max(0, Math.round((businessClock.now().getTime() - new Date(stopEvent.started_at).getTime()) / 60000))
    : 0;

  return { stopEvent, minutesStopped, isBusy, declareStop, resume };
};
