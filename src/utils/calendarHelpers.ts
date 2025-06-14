
import { CalendarEvent } from '@/types/calendar';

export const getEventsForDate = (events: CalendarEvent[], date: Date) => {
  const dateString = date.toISOString().split('T')[0];
  return events.filter(event => event.date === dateString);
};

export const getEventsForMonth = (events: CalendarEvent[], year: number, month: number) => {
  return events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });
};
