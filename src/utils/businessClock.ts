/**
 * businessClock — Fuente única de verdad para fechas/horas en toda la app.
 *
 * Lee `company_data.report_timezone` (configuración del negocio) y entrega
 * "ahora" / "hoy" ajustados a esa zona horaria, NO a la del navegador.
 *
 * Uso:
 *   businessClock.now()      → Date "ahora" en TZ del negocio
 *   businessClock.nowISO()   → string ISO con offset, listo para BD
 *   businessClock.today()    → 'YYYY-MM-DD' del día comercial
 *   businessClock.timezone() → 'America/Santiago' (o lo configurado)
 *
 * IMPORTANTE: llamar `await businessClock.bootstrap()` UNA VEZ al iniciar la
 * app para precargar el cache. Después todas las funciones son síncronas.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { createLogger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';


const logger = createLogger("businessClock");
const FALLBACK_TZ = 'America/Santiago';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let cachedTimezone: string = FALLBACK_TZ;
let lastFetch = 0;
let bootstrapPromise: Promise<void> | null = null;

async function fetchTimezone(): Promise<string> {
  try {
    const { data } = await supabase
      .from('company_data')
      .select('report_timezone, report_use_system_timezone')
      .limit(1)
      .maybeSingle();

    if (!data) return FALLBACK_TZ;

    if (data.report_use_system_timezone) {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
      } catch {
        return FALLBACK_TZ;
      }
    }
    return data.report_timezone || FALLBACK_TZ;
  } catch (err) {
    logger.warn('[businessClock] No se pudo cargar TZ del negocio, usando fallback:', err);
    return FALLBACK_TZ;
  }
}

/**
 * Precarga la zona horaria del negocio. Llamar UNA vez al iniciar la app.
 * Idempotente: llamadas repetidas comparten la misma promesa.
 */
async function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    cachedTimezone = await fetchTimezone();
    lastFetch = Date.now();
  })();
  return bootstrapPromise;
}

/** Refresca el cache si han pasado más de 5 minutos. Se ejecuta en background. */
function maybeRefresh(): void {
  if (Date.now() - lastFetch < REFRESH_INTERVAL_MS) return;
  lastFetch = Date.now(); // marcar antes para evitar carreras
  fetchTimezone().then((tz) => {
    cachedTimezone = tz;
  }).catch(() => { /* ignore */ });
}

/** Invalida cache (úsalo cuando el usuario cambia la config en TimezoneSettingsTab). */
function invalidate(): void {
  bootstrapPromise = null;
  lastFetch = 0;
  fetchTimezone().then((tz) => {
    cachedTimezone = tz;
    lastFetch = Date.now();
  }).catch(() => { /* ignore */ });
}

/** Zona horaria de negocio actual (síncrono). */
function timezone(): string {
  maybeRefresh();
  return cachedTimezone;
}

/**
 * Date "ahora". El objeto Date interno sigue siendo el instante UTC real
 * (eso no cambia), pero al formatearlo con `format()` o `nowISO()` se
 * proyecta a la TZ del negocio.
 */
function now(): Date {
  maybeRefresh();
  return new Date();
}

/**
 * String ISO 8601 con offset de la TZ del negocio.
 * Ej: '2026-04-18T11:45:08-04:00'
 *
 * Listo para guardar en columnas timestamptz / created_at / movement_date.
 * Postgres lo interpreta correctamente sin desfase visual.
 */
function nowISO(): string {
  return formatInTimeZone(new Date(), timezone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** 'YYYY-MM-DD' del día comercial actual (para columnas date). */
function today(): string {
  return formatInTimeZone(new Date(), timezone(), 'yyyy-MM-dd');
}

/** Date del día comercial a las 12:00 local (evita problemas de DST). */
function todayDate(): Date {
  const [y, m, d] = today().split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Convierte una fecha (string 'YYYY-MM-DD' o Date) a un timestamp ISO con
 * la HORA ACTUAL del negocio. Útil cuando el usuario elige una fecha en un
 * date picker pero queremos preservar el momento exacto del registro para
 * ordenamiento por recencia.
 *
 * Si recibe una fecha distinta a hoy, mantiene el día elegido pero a las
 * 12:00 en TZ negocio.
 */
function toTimestamp(date: string | Date): string {
  const todayStr = today();
  let dateStr: string;
  if (typeof date === 'string') {
    dateStr = date.length >= 10 ? date.slice(0, 10) : todayStr;
  } else {
    dateStr = formatInTimeZone(date, timezone(), 'yyyy-MM-dd');
  }
  if (dateStr === todayStr) {
    // Mismo día → usar la hora actual real
    return nowISO();
  }
  // Día distinto → mediodía en TZ negocio (sin desfase visual)
  return formatInTimeZone(
    new Date(`${dateStr}T12:00:00Z`),
    timezone(),
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );
}

/** Format helper que respeta la TZ del negocio. */
function format(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, timezone(), fmt);
}

export const businessClock = {
  bootstrap,
  invalidate,
  timezone,
  now,
  nowISO,
  today,
  todayDate,
  toTimestamp,
  format,
};

// Auto-invalidar cache cuando el usuario cambia la TZ en Configuración
if (typeof window !== 'undefined') {
  window.addEventListener('timezone-changed', () => invalidate());
}

export default businessClock;
