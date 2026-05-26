
import { startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { formatForDisplayShort } from '@/utils/timezoneUtils';
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
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
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
                min-h-32 rounded-lg border border-border/70 bg-card p-2 cursor-pointer transition-colors
                ${isSelected ? 'border-primary bg-primary/10' : 'hover:bg-muted/40'}
                ${isDayToday ? 'border-primary/60' : ''}
              `}
              onClick={() => onDateSelect(day)}
            >
              <div className={`
                text-sm font-medium mb-2
                ${isDayToday ? 'text-primary' : 'text-foreground'}
              `}>
                {formatForDisplayShort(day)}
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
