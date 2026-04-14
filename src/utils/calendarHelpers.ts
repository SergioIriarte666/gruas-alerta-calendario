
import { CalendarEvent } from '@/types/calendar';
import { toLocalDateString, safeParseDateOnly } from '@/utils/timezoneUtils';

export const getEventsForDate = (events: CalendarEvent[], date: Date) => {
  const dateString = toLocalDateString(date);
  return events.filter(event => event.date === dateString);
};

export const getEventsForMonth = (events: CalendarEvent[], year: number, month: number) => {
  return events.filter(event => {
    const eventDate = safeParseDateOnly(event.date);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });
};
