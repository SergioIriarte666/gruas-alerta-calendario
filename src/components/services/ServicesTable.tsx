
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, Edit, Trash2, Truck, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/contexts/UserContext';

interface ServicesTableProps {
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

export const ServicesTable = ({
  services,
  hasInitialServices,
  onViewDetails,
  onEdit,
  onDelete,
  onCloseService,
  onAddNewService,
}: ServicesTableProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Truck className="w-5 h-5 text-tms-green" />
          <span>Servicios Registrados ({services.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-tms-green" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {!hasInitialServices ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
            </h3>
            <p className="text-gray-400 mb-6">
              {!hasInitialServices
                ? 'Comienza agregando tu primer servicio de grúa'
                : 'Intenta ajustar los filtros de búsqueda'
              }
            </p>
            {!hasInitialServices && onAddNewService && (
              <Button 
                className="bg-tms-green hover:bg-tms-green-dark text-white"
                onClick={onAddNewService}
                title="Crear el primer servicio"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Servicio
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Folio</TableHead>
                  <TableHead className="text-gray-300">Fecha Servicio</TableHead>
                  <TableHead className="text-gray-300">Cliente</TableHead>
                  <TableHead className="text-gray-300">Vehículo</TableHead>
                  <TableHead className="text-gray-300">Origen/Destino</TableHead>
                  <TableHead className="text-gray-300">Grúa</TableHead>
                  <TableHead className="text-gray-300">Operador</TableHead>
                  <TableHead className="text-gray-300">Valor</TableHead>
                  <TableHead className="text-gray-300">Estado</TableHead>
                  <TableHead className="text-gray-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  // Check if vehicle info is available
                  const hasVehicleInfo = service.vehicleBrand && service.vehicleModel && service.licensePlate;
                  const isInvoiced = service.status === 'invoiced';
                  
                  return (
                    <TableRow key={service.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell className="font-medium text-tms-green">
                        {service.folio}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="font-medium">{service.client.name}</div>
                        <div className="text-sm text-gray-500">{service.client.rut}</div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {hasVehicleInfo ? (
                          <div>
                            <div className="font-medium">{service.vehicleBrand} {service.vehicleModel}</div>
                            <div className="text-sm text-gray-500">{service.licensePlate}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">
                            Sin vehículo específico
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300 max-w-48">
                        <div className="truncate">{service.origin}</div>
                        <div className="text-sm text-gray-500 truncate">→ {service.destination}</div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {service.crane.licensePlate}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {service.operator.name}
                      </TableCell>
                      <TableCell className="text-gray-300 font-medium">
                        {formatCurrency(service.value)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(service.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {/* Only show close button for pending/in_progress services */}
                          {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
                              onClick={() => onCloseService(service)}
                              title="Cerrar Servicio"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-tms-green hover:text-tms-green-light hover:bg-tms-green/10"
                            onClick={() => onViewDetails(service)}
                            title="Ver detalles del servicio"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {/* Administrators can edit invoiced services */}
                          {onEdit && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={isInvoiced && !isAdmin 
                                ? "text-gray-500 cursor-not-allowed" 
                                : "text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"}
                              onClick={() => onEdit(service)}
                              title={isInvoiced && !isAdmin 
                                ? "No se puede editar un servicio facturado" 
                                : isInvoiced && isAdmin 
                                  ? "⚠️ Editar servicio facturado (solo admin)" 
                                  : "Editar servicio"}
                              disabled={isInvoiced && !isAdmin}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {/* Delete button - disabled for invoiced services */}
                          {onDelete && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={isInvoiced 
                                ? "text-gray-500 cursor-not-allowed" 
                                : "text-red-400 hover:text-red-300 hover:bg-red-400/10"}
                              onClick={isInvoiced ? undefined : () => onDelete(service)}
                              title={isInvoiced 
                                ? "No se puede eliminar un servicio facturado" 
                                : "Eliminar servicio"}
                              disabled={isInvoiced}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
