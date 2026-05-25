import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Eye, Edit, Trash2, Truck, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { useUser } from '@/contexts/UserContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ServicesMobileView } from './ServicesMobileView';
import { shouldShowVehicleInfo, formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';

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
  // Batch selection props
  selectedServices?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
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
  selectedServices = new Set(),
  onSelectionChange,
}: ServicesTableProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const { isMobile } = useDeviceType();

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (!onSelectionChange) return;
    const isChecked = checked === true;

    const newSelection = new Set(selectedServices);

    if (isChecked) {
      // Add all currently visible services (keeps selections across pages)
      services.forEach(s => newSelection.add(s.id));
    } else {
      // Remove all currently visible services
      services.forEach(s => newSelection.delete(s.id));
    }

    onSelectionChange(newSelection);
  };

  const handleSelectService = (serviceId: string, checked: boolean | 'indeterminate') => {
    if (!onSelectionChange) return;
    const isChecked = checked === true;

    const newSelection = new Set(selectedServices);
    if (isChecked) {
      newSelection.add(serviceId);
    } else {
      newSelection.delete(serviceId);
    }
    onSelectionChange(newSelection);
  };

  const allVisibleSelected = services.length > 0 && services.every(s => selectedServices.has(s.id));
  const someSelected = services.some(s => selectedServices.has(s.id));

  // Helper component for sortable table headers
  const SortableHeader = ({ field, children }: { field: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status'; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      className="h-auto p-0 font-medium text-foreground hover:text-primary hover:bg-transparent flex items-center gap-1"
      onClick={() => onSort?.(field)}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )
      )}
    </Button>
  );

  // Render mobile view if on mobile device
  if (isMobile) {
    return (
      <Card>
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

  // Desktop view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-x-2">
          <Truck className="size-5 text-primary" />
          <span>Servicios Registrados ({services.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-center py-12">
            <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="size-8 text-primary" />
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={onAddNewService}
                title="Crear el primer servicio"
              >
                <Plus className="size-4 mr-2" />
                Crear Primer Servicio
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {onSelectionChange && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todos los servicios"
                        className={someSelected && !allVisibleSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      />
                    </TableHead>
                  )}
                  <TableHead>
                    <SortableHeader field="folio">Folio</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="date">Fecha Servicio</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="client">Cliente</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="vehicle">Vehículo</SortableHeader>
                  </TableHead>
                  <TableHead>Origen/Destino</TableHead>
                  <TableHead>
                    <SortableHeader field="crane">Grúa</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="operator">Operador</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="value">Valor</SortableHeader>
                  </TableHead>
                  <TableHead>
                    <SortableHeader field="status">Estado</SortableHeader>
                  </TableHead>
                  <TableHead className="min-w-[140px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const isInvoiced = service.status === 'invoiced';
                  const isSelected = selectedServices.has(service.id);
                  
                  return (
                    <TableRow 
                      key={service.id} 
                      className={`hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      {onSelectionChange && (
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectService(service.id, checked)}
                            aria-label={`Seleccionar servicio ${service.folio}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <Badge variant="tms" className="whitespace-nowrap" title={`Folio: ${service.folio}`}>
                          {service.folio}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatForDisplay(parseFromDatabase(service.serviceDate))}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{toTitleCase(service.client.name)}</div>
                        <div className="text-sm text-muted-foreground">{service.client.department} • {service.client.rut}</div>
                      </TableCell>
                      <TableCell>
                        {shouldShowVehicleInfo(service) ? (
                          <span>{formatVehicleInfo(service)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No aplica</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="truncate">{service.origin}</div>
                        <div className="text-sm text-muted-foreground truncate">→ {service.destination}</div>
                      </TableCell>
                      <TableCell>
                        {service.crane?.licensePlate || 'Sin asignar'}
                      </TableCell>
                      <TableCell>
                        {service.operator?.name || 'Sin asignar'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(getDisplayServiceValue(service))}
                      </TableCell>
                      <TableCell>
                        {getServiceStatusBadge(service.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-x-1">
                          {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="action-button border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500"
                              onClick={() => onCloseService(service)}
                              title="Cerrar Servicio"
                            >
                              <Check className="size-4" />
                            </Button>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="action-button border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary"
                            onClick={() => onViewDetails(service)}
                            title="Ver detalles del servicio"
                          >
                            <Eye className="size-4" />
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
                              <Edit className="size-4" />
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
                              <Trash2 className="size-4" />
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