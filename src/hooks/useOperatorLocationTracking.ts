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
  OperatorLocationSource,
  TrackingSessionEndedReason,
  TrackingSessionStartedReason,
  TrackingSettings,
} from '@/types/operatorLocation';
import {
  BackgroundGeolocation,
  checkLocationPermission,
  clearManualStopForService,
  ensureOperatorLocationSession,
  fetchOperatorTrackingEnabled,
  fetchTrackingSettings,
  findActiveOperatorLocationSession,
  getCurrentLocationPoint,
  hasManualStopForService,
  mapBackgroundGeolocationPoint,
  requestLocationPermission,
  saveOperatorLocationPoint,
  stopOperatorLocationSession,
  updateOperatorLocationSessionService,
} from '@/services/operatorLocationService';
import { isWithinTrackingSchedule, getTrackingScheduleLabel } from '@/utils/trackingSchedule';
import { allowSleepSafely, keepAwakeSafely } from '@/utils/keepAwake';
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

/**
 * Latido: máximo tiempo sin enviar un punto, haya o no movimiento.
 *
 * Debe ser MENOR que tracking_settings.session_timeout_minutes (10 min), o el
 * barrido de sesiones zombie cierra la sesión antes de que llegue el siguiente
 * latido. Con 2 min hay cinco latidos de margen.
 */
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Distancia mínima para considerar que el operador se movió.
 *
 * Antes este filtro vivía en el plugin (`distanceFilter: 30`) y ese era el bug
 * de fondo: con el equipo detenido iOS no emitía NINGÚN evento, así que no
 * había nada que sostuviera la sesión ni que disparara un latido, y la app
 * quedaba suspendida hasta que el sweep la mataba a los 10 min. Ahora el
 * watcher pide todas las actualizaciones (distanceFilter 0) y el filtro se
 * aplica aquí, donde sí podemos distinguir "no se movió" de "no reportó".
 */
const MOVEMENT_THRESHOLD_METERS = 30;

const EARTH_RADIUS_METERS = 6371000;

const distanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

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
  source: OperatorLocationSource = 'mobile_app',
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
  source,
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
  // Corte manual del servicio en curso: inhibe el auto-encendido por movimiento.
  const [manualStop, setManualStop] = useState(false);
  const manualStopRef = useRef(false);

  const intervalRef = useRef<number | null>(null);
  const watcherIdRef = useRef<string | null>(null);
  const scheduleIntervalRef = useRef<number | null>(null);
  const lastNativePersistAtRef = useRef(0);
  const lastPersistedSignatureRef = useRef<string | null>(null);
  // Última posición efectivamente enviada: contra ella se mide el umbral de
  // movimiento, ahora que el filtro dejó de vivir en el plugin.
  const lastPersistedLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

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

  const enqueuePoint = useCallback(async (payload: OperatorLocationPayload) => {
    const queued = await readQueuedPoints();
    queued.push({
      ...payload,
      localId: `${payload.recordedAt}:${queued.length}`,
      attempts: 0,
    });
    await writeQueuedPoints(queued);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const persistPoint = useCallback(async (
    point: OperatorLocationPoint,
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
    source: OperatorLocationSource = 'mobile_app',
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
      source,
    );

    if (!navigator.onLine) {
      trackingLogger.debug('Punto encolado sin conexión', { source, recordedAt: point.recordedAt });
      await enqueuePoint(payload);
      return;
    }

    try {
      await saveOperatorLocationPoint(payload);
    } catch (error) {
      // navigator.onLine miente en terreno: en el desierto la interfaz sigue
      // "en línea" y la petición muere igual. Sin este catch el punto se perdía
      // en vez de irse a la cola offline que el esquema ya contempla.
      trackingLogger.warn('Falló la subida del punto, se encola para reintento', { source, error });
      await enqueuePoint(payload);
      return;
    }

    trackingLogger.debug('Punto enviado', { source, recordedAt: point.recordedAt });
    setLastSyncAt(new Date().toISOString());
    await flushQueue();
  }, [enqueuePoint, flushQueue]);

  const stopSession = useCallback(async (
    endedReason: TrackingSessionEndedReason,
    options: { endedBy?: string | null; manualStop?: boolean } = {},
  ) => {
    clearCaptureLoop();
    void allowSleepSafely();
    const activeSessionId = sessionIdRef.current;

    sessionIdRef.current = null;
    sessionServiceIdRef.current = null;
    trackingModeRef.current = null;
    isTrackingRef.current = false;
    setSessionId(null);
    setTrackingMode(null);
    setIsTracking(false);

    if (options.manualStop) {
      // Se refleja de inmediato en memoria: evaluate() corre cada 30 s y sin
      // esto reabriría la sesión antes de que la BD confirme el corte.
      manualStopRef.current = true;
      setManualStop(true);
    }

    if (activeSessionId) {
      try {
        await stopOperatorLocationSession(activeSessionId, endedReason, options);
      } catch (error) {
        trackingLogger.warn('Could not stop location session', error);
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
    lastPersistedLocationRef.current = null;

    const submit = (point: OperatorLocationPoint, source: OperatorLocationSource) => {
      lastNativePersistAtRef.current = Date.now();
      lastPersistedLocationRef.current = { latitude: point.latitude, longitude: point.longitude };
      setLastPoint(point);
      return persistPoint(point, activeSessionId, activeOperatorId, activeUserId, activeServiceId, source)
        .then(() => setErrorMessage(null))
        .catch((persistError) => {
          const message = persistError instanceof Error
            ? persistError.message
            : 'No se pudo actualizar la ubicacion';
          trackingLogger.warn('Location persistence failed', persistError);
          setErrorMessage(message);
        });
    };

    // Lectura inicial explícita: con el equipo quieto iOS puede tardar en
    // emitir el primer evento del watcher y la central quedaría sin señal
    // desde el arranque o la reanudación del rastreo.
    void getCurrentLocationPoint()
      .then((point) => submit(point, 'mobile_app'))
      .catch((initialPointError) => {
        trackingLogger.warn('Could not capture initial native location point', initialPointError);
      });

    BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Compartiendo ubicación con la central',
        backgroundTitle: 'TMS Operador',
        requestPermissions: true,
        // distanceFilter 0 = el plugin entrega TODAS las actualizaciones. Es
        // deliberado: un setInterval JS no sobrevive la suspensión en iOS, así
        // que el latido tiene que venir del lado nativo. El filtro real de
        // movimiento y la cadencia se aplican abajo, en JS.
        distanceFilter: 0,
      },
      (location, error) => {
        if (error) {
          trackingLogger.warn('Background geolocation watcher error', error);
          return;
        }
        if (!location) return;

        const now = Date.now();
        const elapsed = now - lastNativePersistAtRef.current;
        if (elapsed < NATIVE_MIN_PERSIST_INTERVAL_MS) return;

        const point = mapBackgroundGeolocationPoint(location);
        const previous = lastPersistedLocationRef.current;
        const moved = !previous || distanceMeters(previous, point) >= MOVEMENT_THRESHOLD_METERS;
        const heartbeatDue = elapsed >= HEARTBEAT_INTERVAL_MS;

        if (!moved && !heartbeatDue) return;

        // Sin movimiento pero con latido vencido: se envía igual el último fix
        // conocido marcado como 'heartbeat'. Eso mantiene viva la sesión frente
        // al barrido de 10 min y deja constancia de que el operador estaba
        // detenido, no incomunicado.
        const source: OperatorLocationSource = moved ? 'mobile_app' : 'heartbeat';
        if (!moved) {
          trackingLogger.debug('Latido de ubicación', {
            secondsSinceLastPoint: Math.round(elapsed / 1000),
          });
        }

        void submit(point, source);
      },
    ).then((id) => {
      watcherIdRef.current = id;
      trackingLogger.debug('Watcher de ubicación en segundo plano activo', { watcherId: id });
    }).catch((watcherError) => {
      trackingLogger.warn('Could not start background geolocation watcher', watcherError);
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

      // Reencender es siempre un acto explícito o automático posterior al
      // corte: en ambos casos la inhibición deja de tener sentido.
      if (manualStopRef.current) {
        manualStopRef.current = false;
        setManualStop(false);
        if (effectiveServiceId) {
          void clearManualStopForService(operatorId, effectiveServiceId).catch((clearError) => {
            trackingLogger.warn('No se pudo limpiar la marca de corte manual', clearError);
          });
        }
      }

      beginCapture(session.id, operatorId, userId, effectiveServiceId);
      void keepAwakeSafely();

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
      // Precedencia del corte manual: si el operador apagó la transmisión a
      // mano, el sistema NO la reenciende solo. Antes esta rama ignoraba tanto
      // la pausa como el corte, así que el ciclo de 30 s deshacía la decisión
      // del operador a los pocos segundos.
      if (manualStopRef.current || isPausedRef.current) {
        return;
      }

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

  /**
   * Corte manual desde el control unificado. `endedReason` distingue si hubo
   * que pedir PIN (había un cliente mirando) de la doble confirmación simple;
   * ambos marcan `manual_stop` e inhiben el auto-encendido.
   */
  const stopTransmission = useCallback(async (
    endedReason: 'manual_pin' | 'manual_confirm',
  ) => {
    setIsBusy(true);
    try {
      await stopSession(endedReason, { endedBy: userId ?? null, manualStop: true });
      isPausedRef.current = true;
      setIsPaused(true);
      await writePausedFlag(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo detener la transmisión';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [stopSession, userId]);

  /**
   * Encendido automático por movimiento sostenido (3.6). No pasa por encima de
   * un corte manual: si lo hay, quien llama muestra "Rodando sin transmitir" y
   * no invoca esto.
   */
  const startTransmissionAutomatically = useCallback(async () => {
    if (manualStopRef.current || isTrackingRef.current || trackingDisabledRef.current) return;

    isPausedRef.current = false;
    setIsPaused(false);
    await writePausedFlag(false);
    await startSession(serviceId ? 'auto_service' : 'manual');
    trackingLogger.debug('Transmisión encendida automáticamente por movimiento sostenido');
    toast.success('Transmisión activada automáticamente');
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

      // Se lee de la BD, no solo del almacenamiento local: el corte manual debe
      // sobrevivir una reinstalación o un cambio de teléfono.
      if (operatorId && serviceIdRef.current) {
        try {
          const stopped = await hasManualStopForService(operatorId, serviceIdRef.current);
          if (!cancelled && stopped) {
            manualStopRef.current = true;
            setManualStop(true);
          }
        } catch (error) {
          trackingLogger.warn('No se pudo leer el corte manual del servicio', error);
        }
      }

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
    manualStop,
    pauseTracking,
    resumeTracking,
    stopTransmission,
    startTransmissionAutomatically,
    flushQueue,
  };
};
