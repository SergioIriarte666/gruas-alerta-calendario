
import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarEvent } from '@/hooks/useCalendar';

interface MonthViewProps {
  currentMonth: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
}

export const MonthView = ({ 
  currentMonth, 
  selectedDate, 
  onDateSelect, 
  getEventsForDate, 
  getEventTypeColor 
}: MonthViewProps) => {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div>
      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-400">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(day => {
          const dayEvents = getEventsForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isDayToday = isToday(day);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-24 p-2 border border-gray-700 rounded-lg cursor-pointer transition-colors
                ${isSelected ? 'bg-green-500/20 border-green-500' : 'hover:bg-white/5'}
                ${isDayToday ? 'border-green-500' : ''}
                ${!isCurrentMonth ? 'opacity-50' : ''}
              `}
              onClick={() => onDateSelect(day)}
            >
              <div className={`
                text-sm font-medium mb-1
                ${isDayToday ? 'text-green-500' : 'text-gray-300'}
              `}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    className={`
                      text-xs px-1 py-0.5 rounded truncate
                      ${getEventTypeColor(event.type)}
                    `}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-400">
                    +{dayEvents.length - 2} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
