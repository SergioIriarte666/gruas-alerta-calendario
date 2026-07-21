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
import { toTitleCase } from '@/lib/utils';

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
        return <Wrench className="size-4 text-warning" />;
      case 'meeting':
        return <Users className="size-4 text-info" />;
      case 'service':
        return <CheckCircle className="size-4 text-success" />;
      default:
        return <Calendar className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default">Programado</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-success text-success-foreground">Completado</Badge>;
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
                <Clock className="size-3" />
                <span>{event.start_time} - {event.end_time}</span>
              </div>
              
              {event.client && (
                <div className="flex items-center gap-1">
                  <Users className="size-3" />
                  <span>Cliente: {toTitleCase(event.client.name)}</span>
                </div>
              )}
              
              {event.operator && (
                <div className="flex items-center gap-1">
                  <Users className="size-3" />
                  <span>Operador: {event.operator.name}</span>
                </div>
              )}
              
              {event.crane && (
                <div className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  <span>Grúa: {event.crane.brand} {event.crane.model}</span>
                </div>
              )}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewEvent?.(event)}>
            <Eye className="size-4" />
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
              <Calendar className="size-8 text-info" />
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
              <Wrench className="size-8 text-warning" />
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
              <Users className="size-8 text-info" />
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
              <CheckCircle className="size-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mantenimientos Programados */}
      {data.maintenances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5 text-warning" />
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
              <Users className="size-5 text-info" />
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
              <CheckCircle className="size-5 text-success" />
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
              <Calendar className="size-5 text-muted-foreground" />
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
              <Calendar className="size-5 text-primary" />
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
                            <Clock className="size-3" />
                            <span>{event.start_time} - {event.end_time}</span>
                          </div>
                          
                          {event.client && (
                            <div className="flex items-center gap-1">
                              <Users className="size-3" />
                              <span>Cliente: {toTitleCase(event.client.name)}</span>
                            </div>
                          )}
                          
                          {event.operator && (
                            <div className="flex items-center gap-1">
                              <Users className="size-3" />
                              <span>Operador: {event.operator.name}</span>
                            </div>
                          )}
                          
                          {event.crane && (
                            <div className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              <span>Grúa: {event.crane.brand} {event.crane.model}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={() => onViewEvent?.(event)}>
                        <Eye className="size-4" />
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
