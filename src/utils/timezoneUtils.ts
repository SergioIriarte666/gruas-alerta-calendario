
import { format, parseISO, startOfMonth, endOfMonth, startOfDay, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { businessClock } from './businessClock';
import { createLogger } from '@/lib/logger';

const logger = createLogger('TimezoneUtils');

// Zona horaria por defecto para Chile como fallback
const CHILE_TIMEZONE = 'America/Santiago';

// Cache para preferencias visuales del usuario (SOLO dateFormat).
// IMPORTANTE: la zona horaria de negocio NO se lee aquí; viene de businessClock
// (company_data.report_timezone) que es la única fuente de verdad de la app.
let userSettingsCache: {
  dateFormat: string;
  lastUpdate: number;
} | null = null;

const CACHE_DURATION = 30000; // 30 segundos

// Función para obtener preferencias visuales del usuario (sólo dateFormat)
const getUserSettingsFromCache = async () => {
  const now = Date.now();
  
  if (userSettingsCache && (now - userSettingsCache.lastUpdate) < CACHE_DURATION) {
    return userSettingsCache;
  }

  try {
    // Solo importar supabase si estamos en el browser
    if (typeof window !== 'undefined') {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data } = await supabase
          .from('user_settings')
          .select('date_format')
          .eq('user_id', user.id)
          .single();

        userSettingsCache = {
          dateFormat: data?.date_format || 'DD/MM/YYYY',
          lastUpdate: now
        };
      } else {
        userSettingsCache = {
          dateFormat: 'DD/MM/YYYY',
          lastUpdate: now
        };
      }
    } else {
      userSettingsCache = {
        dateFormat: 'DD/MM/YYYY',
        lastUpdate: now
      };
    }

    return userSettingsCache;
  } catch (error) {
    logger.warn('Error fetching user settings, using defaults:', error);
    userSettingsCache = {
      dateFormat: 'DD/MM/YYYY',
      lastUpdate: now
    };
    return userSettingsCache;
  }
};

// Función para invalidar cache cuando las configuraciones cambien
export const invalidateUserSettingsCache = () => {
  userSettingsCache = null;
};

// Obtener la zona horaria del sistema del usuario
export const getSystemTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    logger.warn('No se pudo detectar la zona horaria del sistema, usando Chile como fallback');
    return CHILE_TIMEZONE;
  }
};

// Obtener la zona horaria de negocio (fuente única de verdad — company_data)
export const getUserTimezone = async (): Promise<string> => {
  // Asegurar que businessClock esté precargado y devolver la TZ del negocio
  try {
    await businessClock.bootstrap();
  } catch { /* fallback ya gestionado */ }
  return businessClock.timezone();
};

// Versión sincrónica — fuente única de verdad: businessClock
export const getUserTimezoneSync = (): string => {
  return businessClock.timezone();
};

// ===================== FUNCIONES BÁSICAS DE CONVERSIÓN =====================

// Convert a date to user's timezone for display
export const toChileTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, getUserTimezoneSync());
};

// Convert a date from user's timezone to UTC for storage
export const fromChileTime = (date: Date): Date => {
  return fromZonedTime(date, getUserTimezoneSync());
};

// Format date in user's timezone
export const formatInChileTime = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, getUserTimezoneSync(), formatStr);
};

// Format date for display in user's timezone with locale
export const formatDateForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, getUserTimezoneSync(), 'PPP', { locale: es });
};

// ===================== FECHAS ACTUALES EN ZONA HORARIA CHILE =====================

// Get current date in Chile timezone
export const getCurrentChileDate = (): Date => {
  // Devuelve un Date apuntando a las 12:00 del día comercial actual.
  // Esto evita problemas de DST y mantiene el día comercial real.
  return businessClock.todayDate();
};

// Get current date in Chile timezone as yyyy-MM-dd string
export const getCurrentChileDateString = (): string => {
  return businessClock.today();
};

// Get tomorrow's date in Chile timezone
export const getTomorrowChileDate = (): Date => {
  const tomorrow = addDays(getCurrentChileDate(), 1);
  return startOfDay(tomorrow);
};

// Get start and end of current month in Chile timezone
export const getCurrentMonthRange = () => {
  const now = getCurrentChileDate();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now)
  };
};

