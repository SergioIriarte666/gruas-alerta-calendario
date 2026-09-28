import { supabase } from '@/integrations/supabase/client';
import { isChileanPlate } from '@/utils/vehicleIdentifiers';
import { isCalendarDate } from '@/utils/calendarDate';
import { createLogger } from '@/lib/logger';

const logger = createLogger('vehiclePatentLookup');

// Datos de un vehículo resueltos por patente. Compartido por el módulo Servicios
// (usePatentLookup) y por LowBoy Ventas para no duplicar la infraestructura de
// consulta (edge functions vehicle-api / check-vehicle-patent + vehicle_api_cache).
export interface VehicleData {
  marca: string;
  modelo: string;
  año: number | null;
  color: string | null;
  // Campos Pro Light
  vin?: string | null;
  combustible?: string | null;
  transmision?: string | null;
  motor?: string | null;
  /** Siempre 'YYYY-MM-DD' o null (normalizado desde la API). */
  rtFecha?: string | null;
  rtResultado?: string | null;
  mesRT?: string | null;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión activa');
  return { Authorization: `Bearer ${session.access_token}` };
};

// Intenta vehicle-api primero; si falla cae a check-vehicle-patent (solo endpoint plate).
// Ambas funciones leen/escriben vehicle_api_cache del lado del servidor.
export const invokeVehicleApi = async (
  endpoint: string,
  value: string,
  headers: Record<string, string>,
) => {
  try {
    const { data, error } = await supabase.functions.invoke('vehicle-api', {
      body: { endpoint, value },
      headers,
    });
    if (!error) return data;
  } catch {
    // vehicle-api no disponible — fallback solo para plate
  }

  if (endpoint === 'plate') {
    const { data, error } = await supabase.functions.invoke('check-vehicle-patent', {
      body: { licensePlate: value },
      headers,
    });
    if (error) throw error;
    return data;
  }

  return null;
};

/**
 * GetAPI Chile entrega rtDate en formatos variables:
 * "2026-02-25 00:00:00.000 +00:00", "2026-05-14 00:00:00", "2026-05-05".
 * Safari no parsea los dos primeros con new Date() (Invalid Date → RangeError
 * al formatear). Se normaliza aquí, en la frontera, a 'YYYY-MM-DD' o null:
 * ningún consumidor debe recibir un string de fecha no calendario.
 */
const normalizeApiDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match && isCalendarDate(match[1]) ? match[1] : null;
};

/** Normaliza los distintos formatos de respuesta (vehicle-api vs check-vehicle-patent). */
export const parseVehiclePayload = (plateResult: unknown): VehicleData | null => {
  if (!plateResult || typeof plateResult !== 'object') return null;
  const payload = plateResult as Record<string, unknown> & { success?: boolean; data?: unknown };

  const errMsg = (payload.error ?? payload.message) as string | undefined;
  if (errMsg) throw new Error(errMsg);

  // vehicle-api devuelve { success, data } — check-vehicle-patent devuelve { data }
  const raw = (payload.success !== undefined
    ? (payload.success ? payload.data : null)
    : payload.data) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, any>;
  return {
    marca:       r.marca        ?? r.model?.brand?.name ?? 'No disponible',
    modelo:      r.modelo       ?? r.model?.name        ?? 'No disponible',
    año:         r.año          ?? r.year               ?? null,
    color:       r.color                                ?? null,
    vin:         r.vin          ?? r.vinNumber          ?? null,
    combustible: r.combustible  ?? r.fuel               ?? null,
    transmision: r.transmision  ?? r.transmission       ?? null,
    motor:       r.motor        ?? r.engine             ?? null,
    rtFecha:     normalizeApiDate(r.rtFecha ?? r.rtDate),
    rtResultado: r.rtResultado  ?? r.rtResult           ?? null,
    mesRT:       r.mesRT        ?? r.monthRT            ?? null,
  };
};

/**
 * Consulta una patente chilena y devuelve los datos del vehículo (o null si no hay
 * información). Lanza si la patente es inválida o si la API responde con error, para
 * que el llamador decida cómo notificarlo. Reutiliza la misma vía que el módulo
 * Servicios (edge functions + vehicle_api_cache).
 */
export const fetchVehicleByPlate = async (licensePlate: string): Promise<VehicleData | null> => {
  const cleanValue = licensePlate.trim().replace(/[-\s]/g, '').toUpperCase();
  if (!isChileanPlate(cleanValue)) throw new Error('Formato de patente no reconocido');

  const headers = await getAuthHeaders();
  const plateResult = await invokeVehicleApi('plate', cleanValue, headers);
  return parseVehiclePayload(plateResult);
};

export { getAuthHeaders };
export type { VehicleData as VehiclePatentData };
export { logger as vehiclePatentLogger };
