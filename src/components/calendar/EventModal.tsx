import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarEvent } from '@/hooks/useCalendar';
import { Plus } from 'lucide-react';

interface EventModalProps {
  onCreateEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  selectedDate?: Date;
}

export const EventModal = ({ onCreateEvent, selectedDate }: EventModalProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    type: 'other' as CalendarEvent['type'],
    status: 'scheduled' as CalendarEvent['status'],
    serviceId: '',
    clientId: '',
    operatorId: '',
    craneId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onCreateEvent({
      title: formData.title,
      description: formData.description,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      type: formData.type,
      status: formData.status,
      serviceId: formData.serviceId || undefined,
      clientId: formData.clientId || undefined,
      operatorId: formData.operatorId || undefined,
      craneId: formData.craneId || undefined
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      date: selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      type: 'other',
      status: 'scheduled',
      serviceId: '',
      clientId: '',
      operatorId: '',
      craneId: ''
    });
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-500 hover:bg-green-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Evento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] calendar-scope">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear Nuevo Evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title" className="text-muted-foreground">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="bg-card border-border text-foreground"
                placeholder="Título del evento"
              />
            </div>
            <div>
              <Label htmlFor="type" className="text-muted-foreground">Tipo de Evento</Label>
              <Select value={formData.type} onValueChange={(value: CalendarEvent['type']) => setFormData({ ...formData, type: value })}>
                <SelectTrigger className="bg-card border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="maintenance">Mantenimiento</SelectItem>
                  <SelectItem value="meeting">Reunión</SelectItem>
                  <SelectItem value="deadline">Vencimiento</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-muted-foreground">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-card border-border text-foreground"
              placeholder="Descripción del evento (opcional)"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date" className="text-muted-foreground">Fecha *</Label>
              <DatePickerInput
                id="date"
                value={formData.date}
                onChange={(value) => setFormData({ ...formData, date: value })}
                placeholder="Seleccionar fecha"
                className="bg-card border-border text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="startTime" className="text-muted-foreground">Hora Inicio *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                className="bg-card border-border text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="endTime" className="text-muted-foreground">Hora Fin *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
                className="bg-card border-border text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Crear Evento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
