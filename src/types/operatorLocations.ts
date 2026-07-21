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
}
