import { format as formatDate, type FormatOptions } from 'date-fns';

/** Calendar dates are YYYY-MM-DD values, never instants or UTC timestamps. */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const candidate = new Date(0);
  candidate.setUTCFullYear(y, m - 1, d);
  return candidate.getUTCFullYear() === y && candidate.getUTCMonth() === m - 1 && candidate.getUTCDate() === d;
}

/** Bridge for calendars/date-fns. Never serialize this local Date as UTC. */
export function parseDateValue(value: string | Date | number): Date {
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    if (!isCalendarDate(value)) return new Date(NaN);
    const [y, m, d] = value.split('-').map(Number);
    const result = new Date(0);
    result.setFullYear(y, m - 1, d);
    result.setHours(12, 0, 0, 0);
    return result;
  }
  // True timestamps retain their instant. Formatting them requires businessClock.
  return new Date(value);
}

/** Serialize calendar widget components without any timezone conversion. */
export function calendarDateString(value: Date | string): string {
  if (typeof value === 'string') {
    if (!isCalendarDate(value)) throw new RangeError(`Invalid calendar date: ${value}`);
    return value;
  }
  if (isNaN(value.getTime())) throw new RangeError('Invalid calendar date');
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function formatCalendarDate(value: string | Date, pattern = 'dd/MM/yyyy', options?: FormatOptions): string {
  return formatDate(parseDateValue(calendarDateString(value)), pattern, options);
}

function calendarDayNumber(value: string | Date): number {
  const [y, m, d] = calendarDateString(value).split('-').map(Number);
  const result = new Date(0);
  result.setUTCFullYear(y, m - 1, d);
  result.setUTCHours(0, 0, 0, 0);
  return result.getTime() / 86400000;
}

/** Calendar arithmetic is independent of DST (days may last 23 or 25 hours). */
export function differenceInCalendarDates(later: string | Date, earlier: string | Date): number {
  return calendarDayNumber(later) - calendarDayNumber(earlier);
}

export function addCalendarDays(value: string | Date, days: number): string {
  const result = new Date((calendarDayNumber(value) + days) * 86400000);
  return `${String(result.getUTCFullYear()).padStart(4, '0')}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

/** Excel day serials have no timezone; use their UTC calendar components. */
export function excelSerialToCalendarDate(serial: number): string {
  if (!Number.isFinite(serial)) throw new RangeError('Invalid Excel date');
  const date = new Date((Math.floor(serial) - 25569) * 86400000);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
