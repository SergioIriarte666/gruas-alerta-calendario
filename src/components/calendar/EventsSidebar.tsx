
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarEvent } from '@/hooks/useCalendar';
import { EventModal } from './EventModal';

interface EventsSidebarProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const EventsSidebar = ({ 
  selectedDate, 
  getEventsForDate, 
  getEventTypeColor, 
  getEventTypeLabel, 
  createEvent 
}: EventsSidebarProps) => {
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">
            Eventos del {format(selectedDate, 'd MMMM', { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getEventsForDate(selectedDate).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">
                No hay eventos programados para este día
              </p>
              <EventModal onCreateEvent={createEvent} selectedDate={selectedDate} />
            </div>
          ) : (
            <div className="space-y-3">
              {getEventsForDate(selectedDate).map(event => (
                <div key={event.id} className="p-3 rounded-lg bg-white/5 border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-white text-sm">{event.title}</h4>
                    <Badge className={getEventTypeColor(event.type)}>
                      {getEventTypeLabel(event.type)}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-gray-400 text-xs mb-2">{event.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{event.startTime} - {event.endTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Legend */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white text-sm">Tipos de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { type: 'service' as const, label: 'Servicios' },
              { type: 'maintenance' as const, label: 'Mantenimiento' },
              { type: 'meeting' as const, label: 'Reuniones' },
              { type: 'deadline' as const, label: 'Vencimientos' }
            ].map(({ type, label }) => (
              <div key={type} className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded ${getEventTypeColor(type)}`} />
                <span className="text-gray-300 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
