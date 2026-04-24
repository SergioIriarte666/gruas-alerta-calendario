import { Service } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Trash2, Truck, Check, Calendar, MapPin, User, DollarSign } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { useUser } from '@/contexts/UserContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { shouldShowVehicleInfo, formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { cn, toTitleCase } from '@/lib/utils';

interface ServicesMobileViewProps {
  services: Service[];
  hasInitialServices: boolean;
  onViewDetails: (service: Service) => void;
  onEdit?: (service: Service) => void;
  onDelete?: (service: Service) => void;
  onCloseService?: (service: Service) => void;
  onAddNewService?: () => void;
  sortField?: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status' | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status') => void;
}

export const ServicesMobileView = ({
  services,
  hasInitialServices,
  onViewDetails,
  onEdit,
  onDelete,
  onCloseService,
  onAddNewService,
  sortField,
  sortDirection,
  onSort,
}: ServicesMobileViewProps) => {
  const { user } = useUser();
  const { isMobile, isTablet } = useDeviceType();
  const isAdmin = user?.role === 'admin';

  if (services.length === 0) {
    return (
      <div className=" text-center py-12">
        <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Truck className="w-8 h-8 text-tms-green" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {!hasInitialServices ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
        </h3>
        <p className="text-muted-foreground mb-6">
          {!hasInitialServices
            ? 'Comienza agregando tu primer servicio de grúa'
            : 'Intenta ajustar los filtros de búsqueda'
          }
        </p>
        {!hasInitialServices && onAddNewService && (
          <Button 
            className="bg-tms-green hover:bg-tms-green-dark text-black"
            onClick={onAddNewService}
            title="Crear el primer servicio"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Primer Servicio
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className=" space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center">
          <Truck className="w-5 h-5 text-tms-green mr-2" />
          Servicios ({services.length})
        </h3>
      </div>

      {services.map((service) => {
        const isInvoiced = service.status === 'invoiced';
        
        return (
          <Card key={service.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="mb-1"><Badge variant="tms" className="whitespace-nowrap" title={`Folio: ${service.folio}`}>#{service.folio}</Badge></div>
                <p className="text-foreground font-medium">{toTitleCase(service.client.name)}</p>
                <p className="text-muted-foreground text-sm">{service.client.department} • {service.client.rut}</p>
                </div>
                {getServiceStatusBadge(service.status)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-foreground text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>{formatForDisplay(parseFromDatabase(service.serviceDate))}</span>
                </div>

                {shouldShowVehicleInfo(service) && (
                  <div className="flex items-center text-foreground text-sm">
                    <Truck className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span>{formatVehicleInfo(service)}</span>
                  </div>
                )}

                <div className="flex items-start text-foreground text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="truncate">{service.origin}</div>
                    <div className="text-muted-foreground text-xs">→ {service.destination}</div>
                  </div>
                </div>

                <div className="flex items-center text-foreground text-sm">
                  <User className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>{service.operator?.name || 'Sin asignar'} • {service.crane?.licensePlate || 'Sin grúa'}</span>
                </div>

                <div className="flex items-center text-tms-green text-sm font-semibold">
                  <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{formatCurrency(getDisplayServiceValue(service))}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500"
                    onClick={() => onCloseService(service)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Cerrar
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 border-tms-green/50 bg-tms-green/10 text-tms-green hover:bg-tms-green/20 hover:border-tms-green"
                  onClick={() => onViewDetails(service)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver
                </Button>
                
                {onEdit && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`flex-1 ${isInvoiced && !isAdmin 
                      ? "border-gray-600 bg-gray-600/10 text-gray-500 cursor-not-allowed" 
                      : "border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500"}`}
                    onClick={() => onEdit(service)}
                    disabled={isInvoiced && !isAdmin}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                )}
                
                {onDelete && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`${isInvoiced 
                      ? "border-gray-600 bg-gray-600/10 text-gray-500 cursor-not-allowed px-3" 
                      : "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500 px-3"}`}
                    onClick={isInvoiced ? undefined : () => onDelete(service)}
                    disabled={isInvoiced}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
