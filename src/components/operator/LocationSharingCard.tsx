import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Service } from '@/types';
import { MapPin, Loader2, Pause, Play, TriangleAlert, WifiOff } from 'lucide-react';
import { useOperatorLocationTracking } from '@/hooks/useOperatorLocationTracking';
import { checkLocationPermission } from '@/services/operatorLocationService';
import { Capacitor } from '@capacitor/core';

interface LocationSharingCardProps {
  operatorId?: string | null;
  userId?: string | null;
  currentService?: Service | null;
}

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Aun sin lecturas';

  return new Date(value).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void checkLocationPermission().then((state) => {
      setShowAlwaysHint(state !== 'granted');
    });
  }, [permissionState]);

  if (trackingDisabled) {
    return null;
  }

  const modeBadge = isPaused
    ? { label: 'Pausado por ti', className: 'border-amber-500/25 bg-amber-500/10 text-amber-200' }
    : trackingMode === 'auto_service'
      ? { label: 'En servicio', className: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200' }
      : trackingMode === 'auto_schedule'
        ? { label: 'En jornada', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' }
        : trackingMode === 'manual'
          ? { label: 'Manual', className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-200' }
          : null;

  return (
    <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <MapPin className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-cyan-100">Ubicacion del operador</p>
              <p className="text-xs text-cyan-100/70">{permissionLabel}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-cyan-100/75">
            {serviceLabel
              ? `Se asociara a ${serviceLabel}.`
              : scheduleLabel || 'Rastreo automatico segun tu jornada laboral.'}
          </p>
        </div>

        {isTracking && !isPaused ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void pauseTracking()}
            disabled={isBusy}
            className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
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
            className="bg-cyan-600 text-white hover:bg-cyan-500"
          >
            {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Reanudar
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/5 bg-zinc-950/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Ultima lectura</p>
          <p className="mt-1 text-sm font-medium text-white">{formatTimestamp(lastPoint?.recordedAt ?? null)}</p>
          <p className="mt-1 text-xs text-zinc-400">{formatAccuracy(lastPoint?.accuracyMeters ?? null)}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-zinc-950/35 p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Sincronizacion</p>
          <p className="mt-1 text-sm font-medium text-white">
            {lastSyncAt ? formatTimestamp(lastSyncAt) : pendingCount > 0 ? 'Pendiente' : 'Sin envios'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {pendingCount > 0 ? `${pendingCount} punto(s) en cola` : 'Todo al dia'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {modeBadge && (
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${modeBadge.className}`}>
            {modeBadge.label}
          </span>
        )}
        {!navigator.onLine && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
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
            className="h-auto px-2 py-1 text-[11px] text-cyan-200 hover:text-cyan-100"
          >
            Reintentar sincronizacion
          </Button>
        )}
      </div>

      {showAlwaysHint && (
        <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          Para rastreo en segundo plano, activa Ubicacion → Siempre en Ajustes de iOS.
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
