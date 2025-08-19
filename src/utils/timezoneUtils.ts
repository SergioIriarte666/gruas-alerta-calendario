
import { format, parseISO, startOfMonth, endOfMonth, startOfDay, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

// Zona horaria por defecto para Chile como fallback
const CHILE_TIMEZONE = 'America/Santiago';

// Cache para configuraciones del usuario
let userSettingsCache: {
  timezone: string;
  useSystemTimezone: boolean;
  dateFormat: string;
  lastUpdate: number;
} | null = null;

const CACHE_DURATION = 30000; // 30 segundos

// Función para obtener configuraciones del usuario con cache
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
          .select('timezone, use_system_timezone, date_format')
          .eq('user_id', user.id)
          .single();

        userSettingsCache = {
          timezone: data?.timezone || CHILE_TIMEZONE,
          useSystemTimezone: data?.use_system_timezone ?? true,
          dateFormat: data?.date_format || 'DD/MM/YYYY',
          lastUpdate: now
        };
      } else {
        userSettingsCache = {
          timezone: CHILE_TIMEZONE,
          useSystemTimezone: true,
          dateFormat: 'DD/MM/YYYY',
          lastUpdate: now
        };
      }
    } else {
      userSettingsCache = {
        timezone: CHILE_TIMEZONE,
        useSystemTimezone: true,
        dateFormat: 'DD/MM/YYYY',
        lastUpdate: now
      };
    }

    return userSettingsCache;
  } catch (error) {
    console.warn('Error fetching user settings, using defaults:', error);
    userSettingsCache = {
      timezone: CHILE_TIMEZONE,
      useSystemTimezone: true,
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
    console.warn('No se pudo detectar la zona horaria del sistema, usando Chile como fallback');
    return CHILE_TIMEZONE;
  }
};

// Obtener la zona horaria a usar (sistema o configurada por el usuario)
export const getUserTimezone = async (): Promise<string> => {
  try {
    const settings = await getUserSettingsFromCache();
    return settings.useSystemTimezone ? getSystemTimezone() : settings.timezone;
  } catch (error) {
    console.warn('Error getting user timezone, using system timezone');
    return getSystemTimezone();
  }
};

// Versión sincrónica para compatibilidad hacia atrás
export const getUserTimezoneSync = (): string => {
  if (userSettingsCache) {
    return userSettingsCache.useSystemTimezone ? getSystemTimezone() : userSettingsCache.timezone;
  }
  return getSystemTimezone();
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
  return toChileTime(new Date());
};

// Get current date in Chile timezone as yyyy-MM-dd string
export const getCurrentChileDateString = (): string => {
  return formatInChileTime(new Date(), 'yyyy-MM-dd');
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

// ===================== UTILIDADES PARA FORMULARIOS =====================

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
  console.log('[parseFromInput] Input dateString:', dateString);
  
  if (!dateString) {
    const fallback = getCurrentChileDate();
    console.log('[parseFromInput] No dateString, using fallback:', fallback);
    return fallback;
  }
  
  // Crear fecha local interpretando el string directamente
  const [year, month, day] = dateString.split('-').map(Number);
  console.log('[parseFromInput] Parsed components:', { year, month, day });
  
  // Usar mediodía para evitar problemas de DST
  const localDate = new Date(year, month - 1, day, 12, 0, 0);
  console.log('[parseFromInput] Created Date object:', localDate);
  console.log('[parseFromInput] Date components check - Year:', localDate.getFullYear(), 'Month:', localDate.getMonth() + 1, 'Day:', localDate.getDate());
  
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
  console.log('[formatForDatabase] Input date:', date);
  console.log('[formatForDatabase] Date type:', typeof date);
  console.log('[formatForDatabase] Is Date instance:', date instanceof Date);
  
  if (!date) {
    console.log('[formatForDatabase] No date provided, returning empty string');
    return '';
  }
  
  // Formatear fecha local sin conversiones timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const result = `${year}-${month}-${day}`;
  console.log('[formatForDatabase] Components - Year:', year, 'Month:', month, 'Day:', day);
  console.log('[formatForDatabase] Final result:', result);
  
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
