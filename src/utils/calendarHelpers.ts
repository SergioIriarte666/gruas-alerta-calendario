
import { CalendarEvent } from '@/types/calendar';
import { toLocalDateString, safeParseDateOnly } from '@/utils/timezoneUtils';

export const getEventsForDate = (events: CalendarEvent[], date: Date) => {
  const dateString = toLocalDateString(date);
  return events.filter(event => {
    if (!event.date) return false;
    const eventDateString = toLocalDateString(safeParseDateOnly(event.date));
    return eventDateString === dateString;
  });
};

export const getEventsForMonth = (events: CalendarEvent[], year: number, month: number) => {
  return events.filter(event => {
    if (!event.date) return false;
    const eventDate = safeParseDateOnly(event.date);
    if (Number.isNaN(eventDate.getTime())) return false;
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });
};
