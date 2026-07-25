import { businessClock } from '@/utils/businessClock';

export interface OperatorLiveLocation {
  operator_id: string;
  operator_name: string;
  session_id: string | null;
  session_status: string | null;
  started_reason: string | null;
  ended_reason: string | null;
  session_started_at: string | null;
  session_ended_at: string | null;
  service_id: string | null;
  service_folio: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  speed_mps: number | null;
  heading_degrees: number | null;
  recorded_at: string | null;
}

export type OperatorLiveStatus =
  | 'en_servicio'
  | 'en_jornada'
  | 'manual'
  | 'sin_senal'
  | 'pausado'
  | 'fuera_jornada'
  | 'inactivo';

export const OPERATOR_STATUS_LABELS: Record<OperatorLiveStatus, string> = {
  en_servicio: 'En servicio',
  en_jornada: 'En jornada',
  manual: 'Manual',
  sin_senal: 'Sin señal',
  pausado: 'Pausado',
  fuera_jornada: 'Fuera de jornada',
  inactivo: 'Inactivo',
};

export const OPERATOR_STATUS_COLOR_TOKENS: Record<OperatorLiveStatus, `--${string}`> = {
  en_servicio: '--info',
  en_jornada: '--success',
  manual: '--muted-foreground',
  sin_senal: '--warning',
  pausado: '--muted-foreground',
  fuera_jornada: '--text-subtle',
  inactivo: '--muted-foreground',
};

const SIGNAL_STALE_MINUTES = 3;
const SIGNAL_LOST_MINUTES = 10;

/**
 * Frescura del último punto recibido.
 * - `live`    (< 3 min): la posición del mapa es la posición real.
 * - `stale`   (3–10 min): puede haber corrido; se dice cuánto hace.
 * - `lost`    (> 10 min): el barrido ya cerró (o va a cerrar) la sesión.
 * - `unknown`: nunca reportó.
 */
export type SignalFreshnessLevel = 'live' | 'stale' | 'lost' | 'unknown';

export interface SignalFreshness {
  level: SignalFreshnessLevel;
  /** Minutos transcurridos desde el último punto; null si nunca reportó. */
  minutes: number | null;
  /** Hora del último punto ('HH:mm'); null si nunca reportó. */
  atLabel: string | null;
  /** Texto listo para mostrar junto al indicador. */
  label: string;
}

/**
 * El módulo mostraba "Siguiendo ruta en vivo" en verde con el último punto de
 * hace 93 minutos: no distinguía "en vivo" de "dato viejo". Esta es la única
 * fuente de esa distinción; toda vista que muestre posición debe usarla y
 * acompañarla SIEMPRE con la hora del último punto.
 */
export const describeSignalFreshness = (
  isoTimestamp: string | null | undefined,
  now: Date = businessClock.now(),
): SignalFreshness => {
  if (!isoTimestamp) {
    return { level: 'unknown', minutes: null, atLabel: null, label: 'Sin señal registrada' };
  }

  const minutes = Math.max(0, Math.round((now.getTime() - new Date(isoTimestamp).getTime()) / 60000));
  const atLabel = businessClock.format(isoTimestamp, 'HH:mm');

  if (minutes < SIGNAL_STALE_MINUTES) {
    return { level: 'live', minutes, atLabel, label: 'En vivo' };
  }

  if (minutes < SIGNAL_LOST_MINUTES) {
    return { level: 'stale', minutes, atLabel, label: `Última señal hace ${minutes} min` };
  }

  return { level: 'lost', minutes, atLabel, label: `Sin señal desde ${atLabel}` };
};

/** Clases de badge por nivel de frescura (verde / ámbar / gris). */
export const SIGNAL_FRESHNESS_BADGE_CLASS: Record<SignalFreshnessLevel, string> = {
  live: 'border-success/30 bg-success/10 text-success',
  stale: 'border-warning/30 bg-warning/10 text-warning',
  lost: 'border-danger/30 bg-danger/10 text-danger',
  unknown: 'border-border bg-muted text-muted-foreground',
};

/**
 * Deriva el estado visible de un operador a partir de su última sesión de
 * rastreo (cualquier status) y su último punto conocido. `now` es inyectable
 * para tests; en producción siempre viene de businessClock.now().
 */
export const deriveOperatorStatus = (
  row: Pick<OperatorLiveLocation, 'session_status' | 'started_reason' | 'ended_reason' | 'service_id' | 'recorded_at'>,
  now: Date = businessClock.now(),
): OperatorLiveStatus => {
  const isSessionActive = row.session_status === 'active';
  const minutesSincePoint = row.recorded_at
    ? (now.getTime() - new Date(row.recorded_at).getTime()) / 60000
    : Number.POSITIVE_INFINITY;

  if (isSessionActive) {
    if (minutesSincePoint < SIGNAL_STALE_MINUTES) {
      if (row.service_id) return 'en_servicio';
      return row.started_reason === 'auto_schedule' ? 'en_jornada' : 'manual';
    }
    return 'sin_senal';
  }

  if (row.ended_reason === 'manual') return 'pausado';
  if (row.ended_reason === 'schedule_end') return 'fuera_jornada';
  return 'inactivo';
};

/** Texto "hace X min" / "hace X h" relativo a `now` (businessClock por defecto). */
export const formatMinutesAgo = (
  isoTimestamp: string | null,
  now: Date = businessClock.now(),
): string => {
  if (!isoTimestamp) return 'Sin señal';

  const minutes = Math.max(0, Math.round((now.getTime() - new Date(isoTimestamp).getTime()) / 60000));

  if (minutes < 1) return 'Justo ahora';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
};

export interface OperatorRoutePoint {
  session_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  speed_mps: number | null;
  heading_degrees: number | null;
  recorded_at: string;
}

export interface OperatorRouteSession {
  id: string;
  status: string;
  started_reason: string;
  ended_reason: string | null;
  service_id: string | null;
  started_at: string;
  ended_at: string | null;
}

/** Un tramo de ruta matcheada (pegada a calles) o crudo (GPS directo). */
export interface MatchedRouteSegment {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  confidence: number;
  matched: boolean;
}

/** Respuesta de la acción map_matching de mapbox-proxy. */
export interface MatchedRouteResult {
  segments: MatchedRouteSegment[];
  avg_confidence: number | null;
  points_input: number;
  points_used: number;
  api_requests: number;
  cached?: boolean;
}

export interface OperatorIdleService {
  id: string;
  operator_id: string;
  folio: string;
  service_date: string;
  start_time: string | null;
  end_time: string | null;
}

export interface OperatorIdleGap {
  operatorId: string;
  date: string;
  fromFolio: string;
  fromEndTime: string;
  toFolio: string;
  toStartTime: string;
  minutes: number;
}

export interface OperatorIdleDaySummary {
  operatorId: string;
  operatorName: string;
  date: string;
  serviceCount: number;
  servicesWithoutSchedule: number;
  totalIdleMinutes: number;
  largestGapMinutes: number;
  gaps: OperatorIdleGap[];
  /** Detenciones CON motivo declarado: lo que distingue una parada justificada de un hueco sin explicar. */
  declaredStops: import('@/types/serviceStopEvent').ServiceStopEvent[];
  declaredStopMinutes: number;
  /** Detenciones que exceden lo típico de su motivo (el descanso nunca cuenta). */
  overdueStopCount: number;
}
