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
const TRACKING_SETTINGS_TABLE = 'tracking_settings';

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

/**
 * Ventana para readoptar una sesión que el barrido cerró por 'timeout'.
 *
 * El sweep cierra a los 10 min sin puntos. Si la app se suspendió en un traslado
 * largo y vuelve 40 min después, crear una sesión nueva parte el recorrido en
 * dos rutas inconexas (así aparecieron 3 sesiones fragmentadas en una tarde).
 * Dentro de esta ventana se reabre la sesión del MISMO servicio y el historial
 * queda como un solo trayecto con un hueco, que es la verdad.
 */
const REOPENABLE_TIMEOUT_WINDOW_MS = 6 * 60 * 60 * 1000;

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

  if (existing) {
    // Misma sesión del mismo servicio (o sesión sin servicio que ahora lo
    // adquiere): se reutiliza y, si cambió el motivo, se corrige en sitio.
    // Antes bastaba un started_reason distinto (auto_schedule -> auto_service)
    // para cerrarla y abrir otra, partiendo la ruta del día sin necesidad.
    const sameService = existing.service_id === serviceId;
    const adoptsService = existing.service_id === null && serviceId !== null;

    if (sameService || adoptsService) {
      if (existing.started_reason === startedReason && sameService) {
        return existing as OperatorLocationSession;
      }

      const { data: updated, error: updateError } = await supabase
        .from(SESSIONS_TABLE)
        .update({ service_id: serviceId, started_reason: startedReason })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(updateError.message || 'No se pudo actualizar la sesión de ubicación activa');
      }

      return updated as OperatorLocationSession;
    }

    // Servicio distinto: ahí sí corresponde cerrarla y abrir una nueva.
    await supabase
      .from(SESSIONS_TABLE)
      .update({
        status: 'stopped',
        ended_at: new Date().toISOString(),
        ended_reason: 'service_change',
      })
      .eq('id', existing.id);
  }

  if (serviceId) {
    const reopened = await reopenTimedOutSession(operatorId, serviceId, startedReason);
    if (reopened) return reopened;
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

/**
 * Reabre la última sesión del servicio cerrada por el barrido de zombies, si
 * cayó dentro de la ventana. Devuelve null si no hay candidata: el llamador
 * crea una sesión nueva.
 */
const reopenTimedOutSession = async (
  operatorId: string,
  serviceId: string,
  startedReason: TrackingSessionStartedReason,
): Promise<OperatorLocationSession | null> => {
  const cutoff = new Date(businessClock.now().getTime() - REOPENABLE_TIMEOUT_WINDOW_MS).toISOString();

  const { data: candidate, error } = await supabase
    .from(SESSIONS_TABLE)
    .select('*')
    .eq('operator_id', operatorId)
    .eq('service_id', serviceId)
    .eq('status', 'stopped')
    .eq('ended_reason', 'timeout')
    .gte('ended_at', cutoff)
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !candidate) return null;

  const { data: reopened, error: reopenError } = await supabase
    .from(SESSIONS_TABLE)
    .update({
      status: 'active',
      ended_at: null,
      ended_reason: null,
      started_reason: startedReason,
    })
    .eq('id', candidate.id)
    .select('*')
    .single();

  if (reopenError || !reopened) return null;

  return reopened as OperatorLocationSession;
};

/**
 * Estado vigente de una sesión, leído de la BD.
 *
 * La sesión es el ÚNICO dueño del estado de transmisión: la UI y el watcher se
 * derivan de ella. Sin esta lectura, el estado local y la BD divergen y aparece
 * el watcher zombi (UI "Sin transmitir" subiendo puntos contra una sesión
 * `stopped`, prueba en terreno del 25/07).
 */
export const fetchOperatorLocationSession = async (
  sessionId: string,
): Promise<OperatorLocationSession | null> => {
  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'No se pudo leer la sesión de ubicación');
  }

  return (data as OperatorLocationSession | null) ?? null;
};

/**
 * Reactiva una sesión que quedó `stopped` cuando el flujo decide reanudar.
 * Un punto jamás debe subirse contra una sesión cerrada: primero se reabre.
 */
