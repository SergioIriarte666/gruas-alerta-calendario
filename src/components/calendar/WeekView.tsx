
import React from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarEvent } from '@/hooks/useCalendar';

interface WeekViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
}

export const WeekView = ({ 
  selectedDate, 
  onDateSelect, 
  getEventsForDate, 
  getEventTypeColor 
}: WeekViewProps) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-400">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => {
          const dayEvents = getEventsForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-32 p-2 border border-gray-700 rounded-lg cursor-pointer transition-colors
                ${isSelected ? 'bg-green-500/20 border-green-500' : 'hover:bg-white/5'}
                ${isDayToday ? 'border-green-500' : ''}
              `}
              onClick={() => onDateSelect(day)}
            >
              <div className={`
                text-sm font-medium mb-2
                ${isDayToday ? 'text-green-500' : 'text-gray-300'}
              `}>
                {format(day, 'd MMM', { locale: es })}
              </div>
              <div className="space-y-1">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className={`
                      text-xs px-1 py-0.5 rounded truncate
                      ${getEventTypeColor(event.type)}
                    `}
                    title={`${event.title} - ${event.startTime}`}
                  >
                    {event.startTime} {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