// Get start and end of current week in Chile timezone (Monday to Sunday)
export const getCurrentWeekRange = () => {
  const chileDate = getCurrentChileDate();
  const weekStart = new Date(chileDate);
  // Calculate days to subtract to get to Monday (1)
  const dayOfWeek = chileDate.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so subtract 6 to get to Monday
  weekStart.setDate(chileDate.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
};

// Get the start of the current week in Chile timezone (Monday)
export const getWeekStart = (date?: Date) => {
  const targetDate = date || getCurrentChileDate();
  const weekStart = new Date(targetDate);
  const dayOfWeek = targetDate.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(targetDate.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

// ===================== UTILIDADES PARA FORMULARIOS =====================

// Crear fecha local desde calendar component manteniendo día exacto
export const createLocalDateFromCalendar = (calendarDate: Date): Date => {
  logger.debug('[createLocalDateFromCalendar] Input date:', calendarDate);
  logger.debug('[createLocalDateFromCalendar] Input components - Year:', calendarDate.getFullYear(), 'Month:', calendarDate.getMonth() + 1, 'Day:', calendarDate.getDate());
  
  // Extraer componentes de fecha directamente sin conversiones timezone
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const day = calendarDate.getDate();
  
  // Crear nueva fecha local usando mediodía para evitar problemas DST
  const localDate = new Date(year, month, day, 12, 0, 0);
  
  logger.debug('[createLocalDateFromCalendar] Created local date:', localDate);
  logger.debug('[createLocalDateFromCalendar] Result components - Year:', localDate.getFullYear(), 'Month:', localDate.getMonth() + 1, 'Day:', localDate.getDate());
  
  return localDate;
};

// Format date for form input (yyyy-MM-dd) manteniendo fecha exacta
export const formatForInput = (date: Date | string): string => {
  if (!date) return '';
  
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Si es string yyyy-MM-dd, parsearlo como fecha local sin conversión timezone
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date; // Ya está en formato correcto
    }
    // Si es ISO string, convertir a Chile timezone
    dateObj = parseISO(date);
  } else {
    dateObj = date;
  }
  
  // Formatear la fecha manteniendo el día exacto (sin conversiones UTC)
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Parse date from form input creando fecha local (sin conversión timezone)
export const parseFromInput = (dateString: string): Date => {
  logger.debug('[parseFromInput] Input dateString:', dateString);
  
  if (!dateString) {
    const fallback = getCurrentChileDate();
    logger.debug('[parseFromInput] No dateString, using fallback:', fallback);
    return fallback;
  }
  
  // Crear fecha local interpretando el string directamente
  const [year, month, day] = dateString.split('-').map(Number);
  logger.debug('[parseFromInput] Parsed components:', { year, month, day });
  
  // Usar mediodía para evitar problemas de DST
  const localDate = new Date(year, month - 1, day, 12, 0, 0);
  logger.debug('[parseFromInput] Created Date object:', localDate);
  logger.debug('[parseFromInput] Date components check - Year:', localDate.getFullYear(), 'Month:', localDate.getMonth() + 1, 'Day:', localDate.getDate());
  
  return localDate;
};

// ===================== UTILIDADES PARA BASE DE DATOS =====================

// Convertir fecha de string de base de datos a Date manteniendo día exacto
export const parseFromDatabase = (dateString: string): Date => {
  if (!dateString) return getCurrentChileDate();
  
  // Si es formato yyyy-MM-dd, parsearlo como fecha local sin conversiones timezone
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  
  // Si es ISO string con timezone, extraer solo la fecha y parsear como local
  if (dateString.includes('T')) {
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  
  // Fallback: crear fecha local directamente
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Convertir Date a string para base de datos (formato yyyy-MM-dd)
export const formatForDatabase = (date: Date): string => {
  logger.debug('[formatForDatabase] Input date:', date);
  logger.debug('[formatForDatabase] Date type:', typeof date);
  logger.debug('[formatForDatabase] Is Date instance:', date instanceof Date);
  
  if (!date) {
    logger.debug('[formatForDatabase] No date provided, returning empty string');
    return '';
  }
  
  // Formatear fecha local sin conversiones timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const result = `${year}-${month}-${day}`;
  logger.debug('[formatForDatabase] Components - Year:', year, 'Month:', month, 'Day:', day);
  logger.debug('[formatForDatabase] Final result:', result);
  
  return result;
};

// ===================== UTILIDADES PARA COMPARACIONES =====================

// Comparar si una fecha es futura (después de hoy en Chile)
export const isFutureDate = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? parseFromDatabase(date) : date;
  const tomorrow = getTomorrowChileDate();
  return dateObj >= tomorrow;
};

// Comparar si una fecha está en el mes actual (Chile timezone)
export const isCurrentMonth = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? parseFromDatabase(date) : date;
  const { start, end } = getCurrentMonthRange();
  return dateObj >= start && dateObj <= end;
};

// ===================== UTILIDADES PARA FORMATEO VISUAL =====================

// Obtener el formato de fecha del usuario con cache
const getUserDateFormat = (): string => {
  if (userSettingsCache) {
    return userSettingsCache.dateFormat;
  }
  return 'DD/MM/YYYY'; // fallback
};

// Convertir formato de usuario a formato date-fns
const convertUserFormatToDateFns = (userFormat: string): string => {
  switch (userFormat) {
    case 'MM/DD/YYYY':
      return 'MM/dd/yyyy';
    case 'YYYY-MM-DD':
      return 'yyyy-MM-dd';
    case 'DD/MM/YYYY':
    default:
      return 'dd/MM/yyyy';
  }
};

// Format date for display using user's configured format
export const formatForDisplay = (date: Date | string): string => {
  if (!date) return 'N/A';
  
  const userFormat = getUserDateFormat();
  const dateFnsFormat = convertUserFormatToDateFns(userFormat);
  
  // Si es string en formato yyyy-MM-dd, convertir directamente
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return format(dateObj, dateFnsFormat);
  }
  
  // Si es Date object, formatear según configuración del usuario
  if (date instanceof Date) {
    return format(date, dateFnsFormat);
  }
  
  return 'N/A';
};

// Format date for display with locale (respects user timezone)
export const formatForDisplayLong = (date: Date | string): string => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? parseFromDatabase(date) : date;
  const userTimezone = getUserTimezoneSync();
  return formatInTimeZone(dateObj, userTimezone, "dd 'de' MMMM, yyyy", { locale: es });
};

