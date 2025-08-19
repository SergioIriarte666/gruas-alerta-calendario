
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent } from '@/types/calendar';
import { sanitizeEventData } from '@/utils/calendarValidation';

export const useCalendarEvents = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

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

      // Use sanitization function for safe data processing
      const formattedEvents: CalendarEvent[] = (data || []).map(sanitizeEventData);
      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
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
        throw error;
      }

      // Use sanitization function for safe data processing
      const newEvent: CalendarEvent = sanitizeEventData(data);
      setEvents(prev => [...prev, newEvent]);
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
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

      // Use sanitization function for safe data processing
      const updatedEvent: CalendarEvent = sanitizeEventData(data);
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

  return {
    events,
    loading,
    setEvents,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent
  };
};
