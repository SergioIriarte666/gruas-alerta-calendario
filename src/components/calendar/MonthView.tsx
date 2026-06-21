
import React from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarEvent } from '@/hooks/useCalendar';

interface MonthViewProps {
  currentMonth: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type'], status?: CalendarEvent['status'], date?: string) => string;
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
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div>
      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
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
                min-h-24 rounded-lg border border-border/70 bg-card p-2 cursor-pointer transition-colors
                ${isSelected ? 'border-primary bg-primary/10' : 'hover:bg-muted/40'}
                ${isDayToday ? 'border-primary/60' : ''}
                ${!isCurrentMonth ? 'opacity-50' : ''}
              `}
              onClick={() => onDateSelect(day)}
            >
              <div className="mb-1 text-sm font-medium text-foreground">
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    className={`
                      text-xs px-1 py-0.5 rounded truncate
                      ${getEventTypeColor(event.type, event.status, event.date)}
                    `}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground">
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