// Format date for display short using user's format but short year
export const formatForDisplayShort = (date: Date | string): string => {
  if (!date) return 'N/A';
  
  const userFormat = getUserDateFormat();
  const dateObj = typeof date === 'string' ? parseFromDatabase(date) : date;
  
  let shortFormat: string;
  switch (userFormat) {
    case 'MM/DD/YYYY':
      shortFormat = 'MM/dd/yy';
      break;
    case 'YYYY-MM-DD':
      shortFormat = 'yy-MM-dd';
      break;
    case 'DD/MM/YYYY':
    default:
      shortFormat = 'dd/MM/yy';
      break;
  }
  
  return format(dateObj, shortFormat, { locale: es });
};

// Format date for alerts and notifications (dd MMM, respects user timezone)
export const formatForAlert = (date: Date | string): string => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? parseFromDatabase(date) : date;
  const userTimezone = getUserTimezoneSync();
  return formatInTimeZone(dateObj, userTimezone, 'dd MMM', { locale: es });
};

// Format date and time for display (respects user's timezone and format)
export const formatForDisplayWithTime = (date: Date | string): string => {
  if (!date) return 'N/A';
  
  const userFormat = getUserDateFormat();
  const dateObj = typeof date === 'string' ? parseFromDatabase(date) : date;
  const userTimezone = getUserTimezoneSync();
  
  let displayFormat: string;
  switch (userFormat) {
    case 'MM/DD/YYYY':
      displayFormat = 'MM/dd/yyyy HH:mm';
      break;
    case 'YYYY-MM-DD':
      displayFormat = 'yyyy-MM-dd HH:mm';
      break;
    case 'DD/MM/YYYY':
    default:
      displayFormat = 'dd/MM/yyyy HH:mm';
      break;
  }
  
  return formatInTimeZone(dateObj, userTimezone, displayFormat, { locale: es });
};

