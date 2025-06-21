
import { Service } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Trash2, Truck, Check, Calendar, MapPin, User, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/contexts/UserContext';

interface ServicesMobileViewProps {
  services: Service[];
  hasInitialServices: boolean;
  onViewDetails: (service: Service) => void;
  onEdit?: (service: Service) => void;
  onDelete?: (service: Service) => void;
  onCloseService?: (service: Service) => void;
  onAddNewService?: () => void;
}

const getStatusBadge = (status: Service['status']) => {
  const statusConfig = {
    pending: { label: 'Pendiente', className: 'bg-yellow-500 text-white' },
    in_progress: { label: 'En Progreso', className: 'bg-blue-500 text-white' },
    completed: { label: 'Completado', className: 'bg-green-500 text-white' },
    cancelled: { label: 'Cancelado', className: 'bg-red-500 text-white' },
    invoiced: { label: 'Facturado', className: 'bg-purple-500 text-white' }
  };
  const config = statusConfig[status] || { label: 'Desconocido', className: 'bg-gray-500 text-white' };
  return <Badge className={config.className}>{config.label}</Badge>;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

export const ServicesMobileView = ({
  services,
  hasInitialServices,
  onViewDetails,
  onEdit,
  onDelete,
  onCloseService,
  onAddNewService,
}: ServicesMobileViewProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Truck className="w-8 h-8 text-tms-green" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">
          {!hasInitialServices ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
        </h3>
        <p className="text-white mb-6">
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
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Truck className="w-5 h-5 text-tms-green mr-2" />
          Servicios ({services.length})
        </h3>
      </div>

      {services.map((service) => {
        const hasVehicleInfo = service.vehicleBrand && service.vehicleModel && service.licensePlate;
        const isInvoiced = service.status === 'invoiced';
        
        return (
          <Card key={service.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-tms-green text-lg">#{service.folio}</h4>
                  <p className="text-white font-medium">{service.client.name}</p>
                  <p className="text-white/70 text-sm">{service.client.rut}</p>
                </div>
                {getStatusBadge(service.status)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-white text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span>{format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}</span>
                </div>

                {hasVehicleInfo ? (
                  <div className="flex items-center text-white text-sm">
                    <Truck className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{service.vehicleBrand} {service.vehicleModel}</span>
                      <span className="text-white/70 ml-1">({service.licensePlate})</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-white/70 text-sm italic">
                    <Truck className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                    <span>Sin vehículo específico</span>
                  </div>
                )}

                <div className="flex items-start text-white text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="truncate">{service.origin}</div>
                    <div className="text-white/70 text-xs">→ {service.destination}</div>
                  </div>
                </div>

                <div className="flex items-center text-white text-sm">
                  <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span>{service.operator.name} • {service.crane.licensePlate}</span>
                </div>

                <div className="flex items-center text-tms-green text-sm font-semibold">
                  <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{formatCurrency(service.value)}</span>
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
