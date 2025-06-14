
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export const useCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Cargar eventos desde Supabase
  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading calendar events:', error);
        return;
      }

      const formattedEvents: CalendarEvent[] = (data || []).map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        startTime: event.start_time,
        endTime: event.end_time,
        type: event.type as CalendarEvent['type'],
        status: event.status as CalendarEvent['status'],
        serviceId: event.service_id,
        clientId: event.client_id,
        operatorId: event.operator_id,
        craneId: event.crane_id,
        createdAt: event.created_at,
        updatedAt: event.updated_at
      }));

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const createEvent = async (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          start_time: eventData.startTime,
          end_time: eventData.endTime,
          type: eventData.type,
          status: eventData.status,
          service_id: eventData.serviceId || null,
          client_id: eventData.clientId || null,
          operator_id: eventData.operatorId || null,
          crane_id: eventData.craneId || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating event:', error);
        return null;
      }

      const newEvent: CalendarEvent = {
        id: data.id,
        title: data.title,
        description: data.description,
        date: data.date,
        startTime: data.start_time,
        endTime: data.end_time,
        type: data.type as CalendarEvent['type'],
        status: data.status as CalendarEvent['status'],
        serviceId: data.service_id,
        clientId: data.client_id,
        operatorId: data.operator_id,
        craneId: data.crane_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setEvents(prev => [...prev, newEvent]);
      return newEvent;
    } catch (error) {
      console.error('Error creating event:', error);
      return null;
    }
  };

  const updateEvent = async (id: string, eventData: Partial<CalendarEvent>) => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          title: eventData.title,
          description: eventData.description,
          date: eventData.date,
          start_time: eventData.startTime,
          end_time: eventData.endTime,
          type: eventData.type,
          status: eventData.status,
          service_id: eventData.serviceId || null,
          client_id: eventData.clientId || null,
          operator_id: eventData.operatorId || null,
          crane_id: eventData.craneId || null
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating event:', error);
        return;
      }

      const updatedEvent: CalendarEvent = {
        id: data.id,
        title: data.title,
        description: data.description,
        date: data.date,
        startTime: data.start_time,
        endTime: data.end_time,
        type: data.type as CalendarEvent['type'],
        status: data.status as CalendarEvent['status'],
        serviceId: data.service_id,
        clientId: data.client_id,
        operatorId: data.operator_id,
        craneId: data.crane_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setEvents(prev => prev.map(event => 
        event.id === id ? updatedEvent : event
      ));
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting event:', error);
        return;
      }

      setEvents(prev => prev.filter(event => event.id !== id));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
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
    getEventsForMonth,
    loadEvents
  };
};
