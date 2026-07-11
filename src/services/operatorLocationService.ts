import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import type {
  BackgroundGeolocationPlugin,
  Location as BackgroundGeolocationPoint,
} from '@capacitor-community/background-geolocation';
import type {
  LocationPermissionState,
  OperatorLocationPayload,
  OperatorLocationPoint,
  OperatorLocationSession,
  TrackingSessionEndedReason,
  TrackingSessionStartedReason,
  TrackingSettings,
} from '@/types/operatorLocation';

const SESSIONS_TABLE = 'operator_location_sessions';
const POINTS_TABLE = 'operator_location_points';
const TRACKING_SETTINGS_TABLE = 'tracking_settings';
const POINTS_CONFLICT_TARGET = 'operator_id,recorded_at,latitude,longitude';

// Bug conocido de WebKit/Safari: GeolocationPosition.timestamp a veces viene
// referido al epoch de Apple (2001-01-01) en vez del epoch Unix (1970-01-01).
const APPLE_TO_UNIX_EPOCH_OFFSET_MS = 978307200000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nunca confiar en el timestamp del fix GPS como fuente única: si viene muy
 * lejos del reloj del dispositivo, se sanea (offset de epoch Apple) o se
 * descarta a favor de la hora de captura real.
 */
export const resolveRecordedAt = (rawTimestampMs: number | null | undefined): string => {
  const deviceNowMs = businessClock.now().getTime();

  if (typeof rawTimestampMs !== 'number' || Number.isNaN(rawTimestampMs)) {
    return new Date(deviceNowMs).toISOString();
  }

  if (Math.abs(deviceNowMs - rawTimestampMs) <= ONE_YEAR_MS) {
    return new Date(rawTimestampMs).toISOString();
  }

  const correctedMs = rawTimestampMs + APPLE_TO_UNIX_EPOCH_OFFSET_MS;
  if (Math.abs(deviceNowMs - correctedMs) <= ONE_DAY_MS) {
    return new Date(correctedMs).toISOString();
  }

  return new Date(deviceNowMs).toISOString();
};

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  weekday_start: '08:30',
  weekday_end: '18:00',
  saturday_start: '08:30',
  saturday_end: '13:00',
  sunday_enabled: false,
  session_timeout_minutes: 10,
  points_retention_days: 180,
};

export const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export const mapBackgroundGeolocationPoint = (
  location: BackgroundGeolocationPoint,
): OperatorLocationPoint => ({
  latitude: location.latitude,
  longitude: location.longitude,
  accuracyMeters: location.accuracy ?? null,
  speedMps: location.speed ?? null,
  headingDegrees: location.bearing ?? null,
  altitudeMeters: location.altitude ?? null,
  recordedAt: resolveRecordedAt(location.time),
});

const mapPermissionState = (value?: string): LocationPermissionState => {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  if (value === 'prompt' || value === 'prompt-with-rationale') return 'prompt';
  return 'unknown';
};

export const getLocationPlatform = () => Capacitor.getPlatform();

export const checkLocationPermission = async (): Promise<LocationPermissionState> => {
  if (Capacitor.isNativePlatform()) {
    const permissions = await Geolocation.checkPermissions();
    return mapPermissionState(permissions.location || permissions.coarseLocation);
  }

  if (!('geolocation' in navigator)) return 'unsupported';

  if (!('permissions' in navigator) || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return mapPermissionState(result.state);
  } catch {
    return 'unknown';
  }
};

export const requestLocationPermission = async (): Promise<LocationPermissionState> => {
  if (Capacitor.isNativePlatform()) {
    const permissions = await Geolocation.requestPermissions();
    return mapPermissionState(permissions.location || permissions.coarseLocation);
  }

  if (!('geolocation' in navigator)) return 'unsupported';

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve('denied');
          return;
        }
        resolve('unknown');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
};

export const getCurrentLocationPoint = async (): Promise<OperatorLocationPoint> => {
  if (Capacitor.isNativePlatform()) {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? null,
      speedMps: position.coords.speed ?? null,
      headingDegrees: position.coords.heading ?? null,
      altitudeMeters: position.coords.altitude ?? null,
      recordedAt: resolveRecordedAt(position.timestamp),
    };
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
          speedMps: position.coords.speed ?? null,
          headingDegrees: position.coords.heading ?? null,
          altitudeMeters: position.coords.altitude ?? null,
          recordedAt: resolveRecordedAt(position.timestamp),
        });
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    );
  });
};

