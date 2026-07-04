export type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

export type TrackingSessionStartedReason = 'manual' | 'auto_schedule' | 'auto_service';
export type TrackingSessionEndedReason = 'manual' | 'service_change' | 'timeout' | 'schedule_end';

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
