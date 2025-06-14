
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CalendarEvent } from '@/hooks/useCalendar';
import { EventModal } from './EventModal';

interface DayViewProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const DayView = ({ 
  selectedDate, 
  getEventsForDate, 
  getEventTypeColor, 
  getEventTypeLabel, 
  createEvent 
}: DayViewProps) => {
  const dayEvents = getEventsForDate(selectedDate).sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">
          {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
        </h3>
      </div>
      
      {dayEvents.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-400 mb-4">No hay eventos programados para este día</p>
          <EventModal onCreateEvent={createEvent} selectedDate={selectedDate} />
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map(event => (
            <div key={event.id} className="p-4 rounded-lg bg-white/5 border border-gray-700">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-white text-lg">{event.title}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400 text-sm">{event.startTime} - {event.endTime}</span>
                  </div>
                </div>
                <Badge className={getEventTypeColor(event.type)}>
                  {getEventTypeLabel(event.type)}
                </Badge>
              </div>
              {event.description && (
                <p className="text-gray-300 text-sm">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
