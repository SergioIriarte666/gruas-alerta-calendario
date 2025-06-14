
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useCalendar, CalendarEvent } from '@/hooks/useCalendar';
import { EventModal } from '@/components/calendar/EventModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addDays, startOfDay, endOfDay } from 'date-fns';
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
      case 'service': return 'bg-tms-green text-white';
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

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => {
      if (viewMode === 'day') {
        return direction === 'prev' ? addDays(prev, -1) : addDays(prev, 1);
      } else if (viewMode === 'week') {
        return direction === 'prev' ? addDays(prev, -7) : addDays(prev, 7);
      } else {
        return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
      }
    });
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div>
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const dayEvents = getEventsForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`
                  min-h-24 p-2 border border-gray-700 rounded-lg cursor-pointer transition-colors
                  ${isSelected ? 'bg-tms-green/20 border-tms-green' : 'hover:bg-white/5'}
                  ${isDayToday ? 'border-tms-green' : ''}
                `}
                onClick={() => setSelectedDate(day)}
              >
                <div className={`
                  text-sm font-medium mb-1
                  ${isDayToday ? 'text-tms-green' : 'text-gray-300'}
                `}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className={`
                        text-xs px-1 py-0.5 rounded truncate
                        ${getEventTypeColor(event.type)}
                      `}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{dayEvents.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-400">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const dayEvents = getEventsForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`
                  min-h-32 p-2 border border-gray-700 rounded-lg cursor-pointer transition-colors
                  ${isSelected ? 'bg-tms-green/20 border-tms-green' : 'hover:bg-white/5'}
                  ${isDayToday ? 'border-tms-green' : ''}
                `}
                onClick={() => setSelectedDate(day)}
              >
                <div className={`
                  text-sm font-medium mb-2
                  ${isDayToday ? 'text-tms-green' : 'text-gray-300'}
                `}>
                  {format(day, 'd MMM', { locale: es })}
                </div>
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      className={`
                        text-xs px-1 py-0.5 rounded truncate
                        ${getEventTypeColor(event.type)}
                      `}
                      title={`${event.title} - ${event.startTime}`}
                    >
                      {event.startTime} {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(selectedDate).sort((a, b) => 
      a.startTime.localeCompare(b.startTime)
    );

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-white mb-2">
            {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
          </h3>
        </div>
        
        {dayEvents.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-400 mb-4">No hay eventos programados para este día</p>
            <EventModal onCreateEvent={createEvent} selectedDate={selectedDate} />
          </div>
        ) : (
          <div className="space-y-3">
            {dayEvents.map(event => (
              <div key={event.id} className="p-4 rounded-lg bg-white/5 border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white text-lg">{event.title}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">{event.startTime} - {event.endTime}</span>
                    </div>
                  </div>
                  <Badge className={getEventTypeColor(event.type)}>
                    {getEventTypeLabel(event.type)}
                  </Badge>
                </div>
                {event.description && (
                  <p className="text-gray-300 text-sm">{event.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case 'day':
        return format(selectedDate, 'd MMMM yyyy', { locale: es });
      case 'week':
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
        return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendario Centralizado</h1>
          <p className="text-gray-400 mt-2">
            Vista integrada de servicios, vencimientos y eventos importantes
          </p>
        </div>
        <EventModal onCreateEvent={createEvent} selectedDate={selectedDate} />
      </div>

      {/* Calendar Controls */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-700 text-gray-300"
                onClick={() => {
                  if (viewMode === 'month') {
                    navigateMonth('prev');
                  } else {
                    navigateDate('prev');
                  }
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold text-white min-w-64 text-center">
                {getViewTitle()}
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-700 text-gray-300"
                onClick={() => {
                  if (viewMode === 'month') {
                    navigateMonth('next');
                  } else {
                    navigateDate('next');
                  }
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant={viewMode === 'day' ? 'default' : 'outline'} 
                size="sm" 
                className={viewMode === 'day' ? 'bg-tms-green hover:bg-tms-green-dark text-white' : 'border-gray-700 text-gray-300'}
                onClick={() => setViewMode('day')}
              >
                Día
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'default' : 'outline'} 
                size="sm" 
                className={viewMode === 'week' ? 'bg-tms-green hover:bg-tms-green-dark text-white' : 'border-gray-700 text-gray-300'}
                onClick={() => setViewMode('week')}
              >
                Semana
              </Button>
              <Button 
                variant={viewMode === 'month' ? 'default' : 'outline'} 
                size="sm" 
                className={viewMode === 'month' ? 'bg-tms-green hover:bg-tms-green-dark text-white' : 'border-gray-700 text-gray-300'}
                onClick={() => setViewMode('month')}
              >
                Mes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-3">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <CalendarIcon className="w-5 h-5 text-tms-green" />
                <span>Vista {viewMode === 'day' ? 'Diaria' : viewMode === 'week' ? 'Semanal' : 'Mensual'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && renderWeekView()}
              {viewMode === 'day' && renderDayView()}
            </CardContent>
          </Card>
        </div>

        {/* Events for selected date - only show in month and week view */}
        {(viewMode === 'month' || viewMode === 'week') && (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white">
                  Eventos del {format(selectedDate, 'd MMMM', { locale: es })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getEventsForDate(selectedDate).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">
                      No hay eventos programados para este día
                    </p>
                    <EventModal onCreateEvent={createEvent} selectedDate={selectedDate} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getEventsForDate(selectedDate).map(event => (
                      <div key={event.id} className="p-3 rounded-lg bg-white/5 border border-gray-700">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-white text-sm">{event.title}</h4>
                          <Badge className={getEventTypeColor(event.type)}>
                            {getEventTypeLabel(event.type)}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-gray-400 text-xs mb-2">{event.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Event Legend */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-white text-sm">Tipos de Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { type: 'service' as const, label: 'Servicios' },
                    { type: 'maintenance' as const, label: 'Mantenimiento' },
                    { type: 'meeting' as const, label: 'Reuniones' },
                    { type: 'deadline' as const, label: 'Vencimientos' }
                  ].map(({ type, label }) => (
                    <div key={type} className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded ${getEventTypeColor(type)}`} />
                      <span className="text-gray-300 text-sm">{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
