import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Eye, Edit, Trash2, Truck, Check, ChevronUp, ChevronDown, MessageCircle } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { useUser } from '@/contexts/UserContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ServicesMobileView } from './ServicesMobileView';
import { shouldShowVehicleInfo, formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      <Card className="border-border/70 bg-card/80 shadow-sm">
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
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="flex items-center gap-x-2">
          <Truck className="size-5 text-primary" />
          <span>Servicios Registrados ({services.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {services.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Truck className="size-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              {!hasInitialServices ? 'No hay servicios registrados' : 'No hay servicios que coincidan con los filtros'}
            </h3>
            <p className="mb-6 text-muted-foreground">
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
                <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                  {onSelectionChange && (
                    <TableHead className="w-12 pl-6">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todos los servicios"
                        className={someSelected && !allVisibleSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                      />
                    </TableHead>
                  )}
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="folio">Folio</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="date">Fecha Servicio</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="client">Cliente</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="vehicle">Vehículo</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">Origen/Destino</TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="crane">Grúa</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="operator">Operador</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="value">Valor</SortableHeader>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <SortableHeader field="status">Estado</SortableHeader>
                  </TableHead>
                  <TableHead className="min-w-[140px] pr-6 font-semibold text-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => {
                  const isInvoiced = service.status === 'invoiced';
                  const isSelected = selectedServices.has(service.id);
                  
                  return (
                    <TableRow 
                      key={service.id} 
                      className={`border-border/60 hover:bg-accent/20 ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      {onSelectionChange && (
                        <TableCell className="pl-6">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectService(service.id, checked)}
                            aria-label={`Seleccionar servicio ${service.folio}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="whitespace-nowrap border-primary/20 bg-primary/10 text-primary" title={`Folio: ${service.folio}`}>
                          #{service.folio}
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
                      <TableCell className="pr-6">
                        <div className="flex gap-x-1">
                          {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="action-button border-success/30 bg-success/10 text-success hover:bg-success/15 hover:border-success/40"
                              onClick={() => onCloseService(service)}
                              title="Cerrar Servicio"
                            >
                              <Check className="size-4" />
                            </Button>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="action-button border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:border-primary/40"
                            onClick={() => onViewDetails(service)}
                            title="Ver detalles del servicio"
                          >
                            <Eye className="size-4" />
                          </Button>

                          {(service.purchaseOrderNumber || service.purchaseOrder) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="action-button border-success/30 bg-success/10 text-success hover:bg-success/15 hover:border-success/40"
                              onClick={async () => {
                                const oc = service.purchaseOrderNumber || service.purchaseOrder;
                                const { error } = await supabase.functions.invoke('send-whatsapp-admin', {
                                  body: {
                                    event: 'orden_compra',
                                    data: {
                                      proveedor: service.client?.name || '',
                                      monto: getDisplayServiceValue(service).toLocaleString('es-CL') || '0',
                                      descripcion: `OC ${oc} - Folio ${service.folio}`,
                                    },
                                  },
                                });

                                if (error) {
                                  console.warn('WhatsApp admin no enviado:', error);
                                  toast.error('No se pudo enviar la notificación');
                                } else {
                                  toast.success('Administradores notificados por WhatsApp');
                                }
                              }}
                              title="Notificar O.C. por WhatsApp"
                            >
                              <MessageCircle className="size-4" />
                            </Button>
                          )}
                          
                          {onEdit && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={isInvoiced && !isAdmin 
                                ? "action-button cursor-not-allowed border-border bg-muted text-muted-foreground" 
                                : "action-button border-info/30 bg-info/10 text-info hover:bg-info/15 hover:border-info/40"}
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
                                ? "action-button cursor-not-allowed border-border bg-muted text-muted-foreground" 
                                : "action-button border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 hover:border-danger/40"}
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
