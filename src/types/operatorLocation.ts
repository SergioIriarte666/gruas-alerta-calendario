export type LocationPermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';

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
}