export const reactivateOperatorLocationSession = async (
  sessionId: string,
): Promise<void> => {
  const { error } = await supabase
    .from(SESSIONS_TABLE)
    .update({ status: 'active', ended_at: null, ended_reason: null })
    .eq('id', sessionId)
    .neq('status', 'active');

  if (error) {
    throw new Error(error.message || 'No se pudo reactivar la sesión de ubicación');
  }
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

/**
 * Fallo al subir un punto, con la distinción que importa.
 *
 * `permanent` separa "el servidor lo rechazó por lo que ES" —RLS, constraint,
 * sesión inexistente— de "no llegó". Es la diferencia entre un punto roto, que
 * hay que soltar, y un punto que solo espera cobertura, que hay que guardar
 * indefinidamente. Confundirlas borraba el primer punto de la cola a los diez
 * minutos sin señal, justo en el escenario para el que la cola existe.
 */
export class LocationUploadError extends Error {
  readonly code: string | null;
  readonly permanent: boolean;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'LocationUploadError';
    this.code = code;
    // PostgREST siempre trae código en un rechazo del servidor; una falla de
    // transporte (fetch abortado, DNS, timeout) llega sin él. La heurística es
    // deliberadamente conservadora: ante la duda, el punto NO se descarta.
    this.permanent = Boolean(code);
  }
}

export const isPermanentUploadError = (error: unknown): boolean =>
  error instanceof LocationUploadError && error.permanent;

export const saveOperatorLocationPoint = async (
  payload: OperatorLocationPayload,
): Promise<void> => {
  // Una sola llamada, una sola transacción. Antes eran dos escrituras sueltas:
  // si la segunda fallaba, el punto quedaba guardado y la sesión decía que no
  // había llegado nada, y el barrido de zombies la cerraba por "timeout" con
  // puntos entrando.
  const { error } = await supabase.rpc('record_operator_location_point', {
    p_session_id: payload.sessionId,
    p_operator_id: payload.operatorId,
    p_user_id: payload.userId,
    p_service_id: payload.serviceId,
    p_latitude: payload.latitude,
    p_longitude: payload.longitude,
    p_accuracy_meters: payload.accuracyMeters,
    p_speed_mps: payload.speedMps,
    p_heading_degrees: payload.headingDegrees,
    p_altitude_meters: payload.altitudeMeters,
    p_recorded_at: payload.recordedAt,
    p_is_offline_sync: payload.isOfflineSync ?? false,
    // 'heartbeat' marca los latidos sin movimiento: sin ellos, un operador
    // detenido y una app muerta se ven idénticos desde la central.
    p_source: payload.source ?? 'mobile_app',
    p_platform: getLocationPlatform(),
  });

  if (error) {
    throw new LocationUploadError(
      error.message || 'No se pudo guardar el punto de ubicación',
      error.code ?? null,
    );
  }
};

/**
 * Cierra la sesión. Para cortes manuales se registra QUIÉN cortó y se marca
 * `manual_stop`, que inhibe el auto-encendido por movimiento hasta que el
 * operador reencienda a mano (el sistema avisa, nunca decide por sobre él).
 */
export const stopOperatorLocationSession = async (
  sessionId: string,
  endedReason: TrackingSessionEndedReason,
  options: { endedBy?: string | null; manualStop?: boolean } = {},
): Promise<void> => {
  const { error } = await supabase
    .from(SESSIONS_TABLE)
    .update({
      status: 'stopped',
      ended_at: new Date().toISOString(),
      ended_reason: endedReason,
      ...(options.endedBy !== undefined ? { ended_by: options.endedBy } : {}),
      ...(options.manualStop !== undefined ? { manual_stop: options.manualStop } : {}),
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(error.message || 'No se pudo cerrar la sesión de ubicación');
  }
};

/**
 * ¿El operador cortó a mano la transmisión de este servicio?
 *
 * Se consulta en la BD y no solo en almacenamiento local para que la decisión
 * sobreviva una reinstalación o un cambio de teléfono: el auto-encendido no
 * debe resucitar por reiniciar la app.
 */
export const hasManualStopForService = async (
  operatorId: string,
  serviceId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select('manual_stop')
    .eq('operator_id', operatorId)
    .eq('service_id', serviceId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  return data.manual_stop === true;
};

/** Limpia la marca de corte manual del servicio (el operador reencendió a mano). */
export const clearManualStopForService = async (
  operatorId: string,
  serviceId: string,
): Promise<void> => {
  const { error } = await supabase
    .from(SESSIONS_TABLE)
    .update({ manual_stop: false })
    .eq('operator_id', operatorId)
    .eq('service_id', serviceId)
    .eq('manual_stop', true);

  if (error) {
    throw new Error(error.message || 'No se pudo limpiar el corte manual de la sesión');
  }
};
