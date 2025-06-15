import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon } from 'lucide-react';
import { useCalendar, CalendarEvent } from '@/hooks/useCalendar';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { CalendarControls } from '@/components/calendar/CalendarControls';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { EventsSidebar } from '@/components/calendar/EventsSidebar';
import { format, addMonths, subMonths, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

const Calendar = () => {
  const { 
    events, 
    loading, 
    selectedDate, 
    setSelectedDate, 
    viewMode, 
    setViewMode,
    createEvent,
    getEventsForDate 
  } = useCalendar();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'service': return 'bg-green-500 text-white';
      case 'maintenance': return 'bg-blue-500 text-white';
      case 'meeting': return 'bg-purple-500 text-white';
      case 'deadline': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
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
      case 'week':
        const weekStartVal = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const weekEndVal = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return `${format(weekStartVal, 'd MMM', { locale: es })} - ${format(weekEndVal, 'd MMM yyyy', { locale: es })}`;
      case 'month':
        return format(currentMonth, 'MMMM yyyy', { locale: es });
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-white">Cargando calendario...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CalendarHeader onCreateEvent={createEvent} selectedDate={selectedDate} />

      <CalendarControls 
        viewTitle={getViewTitle()}
        viewMode={viewMode}
        onNavigate={navigateDate}
        onViewModeChange={setViewMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-3">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <CalendarIcon className="w-5 h-5 text-green-500" />
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
          />
        )}
      </div>  
    </div>
  );
};

export default Calendar;
