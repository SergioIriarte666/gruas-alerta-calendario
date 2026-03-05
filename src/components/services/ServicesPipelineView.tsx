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
    color: 'bg-blue-50 border-blue-200 text-blue-800'
  },
  {
    status: 'purchase_order_pending',
    title: 'Esperando O.C.',
    description: 'Pendientes de orden de compra',
    color: 'bg-amber-50 border-amber-200 text-amber-800'
  },
  {
    status: 'with_purchase_order',
    title: 'Con Orden de Compra',
    description: 'Confirmados con O.C.',
    color: 'bg-green-50 border-green-200 text-green-800'
  },
  {
    status: 'pending',
    title: 'Pendientes',
    description: 'Listos para ejecutar',
    color: 'bg-purple-50 border-purple-200 text-purple-800'
  },
  {
    status: 'in_progress',
    title: 'En Progreso',
    description: 'Servicios en ejecución',
    color: 'bg-orange-50 border-orange-200 text-orange-800'
  },
  {
    status: 'completed',
    title: 'Completados',
    description: 'Servicios terminados',
    color: 'bg-teal-50 border-teal-200 text-teal-800'
  },
  {
    status: 'failed',
    title: 'Fallidos',
    description: 'Servicios fallidos por cliente',
    color: 'bg-orange-50 border-orange-200 text-orange-800'
  },
  {
    status: 'invoiced',
    title: 'Facturados',
    description: 'Servicios facturados',
    color: 'bg-gray-50 border-gray-200 text-gray-800'
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
            (new Date().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
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
      <Card className="bg-white">
        <CardContent className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No hay servicios registrados</h3>
            <p className="text-sm mt-2">Crea tu primer servicio para comenzar</p>
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
    <div className="space-y-6">
      {/* Métricas del Pipeline */}
      <ServicesPipelineMetrics services={services} />

      {/* Filtros */}
      <Card className="bg-white">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por folio, cliente, origen o destino..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Groups */}
      <div className="space-y-4">
        {serviceGroups.map((group) => (
          <Card key={group.status} className="bg-white">
            <Collapsible
              open={expandedGroups.has(group.status)}
              onOpenChange={() => toggleGroup(group.status)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {expandedGroups.has(group.status) ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <div>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <span>{group.title}</span>
                          <Badge className={group.color}>
                            {group.services.length}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold text-gray-900">
                        ${group.totalValue.toLocaleString()}
                      </div>
                      {group.avgDays > 0 && (
                        <div className="text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
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
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="font-medium text-gray-900">
                                Folio: {service.folio}
                              </div>
                              <div className="text-gray-600 flex items-center">
                                <User className="w-3 h-3 mr-1" />
                                {toTitleCase(service.client.name)}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-600 flex items-center">
                                <MapPin className="w-3 h-3 mr-1" />
                                {service.origin}
                              </div>
                              <div className="text-gray-600">
                                → {service.destination}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-600 flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatForDisplay(service.serviceDate)}
                              </div>
                              <div className="text-gray-600 flex items-center">
                                <Truck className="w-3 h-3 mr-1" />
                                {service.crane?.licensePlate || 'Sin asignar'}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 flex items-center">
                                <DollarSign className="w-3 h-3 mr-1" />
                                ${getDisplayServiceValue(service).toLocaleString()}
                              </div>
                              <div className="text-gray-600">
                                {service.serviceType.name}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onViewDetails(service)}
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {onEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onEdit(service)}
                                title="Editar servicio"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {service.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onCloseService(service)}
                                title="Cerrar servicio"
                                className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDelete(service.id)}
                                title="Eliminar servicio"
                                className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
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