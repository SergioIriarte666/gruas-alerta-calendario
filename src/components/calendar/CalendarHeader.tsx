
import React from 'react';
import { EventModal } from './EventModal';
import { CalendarEvent } from '@/hooks/useCalendar';
import { CalendarDays } from 'lucide-react';

interface CalendarHeaderProps {
  onCreateEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  selectedDate: Date;
}

export const CalendarHeader = ({ onCreateEvent, selectedDate }: CalendarHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="dashboard-section-kicker">
          <CalendarDays className="size-3.5" />
          Programación
        </span>
        <h1 className="dashboard-section-title">Calendario</h1>
        <p className="dashboard-section-description">Servicios, vencimientos y eventos importantes en una vista integrada.</p>
      </div>
      <EventModal onCreateEvent={onCreateEvent} selectedDate={selectedDate} />
    </div>
  );
};
