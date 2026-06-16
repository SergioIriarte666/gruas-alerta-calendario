
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, CalendarClock } from 'lucide-react';
import { useCalendar, CalendarEvent } from '@/hooks/useCalendar';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarControls } from '@/components/calendar/CalendarControls';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { EventsSidebar } from '@/components/calendar/EventsSidebar';
import { format, addMonths, subMonths, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { businessClock } from '@/utils/businessClock';

const Calendar = () => {
  const { 
    events, 
    loading, 
    selectedDate, 
    setSelectedDate, 
    viewMode, 
    setViewMode,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate 
  } = useCalendar();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Count upcoming service events for awareness (today and onwards)
  const upcomingCounts = useMemo(() => {
    const todayStr = businessClock.today();
    const thisMonth = format(businessClock.todayDate(), 'yyyy-MM');
    let thisMonthCount = 0;
    let futureCount = 0;
    for (const ev of events) {
      if (ev.type !== 'service' || ev.status !== 'scheduled') continue;
      if (!ev.date || ev.date < todayStr) continue;
      if (ev.date.startsWith(thisMonth)) thisMonthCount++;
      else futureCount++;
    }
    return { thisMonthCount, futureCount };
  }, [events]);

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'service': return 'bg-green-100 text-green-900';
      case 'maintenance': return 'bg-blue-100 text-blue-900';
      case 'meeting': return 'bg-purple-100 text-purple-900';
      case 'deadline': return 'bg-red-100 text-red-900';
      default: return 'bg-gray-100 text-gray-900';
    }
  };

  const getEventTypeLabel = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'service': return 'Servicio';
      case 'maintenance': return 'Mantenimiento';
      case 'meeting': return 'Reunión';
      case 'deadline': return 'Vencimiento';
      default: return 'Otro';
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      if (viewMode === 'day') {
        return direction === 'prev' ? addDays(prev, -1) : addDays(prev, 1);
      } else if (viewMode === 'week') {
        return direction === 'prev' ? addDays(prev, -7) : addDays(prev, 7);
      } else {
        const newMonth = direction === 'prev' ? subMonths(currentMonth, 1) : addMonths(currentMonth, 1);
        setCurrentMonth(newMonth);
        return prev;
      }
    });
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case 'day':
        return format(selectedDate, 'd MMMM yyyy', { locale: es });
      case 'week': {
        const weekStartVal = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEndVal = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStartVal, 'd MMM', { locale: es })} - ${format(weekEndVal, 'd MMM yyyy', { locale: es })}`;
      }
      case 'month':
        return format(currentMonth, 'MMMM yyyy', { locale: es });
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-foreground">Cargando calendario...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CalendarHeader onCreateEvent={createEvent} selectedDate={selectedDate} />

      {(upcomingCounts.thisMonthCount > 0 || upcomingCounts.futureCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-2 text-sm">
          <CalendarClock className="size-4 text-violet-600" />
          <span className="font-medium text-foreground">
            {upcomingCounts.thisMonthCount} servicio{upcomingCounts.thisMonthCount === 1 ? '' : 's'} programado{upcomingCounts.thisMonthCount === 1 ? '' : 's'} este mes
          </span>
          {upcomingCounts.futureCount > 0 && (
            <span className="text-muted-foreground">· {upcomingCounts.futureCount} en meses siguientes</span>
          )}
        </div>
      )}

      <CalendarControls 
        viewTitle={getViewTitle()}
        viewMode={viewMode}
        onNavigate={navigateDate}
        onViewModeChange={setViewMode}
      />

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-3">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-x-2 text-foreground">
                <CalendarIcon className="size-5 text-green-500" />
                <span>Vista {viewMode === 'day' ? 'Diaria' : viewMode === 'week' ? 'Semanal' : 'Mensual'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'month' && (
                <MonthView
                  currentMonth={currentMonth}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  getEventsForDate={getEventsForDate}
                  getEventTypeColor={getEventTypeColor}
                />
              )}
              {viewMode === 'week' && (
                <WeekView
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  getEventsForDate={getEventsForDate}
                  getEventTypeColor={getEventTypeColor}
                />
              )}
              {viewMode === 'day' && (
                <DayView
                  selectedDate={selectedDate}
                  getEventsForDate={getEventsForDate}
                  getEventTypeColor={getEventTypeColor}
                  getEventTypeLabel={getEventTypeLabel}
                  createEvent={createEvent}
                  deleteEvent={deleteEvent}
                  updateEvent={updateEvent}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Events Sidebar - only show in month and week view */}
        {(viewMode === 'month' || viewMode === 'week') && (
          <EventsSidebar
            selectedDate={selectedDate}
            getEventsForDate={getEventsForDate}
            getEventTypeColor={getEventTypeColor}
            getEventTypeLabel={getEventTypeLabel}
            createEvent={createEvent}
            deleteEvent={deleteEvent}
            updateEvent={updateEvent}
          />
        )}
      </div>  
    </div>
  );
};

export default Calendar;
