
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarEvent } from '@/types/calendar';
import { ConvertEventToServiceModal } from './ConvertEventToServiceModal';
import { formatForInput, formatForDisplayLong } from '@/utils/timezoneUtils';
import { Plus, Clock, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface EventsSidebarProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
}

export const EventsSidebar: React.FC<EventsSidebarProps> = ({
  selectedDate,
  getEventsForDate,
  getEventTypeColor,
  getEventTypeLabel,
  createEvent,
  deleteEvent,
  updateEvent
}) => {
  const [showForm, setShowForm] = useState(false);
  const [convertingEvent, setConvertingEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '10:00',
    type: 'other' as CalendarEvent['type']
  });

  const events = getEventsForDate(selectedDate);

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.error('El título del evento es requerido');
      return;
    }

    try {
      await createEvent({
        ...newEvent,
        date: formatForInput(selectedDate),
        status: 'scheduled'
      });
      
      setNewEvent({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '10:00',
        type: 'other'
      });
      setShowForm(false);
      toast.success('Evento creado exitosamente');
    } catch (error) {
      toast.error('Error al crear el evento');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      toast.success('Evento eliminado exitosamente');
    } catch (error) {
      toast.error('Error al eliminar el evento');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-foreground">
            <span>Eventos - {formatForDisplayLong(selectedDate)}</span>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="size-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="space-y-4 mb-4 p-4 bg-card rounded-lg border">
              <div>
                <Label htmlFor="title" className="text-foreground">Título</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="Título del evento"
                  className="bg-card border-border text-foreground"
                />
              </div>
              
              <div>
                <Label htmlFor="type" className="text-foreground">Tipo</Label>
                <Select value={newEvent.type} onValueChange={(value: CalendarEvent['type']) => setNewEvent({...newEvent, type: value})}>
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Servicio</SelectItem>
                    <SelectItem value="maintenance">Mantenimiento</SelectItem>
                    <SelectItem value="meeting">Reunión</SelectItem>
                    <SelectItem value="deadline">Vencimiento</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="startTime" className="text-foreground">Hora inicio</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label htmlFor="endTime" className="text-foreground">Hora fin</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-foreground">Descripción</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Descripción del evento"
                  className="bg-card border-border text-foreground"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateEvent} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Crear Evento
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No hay eventos para esta fecha</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border border-border/60 ${getEventTypeColor(event.type)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">{event.title}</h4>
                      <p className="text-sm text-muted-foreground flex items-center mt-1">
                        <Clock className="size-3 mr-1" />
                        {event.startTime} - {event.endTime}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getEventTypeLabel(event.type)}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-x-2">
                      {!event.serviceId && event.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConvertingEvent(event)}
                          className="text-green-400 hover:text-green-300 border-green-500/30 hover:bg-green-500/10"
                          title="Convertir a servicio"
                        >
                          <ArrowRight className="size-3 mr-1" />
                          <span className="text-xs">Servicio</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

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
