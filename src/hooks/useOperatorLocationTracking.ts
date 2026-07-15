import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { toast } from 'sonner';
import type { Service } from '@/types';
import type {
  LocationPermissionState,
  OperatorLocationPayload,
  OperatorLocationPoint,
  OperatorLocationSession,
  TrackingSessionEndedReason,
  TrackingSessionStartedReason,
  TrackingSettings,
} from '@/types/operatorLocation';
import {
  BackgroundGeolocation,
  checkLocationPermission,
  ensureOperatorLocationSession,
  fetchOperatorTrackingEnabled,
  fetchTrackingSettings,
  findActiveOperatorLocationSession,
  getCurrentLocationPoint,
  mapBackgroundGeolocationPoint,
  requestLocationPermission,
  saveOperatorLocationPoint,
  stopOperatorLocationSession,
  updateOperatorLocationSessionService,
} from '@/services/operatorLocationService';
import { isWithinTrackingSchedule, getTrackingScheduleLabel } from '@/utils/trackingSchedule';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useOperatorLocationTracking');
// Logger dedicado para detectar regresiones del bug SRV: sesiones auto_service con service_id NULL
const trackingLogger = createLogger('OperatorTracking');

const LOCATION_QUEUE_KEY = 'operator-location-points-queue-v1';
const TRACKING_PAUSED_KEY = 'operator-tracking-paused-v1';
const TRACKING_INTERVAL_MS = 30000;
const NATIVE_MIN_PERSIST_INTERVAL_MS = 20000;
const SCHEDULE_CHECK_INTERVAL_MS = 30000;
const MAX_QUEUED_POINTS = 200;
const MAX_QUEUE_ATTEMPTS = 10;

export type TrackingMode = TrackingSessionStartedReason | null;

interface QueuedLocationPoint extends OperatorLocationPayload {
  localId: string;
  attempts: number;
}

interface UseOperatorLocationTrackingOptions {
  operatorId?: string | null;
  userId?: string | null;
  currentService?: Service | null;
}

const readQueuedPoints = async (): Promise<QueuedLocationPoint[]> => {
  try {
    const { value } = await Preferences.get({ key: LOCATION_QUEUE_KEY });
    if (!value) return [];
    return JSON.parse(value) as QueuedLocationPoint[];
  } catch {
    return [];
  }
};

const writeQueuedPoints = async (points: QueuedLocationPoint[]) => {
  await Preferences.set({
    key: LOCATION_QUEUE_KEY,
    value: JSON.stringify(points.slice(-MAX_QUEUED_POINTS)),
  });
};

const readPausedFlag = async (): Promise<boolean> => {
  try {
    const { value } = await Preferences.get({ key: TRACKING_PAUSED_KEY });
    return value === 'true';
  } catch {
    return false;
  }
};

const writePausedFlag = async (paused: boolean) => {
  if (paused) {
    await Preferences.set({ key: TRACKING_PAUSED_KEY, value: 'true' });
  } else {
    await Preferences.remove({ key: TRACKING_PAUSED_KEY });
  }
};

const createPayload = (
  point: OperatorLocationPoint,
  sessionId: string,
  operatorId: string,
  userId: string,
  serviceId: string | null,
  isOfflineSync = false,
): OperatorLocationPayload => ({
  sessionId,
  operatorId,
  userId,
  serviceId,
  latitude: point.latitude,
  longitude: point.longitude,
  accuracyMeters: point.accuracyMeters,
  speedMps: point.speedMps,
  headingDegrees: point.headingDegrees,
  altitudeMeters: point.altitudeMeters,
  recordedAt: point.recordedAt,
  isOfflineSync,
});

