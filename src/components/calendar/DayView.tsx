
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/hooks/useCalendar';
import { EventModal } from './EventModal';
import { useToast } from '@/components/ui/custom-toast';

interface DayViewProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteEvent: (id: string) => void;
}

export const DayView = ({ 
  selectedDate, 
  getEventsForDate, 
  getEventTypeColor, 
  getEventTypeLabel, 
  createEvent,
  deleteEvent
}: DayViewProps) => {
  const { toast } = useToast();
  
  const dayEvents = getEventsForDate(selectedDate).sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );

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
            <div key={event.id} className="p-4 rounded-lg bg-white/5 border border-gray-700 hover:bg-white/10 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-white text-lg">{event.title}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400 text-sm">{event.startTime} - {event.endTime}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getEventTypeColor(event.type)}>
                    {getEventTypeLabel(event.type)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEvent(event.id, event.title)}
                    className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    title="Eliminar evento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
