import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import type {
  LocationPermissionState,
  OperatorLocationPayload,
  OperatorLocationPoint,
  OperatorLocationSession,
} from '@/types/operatorLocation';

const SESSIONS_TABLE = 'operator_location_sessions';
const POINTS_TABLE = 'operator_location_points';

const getSupabaseClient = () => supabase as any;

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
      recordedAt: new Date(position.timestamp).toISOString(),
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
          recordedAt: new Date(position.timestamp).toISOString(),
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

export const ensureOperatorLocationSession = async (
  operatorId: string,
  userId: string,
  serviceId: string | null,
): Promise<OperatorLocationSession> => {
  const client = getSupabaseClient();

  const { data: existing, error: existingError } = await client
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

  if (existing && existing.service_id === serviceId) {
    return existing as OperatorLocationSession;
  }

  if (existing) {
    await client
      .from(SESSIONS_TABLE)
      .update({
        status: 'stopped',
        ended_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  }

  const { data, error } = await client
    .from(SESSIONS_TABLE)
    .insert({
      operator_id: operatorId,
      user_id: userId,
      service_id: serviceId,
      source: 'mobile_app',
      platform: getLocationPlatform(),
      status: 'active',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'No se pudo iniciar la sesión de ubicación');
  }

  return data as OperatorLocationSession;
};

export const saveOperatorLocationPoint = async (
  payload: OperatorLocationPayload,
): Promise<void> => {
  const client = getSupabaseClient();
  const { error } = await client.from(POINTS_TABLE).insert({
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
  });

  if (error) {
    throw new Error(error.message || 'No se pudo guardar el punto de ubicación');
  }

  const { error: updateError } = await client
    .from(SESSIONS_TABLE)
    .update({
      last_point_at: payload.recordedAt,
    })
    .eq('id', payload.sessionId);

  if (updateError) {
    throw new Error(updateError.message || 'No se pudo actualizar la sesión de ubicación');
  }
};

export const stopOperatorLocationSession = async (sessionId: string): Promise<void> => {
  const client = getSupabaseClient();
  const { error } = await client
    .from(SESSIONS_TABLE)
    .update({
      status: 'stopped',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(error.message || 'No se pudo cerrar la sesión de ubicación');
  }
};
