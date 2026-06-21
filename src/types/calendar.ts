
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
  /** Source of the event: 'manual' for calendar_events, 'service' for services, 'maintenance' for crane_maintenance */
  source?: 'manual' | 'service' | 'maintenance';
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';
