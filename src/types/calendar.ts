
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

export type CalendarViewMode = 'month' | 'week' | 'day';