export const useOperatorLocationTracking = ({
  operatorId,
  userId,
  currentService,
}: UseOperatorLocationTrackingOptions) => {
  const [permissionState, setPermissionState] = useState<LocationPermissionState>('unknown');
  const [isTracking, setIsTracking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [lastPoint, setLastPoint] = useState<OperatorLocationPoint | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [trackingSettings, setTrackingSettings] = useState<TrackingSettings | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [trackingDisabled, setTrackingDisabled] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const watcherIdRef = useRef<string | null>(null);
  const scheduleIntervalRef = useRef<number | null>(null);
  const lastNativePersistAtRef = useRef(0);
  const lastPersistedSignatureRef = useRef<string | null>(null);

  const isTrackingRef = useRef(false);
  const trackingModeRef = useRef<TrackingMode>(null);
  const isPausedRef = useRef(false);
  const trackingSettingsRef = useRef<TrackingSettings | null>(null);
  const sessionServiceIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const trackingDisabledRef = useRef(false);

  const serviceId = currentService?.id ?? null;
  // Mantenida al dia en cada render (no en un efecto) para que startSession pueda leer
  // el service_id mas reciente incluso durante el await de permisos, que puede tardar
  // un tiempo indeterminado y dejar obsoleto el valor capturado en el closure.
  const serviceIdRef = useRef<string | null>(serviceId);
  serviceIdRef.current = serviceId;
  const serviceLabel = currentService?.folio
    ? `Folio ${currentService.folio}`
    : currentService?.origin || currentService?.destination
      ? [currentService.origin, currentService.destination].filter(Boolean).join(' -> ')
      : null;

  const scheduleLabel = useMemo(
    () => (trackingSettings ? getTrackingScheduleLabel(trackingSettings) : null),
    [trackingSettings],
  );

  const clearCaptureLoop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watcherIdRef.current !== null) {
      const id = watcherIdRef.current;
      watcherIdRef.current = null;
      void BackgroundGeolocation.removeWatcher({ id }).catch((error) => {
        logger.warn('Could not remove background geolocation watcher', error);
      });
    }
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const queued = await readQueuedPoints();
    setPendingCount(queued.length);
  }, []);

  const flushQueue = useCallback(async () => {
    const queued = await readQueuedPoints();
    if (!queued.length || !navigator.onLine) {
      await refreshPendingCount();
      return;
    }

    const remaining: QueuedLocationPoint[] = [];

    for (const item of queued) {
      try {
        await saveOperatorLocationPoint({
          ...item,
          isOfflineSync: true,
        });
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_QUEUE_ATTEMPTS) {
          logger.warn('Discarding queued location point after max attempts', { localId: item.localId, error });
        } else {
          logger.warn('Could not flush queued location point', error);
          remaining.push({ ...item, attempts });
        }
      }
    }

    await writeQueuedPoints(remaining);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const persistPoint = useCallback(async (
    point: OperatorLocationPoint,
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    const signature = `${activeSessionId}:${point.recordedAt}:${point.latitude}:${point.longitude}`;
    if (lastPersistedSignatureRef.current === signature) {
      return;
    }
    lastPersistedSignatureRef.current = signature;

    const payload = createPayload(
      point,
      activeSessionId,
      activeOperatorId,
      activeUserId,
      activeServiceId,
    );

    if (!navigator.onLine) {
      const queued = await readQueuedPoints();
      queued.push({
        ...payload,
        localId: `${payload.recordedAt}:${queued.length}`,
        attempts: 0,
      });
      await writeQueuedPoints(queued);
      await refreshPendingCount();
      return;
    }

    await saveOperatorLocationPoint(payload);
    setLastSyncAt(new Date().toISOString());
    await flushQueue();
  }, [flushQueue, refreshPendingCount]);

  const stopSession = useCallback(async (endedReason: TrackingSessionEndedReason) => {
    clearCaptureLoop();
    const activeSessionId = sessionIdRef.current;

    sessionIdRef.current = null;
    sessionServiceIdRef.current = null;
    trackingModeRef.current = null;
    isTrackingRef.current = false;
    setSessionId(null);
    setTrackingMode(null);
    setIsTracking(false);

    if (activeSessionId) {
      try {
        await stopOperatorLocationSession(activeSessionId, endedReason);
      } catch (error) {
        logger.warn('Could not stop location session', error);
      }
    }
  }, [clearCaptureLoop]);

  const beginWebPolling = useCallback((
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    const run = async () => {
      try {
        const point = await getCurrentLocationPoint();
        setLastPoint(point);
        await persistPoint(point, activeSessionId, activeOperatorId, activeUserId, activeServiceId);
        setErrorMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo actualizar la ubicacion';
        logger.warn('Location polling failed', error);
        setErrorMessage(message);
      }
    };

    void run();
    intervalRef.current = window.setInterval(() => {
      void run();
    }, TRACKING_INTERVAL_MS);
  }, [persistPoint]);

  const beginNativeWatcher = useCallback((
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    lastNativePersistAtRef.current = 0;

    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Compartiendo ubicación con la central',
        backgroundTitle: 'TMS Operador',
        requestPermissions: true,
        distanceFilter: 30,
      },
      (location, error) => {
        if (error) {
          logger.warn('Background geolocation watcher error', error);
          return;
        }
        if (!location) return;

        const now = Date.now();
        if (now - lastNativePersistAtRef.current < NATIVE_MIN_PERSIST_INTERVAL_MS) return;
        lastNativePersistAtRef.current = now;

        const point = mapBackgroundGeolocationPoint(location);
        setLastPoint(point);
        void persistPoint(point, activeSessionId, activeOperatorId, activeUserId, activeServiceId)
          .then(() => setErrorMessage(null))
          .catch((persistError) => {
            const message = persistError instanceof Error
              ? persistError.message
              : 'No se pudo actualizar la ubicacion';
            logger.warn('Location persistence failed', persistError);
            setErrorMessage(message);
          });
      },
    ).then((id) => {
      watcherIdRef.current = id;
    }).catch((watcherError) => {
      logger.warn('Could not start background geolocation watcher', watcherError);
      setErrorMessage('No se pudo iniciar el rastreo en segundo plano');
    });
  }, [persistPoint]);

  const beginCapture = useCallback((
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    clearCaptureLoop();

    if (Capacitor.isNativePlatform()) {
      beginNativeWatcher(activeSessionId, activeOperatorId, activeUserId, activeServiceId);
    } else {
      beginWebPolling(activeSessionId, activeOperatorId, activeUserId, activeServiceId);
    }
  }, [beginNativeWatcher, beginWebPolling, clearCaptureLoop]);

  const maybeRepairAutoServiceSession = useCallback(async (
    session: OperatorLocationSession,
  ): Promise<OperatorLocationSession> => {
    const expectedServiceId = serviceIdRef.current;
    if (session.started_reason !== 'auto_service' || session.service_id || !expectedServiceId) {
      return session;
    }

    trackingLogger.warn('auto_service session created with null service_id, repairing', {
      sessionId: session.id,
      expectedServiceId,
    });

    try {
      await updateOperatorLocationSessionService(session.id, expectedServiceId);
      return { ...session, service_id: expectedServiceId };
    } catch (repairError) {
      trackingLogger.warn('Could not repair auto_service session service_id', repairError);
      return session;
    }
  }, []);

  const startSession = useCallback(async (reason: TrackingSessionStartedReason) => {
    if (!operatorId || !userId || trackingDisabledRef.current) return;

    let permission = await checkLocationPermission();
    if (permission !== 'granted') {
      permission = await requestLocationPermission();
    }
    setPermissionState(permission);

    if (permission !== 'granted') {
      if (reason === 'manual') {
        toast.error('Debes permitir la ubicacion para compartir tu posicion');
      }
      return;
    }

    // Leida justo antes de escribir en la sesion: durante el await de permisos arriba
    // el service_id "real" puede haber cambiado respecto al valor capturado al invocar
    // esta funcion, así que para auto_service usamos siempre el mas reciente.
    const effectiveServiceId = reason === 'auto_service' ? serviceIdRef.current : serviceId;

    try {
      let session = await ensureOperatorLocationSession(operatorId, userId, effectiveServiceId, reason);
      session = await maybeRepairAutoServiceSession(session);

      if (reason === 'auto_service' && isPausedRef.current) {
        isPausedRef.current = false;
        setIsPaused(false);
        await writePausedFlag(false);
      }

      sessionIdRef.current = session.id;
      sessionServiceIdRef.current = session.service_id;
      trackingModeRef.current = session.started_reason;
      isTrackingRef.current = true;

      setSessionId(session.id);
      setTrackingMode(session.started_reason);
      setIsTracking(true);
      setErrorMessage(null);

      beginCapture(session.id, operatorId, userId, effectiveServiceId);

      if (reason === 'manual') {
        toast.success(effectiveServiceId
          ? 'Ubicacion compartida para el servicio activo'
          : 'Ubicacion compartida desde la app operador');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar la ubicacion';
      setErrorMessage(message);
      if (reason === 'manual') {
        toast.error(message);
      }
    }
  }, [beginCapture, maybeRepairAutoServiceSession, operatorId, serviceId, userId]);

  const evaluate = useCallback(() => {
    if (!operatorId || !userId || !isReady || trackingDisabledRef.current) return;

    if (serviceId) {
      if (
        !isTrackingRef.current
        || sessionServiceIdRef.current !== serviceId
        || trackingModeRef.current !== 'auto_service'
      ) {
        void startSession('auto_service');
      }
      return;
    }

    if (isPausedRef.current) {
      return;
    }

    const settings = trackingSettingsRef.current;
    const withinSchedule = settings ? isWithinTrackingSchedule(settings) : false;

    if (withinSchedule) {
      if (!isTrackingRef.current || trackingModeRef.current === 'auto_service') {
        void startSession('auto_schedule');
      }
      return;
    }

    if (isTrackingRef.current && trackingModeRef.current !== 'manual') {
      void stopSession('schedule_end');
    }
  }, [isReady, operatorId, serviceId, startSession, stopSession, userId]);

  const pauseTracking = useCallback(async () => {
    setIsBusy(true);
    try {
      await stopSession('manual');
      isPausedRef.current = true;
      setIsPaused(true);
      await writePausedFlag(true);
      toast.success('Rastreo pausado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo pausar el rastreo';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [stopSession]);

  const resumeTracking = useCallback(async () => {
    setIsBusy(true);
    try {
      isPausedRef.current = false;
      setIsPaused(false);
      await writePausedFlag(false);
      await startSession(serviceId ? 'auto_service' : 'manual');
    } finally {
      setIsBusy(false);
    }
  }, [serviceId, startSession]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const [permission, paused, settings, trackingEnabled] = await Promise.all([
        checkLocationPermission(),
        readPausedFlag(),
        fetchTrackingSettings(),
        operatorId ? fetchOperatorTrackingEnabled(operatorId) : Promise.resolve(true),
      ]);

      if (cancelled) return;

      setPermissionState(permission);
      setIsPaused(paused);
      isPausedRef.current = paused;
      setTrackingSettings(settings);
      trackingSettingsRef.current = settings;

      const disabled = !trackingEnabled;
      setTrackingDisabled(disabled);
      trackingDisabledRef.current = disabled;

      if (disabled) {
        setIsReady(true);
        return;
      }

      await refreshPendingCount();

      if (operatorId) {
        try {
          let activeSession = await findActiveOperatorLocationSession(operatorId);
          if (activeSession) {
            activeSession = await maybeRepairAutoServiceSession(activeSession);
          }
          if (!cancelled && activeSession) {
            sessionIdRef.current = activeSession.id;
            sessionServiceIdRef.current = activeSession.service_id;
            trackingModeRef.current = activeSession.started_reason;
            isTrackingRef.current = true;

            setSessionId(activeSession.id);
            setTrackingMode(activeSession.started_reason);
            setIsTracking(true);
            beginCapture(activeSession.id, operatorId, userId ?? '', activeSession.service_id);
          }
        } catch (error) {
          logger.warn('Could not recover active location session', error);
        }
      }

      if (!cancelled) {
        setIsReady(true);
      }
    };

    void bootstrap();

    const handleOnline = () => {
      void flushQueue();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      clearCaptureLoop();
    };
  }, [operatorId, userId]);

  useEffect(() => {
    if (!isReady) return;
    evaluate();

    scheduleIntervalRef.current = window.setInterval(() => {
      evaluate();
    }, SCHEDULE_CHECK_INTERVAL_MS);

    return () => {
      if (scheduleIntervalRef.current !== null) {
        window.clearInterval(scheduleIntervalRef.current);
        scheduleIntervalRef.current = null;
      }
    };
  }, [evaluate, isReady]);

  // Auto-recuperación al volver a foreground / reabrir tras un crash.
  // iOS puede terminar el proceso (o el watcher nativo) mientras la app está en
  // segundo plano; el toggle manual Pausar/Reanudar no puede ser el único
  // mecanismo de recuperación (un traslado completo quedó sin puntos por esto).
  // Al volver a foreground: si hay un servicio activo con tracking habilitado y
  // sin pausa manual, garantizamos una sesión viva con el watcher re-enganchado.
  const recoverTrackingOnForeground = useCallback(async () => {
    if (!operatorId || !userId || !isReady || trackingDisabledRef.current) return;

    await flushQueue();

    const activeServiceId = serviceIdRef.current;

    // Sin servicio asignado: dejar que evaluate() maneje el modo por horario.
    if (!activeServiceId) {
      evaluate();
      return;
    }

    if (isPausedRef.current) return;

    const hasLiveAutoServiceSession =
      isTrackingRef.current
      && trackingModeRef.current === 'auto_service'
      && sessionServiceIdRef.current === activeServiceId;

    if (!hasLiveAutoServiceSession) {
      // No hay sesión viva (mismo criterio auto_service de evaluate): re-crearla.
      void startSession('auto_service');
      return;
    }

    // Creemos estar rastreando, pero el watcher nativo pudo morir en background
    // sin que el estado JS se enterara. Re-enganchar la captura garantiza que el
    // tramo de traslado siga registrando puntos.
    if (Capacitor.isNativePlatform() && sessionIdRef.current) {
      beginCapture(sessionIdRef.current, operatorId, userId, activeServiceId);
    }
  }, [beginCapture, evaluate, flushQueue, isReady, operatorId, startSession, userId]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void recoverTrackingOnForeground();
      }
    });
    void listenerPromise.then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      removeListener?.();
    };
  }, [recoverTrackingOnForeground]);

  const permissionLabel = useMemo(() => {
    switch (permissionState) {
      case 'granted':
        return 'Permiso concedido';
      case 'denied':
        return 'Permiso denegado';
      case 'prompt':
        return 'Permiso pendiente';
      case 'unsupported':
        return 'Ubicacion no soportada';
      default:
        return 'Permiso por revisar';
    }
  }, [permissionState]);

  return {
    permissionState,
    permissionLabel,
    isTracking,
    isBusy,
    lastPoint,
    lastSyncAt,
    pendingCount,
    errorMessage,
    sessionId,
    serviceLabel,
    trackingMode,
    isPaused,
    scheduleLabel,
    trackingSettings,
    trackingDisabled,
    pauseTracking,
    resumeTracking,
    flushQueue,
  };
};
