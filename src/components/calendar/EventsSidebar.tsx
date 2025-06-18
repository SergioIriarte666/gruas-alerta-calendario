
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/hooks/useCalendar';
import { EventModal } from './EventModal';
import { useToast } from '@/components/ui/custom-toast';

interface EventsSidebarProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteEvent: (id: string) => void;
}

export const EventsSidebar = ({ 
  selectedDate, 
  getEventsForDate, 
  getEventTypeColor, 
  getEventTypeLabel, 
  createEvent,
  deleteEvent
}: EventsSidebarProps) => {
  const { toast } = useToast();

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    try {
      await deleteEvent(eventId);
      toast({
        type: 'success',
        title: 'Evento eliminado',
        description: `El evento "${eventTitle}" ha sido eliminado correctamente`
      });
    } catch (error) {
      toast({
        type: 'error',
        title: 'Error al eliminar',
        description: 'No se pudo eliminar el evento. Inténtalo de nuevo.'
      });
    }
  };

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
                <div key={event.id} className="p-3 rounded-lg bg-white/5 border border-gray-700 hover:bg-white/10 transition-colors group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-white text-sm">{event.title}</h4>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getEventTypeColor(event.type)}>
                        {getEventTypeLabel(event.type)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEvent(event.id, event.title)}
                        className="h-6 w-6 text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Eliminar evento"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
