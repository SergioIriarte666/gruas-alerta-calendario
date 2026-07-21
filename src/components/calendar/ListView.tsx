import React, { useMemo } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { ArrowRight, CalendarDays, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { businessClock } from '@/utils/businessClock';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ListViewProps {
  events: CalendarEvent[];
  getEventTypeColor: (type: CalendarEvent['type'], status?: CalendarEvent['status'], date?: string) => string;
  getEventTypeLabel: (type: CalendarEvent['type']) => string;
  onDeleteEvent: (id: string) => Promise<void>;
  onConvertToService?: (event: CalendarEvent) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  events,
  getEventTypeColor,
  getEventTypeLabel,
  onDeleteEvent,
  onConvertToService,
}) => {
  const today = businessClock.today();

  const { upcoming, past } = useMemo(() => {
    const upcoming = events
      .filter(event => event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    const past = events
      .filter(event => event.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming, past };
  }, [events, today]);

  const groupByDate = (groupEvents: CalendarEvent[]) => {
    const groups: Record<string, CalendarEvent[]> = {};
    groupEvents.forEach(event => {
      if (!groups[event.date]) groups[event.date] = [];
      groups[event.date].push(event);
    });
    return groups;
  };

  const upcomingGroups = groupByDate(upcoming);
  const pastGroups = groupByDate(past);

  const formatGroupDate = (dateStr: string) => {
    if (dateStr === today) return 'Hoy';
    return format(safeParseDateOnly(dateStr), "EEEE d 'de' MMMM yyyy", { locale: es });
  };

  const renderEventRow = (event: CalendarEvent) => (
    <div
      key={event.id}
      className={`flex items-start justify-between gap-x-3 rounded-lg border border-border/60 px-4 py-3 ${getEventTypeColor(event.type, event.status, event.date)}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="truncate font-medium">{event.title}</span>
          <Badge variant="outline" className="shrink-0 text-xs">
            {getEventTypeLabel(event.type)}
          </Badge>
        </div>
        {(event.startTime || event.endTime) && (
          <p className="mt-1 flex items-center gap-x-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
          </p>
        )}
        {event.description && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{event.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-x-1">
        {onConvertToService && !event.serviceId && event.status !== 'completed' && event.date >= today && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConvertToService(event)}
            className="h-7 border-success/30 px-2 text-xs text-success hover:bg-success-soft"
          >
            <ArrowRight className="mr-1 size-3" />
            Servicio
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDeleteEvent(event.id)}
          className="size-7 p-0 text-danger hover:bg-danger-soft hover:text-danger-text"
          aria-label={`Eliminar ${event.title}`}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );

  const renderGroup = (dateStr: string, groupEvents: CalendarEvent[]) => (
    <div key={dateStr} className="space-y-2">
      <div className="flex items-center gap-x-2 pt-2">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className={`text-sm font-semibold capitalize ${dateStr === today ? 'text-primary' : 'text-foreground'}`}>
          {formatGroupDate(dateStr)}
        </span>
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs text-muted-foreground">
          {groupEvents.length} evento{groupEvents.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-1.5 pl-6">
        {groupEvents.map(renderEventRow)}
      </div>
    </div>
  );

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-2 py-16 text-muted-foreground">
        <CalendarDays className="size-10 opacity-30" />
        <p className="text-sm">No hay eventos registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {Object.keys(upcomingGroups).length > 0 && (
        <div className="space-y-3">
          {Object.entries(upcomingGroups).map(([date, groupEvents]) => renderGroup(date, groupEvents))}
        </div>
      )}

      {past.length > 0 && upcoming.length > 0 && (
        <div className="flex items-center gap-x-2 py-4">
          <div className="h-px flex-1 bg-border" />
          <span className="px-2 text-xs text-muted-foreground">Eventos pasados</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {Object.keys(pastGroups).length > 0 && (
        <div className="space-y-3 opacity-70">
          {Object.entries(pastGroups).map(([date, groupEvents]) => renderGroup(date, groupEvents))}
        </div>
      )}
    </div>
  );
};
