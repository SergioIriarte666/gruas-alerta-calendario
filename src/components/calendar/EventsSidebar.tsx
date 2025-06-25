
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarEvent } from '@/types/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface EventsSidebarProps {
  selectedDate: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type']) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
}

export const EventsSidebar: React.FC<EventsSidebarProps> = ({
  selectedDate,
  getEventsForDate,
  getEventTypeColor,
  getEventTypeLabel,
  createEvent,
  deleteEvent
}) => {
  const [showForm, setShowForm] = useState(false);
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
        date: format(selectedDate, 'yyyy-MM-dd'),
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
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <span>Eventos - {format(selectedDate, 'd MMMM yyyy', { locale: es })}</span>
            <Button
              size="sm"
              onClick={() => setShowForm(!showForm)}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showForm && (
            <div className="space-y-4 mb-4 p-4 bg-gray-800 rounded-lg">
              <div>
                <Label htmlFor="title" className="text-white">Título</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="Título del evento"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="type" className="text-white">Tipo</Label>
                <Select value={newEvent.type} onValueChange={(value: CalendarEvent['type']) => setNewEvent({...newEvent, type: value})}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
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
                  <Label htmlFor="startTime" className="text-white">Hora inicio</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="endTime" className="text-white">Hora fin</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-white">Descripción</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Descripción del evento"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateEvent} className="bg-green-500 hover:bg-green-600 text-white">
                  Crear Evento
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline" className="border-gray-600 text-gray-300">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No hay eventos para esta fecha</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg ${getEventTypeColor(event.type)} bg-opacity-20 border border-opacity-30`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{event.title}</h4>
                      <p className="text-sm text-gray-300 flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {event.startTime} - {event.endTime}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {getEventTypeLabel(event.type)}
                      </p>
                      {event.description && (
                        <p className="text-sm text-gray-300 mt-2">{event.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteEvent(event.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
