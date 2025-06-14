
import { useState, useEffect } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'service' | 'maintenance' | 'meeting' | 'deadline' | 'other';
  status: 'scheduled' | 'completed' | 'cancelled';
  serviceId?: string;
  clientId?: string;
  operatorId?: string;
  craneId?: string;
  createdAt: string;
  updatedAt: string;
}

// Mock data
const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Servicio de Grúa - Constructora ABC',
    description: 'Instalación de vigas en edificio comercial',
    date: '2024-06-15',
    startTime: '08:00',
    endTime: '16:00',
    type: 'service',
    status: 'scheduled',
    serviceId: '1',
    clientId: '1',
    operatorId: '1',
    craneId: '1',
    createdAt: '2024-06-01T10:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z'
  },
  {
    id: '2',
    title: 'Mantenimiento Grúa GT-001',
    description: 'Revisión técnica mensual',
    date: '2024-06-18',
    startTime: '09:00',
    endTime: '12:00',
    type: 'maintenance',
    status: 'scheduled',
    craneId: '1',
    createdAt: '2024-06-01T10:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z'
  },
  {
    id: '3',
    title: 'Reunión con Cliente',
    description: 'Planificación proyecto torre residencial',
    date: '2024-06-20',
    startTime: '14:00',
    endTime: '15:30',
    type: 'meeting',
    status: 'scheduled',
    clientId: '2',
    createdAt: '2024-06-01T10:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z'
  }
];

export const useCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  useEffect(() => {
    // Simular carga de eventos
    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 500);
  }, []);

  const createEvent = (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEvents(prev => [...prev, newEvent]);
    return newEvent;
  };

  const updateEvent = (id: string, eventData: Partial<CalendarEvent>) => {
    setEvents(prev => prev.map(event => 
      event.id === id 
        ? { ...event, ...eventData, updatedAt: new Date().toISOString() }
        : event
    ));
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  };

  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateString);
  };

  const getEventsForMonth = (year: number, month: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  };

  return {
    events,
    loading,
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    getEventsForMonth
  };
};
