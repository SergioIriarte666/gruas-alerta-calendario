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
    overdueWithoutPO: any[];
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
        return <Badge variant="default" className="bg-success text-success-foreground">Completado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const ServiceCard = ({ service, tone = 'default' }: { service: any; tone?: 'default' | 'danger' | 'success' }) => (
    <Card className={tone === 'danger' ? 'border-danger/30 bg-danger/5' : tone === 'success' ? 'border-success/30 bg-success/5' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-muted-foreground" />
              <span className="font-medium">{service.folio}</span>
              {getStatusBadge(service.status)}
              {tone === 'danger' && <AlertTriangle className="size-4 text-danger" />}
              {tone === 'success' && <CheckCircle className="size-4 text-success" />}
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
            <Eye className="size-4" />
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
            <Calendar className="size-5 text-info" />
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

      {/* Servicios Completados SIN Orden de Compra (CRÍTICO) */}
      {data.overdueWithoutPO && data.overdueWithoutPO.length > 0 && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" />
              ⚠️ Servicios Completados SIN Orden de Compra
              <Badge className="bg-warning text-warning-foreground">
                {data.overdueWithoutPO.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <div className="px-6 pb-2 text-sm font-medium text-warning">
            ⚠️ Estos servicios NO pueden facturarse hasta obtener la Orden de Compra del cliente
          </div>
          <CardContent>
            <div className="space-y-3">
              {data.overdueWithoutPO.map((service) => (
                <Card key={service.id} className="border-warning/30 bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="size-4 text-warning" />
                          <span className="font-medium">{service.folio}</span>
                          {getStatusBadge(service.status)}
                          <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                            Sin O.C.
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Cliente:</strong> {service.client?.name || 'N/A'}</p>
                          <p><strong>Fecha:</strong> {service.service_date}</p>
                          {service.operator && <p><strong>Operador:</strong> {service.operator.name}</p>}
                          {service.crane && <p><strong>Grúa:</strong> {service.crane.brand} {service.crane.model}</p>}
                          {service.service_type && <p><strong>Tipo:</strong> {service.service_type.name}</p>}
                          <p><strong>Valor:</strong> {formatCurrency(service.value)}</p>
                          <div className="mt-2 rounded border border-warning/30 bg-warning-soft p-2">
                            <p className="text-xs font-medium text-warning">
                              ⚠️ Acción requerida: Solicitar O.C. al cliente
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={() => onViewService?.(service)}>
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

      {/* Servicios Listos para Facturar (Con O.C.) */}
      {data.overdue && data.overdue.length > 0 && (
        <Card className="border-success/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="size-5" />
              ✅ Servicios Listos para Facturar (Con O.C.)
              <Badge className="bg-success text-success-foreground">{data.overdue.length}</Badge>
            </CardTitle>
          </CardHeader>
          <div className="px-6 pb-2 text-sm text-success">
            ✅ Servicios completados con Orden de Compra, listos para incluir en factura
          </div>
          <CardContent>
            <div className="space-y-3">
              {data.overdue.map((service) => (
                <ServiceCard key={service.id} service={service} tone="success" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servicios Pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-warning" />
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
            <Calendar className="size-5 text-info" />
            Próximos 7 Días
            <Badge variant="outline">{data.nextWeek.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.nextWeek.length > 0 ? (
            <div className="space-y-3">
              {data.nextWeek.slice(0, 5).map((service) => (
                <Card key={service.id} className="border-info/30">
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
                    <Eye className="size-4" />
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
