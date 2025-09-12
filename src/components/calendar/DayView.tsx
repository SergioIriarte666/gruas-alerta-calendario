
import React, { useState } from 'react';
import { formatForDisplayLong } from '@/utils/timezoneUtils';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/hooks/useCalendar';
import { EventModal } from './EventModal';
import { ConvertEventToServiceModal } from './ConvertEventToServiceModal';
import { useToast } from '@/components/ui/custom-toast';

interface DayViewProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteEvent: (id: string) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
}

export const DayView = ({ 
  selectedDate, 
  getEventsForDate, 
  getEventTypeColor, 
  getEventTypeLabel, 
  createEvent,
  deleteEvent,
  updateEvent
}: DayViewProps) => {
  const { toast } = useToast();
  const [convertingEvent, setConvertingEvent] = useState<CalendarEvent | null>(null);
  
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
    <div className="space-y-4 calendar-scope">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {formatForDisplayLong(selectedDate)}
        </h3>
      </div>
      
      {dayEvents.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No hay eventos programados para este día</p>
          <EventModal onCreateEvent={createEvent} selectedDate={selectedDate} />
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map(event => (
            <div key={event.id} className="p-4 rounded-lg bg-card border hover:bg-accent transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground text-lg">{event.title}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-sm">{event.startTime} - {event.endTime}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getEventTypeColor(event.type)}>
                    {getEventTypeLabel(event.type)}
                  </Badge>
                  {!event.serviceId && event.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setConvertingEvent(event)}
                      className="h-9 px-3 text-green-400 hover:text-green-300 border-green-500/30 hover:bg-green-500/10 transition-all duration-200"
                      title="Convertir este evento a un servicio"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Convertir a Servicio</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEvent(event.id, event.title)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    title="Eliminar evento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {event.description && (
                <p className="text-muted-foreground text-sm">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Convert Event to Service Modal */}
      {convertingEvent && (
        <ConvertEventToServiceModal
          event={convertingEvent}
          open={!!convertingEvent}
          onOpenChange={(open) => !open && setConvertingEvent(null)}
          onEventUpdate={updateEvent}
        />
      )}
    </div>
  );
};
