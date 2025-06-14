
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EventModal } from './EventModal';
import { CalendarEvent } from '@/hooks/useCalendar';

interface CalendarHeaderProps {
  onCreateEvent: (eventData: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  selectedDate: Date;
}

export const CalendarHeader = ({ onCreateEvent, selectedDate }: CalendarHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-white">Calendario Centralizado</h1>
        <p className="text-gray-400 mt-2">
          Vista integrada de servicios, vencimientos y eventos importantes
        </p>
      </div>
      <EventModal onCreateEvent={onCreateEvent} selectedDate={selectedDate} />
    </div>
  );
};