// ===================== BUSINESS TIMEZONE (SINGLE SOURCE OF TRUTH) =====================

// Cache for business timezone from company_data
let businessTimezoneCache: {
  timezone: string;
  lastUpdate: number;
} | null = null;

const BUSINESS_TZ_CACHE_DURATION = 60000; // 60 seconds

/**
 * Get the business timezone from company_data.report_timezone (single source of truth).
 * This is used for all report/business date calculations.
 */
export const getBusinessTimezone = async (): Promise<string> => {
  const now = Date.now();
  if (businessTimezoneCache && (now - businessTimezoneCache.lastUpdate) < BUSINESS_TZ_CACHE_DURATION) {
    return businessTimezoneCache.timezone;
  }

  try {
    if (typeof window !== 'undefined') {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('company_data')
        .select('report_timezone, report_use_system_timezone')
        .limit(1)
        .maybeSingle();

      if (data) {
        let tz: string;
        if (data.report_use_system_timezone) {
          tz = getSystemTimezone();
        } else {
          tz = data.report_timezone || CHILE_TIMEZONE;
        }
        businessTimezoneCache = { timezone: tz, lastUpdate: now };
        return tz;
      }
    }
  } catch (error) {
    logger.warn('Error fetching business timezone, using fallback:', error);
  }

  const fallback = CHILE_TIMEZONE;
  businessTimezoneCache = { timezone: fallback, lastUpdate: now };
  return fallback;
};

/** Invalidate business timezone cache */
export const invalidateBusinessTimezoneCache = () => {
  businessTimezoneCache = null;
};

// ===================== SAFE DATE-ONLY HELPERS =====================

/**
 * Safely parse a YYYY-MM-DD string without timezone shift.
 * Returns components as { year, month, day } to avoid any Date object issues.
 * Using noon local time to prevent DST edge cases.
 */
export const safeParseDateOnly = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(dateStr);
  const [, y, m, d] = match;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);
};

/**
 * Format a YYYY-MM-DD string to dd-MM-yyyy for display (pure string operation, no Date).
 */
export const safeDateToDisplay = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  return `${match[3]}-${match[2]}-${match[1]}`;
};

/**
 * Calculate days between a YYYY-MM-DD date string and a reference YYYY-MM-DD string.
 * Pure date-only arithmetic — no timezone shift possible.
 */
export const safeDaysSince = (dateStr: string, todayStr: string): number => {
  const d = safeParseDateOnly(dateStr);
  const t = safeParseDateOnly(todayStr);
  return Math.floor((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Check if a YYYY-MM-DD date belongs to the same year-month as a reference YYYY-MM-DD.
 */
export const isSameYearMonth = (dateStr: string, refStr: string): boolean => {
  return dateStr.substring(0, 7) === refStr.substring(0, 7);
};

/**
 * Get today's date as YYYY-MM-DD in a specific timezone.
 */
export const getTodayStringInTimezone = (tz: string): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
};

/**
 * Get current time as HH:mm in the business timezone.
 */
export const getCurrentTimeInBusinessTZ = async (): Promise<string> => {
  const tz = await getBusinessTimezone();
  return new Date().toLocaleTimeString('en-GB', { 
    timeZone: tz, 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
};

// ===================== CONVENIENCE ALIASES =====================

/**
 * Convert a Date to YYYY-MM-DD using LOCAL time (not UTC).
 * Alias for formatForInput — avoids toISOString().split('T')[0] which shifts dates in negative UTC offsets.
 */
export const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Get today as YYYY-MM-DD in local time.
 * Equivalent to getCurrentChileDateString but synchronous and without timezone conversion overhead.
 */
export const getTodayLocal = (): string => toLocalDateString(new Date());

// ===================== HELPERS PUBLICOS BASADOS EN BUSINESS TZ =====================

/**
 * "Hoy" en la zona horaria del negocio (YYYY-MM-DD). Síncrono y seguro.
 * Úsese SIEMPRE para comparaciones de día comercial (overdue, filtros, etc.).
 */
export const getBusinessToday = (): string => businessClock.today();

/**
 * Date a las 12:00 del día comercial actual. Seguro para comparaciones.
 */
export const getBusinessTodayDate = (): Date => businessClock.todayDate();
