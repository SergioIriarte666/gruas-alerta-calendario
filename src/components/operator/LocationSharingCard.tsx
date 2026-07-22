import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Service } from '@/types';
import { MapPin, Loader2, Pause, Play, TriangleAlert, WifiOff } from 'lucide-react';
import { useOperatorLocationTracking } from '@/hooks/useOperatorLocationTracking';
import { checkLocationPermission } from '@/services/operatorLocationService';
import { Capacitor } from '@capacitor/core';
import { businessClock } from '@/utils/businessClock';
import { formatInChileTime, formatForDisplayWithTime } from '@/utils/timezoneUtils';

const FRESHNESS_CHECK_INTERVAL_MS = 30000;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 10;
const FRESHNESS_MARGIN_MINUTES = 1;

interface LocationSharingCardProps {
  operatorId?: string | null;
  userId?: string | null;
  currentService?: Service | null;
}

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Aun sin lecturas';

  const isToday = formatInChileTime(value, 'yyyy-MM-dd') === businessClock.today();
  if (isToday) {
    return businessClock.format(value, 'HH:mm:ss');
  }
  return formatForDisplayWithTime(value);
};

const formatAccuracy = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'Sin precision';
  return `+-${Math.round(value)} m`;
};

export const LocationSharingCard = ({
  operatorId,
  userId,
  currentService,
}: LocationSharingCardProps) => {
  const {
    permissionLabel,
    permissionState,
    isTracking,
    isBusy,
    lastPoint,
    lastSyncAt,
    pendingCount,
    errorMessage,
    serviceLabel,
    trackingMode,
    isPaused,
    scheduleLabel,
    trackingSettings,
    trackingDisabled,
    pauseTracking,
    resumeTracking,
    flushQueue,
  } = useOperatorLocationTracking({
    operatorId,
    userId,
    currentService,
  });

  const [showAlwaysHint, setShowAlwaysHint] = useState(false);
  const [, setFreshnessTick] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void checkLocationPermission().then((state) => {
      setShowAlwaysHint(state !== 'granted');
    });
  }, [permissionState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFreshnessTick((tick) => tick + 1);
    }, FRESHNESS_CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  if (trackingDisabled) {
    return null;
  }

  const freshnessThresholdMs =
    ((trackingSettings?.session_timeout_minutes ?? DEFAULT_SESSION_TIMEOUT_MINUTES) + FRESHNESS_MARGIN_MINUTES)
    * 60 * 1000;
  const lastPointAgeMs = lastPoint?.recordedAt
    ? businessClock.now().getTime() - new Date(lastPoint.recordedAt).getTime()
    : null;
  const hasStaleReading = isTracking && !isPaused
    && (lastPointAgeMs === null || lastPointAgeMs > freshnessThresholdMs);

  const modeBadge = isPaused
    ? { label: 'Pausado por ti', className: 'border-warning/30 bg-warning-soft text-warning-text' }
    : trackingMode === 'auto_service'
      ? { label: 'En servicio', className: 'border-info/30 bg-info-soft text-info-text' }
      : trackingMode === 'auto_schedule'
        ? { label: 'En jornada', className: 'border-success/30 bg-success-soft text-success-text' }
        : trackingMode === 'manual'
          ? { label: 'Manual', className: 'border-border bg-muted text-muted-foreground' }
          : null;

  return (
    <section className="operator-location-card rounded-3xl border border-info/30 bg-info-soft p-5" aria-label="Estado de ubicación">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="operator-location-pulse flex size-11 items-center justify-center rounded-2xl bg-info-soft text-info-text">
              <MapPin className="size-5" />
            </span>
            <div>
              <p className="operator-native-eyebrow text-info-text/70">Seguimiento en directo</p>
              <p className="text-base font-semibold text-info-text">Ubicación activa</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-medium text-info-text/80">
            {serviceLabel
              ? `Se asociara a ${serviceLabel}.`
              : scheduleLabel || 'Rastreo automatico segun tu jornada laboral.'}
          </p>
          <p className="mt-1 text-xs text-info-text/60">{permissionLabel}</p>
        </div>

        {isTracking && !isPaused ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void pauseTracking()}
            disabled={isBusy}
            className="min-h-11 rounded-xl border-warning/30 bg-warning-soft px-3 text-warning-text hover:bg-warning-soft"
          >
            {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Pause className="mr-2 size-4" />}
            Pausar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void resumeTracking()}
            disabled={isBusy}
            className="min-h-11 rounded-xl bg-info px-3 text-info-foreground hover:bg-info/90"
          >
            {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Reanudar
          </Button>
        )}
      </div>

      <div className="operator-location-metrics mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-card/70 p-3.5">
          <p className="operator-native-eyebrow">Última lectura</p>
          <p className="operator-native-display mt-1 text-xl font-bold text-foreground">{formatTimestamp(lastPoint?.recordedAt ?? null)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Precisión {formatAccuracy(lastPoint?.accuracyMeters ?? null)}</p>
        </div>
        <div className="rounded-2xl bg-card/70 p-3.5">
          <p className="operator-native-eyebrow">Sincronización</p>
          <p className={`mt-1 text-sm font-bold ${hasStaleReading ? 'text-warning-text' : 'text-foreground'}`}>
            {hasStaleReading
              ? 'Sin lecturas recientes'
              : lastSyncAt
                ? formatTimestamp(lastSyncAt)
                : pendingCount > 0 ? 'Pendiente' : 'Sin envios'}
          </p>
          <p className={`mt-0.5 text-xs ${hasStaleReading ? 'text-warning-text/80' : 'text-muted-foreground'}`}>
            {hasStaleReading
              ? 'Verifica la conexion o el GPS del dispositivo'
              : pendingCount > 0 ? `${pendingCount} punto(s) en cola` : 'Todo al dia'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {modeBadge && (
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${modeBadge.className}`}>
            {modeBadge.label}
          </span>
        )}
        {!navigator.onLine && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-text">
            <WifiOff className="size-3" />
            Sin internet
          </span>
        )}
        {pendingCount > 0 && navigator.onLine && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void flushQueue()}
            className="h-auto px-2 py-1 text-xs text-info-text hover:text-info-text"
          >
            Reintentar sincronizacion
          </Button>
        )}
      </div>

      {showAlwaysHint && (
        <div className="mt-3 rounded-xl border border-info/30 bg-info-soft p-3 text-xs text-info-text">
          Para rastreo en segundo plano, activa Ubicacion → Siempre en Ajustes de iOS.
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning-text">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        </div>
      )}
    </section>
  );
};
