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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <Truck className="h-8 w-8 text-primary" />
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
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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
          <Truck className="mr-2 h-5 w-5 text-primary" />
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

                <div className="flex items-center text-primary text-sm font-semibold">
                  <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{formatCurrency(getDisplayServiceValue(service))}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 border-success/30 bg-success-soft text-foreground hover:bg-success-soft/80"
                    onClick={() => onCloseService(service)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Cerrar
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                    className="flex-1 border-primary/30 bg-primary-soft text-foreground hover:bg-primary-soft/80"
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
                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground" 
                      : "border-info/30 bg-info-soft text-foreground hover:bg-info-soft/80"}`}
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
                      ? "cursor-not-allowed border-border bg-muted px-3 text-muted-foreground" 
                      : "border-danger/30 bg-danger-soft px-3 text-foreground hover:bg-danger-soft/80"}`}
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
