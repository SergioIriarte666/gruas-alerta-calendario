import { formatInTimeZone } from 'date-fns-tz';
import { businessClock } from '@/utils/businessClock';
import type { TrackingSettings } from '@/types/operatorLocation';

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const trimSeconds = (value: string): string => value.slice(0, 5);

/**
 * Día ISO (1=lunes...7=domingo) y hora HH:mm del negocio (America/Santiago u
 * otra TZ configurada en company_data), nunca del navegador.
 */
const getChileWeekdayAndMinutes = (now: Date): { weekday: number; minutes: number } => {
  const tz = businessClock.timezone();
  const weekday = Number(formatInTimeZone(now, tz, 'i'));
  const minutes = timeToMinutes(formatInTimeZone(now, tz, 'HH:mm'));
  return { weekday, minutes };
};

/**
 * ¿Cae `now` dentro de la jornada de rastreo configurada?
 * L-V usa weekday_start/end, sábado usa saturday_start/end. Domingo no
 * tiene columnas propias de horario: si sunday_enabled está activo, se
 * reutiliza el horario de semana (weekday_start/end).
 */
export const isWithinTrackingSchedule = (
  settings: TrackingSettings,
  now: Date = businessClock.now(),
): boolean => {
  const { weekday, minutes } = getChileWeekdayAndMinutes(now);

  if (weekday === 7) {
    if (!settings.sunday_enabled) return false;
    return minutes >= timeToMinutes(settings.weekday_start) && minutes < timeToMinutes(settings.weekday_end);
  }

  if (weekday === 6) {
    return minutes >= timeToMinutes(settings.saturday_start) && minutes < timeToMinutes(settings.saturday_end);
  }

  return minutes >= timeToMinutes(settings.weekday_start) && minutes < timeToMinutes(settings.weekday_end);
};

/** Texto legible de la jornada vigente para el día de `now`. */
export const getTrackingScheduleLabel = (
  settings: TrackingSettings,
  now: Date = businessClock.now(),
): string => {
  const { weekday } = getChileWeekdayAndMinutes(now);

  if (weekday === 7) {
    return settings.sunday_enabled
      ? `Domingo ${trimSeconds(settings.weekday_start)}-${trimSeconds(settings.weekday_end)}`
      : 'Domingo sin jornada (solo servicios)';
  }

  if (weekday === 6) {
    return `Sábado ${trimSeconds(settings.saturday_start)}-${trimSeconds(settings.saturday_end)}`;
  }

  return `L-V ${trimSeconds(settings.weekday_start)}-${trimSeconds(settings.weekday_end)}`;
};
