
import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

const CHILE_TIMEZONE = 'America/Santiago';

// Convert a date to Chile timezone for display
export const toChileTime = (date: Date | string): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, CHILE_TIMEZONE);
};

// Convert a date from Chile timezone to UTC for storage
export const fromChileTime = (date: Date): Date => {
  return fromZonedTime(date, CHILE_TIMEZONE);
};

// Format date in Chile timezone
export const formatInChileTime = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, CHILE_TIMEZONE, formatStr);
};

// Format date for display in Chile timezone with locale
export const formatDateForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, CHILE_TIMEZONE, 'PPP', { locale: es });
};

// Get current date in Chile timezone
export const getCurrentChileDate = (): Date => {
  return toChileTime(new Date());
};

// Format date for form input (yyyy-MM-dd) in Chile timezone
export const formatForInput = (date: Date | string): string => {
  return formatInChileTime(date, 'yyyy-MM-dd');
};

// Parse date from form input ensuring Chile timezone
export const parseFromInput = (dateString: string): Date => {
  // Parse the date string and treat it as Chile time
  const parsedDate = new Date(dateString + 'T00:00:00');
  return toChileTime(parsedDate);
};
