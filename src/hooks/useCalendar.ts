
import { useEffect } from 'react';
import { useCalendarEvents } from './useCalendarEvents';
import { useCalendarNavigation } from './useCalendarNavigation';
import { getEventsForDate, getEventsForMonth } from '@/utils/calendarHelpers';

export const useCalendar = () => {
  const {
    events,
    loading,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent
  } = useCalendarEvents();

  const {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode
  } = useCalendarNavigation();

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Listen for global data refresh events (service/maintenance CRUD)
  useEffect(() => {
    const handleRefresh = () => {
      loadEvents();
    };

    window.addEventListener('global-data-refresh', handleRefresh);
    return () => window.removeEventListener('global-data-refresh', handleRefresh);
  }, [loadEvents]);

  return {
    events,
    loading,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate: (date: Date) => getEventsForDate(events, date),
    getEventsForMonth: (year: number, month: number) => getEventsForMonth(events, year, month),
    loadEvents
  };
};

// Re-export types for backward compatibility
export type { CalendarEvent } from '@/types/calendar';
