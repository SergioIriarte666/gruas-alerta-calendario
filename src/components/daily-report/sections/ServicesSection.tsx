import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Truck
} from 'lucide-react';

interface ServicesSectionProps {
  data?: {
    scheduled: any[];
    pending: any[];
    overdue: any[];
    nextWeek: any[];
    total: number;
  } | null;
  onViewService?: (service: any) => void;
}

export const ServicesSection = ({ data, onViewService }: ServicesSectionProps) => {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">No hay datos de servicios disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default">Programado</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'in_progress':
        return <Badge variant="outline">En Progreso</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const ServiceCard = ({ service, showAlert = false }: { service: any; showAlert?: boolean }) => (
    <Card className={`${showAlert ? 'border-red-200 bg-red-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{service.folio}</span>
              {getStatusBadge(service.status)}
              {showAlert && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Cliente:</strong> {service.client?.name || 'N/A'}</p>
              <p><strong>Fecha:</strong> {service.service_date}</p>
              {service.operator && <p><strong>Operador:</strong> {service.operator.name}</p>}
              {service.crane && <p><strong>Grúa:</strong> {service.crane.brand} {service.crane.model}</p>}
              {service.service_type && <p><strong>Tipo:</strong> {service.service_type.name}</p>}
              <p><strong>Valor:</strong> {formatCurrency(service.value)}</p>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewService?.(service)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Servicios Programados para Hoy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Servicios Programados Hoy
            <Badge variant="outline">{data.scheduled.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.scheduled.length > 0 ? (
            <div className="space-y-3">
              {data.scheduled.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No hay servicios programados para hoy
            </p>
          )}
        </CardContent>
      </Card>

      {/* Servicios Atrasados */}
      {data.overdue.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Servicios Atrasados
              <Badge variant="destructive">{data.overdue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.overdue.map((service) => (
                <ServiceCard key={service.id} service={service} showAlert />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servicios Pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" />
            Servicios Pendientes
            <Badge variant="secondary">{data.pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.pending.length > 0 ? (
            <div className="space-y-3">
              {data.pending.slice(0, 5).map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
              {data.pending.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  y {data.pending.length - 5} servicios más...
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No hay servicios pendientes
            </p>
          )}
        </CardContent>
      </Card>

      {/* Próximos 7 días */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            Próximos 7 Días
            <Badge variant="outline">{data.nextWeek.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.nextWeek.length > 0 ? (
            <div className="space-y-3">
              {data.nextWeek.slice(0, 5).map((service) => (
                <Card key={service.id} className="border-green-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{service.folio}</span>
                          {getStatusBadge(service.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>{service.client?.name}</strong> - {service.service_date}
                        </p>
                      </div>
                  <Button variant="ghost" size="sm" onClick={() => onViewService?.(service)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {data.nextWeek.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  y {data.nextWeek.length - 5} servicios más...
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No hay servicios programados para los próximos 7 días
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};