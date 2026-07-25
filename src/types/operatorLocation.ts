export type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export type TrackingSessionStartedReason = 'manual' | 'auto_schedule' | 'auto_service';

/**
 * 'manual' queda por compatibilidad con las filas ya escritas. Los cortes
 * nuevos distinguen si hubo que pedir PIN (había un cliente mirando el link)
 * o bastó la doble confirmación.
 */
export type TrackingSessionEndedReason =
  | 'manual'
  | 'manual_pin'
  | 'manual_confirm'
  | 'service_change'
  | 'timeout'
  | 'schedule_end'
  | 'service_closed';

/**
 * Origen del punto:
 * - 'mobile_app': el operador se movió lo suficiente para gatillar una captura.
 * - 'heartbeat': latido periódico con el último fix conocido, aunque no haya
 *   movimiento. Es lo que distingue "detenido" de "app muerta" en la central.
 */
export type OperatorLocationSource = 'mobile_app' | 'heartbeat';

export interface OperatorLocationPayload {
  sessionId: string;
  operatorId: string;
  userId: string;
  serviceId: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  altitudeMeters: number | null;
  recordedAt: string;
  isOfflineSync?: boolean;
  source?: OperatorLocationSource;
}

export interface OperatorLocationPoint {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMps: number | null;
  headingDegrees: number | null;
  altitudeMeters: number | null;
  recordedAt: string;
}

export interface OperatorLocationSession {
  id: string;
  operator_id: string;
  user_id: string;
  service_id: string | null;
  status: 'active' | 'stopped';
  source: string;
  platform: string;
  started_at: string;
  ended_at: string | null;
  last_point_at: string | null;
  started_reason: TrackingSessionStartedReason;
  ended_reason: TrackingSessionEndedReason | null;
  /** Usuario que cortó a mano; NULL en cierres automáticos. */
  ended_by?: string | null;
  /** Corte manual: inhibe el auto-encendido por movimiento hasta reencender a mano. */
  manual_stop?: boolean;
}

export interface TrackingSettings {
  weekday_start: string;
  weekday_end: string;
  saturday_start: string;
  saturday_end: string;
  sunday_enabled: boolean;
  session_timeout_minutes: number;
  points_retention_days: number;
}
