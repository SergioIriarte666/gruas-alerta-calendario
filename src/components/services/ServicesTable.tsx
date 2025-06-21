import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, Edit, Trash2, Truck, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ServicesMobileView } from './ServicesMobileView';
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
    pending: {
      label: 'Pendiente',
      className: 'bg-yellow-500 text-white'
    },
    in_progress: {
      label: 'En Progreso',
      className: 'bg-blue-500 text-white'
    },
    completed: {
      label: 'Completado',
      className: 'bg-green-500 text-white'
    },
    cancelled: {
      label: 'Cancelado',
      className: 'bg-red-500 text-white'
    },
    invoiced: {
      label: 'Facturado',
      className: 'bg-purple-500 text-white'
    }
  };
  const config = statusConfig[status] || {
    label: 'Desconocido',
    className: 'bg-gray-500 text-white'
  };
  return <Badge className="">{config.label}</Badge>;
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
  onAddNewService
}: ServicesTableProps) => {
  const {
    user
  } = useUser();
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();

  // Render mobile view if on mobile device
  if (isMobile) {
    return <Card className="glass-card tms-text-white">
        <CardContent className="p-4">
          <ServicesMobileView services={services} hasInitialServices={hasInitialServices} onViewDetails={onViewDetails} onEdit={onEdit} onDelete={onDelete} onCloseService={onCloseService} onAddNewService={onAddNewService} />
        </CardContent>
      </Card>;
  }

  // Desktop view (unchanged functionality)
  return <Card className="glass-card tms-text-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Truck className="w-5 h-5 text-tms-green" />
          <span className="text-white">Servicios Registrados ({services.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="tms-text-white">
        {services.length === 0 ? <div className="text-center py-12">
            <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-tms-green" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {!hasInitialServices ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
            </h3>
            <p className="text-white mb-6">
              {!hasInitialServices ? 'Comienza agregando tu primer servicio de grúa' : 'Intenta ajustar los filtros de búsqueda'}
            </p>
            {!hasInitialServices && onAddNewService && <Button className="bg-tms-green hover:bg-tms-green-dark text-black" onClick={onAddNewService} title="Crear el primer servicio">
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Servicio
              </Button>}
          </div> : <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-white">Folio</TableHead>
                  <TableHead className="text-white">Fecha Servicio</TableHead>
                  <TableHead className="text-white">Cliente</TableHead>
                  <TableHead className="text-white">Vehículo</TableHead>
                  <TableHead className="text-white">Origen/Destino</TableHead>
                  <TableHead className="text-white">Grúa</TableHead>
                  <TableHead className="text-white">Operador</TableHead>
                  <TableHead className="text-white">Valor</TableHead>
                  <TableHead className="text-white">Estado</TableHead>
                  <TableHead className="text-white min-w-[140px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map(service => {
              const hasVehicleInfo = service.vehicleBrand && service.vehicleModel && service.licensePlate;
              const isInvoiced = service.status === 'invoiced';
              return <TableRow key={service.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell className="font-medium text-tms-green">
                        {service.folio}
                      </TableCell>
                      <TableCell className="text-white">
                        {format(new Date(service.serviceDate), 'dd/MM/yyyy', {
                    locale: es
                  })}
                      </TableCell>
                      <TableCell className="text-white">
                        <div className="font-medium text-white">{service.client.name}</div>
                        <div className="text-sm text-white opacity-70">{service.client.rut}</div>
                      </TableCell>
                      <TableCell className="text-white">
                        {hasVehicleInfo ? <div>
                            <div className="font-medium text-white">{service.vehicleBrand} {service.vehicleModel}</div>
                            <div className="text-sm text-white opacity-70">{service.licensePlate}</div>
                          </div> : <div className="text-sm text-white opacity-70 italic">
                            Sin vehículo específico
                          </div>}
                      </TableCell>
                      <TableCell className="text-white max-w-48">
                        <div className="truncate text-white">{service.origin}</div>
                        <div className="text-sm text-white opacity-70 truncate">→ {service.destination}</div>
                      </TableCell>
                      <TableCell className="text-white">
                        {service.crane.licensePlate}
                      </TableCell>
                      <TableCell className="text-white">
                        {service.operator.name}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {formatCurrency(service.value)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(service.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && <Button variant="outline" size="sm" className="action-button border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500" onClick={() => onCloseService(service)} title="Cerrar Servicio">
                              <Check className="w-4 h-4" />
                            </Button>}
                          
                          <Button variant="outline" size="sm" className="action-button border-tms-green/50 bg-tms-green/10 text-tms-green hover:bg-tms-green/20 hover:border-tms-green" onClick={() => onViewDetails(service)} title="Ver detalles del servicio">
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {onEdit && <Button variant="outline" size="sm" className={isInvoiced && !isAdmin ? "action-button border-gray-600 bg-gray-600/10 text-gray-500 cursor-not-allowed" : "action-button border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500"} onClick={() => onEdit(service)} title={isInvoiced && !isAdmin ? "No se puede editar un servicio facturado" : isInvoiced && isAdmin ? "⚠️ Editar servicio facturado (solo admin)" : "Editar servicio"} disabled={isInvoiced && !isAdmin}>
                              <Edit className="w-4 h-4" />
                            </Button>}
                          
                          {onDelete && <Button variant="outline" size="sm" className={isInvoiced ? "action-button border-gray-600 bg-gray-600/10 text-gray-500 cursor-not-allowed" : "action-button border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500"} onClick={isInvoiced ? undefined : () => onDelete(service)} title={isInvoiced ? "No se puede eliminar un servicio facturado" : "Eliminar servicio"} disabled={isInvoiced}>
                              <Trash2 className="w-4 h-4" />
                            </Button>}
                        </div>
                      </TableCell>
                    </TableRow>;
            })}
              </TableBody>
            </Table>
          </div>}
      </CardContent>
    </Card>;
};