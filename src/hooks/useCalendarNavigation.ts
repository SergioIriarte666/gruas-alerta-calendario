
import React, { useState } from 'react';
import { CalendarViewMode } from '@/types/calendar';

export const useCalendarNavigation = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  return {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode
  };
};
