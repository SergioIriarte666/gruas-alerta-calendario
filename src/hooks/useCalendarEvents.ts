
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent } from '@/types/calendar';
import { sanitizeEventData } from '@/utils/calendarValidation';

const CALENDAR_EVENTS_SELECT = `
  id,
  title,
  description,
  date,
  start_time,
  end_time,
  type,
  status,
  service_id,
  client_id,
  operator_id,
  crane_id,
  created_at,
  updated_at
`;

export const useCalendarEvents = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all sources in parallel
      const [calendarRes, servicesRes, maintenanceRes] = await Promise.all([
        supabase
          .from('calendar_events')
          .select(CALENDAR_EVENTS_SELECT)
          .order('date', { ascending: true }),
        supabase
          .from('services')
          .select('id, folio, service_date, start_time, end_time, status, client_id, crane_id, operator_id, origin, destination, clients(name)')
          .order('service_date', { ascending: false })
          .limit(2000),
        supabase
          .from('crane_maintenance')
          .select('id, description, scheduled_date, completed_date, status, crane_id, maintenance_type, cranes(license_plate, brand)')
          .order('scheduled_date', { ascending: false })
          .limit(500),
      ]);

      if (calendarRes.error) console.error('Error loading calendar events:', calendarRes.error);
      if (servicesRes.error) console.error('Error loading services for calendar:', servicesRes.error);
      if (maintenanceRes.error) console.error('Error loading maintenance for calendar:', maintenanceRes.error);

      // Manual calendar events
      const manualEvents: CalendarEvent[] = (calendarRes.data || []).map(d => ({
        ...sanitizeEventData(d),
        source: 'manual' as const,
      }));

      // Services → calendar events
      const serviceStatusMap: Record<string, CalendarEvent['status']> = {
        pending: 'scheduled',
        en_route: 'scheduled',
        in_progress: 'scheduled',
        completed: 'completed',
        cancelled: 'cancelled',
      };

      const serviceEvents: CalendarEvent[] = (servicesRes.data || []).map((s: any) => {
        const clientName = s.clients?.name || '';
        const routeInfo = [s.origin, s.destination].filter(Boolean).join(' → ');
        const description = routeInfo || undefined;

        return {
          id: `svc-${s.id}`,
          title: `${s.folio}${clientName ? ` - ${clientName}` : ''}`,
          description,
          date: s.service_date || '',
          startTime: s.start_time || '08:00',
          endTime: s.end_time || '18:00',
          type: 'service' as const,
          status: serviceStatusMap[s.status] || 'scheduled',
          serviceId: s.id,
          clientId: s.client_id || undefined,
          operatorId: s.operator_id || undefined,
          craneId: s.crane_id || undefined,
          createdAt: '',
          updatedAt: '',
          source: 'service' as const,
        };
      });

      // Maintenance → calendar events
      const maintenanceStatusMap: Record<string, CalendarEvent['status']> = {
        scheduled: 'scheduled',
        in_progress: 'scheduled',
        completed: 'completed',
        cancelled: 'cancelled',
      };

      const maintenanceEvents: CalendarEvent[] = (maintenanceRes.data || []).map((m: any) => {
        const crane = m.cranes;
        const craneLabel = crane ? `${crane.brand} ${crane.license_plate}` : '';

        return {
          id: `mnt-${m.id}`,
          title: `🔧 ${m.description}${craneLabel ? ` (${craneLabel})` : ''}`,
          description: m.maintenance_type || undefined,
          date: m.scheduled_date || m.completed_date || '',
          startTime: '08:00',
          endTime: '17:00',
          type: 'maintenance' as const,
          status: maintenanceStatusMap[m.status] || 'scheduled',
          craneId: m.crane_id || undefined,
          createdAt: '',
          updatedAt: '',
          source: 'maintenance' as const,
        };
      });

      // Merge all events
      const allEvents = [...manualEvents, ...serviceEvents, ...maintenanceEvents];
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
        .select(CALENDAR_EVENTS_SELECT)
        .single();

      if (error) {
        console.error('Error creating event:', error);
        throw error;
      }

      const newEvent: CalendarEvent = { ...sanitizeEventData(data), source: 'manual' };
      setEvents(prev => [...prev, newEvent]);
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };

  const updateEvent = async (id: string, eventData: Partial<CalendarEvent>) => {
    // Only allow editing manual events
    if (id.startsWith('svc-') || id.startsWith('mnt-')) {
      console.warn('Cannot edit synced events from calendar. Edit them in their original module.');
      return;
    }

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
        .select(CALENDAR_EVENTS_SELECT)
        .single();

      if (error) {
        console.error('Error updating event:', error);
        return;
      }

      const updatedEvent: CalendarEvent = { ...sanitizeEventData(data), source: 'manual' };
      setEvents(prev => prev.map(event => 
        event.id === id ? updatedEvent : event
      ));
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const deleteEvent = async (id: string) => {
    // Only allow deleting manual events
    if (id.startsWith('svc-') || id.startsWith('mnt-')) {
      console.warn('Cannot delete synced events from calendar. Delete them in their original module.');
      return;
    }

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
