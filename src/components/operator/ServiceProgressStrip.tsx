import React from 'react';
import { businessClock } from '@/utils/businessClock';
import { cn } from '@/lib/utils';
import { useServiceProgress, type ServiceLiveProgress } from '@/hooks/operator/useServiceProgress';
import { STOP_REASON_LABELS, type StopReason } from '@/types/serviceStopEvent';

/**
 * Un ETA más viejo que esto no es un ETA: es un número con formato de ETA. La
 * edge function lo recalcula cada minuto mientras alguien mira el link; sin
 * nadie mirando se queda quieto y no hay nada que prometer.
 */
export const ETA_FRESH_MS = 5 * 60 * 1000;

/**
 * Sin un punto en este tiempo hay ALGO que decir. Qué se dice depende de la
 * velocidad del último punto (ver `resolveSignalState`).
 */
export const SIGNAL_SILENCE_MS = 10 * 60 * 1000;

/** Bajo esta velocidad el camión está detenido, no rodando. */
const MOVING_KMH = 3;

const ETA_TARGET_LABELS: Record<string, string> = {
  origin: 'al origen',
  destination: 'al destino',
  stop: 'a la parada',
};

/** "137,5" — coma decimal, un decimal fijo: el número tiene que verse avanzar. */
export const formatKm = (value: number | null | undefined): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${value.toFixed(1).replace('.', ',')} km`;
};

/** "1h 31m", o "31m" cuando no llega a la hora. */
export const formatDuration = (minutes: number | null | undefined): string | null => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return null;
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
};

export const formatSpeed = (kmh: number | null | undefined): string | null => {
  if (typeof kmh !== 'number' || !Number.isFinite(kmh)) return null;
  return `${Math.round(kmh)} km/h`;
};

/**
 * "SIN SEÑAL" y "DETENIDO" no son lo mismo y confundirlos cuesta caro.
 *
 * El plugin de segundo plano emite por filtro de DISTANCIA: con el camión
 * detenido deja de haber puntos, y en el 3266844-1 eso llegó a 26 minutos de
 * silencio con todo funcionando. Un umbral simple por antigüedad marcaría como
 * anomalía a una grúa correctamente estacionada en faena.
 *
 * Lo que sí es anomalía es que alguien VENÍA RODANDO y dejó de reportar. Por
 * eso la velocidad del último punto es la que decide. Sin velocidad conocida se
 * asume detenido: la ausencia de dato nunca se lee como una alarma.
 */
export const resolveSignalState = (
  lastPointAt: string | null,
  lastSpeedKmh: number | null,
  now: Date,
): 'live' | 'stopped' | 'no_signal' => {
  if (!lastPointAt) return 'live';
  const age = now.getTime() - new Date(lastPointAt).getTime();
  if (!Number.isFinite(age) || age < SIGNAL_SILENCE_MS) return 'live';
  return typeof lastSpeedKmh === 'number' && lastSpeedKmh >= MOVING_KMH ? 'no_signal' : 'stopped';
};

export const isEtaFresh = (etaCachedAt: string | null, now: Date): boolean => {
  if (!etaCachedAt) return false;
  const age = now.getTime() - new Date(etaCachedAt).getTime();
  return Number.isFinite(age) && age < ETA_FRESH_MS;
};

interface ChipProps {
  label: string;
  value: string;
  hint?: string | null;
  tone?: 'default' | 'warning' | 'muted';
}

const Chip = ({ label, value, hint, tone = 'default' }: ChipProps) => (
  <div
    className={cn(
      'operator-progress-strip__chip',
      tone === 'warning' && 'is-warning',
      tone === 'muted' && 'is-muted',
    )}
  >
    <span className="operator-progress-strip__chip-label">{label}</span>
    <strong className="operator-progress-strip__chip-value">{value}</strong>
    {hint && <span className="operator-progress-strip__chip-hint">{hint}</span>}
  </div>
);

interface ServiceProgressStripProps {
  /**
   * Servicio EN CURSO. Es obligatorio: quien monta la cinta ya decidió que hay
   * un viaje en marcha. Montarla "por si acaso" obligaría a colgar un
   * QueryClient de cualquier pantalla que muestre el panel del operador.
   */
  serviceId: string;
}

/**
 * Cinta de telemetría en vivo del servicio en curso.
 *
 * Memorizada y con su propio `useQuery` a propósito: el refresco cada 30 s
 * tiene que repintar SOLO esta franja. Si el hook viviera en el panel, cada
 * refetch volvería a renderizar el contenedor del mapa Mapbox mientras el
 * operador maneja.
 */
export const ServiceProgressStrip = React.memo(({ serviceId }: ServiceProgressStripProps) => {
  const { data, isPending } = useServiceProgress({ serviceId, isActive: true });

  // Reserva exacta del alto de la cinta: sin esto, el mapa salta hacia abajo
  // cuando llega la primera respuesta.
  if (isPending || !data) {
    return (
      <div className="operator-progress-strip" aria-hidden="true">
        <div className="operator-progress-strip__track">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="operator-progress-strip__chip is-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const progress: ServiceLiveProgress = data;
  const now = businessClock.now();
  const signal = resolveSignalState(progress.last_point_at, progress.last_speed_kmh, now);
  const stopReason = progress.open_stop_reason as StopReason | null;

  const etaValue = (() => {
    if (!isEtaFresh(progress.eta_cached_at, now) || typeof progress.eta_seconds !== 'number') {
      return '—';
    }
    const minutes = Math.max(0, Math.round(progress.eta_seconds / 60));
    const km = typeof progress.eta_distance_meters === 'number'
      ? formatKm(progress.eta_distance_meters / 1000)
      : null;
    return km ? `${minutes} min · ${km}` : `${minutes} min`;
  })();

  return (
    <div
      className={cn('operator-progress-strip', signal === 'no_signal' && 'opacity-60')}
      aria-label="Progreso del servicio en curso"
    >
      <div className="operator-progress-strip__track">
        {/* La anomalía va primero: es lo único de la cinta que pide una
            reacción. Los valores acumulados siguen siendo válidos aunque no
            lleguen puntos nuevos, así que nunca se borran. */}
        {signal === 'no_signal' && (
          <Chip label="Señal" value="SIN SEÑAL" hint="venía rodando" tone="warning" />
        )}
        {signal === 'stopped' && (
          <Chip label="Señal" value="DETENIDO" hint="sin movimiento" tone="muted" />
        )}

        <Chip label="Recorrido" value={formatKm(progress.distance_km) ?? '—'} />

        {stopReason ? (
          // La edge function suspende el ETA durante una detención declarada;
          // la cinta dice lo mismo en vez de prometer una llegada.
          <Chip
            label="Estado"
            value={`En detención · ${STOP_REASON_LABELS[stopReason] ?? stopReason}`}
            tone="warning"
          />
        ) : (
          <Chip
            label="Faltan"
            value={etaValue}
            hint={progress.eta_target_kind ? ETA_TARGET_LABELS[progress.eta_target_kind] : null}
          />
        )}

        <Chip label="Rodando" value={formatDuration(progress.moving_minutes) ?? '—'} />
        <Chip label="Detenido" value={formatDuration(progress.stopped_minutes) ?? '—'} />
        <Chip label="Promedio" value={formatSpeed(progress.avg_moving_kmh) ?? '—'} />
      </div>
    </div>
  );
});

ServiceProgressStrip.displayName = 'ServiceProgressStrip';
