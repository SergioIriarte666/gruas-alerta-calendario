import { businessClock } from '@/utils/businessClock';

import { useState } from 'react';
import { CalendarViewMode } from '@/types/calendar';

export const useCalendarNavigation = () => {
  const [selectedDate, setSelectedDate] = useState(businessClock.todayDate());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  return {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode
  };
};