export const fetchOperatorTrackingEnabled = async (operatorId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('operators')
    .select('tracking_enabled')
    .eq('id', operatorId)
    .maybeSingle();

  if (error || !data) {
    return true;
  }

  return data.tracking_enabled ?? true;
};

export const fetchTrackingSettings = async (): Promise<TrackingSettings> => {
  const { data, error } = await supabase
    .from(TRACKING_SETTINGS_TABLE)
    .select('weekday_start, weekday_end, saturday_start, saturday_end, sunday_enabled, session_timeout_minutes, points_retention_days')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_TRACKING_SETTINGS;
  }

  return data;
};

export const ensureOperatorLocationSession = async (
  operatorId: string,
  userId: string,
  serviceId: string | null,
  startedReason: TrackingSessionStartedReason,
): Promise<OperatorLocationSession> => {
  const { data: existing, error: existingError } = await supabase
    .from(SESSIONS_TABLE)
    .select('*')
    .eq('operator_id', operatorId)
    .eq('status', 'active')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || 'No se pudo revisar la sesión de ubicación activa');
  }

  if (existing && existing.service_id === serviceId && existing.started_reason === startedReason) {
    return existing as OperatorLocationSession;
  }

  if (existing) {
    await supabase
      .from(SESSIONS_TABLE)
      .update({
        status: 'stopped',
        ended_at: new Date().toISOString(),
        ended_reason: 'service_change',
      })
      .eq('id', existing.id);
  }

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .insert({
      operator_id: operatorId,
      user_id: userId,
      service_id: serviceId,
      source: 'mobile_app',
      platform: getLocationPlatform(),
      status: 'active',
      started_reason: startedReason,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo iniciar la sesión de ubicación');
  }

  return data as OperatorLocationSession;
};

export const updateOperatorLocationSessionService = async (
  sessionId: string,
  serviceId: string,
): Promise<void> => {
  const { error } = await supabase
    .from(SESSIONS_TABLE)
    .update({ service_id: serviceId })
    .eq('id', sessionId);

  if (error) {
    throw new Error(error.message || 'No se pudo corregir la sesión de ubicación');
  }
};

export const findActiveOperatorLocationSession = async (
  operatorId: string,
): Promise<OperatorLocationSession | null> => {
  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select('*')
    .eq('operator_id', operatorId)
    .eq('status', 'active')
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo revisar la sesión de ubicación activa');
  }

  return (data as OperatorLocationSession | null) ?? null;
};

export const saveOperatorLocationPoint = async (
  payload: OperatorLocationPayload,
): Promise<void> => {
  const { error } = await supabase.from(POINTS_TABLE).upsert({
    session_id: payload.sessionId,
    operator_id: payload.operatorId,
    user_id: payload.userId,
    service_id: payload.serviceId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy_meters: payload.accuracyMeters,
    speed_mps: payload.speedMps,
    heading_degrees: payload.headingDegrees,
    altitude_meters: payload.altitudeMeters,
    recorded_at: payload.recordedAt,
    is_offline_sync: payload.isOfflineSync ?? false,
    source: 'mobile_app',
    platform: getLocationPlatform(),
  }, {
    onConflict: POINTS_CONFLICT_TARGET,
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(error.message || 'No se pudo guardar el punto de ubicación');
  }

  const { error: updateError } = await supabase
    .from(SESSIONS_TABLE)
    .update({
      last_point_at: payload.recordedAt,
    })
    .eq('id', payload.sessionId);

  if (updateError) {
    throw new Error(updateError.message || 'No se pudo actualizar la sesión de ubicación');
  }
};

export const stopOperatorLocationSession = async (
  sessionId: string,
  endedReason: TrackingSessionEndedReason,
): Promise<void> => {
  const { error } = await supabase
    .from(SESSIONS_TABLE)
    .update({
      status: 'stopped',
      ended_at: new Date().toISOString(),
      ended_reason: endedReason,
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(error.message || 'No se pudo cerrar la sesión de ubicación');
  }
};
