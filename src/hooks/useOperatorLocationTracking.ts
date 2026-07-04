import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Service } from '@/types';
import type {
  LocationPermissionState,
  OperatorLocationPayload,
  OperatorLocationPoint,
} from '@/types/operatorLocation';
import {
  checkLocationPermission,
  ensureOperatorLocationSession,
  getCurrentLocationPoint,
  requestLocationPermission,
  saveOperatorLocationPoint,
  stopOperatorLocationSession,
} from '@/services/operatorLocationService';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useOperatorLocationTracking');

const LOCATION_QUEUE_KEY = 'operator-location-points-queue-v1';
const LOCATION_SESSION_KEY = 'operator-location-session-v1';
const TRACKING_INTERVAL_MS = 30000;
const MAX_QUEUED_POINTS = 200;

interface QueuedLocationPoint extends OperatorLocationPayload {
  localId: string;
}

interface StoredSession {
  sessionId: string;
  operatorId: string;
  userId: string;
  serviceId: string | null;
}

interface UseOperatorLocationTrackingOptions {
  operatorId?: string | null;
  userId?: string | null;
  currentService?: Service | null;
}

const readQueuedPoints = (): QueuedLocationPoint[] => {
  try {
    const raw = localStorage.getItem(LOCATION_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedLocationPoint[];
  } catch {
    return [];
  }
};

const writeQueuedPoints = (points: QueuedLocationPoint[]) => {
  localStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(points.slice(-MAX_QUEUED_POINTS)));
};

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(LOCATION_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

const writeStoredSession = (session: StoredSession | null) => {
  if (!session) {
    localStorage.removeItem(LOCATION_SESSION_KEY);
    return;
  }

  localStorage.setItem(LOCATION_SESSION_KEY, JSON.stringify(session));
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
  const intervalRef = useRef<number | null>(null);

  const serviceId = currentService?.id ?? null;
  const serviceLabel = currentService?.folio
    ? `Folio ${currentService.folio}`
    : currentService?.origin || currentService?.destination
      ? [currentService.origin, currentService.destination].filter(Boolean).join(' -> ')
      : null;

  const clearTrackingInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(readQueuedPoints().length);
  }, []);

  const flushQueue = useCallback(async () => {
    const queued = readQueuedPoints();
    if (!queued.length || !navigator.onLine) {
      refreshPendingCount();
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
        logger.warn('Could not flush queued location point', error);
        remaining.push(item);
      }
    }

    writeQueuedPoints(remaining);
    refreshPendingCount();
  }, [refreshPendingCount]);

  const persistPoint = useCallback(async (
    point: OperatorLocationPoint,
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    const payload = createPayload(
      point,
      activeSessionId,
      activeOperatorId,
      activeUserId,
      activeServiceId,
    );

    if (!navigator.onLine) {
      const queued = readQueuedPoints();
      queued.push({
        ...payload,
        localId: `${payload.recordedAt}:${queued.length}`,
      });
      writeQueuedPoints(queued);
      refreshPendingCount();
      return;
    }

    await saveOperatorLocationPoint(payload);
    setLastSyncAt(new Date().toISOString());
    await flushQueue();
  }, [flushQueue, refreshPendingCount]);

  const captureAndPersistPoint = useCallback(async (
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    const point = await getCurrentLocationPoint();
    setLastPoint(point);
    await persistPoint(point, activeSessionId, activeOperatorId, activeUserId, activeServiceId);
  }, [persistPoint]);

  const stopTracking = useCallback(async () => {
    clearTrackingInterval();
    setIsBusy(true);

    try {
      if (sessionId) {
        await stopOperatorLocationSession(sessionId);
      }
      writeStoredSession(null);
      setSessionId(null);
      setIsTracking(false);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo detener la ubicacion';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [clearTrackingInterval, sessionId]);

  const beginPolling = useCallback((
    activeSessionId: string,
    activeOperatorId: string,
    activeUserId: string,
    activeServiceId: string | null,
  ) => {
    clearTrackingInterval();

    const run = async () => {
      try {
        await captureAndPersistPoint(
          activeSessionId,
          activeOperatorId,
          activeUserId,
          activeServiceId,
        );
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
  }, [captureAndPersistPoint, clearTrackingInterval]);

  const startTracking = useCallback(async () => {
    if (!operatorId || !userId) {
      toast.error('No pudimos identificar al operador para compartir ubicacion');
      return;
    }

    setIsBusy(true);
    try {
      let permission = await checkLocationPermission();
      if (permission !== 'granted') {
        permission = await requestLocationPermission();
      }

      setPermissionState(permission);

      if (permission !== 'granted') {
        toast.error('Debes permitir la ubicacion para compartir tu posicion');
        return;
      }

      const session = await ensureOperatorLocationSession(operatorId, userId, serviceId);
      setSessionId(session.id);
      writeStoredSession({
        sessionId: session.id,
        operatorId,
        userId,
        serviceId,
      });

      setIsTracking(true);
      setErrorMessage(null);
      beginPolling(session.id, operatorId, userId, serviceId);
      toast.success(serviceId
        ? 'Ubicacion compartida para el servicio activo'
        : 'Ubicacion compartida desde la app operador');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar la ubicacion';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsBusy(false);
    }
  }, [beginPolling, operatorId, serviceId, userId]);

  useEffect(() => {
    void checkLocationPermission().then(setPermissionState);
    refreshPendingCount();

    const storedSession = readStoredSession();
    if (
      storedSession &&
      storedSession.operatorId === operatorId &&
      storedSession.userId === userId
    ) {
      setSessionId(storedSession.sessionId);
      setIsTracking(true);
      beginPolling(
        storedSession.sessionId,
        storedSession.operatorId,
        storedSession.userId,
        storedSession.serviceId,
      );
    }

    const handleOnline = () => {
      void flushQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearTrackingInterval();
    };
  }, [beginPolling, clearTrackingInterval, flushQueue, operatorId, refreshPendingCount, userId]);

  useEffect(() => {
    if (!isTracking || !sessionId || !operatorId || !userId) return;

    const storedSession = readStoredSession();
    if (!storedSession || storedSession.serviceId === serviceId) return;

    void ensureOperatorLocationSession(operatorId, userId, serviceId)
      .then((session) => {
        setSessionId(session.id);
        writeStoredSession({
          sessionId: session.id,
          operatorId,
          userId,
          serviceId,
        });
        beginPolling(session.id, operatorId, userId, serviceId);
      })
      .catch((error) => {
        logger.warn('Could not rotate tracking session to new service', error);
      });
  }, [beginPolling, isTracking, operatorId, serviceId, sessionId, userId]);

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
    startTracking,
    stopTracking,
    flushQueue,
  };
};
