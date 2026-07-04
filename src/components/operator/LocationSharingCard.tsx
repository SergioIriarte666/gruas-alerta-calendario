import { Button } from '@/components/ui/button';
import type { Service } from '@/types';
import { MapPin, LocateFixed, Loader2, Square, TriangleAlert, WifiOff } from 'lucide-react';
import { useOperatorLocationTracking } from '@/hooks/useOperatorLocationTracking';

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
    isTracking,
    isBusy,
    lastPoint,
    lastSyncAt,
    pendingCount,
    errorMessage,
    serviceLabel,
    startTracking,
    stopTracking,
    flushQueue,
  } = useOperatorLocationTracking({
    operatorId,
    userId,
    currentService,
  });

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
              : 'Puedes iniciar el envio para probar desde este iPhone.'}
          </p>
        </div>

        {isTracking ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void stopTracking()}
            disabled={isBusy}
            className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          >
            {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Square className="mr-2 size-4" />}
            Detener
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void startTracking()}
            disabled={isBusy}
            className="bg-cyan-600 text-white hover:bg-cyan-500"
          >
            {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LocateFixed className="mr-2 size-4" />}
            Compartir ubicacion
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
        {isTracking && (
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            Compartiendo en primer plano
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
