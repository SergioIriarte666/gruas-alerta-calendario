import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, Edit, Trash2, Truck, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUser } from '@/contexts/UserContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ServicesMobileView } from './ServicesMobileView';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { shouldShowVehicleInfo, formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getServiceDisplayValue } from '@/utils/serviceValueCalculations';

interface ServicesTableProps {
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

export const ServicesTable = ({
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
}: ServicesTableProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const { isMobile } = useDeviceType();

  // Helper component for sortable table headers
  const SortableHeader = ({ field, children }: { field: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status'; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      className="h-auto p-0 font-medium text-white hover:text-tms-green hover:bg-transparent flex items-center gap-1"
      onClick={() => onSort?.(field)}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )
      )}
    </Button>
  );

  // Render mobile view if on mobile device
  if (isMobile) {
    return (
      <Card className="glass-card tms-text-white">
        <CardContent className="p-4">
          <ServicesMobileView
            services={services}
            hasInitialServices={hasInitialServices}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onDelete={onDelete}
            onCloseService={onCloseService}
            onAddNewService={onAddNewService}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        </CardContent>
      </Card>
    );
  }

  // Desktop view (unchanged functionality)
  return (
    <Card className="glass-card tms-text-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <Truck className="w-5 h-5 text-tms-green" />
          <span className="text-white">Servicios Registrados ({services.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="tms-text-white">
        {services.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-white">
                    <SortableHeader field="folio">Folio</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="date">Fecha Servicio</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="client">Cliente</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="vehicle">Vehículo</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">Origen/Destino</TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="crane">Grúa</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="operator">Operador</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="value">Valor</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white">
                    <SortableHeader field="status">Estado</SortableHeader>
                  </TableHead>
                  <TableHead className="text-white min-w-[140px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const isInvoiced = service.status === 'invoiced';
                  
                  return (
                    <TableRow key={service.id} className="border-gray-700 hover:bg-white/5">
                      <TableCell className="font-medium text-tms-green">
                        {service.folio}
                      </TableCell>
                      <TableCell className="text-white">
                        {(() => {
                          // Direct conversion from yyyy-MM-dd to dd/MM/yyyy without any Date object conversion
                          if (service.serviceDate && typeof service.serviceDate === 'string' && service.serviceDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const [year, month, day] = service.serviceDate.split('-');
                            return `${day}/${month}/${year}`;
                          }
                          return service.serviceDate || 'N/A';
                        })()}
                      </TableCell>
                      <TableCell className="text-white">
                        <div className="font-medium text-white">{service.client.name}</div>
                        <div className="text-sm text-white opacity-70">{service.client.department} • {service.client.rut}</div>
                      </TableCell>
                      <TableCell className="text-white">
                        {shouldShowVehicleInfo(service) ? (
                          <span>{formatVehicleInfo(service)}</span>
                        ) : (
                          <span className="text-sm text-white opacity-70 italic">No aplica</span>
                        )}
                      </TableCell>
                      <TableCell className="text-white max-w-48">
                        <div className="truncate text-white">{service.origin}</div>
                        <div className="text-sm text-white opacity-70 truncate">→ {service.destination}</div>
                      </TableCell>
                      <TableCell className="text-white">
                        {service.crane?.licensePlate || 'Sin asignar'}
                      </TableCell>
                      <TableCell className="text-white">
                        {service.operator?.name || 'Sin asignar'}
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {formatCurrency(getServiceDisplayValue(service))}
                      </TableCell>
                      <TableCell>
                        {getServiceStatusBadge(service.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="action-button border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500"
                              onClick={() => onCloseService(service)}
                              title="Cerrar Servicio"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="action-button border-tms-green/50 bg-tms-green/10 text-tms-green hover:bg-tms-green/20 hover:border-tms-green"
                            onClick={() => onViewDetails(service)}
                            title="Ver detalles del servicio"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {onEdit && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={isInvoiced && !isAdmin 
                                ? "action-button border-gray-600 bg-gray-600/10 text-gray-500 cursor-not-allowed" 
                                : "action-button border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500"}
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
                          
                          {onDelete && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={isInvoiced 
                                ? "action-button border-gray-600 bg-gray-600/10 text-gray-500 cursor-not-allowed" 
                                : "action-button border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500"}
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
