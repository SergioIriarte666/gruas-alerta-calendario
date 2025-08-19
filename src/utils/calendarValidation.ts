
import { CalendarEvent } from '@/types/calendar';

// Type guard functions for validation
export const isValidEventType = (type: string): type is CalendarEvent['type'] => {
  return ['service', 'maintenance', 'meeting', 'deadline', 'other'].includes(type);
};

export const isValidEventStatus = (status: string): status is CalendarEvent['status'] => {
  return ['scheduled', 'completed', 'cancelled'].includes(status);
};

// Sanitize event data from database
export const sanitizeEventData = (data: any): CalendarEvent => {
  // Validate and set default values for type and status
  const eventType = isValidEventType(data.type) ? data.type : 'other';
  const eventStatus = isValidEventStatus(data.status) ? data.status : 'scheduled';

  // Log warnings for invalid data
  if (!isValidEventType(data.type)) {
    console.warn(`Invalid event type received: ${data.type}, defaulting to 'other'`);
  }
  if (!isValidEventStatus(data.status)) {
    console.warn(`Invalid event status received: ${data.status}, defaulting to 'scheduled'`);
  }

  return {
    id: data.id,
    title: data.title || 'Untitled Event',
    description: data.description,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time,
    type: eventType,
    status: eventStatus,
    serviceId: data.service_id,
    clientId: data.client_id,
    operatorId: data.operator_id,
    craneId: data.crane_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};
