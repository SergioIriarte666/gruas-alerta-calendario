import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar,
  Clock,
  Users,
  Wrench,
  CheckCircle,
  Eye,
  MapPin
} from 'lucide-react';
import { formatForDisplayShort } from '@/utils/timezoneUtils';

interface CalendarSectionProps {
  data?: {
    events: any[];
    maintenances: any[];
    inspections: any[];
    meetings: any[];
    weekEvents: any[];
    total: number;
  } | null;
  onViewEvent?: (event: any) => void;
}

export const CalendarSection = ({ data, onViewEvent }: CalendarSectionProps) => {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">No hay datos del calendario disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-orange-500" />;
      case 'meeting':
        return <Users className="w-4 h-4 text-blue-500" />;
      case 'service':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Calendar className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default">Programado</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const EventCard = ({ event }: { event: any }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getEventIcon(event.type)}
              <span className="font-medium">{event.title}</span>
              {getStatusBadge(event.status)}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{event.start_time} - {event.end_time}</span>
              </div>
              
              {event.client && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>Cliente: {event.client.name}</span>
                </div>
              )}
              
              {event.operator && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>Operador: {event.operator.name}</span>
                </div>
              )}
              
              {event.crane && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>Grúa: {event.crane.brand} {event.crane.model}</span>
                </div>
              )}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewEvent?.(event)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Eventos</p>
                <p className="text-2xl font-bold">{data.total}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mantenimientos</p>
                <p className="text-2xl font-bold">{data.maintenances.length}</p>
              </div>
              <Wrench className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reuniones</p>
                <p className="text-2xl font-bold">{data.meetings.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inspecciones</p>
                <p className="text-2xl font-bold">{data.inspections.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mantenimientos Programados */}
      {data.maintenances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              Mantenimientos Programados
              <Badge variant="outline">{data.maintenances.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.maintenances.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reuniones */}
      {data.meetings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Reuniones
              <Badge variant="outline">{data.meetings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.meetings.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inspecciones */}
      {data.inspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Inspecciones
              <Badge variant="outline">{data.inspections.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.inspections.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Otros Eventos */}
      {data.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              Otros Eventos
              <Badge variant="outline">{data.events.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Eventos de la Semana */}
      {data.weekEvents && data.weekEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Eventos de la Semana
              <Badge variant="outline">{data.weekEvents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.weekEvents.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getEventIcon(event.type)}
                          <span className="font-medium">{event.title}</span>
                          {getStatusBadge(event.status)}
                          <Badge variant="secondary" className="text-xs">
                            {formatForDisplayShort(event.date)}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{event.start_time} - {event.end_time}</span>
                          </div>
                          
                          {event.client && (
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span>Cliente: {event.client.name}</span>
                            </div>
                          )}
                          
                          {event.operator && (
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              <span>Operador: {event.operator.name}</span>
                            </div>
                          )}
                          
                          {event.crane && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>Grúa: {event.crane.brand} {event.crane.model}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={() => onViewEvent?.(event)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sin eventos */}
      {data.total === 0 && (!data.weekEvents || data.weekEvents.length === 0) && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              No hay eventos programados para este día ni para la semana
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};