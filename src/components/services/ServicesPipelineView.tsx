import React, { useState, useMemo } from 'react';
import { Service, ServiceStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Calendar,
  MapPin,
  User,
  Truck,
  DollarSign,
  Clock,
  Eye,
  Edit,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { ServicesPipelineMetrics } from './ServicesPipelineMetrics';
import { toTitleCase } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';

interface ServiceGroup {
  status: ServiceStatus;
  title: string;
  description: string;
  color: string;
  services: Service[];
  totalValue: number;
  avgDays: number;
}

interface ServicesPipelineViewProps {
  services: Service[];
  hasInitialServices: boolean;
  onViewDetails: (service: Service) => void;
  onEdit?: (service: Service) => void;
  onDelete?: (id: string) => void;
  onCloseService: (service: Service) => void;
  onAddNewService?: () => void;
}

const PIPELINE_STATUSES: Array<{
  status: ServiceStatus;
  title: string;
  description: string;
  color: string;
}> = [
  {
    status: 'quoted',
    title: 'Cotizados',
    description: 'Servicios con cotización enviada',
    color: 'border-info/20 bg-info/10 text-info'
  },
  {
    status: 'purchase_order_pending',
    title: 'Esperando O.C.',
    description: 'Pendientes de orden de compra',
    color: 'border-warning/20 bg-warning/10 text-warning'
  },
  {
    status: 'with_purchase_order',
    title: 'Con Orden de Compra',
    description: 'Confirmados con O.C.',
    color: 'border-success/20 bg-success/10 text-success'
  },
  {
    status: 'pending',
    title: 'Pendientes',
    description: 'Listos para ejecutar',
    color: 'border-primary/20 bg-primary/10 text-primary'
  },
  {
    status: 'in_progress',
    title: 'En Progreso',
    description: 'Servicios en ejecución',
    color: 'border-warning/20 bg-warning/10 text-warning'
  },
  {
    status: 'completed',
    title: 'Completados',
    description: 'Servicios terminados',
    color: 'border-success/20 bg-success/10 text-success'
  },
  {
    status: 'failed',
    title: 'Fallidos',
    description: 'Servicios fallidos por cliente',
    color: 'border-danger/20 bg-danger/10 text-danger'
  },
  {
    status: 'invoiced',
    title: 'Facturados',
    description: 'Servicios facturados',
    color: 'border-border/70 bg-muted/40 text-muted-foreground'
  }
];

export const ServicesPipelineView: React.FC<ServicesPipelineViewProps> = ({
  services,
  hasInitialServices,
  onViewDetails,
  onEdit,
  onDelete,
  onCloseService,
  onAddNewService
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<ServiceStatus>>(
    new Set(['quoted', 'purchase_order_pending', 'with_purchase_order', 'pending', 'in_progress'])
  );

  const serviceGroups: ServiceGroup[] = useMemo(() => {
    const filteredServices = services.filter(service =>
      service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.destination.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return PIPELINE_STATUSES.map(statusConfig => {
      const statusServices = filteredServices.filter(service => service.status === statusConfig.status);
      
      const totalValue = statusServices.reduce((sum, service) => sum + getDisplayServiceValue(service), 0);
      
      // Calcular promedio de días desde la fecha de servicio
      const avgDays = statusServices.length > 0 ? Math.round(
        statusServices.reduce((sum, service) => {
          const daysSince = Math.floor(
            (businessClock.todayDate().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + Math.max(0, daysSince);
        }, 0) / statusServices.length
      ) : 0;

      return {
        status: statusConfig.status,
        title: statusConfig.title,
        description: statusConfig.description,
        color: statusConfig.color,
        services: statusServices,
        totalValue,
        avgDays
      };
    });
  }, [services, searchTerm]);

  const toggleGroup = (status: ServiceStatus) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  if (!hasInitialServices) {
    return (
      <Card className="services-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="text-center py-12">
          <div className="mb-4 text-muted-foreground">
            <Calendar className="size-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No hay servicios registrados</h3>
            <p className="mt-2 text-sm">Crea tu primer servicio para comenzar</p>
          </div>
          {onAddNewService && (
            <Button onClick={onAddNewService} className="mt-4">
              Crear Primer Servicio
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="services-pipeline space-y-6">
      {/* Métricas del Pipeline */}
      <ServicesPipelineMetrics services={services} />

      {/* Filtros */}
      <Card className="services-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Buscar por folio, cliente, origen o destino..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border/70 bg-background/60 pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Groups */}
      <div className="space-y-4">
        {serviceGroups.map((group) => (
          <Card key={group.status} className="services-panel border-border/70 bg-card/80 shadow-sm">
            <Collapsible
              open={expandedGroups.has(group.status)}
              onOpenChange={() => toggleGroup(group.status)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer transition-colors hover:bg-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-3">
                      {expandedGroups.has(group.status) ? (
                        <ChevronDown className="size-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-5 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="flex items-center gap-x-2 text-lg text-foreground">
                          <span>{group.title}</span>
                          <Badge className={group.color}>
                            {group.services.length}
                          </Badge>
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold text-foreground">
                        ${group.totalValue.toLocaleString()}
                      </div>
                      {group.avgDays > 0 && (
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="size-3 mr-1" />
                          {group.avgDays} días prom.
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {group.services.length > 0 ? (
                    <div className="space-y-2">
                      {group.services.map((service) => (
                        <div 
                          key={service.id} 
                          className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 p-4 transition-colors hover:bg-accent/20"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-foreground">
                                Folio: {service.folio}
                              </div>
                              <div className="flex items-center text-muted-foreground">
                                <User className="size-3 mr-1" />
                                {toTitleCase(service.client.name)}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center text-muted-foreground">
                                <MapPin className="size-3 mr-1" />
                                {service.origin}
                              </div>
                              <div className="text-muted-foreground">
                                → {service.destination}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center text-muted-foreground">
                                <Calendar className="size-3 mr-1" />
                                {formatForDisplay(service.serviceDate)}
                              </div>
                              <div className="flex items-center text-muted-foreground">
                                <Truck className="size-3 mr-1" />
                                {service.crane?.licensePlate || 'Sin asignar'}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center font-semibold text-foreground">
                                <DollarSign className="size-3 mr-1" />
                                ${getDisplayServiceValue(service).toLocaleString()}
                              </div>
                              <div className="text-muted-foreground">
                                {service.serviceType.name}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-x-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onViewDetails(service)}
                              title="Ver detalles"
                            >
                              <Eye className="size-4" />
                            </Button>
                            {onEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(service)}
                                title="Editar servicio"
                              >
                                <Edit className="size-4" />
                              </Button>
                            )}
                            {(service.status === 'pending' || service.status === 'in_progress') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onCloseService(service)}
                                title="Cerrar servicio"
                                className="border-success/30 bg-success/10 text-success hover:bg-success/20"
                              >
                                <CheckCircle className="size-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDelete(service.id)}
                                title="Eliminar servicio"
                                className="border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      <p>No hay servicios en este estado</p>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
};
