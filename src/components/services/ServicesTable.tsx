import React, { useMemo } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Trash2, Truck, Check, MessageCircle, MapPinOff, Ban } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useUser } from '@/contexts/UserContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ServicesMobileView } from './ServicesMobileView';
import { formatVehicleInfo, getServiceStatusBadge } from '@/utils/statusHelpers';
import { useServiceBillingLinks } from '@/hooks/services/useServiceBillingLinks';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';
import { useServiceCostTotals } from '@/hooks/services/useServiceCostTotals';
import { ServiceValueWithProfit } from './ServiceValueWithProfit';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";
import {
  flexRender,
  ColumnDef,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
} from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const logger = createLogger("ServicesTable");

interface ServicesTableProps {
  services: Service[];
  hasInitialServices: boolean;
  onViewDetails: (service: Service) => void;
  onEdit?: (service: Service) => void;
  onDelete?: (service: Service) => void;
  onCloseService?: (service: Service) => void;
  /** Castigo formal (incobrable). Solo se pasa para admin. */
  onWriteOff?: (service: Service) => void;
  onAddNewService?: () => void;
  sortField?: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status' | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: 'folio' | 'date' | 'client' | 'vehicle' | 'crane' | 'operator' | 'value' | 'status') => void;
  selectedServices?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  allFilteredIds?: string[];
}

export const ServicesTable = React.memo(({
  services,
  hasInitialServices,
  onViewDetails,
  onEdit,
  onDelete,
  onCloseService,
  onWriteOff,
  onAddNewService,
  sortField,
  sortDirection,
  onSort,
  selectedServices = new Set(),
  onSelectionChange,
  allFilteredIds,
}: ServicesTableProps) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const { isMobile } = useDeviceType();
  const { data: serviceCostTotals, isError: costsError } = useServiceCostTotals(services.map(service => service.id));

  // El castigo solo aplica a completados sin vínculo a factura ni cierre. Se
  // consulta por página (2 consultas), no por fila.
  const writeOffCandidateIds = useMemo(
    () => (onWriteOff ? services.filter(s => s.status === 'completed').map(s => s.id) : []),
    [onWriteOff, services],
  );
  const { linkedServiceIds } = useServiceBillingLinks(writeOffCandidateIds);

  const effectiveSelectAllIds = allFilteredIds ?? services.map(s => s.id);
  const allFilteredSelected = effectiveSelectAllIds.length > 0 && effectiveSelectAllIds.every(id => selectedServices.has(id));
  const someFilteredSelected = effectiveSelectAllIds.some(id => selectedServices.has(id));

  // Convert Set<string> → RowSelectionState for TanStack
  const rowSelection: RowSelectionState = useMemo(() => {
    const state: RowSelectionState = {};
    selectedServices.forEach(id => { state[id] = true; });
    return state;
  }, [selectedServices]);

  const columns = useMemo<ColumnDef<Service>[]>(() => {
    const cols: ColumnDef<Service>[] = [];

    if (onSelectionChange) {
      cols.push({
        id: 'select',
        size: 48,
        enableSorting: false,
        header: () => (
          <Checkbox
            checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' as const : false}
            onCheckedChange={(value) => {
              if (value) {
                onSelectionChange?.(new Set(effectiveSelectAllIds));
              } else {
                onSelectionChange?.(new Set());
              }
            }}
            aria-label="Seleccionar todo"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Seleccionar fila"
            onClick={(e) => e.stopPropagation()}
          />
        ),
      });
    }

    cols.push(
      {
        id: 'folio',
        accessorKey: 'folio',
        enableSorting: true,
        size: 100,
        meta: { headerTitle: 'Folio' },
        header: () => (
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort?.('folio')}>
            Folio
            {sortField === 'folio' && sortDirection === 'asc' ? <ArrowUp className="size-3" /> : sortField === 'folio' && sortDirection === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
          </button>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="whitespace-nowrap border-primary/20 bg-primary/10 text-primary"
            title={`Folio: ${row.original.folio}`}
          >
            #{row.original.folio}
          </Badge>
        ),
      },
      {
        id: 'date',
        accessorKey: 'serviceDate',
        enableSorting: true,
        size: 130,
        meta: { headerTitle: 'Fecha Servicio' },
        header: () => (
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort?.('date')}>
            Fecha Servicio
            {sortField === 'date' && sortDirection === 'asc' ? <ArrowUp className="size-3" /> : sortField === 'date' && sortDirection === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
          </button>
        ),
        cell: ({ row }) =>
          formatForDisplay(row.original.serviceDate),
      },
      {
        id: 'client',
        enableSorting: false,
        size: 180,
        meta: { headerTitle: 'Cliente' },
        header: () => (
          <span className="text-secondary-foreground/80 text-sm font-normal">Cliente</span>
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{toTitleCase(row.original.client.name)}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.client.department} • {row.original.client.rut}
            </div>
          </div>
        ),
      },
      {
        id: 'vehicle',
        enableSorting: false,
        size: 140,
        meta: { headerTitle: 'Vehículo' },
        header: () => (
          <span className="text-secondary-foreground/80 text-sm font-normal">Vehículo</span>
        ),
        cell: ({ row }) => <span>{formatVehicleInfo(row.original)}</span>,
      },
      {
        id: 'originDestination',
        enableSorting: false,
        size: 180,
        meta: { headerTitle: 'Origen/Destino' },
        header: () => (
          <span className="text-secondary-foreground/80 text-sm font-normal">
            Origen/Destino
          </span>
        ),
        cell: ({ row }) => (
          <div className="max-w-48">
            <div className="flex items-center gap-1.5">
              {/* Sin coordenada: ese servicio no genera seguimiento, ETA ni
                  peajes. El icono es la unica pista visible en la lista. */}
              {row.original.originLat == null || row.original.originLng == null ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0">
                        <MapPinOff className="size-3.5 text-muted-foreground/70" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Sin coordenada de origen: sin seguimiento ni métricas de ruta
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
              <div className="truncate">{row.original.origin}</div>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              → {row.original.destination}
            </div>
          </div>
        ),
      },
      {
        id: 'crane',
        enableSorting: false,
        size: 110,
        meta: { headerTitle: 'Grúa' },
        header: () => (
          <span className="text-secondary-foreground/80 text-sm font-normal">Grúa</span>
        ),
        cell: ({ row }) =>
          row.original.crane?.licensePlate || 'Sin asignar',
      },
      {
        id: 'operator',
        enableSorting: false,
        size: 130,
        meta: { headerTitle: 'Operador' },
        header: () => (
          <span className="text-secondary-foreground/80 text-sm font-normal">Operador</span>
        ),
        cell: ({ row }) =>
          row.original.operator?.name || 'Sin asignar',
      },
      {
        id: 'value',
        enableSorting: true,
        size: 110,
        meta: { headerTitle: 'Valor' },
        header: () => (
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort?.('value')}>
            Valor
            {sortField === 'value' && sortDirection === 'asc' ? <ArrowUp className="size-3" /> : sortField === 'value' && sortDirection === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
          </button>
        ),
        cell: ({ row }) => (
          <ServiceValueWithProfit
            service={row.original}
            totalCost={serviceCostTotals?.[row.original.id]}
            isError={costsError}
          />
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        enableSorting: true,
        size: 120,
        meta: { headerTitle: 'Estado' },
        header: () => (
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort?.('status')}>
            Estado
            {sortField === 'status' && sortDirection === 'asc' ? <ArrowUp className="size-3" /> : sortField === 'status' && sortDirection === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
          </button>
        ),
        cell: ({ row }) => getServiceStatusBadge(row.original.status),
      },
      {
        id: 'actions',
        enableSorting: false,
        size: 160,
        meta: { headerTitle: 'Acciones' },
        header: () => (
          <span className="text-secondary-foreground/80 text-sm font-normal">
            Acciones
          </span>
        ),
        cell: ({ row }) => {
          const service = row.original;
          const isInvoiced = service.status === 'invoiced';
          return (
            <div className="flex gap-x-1">
              {(service.status === 'pending' || service.status === 'in_progress') && onCloseService && (
                <Button
                  variant="outline"
                  size="sm"
                  className="action-button border-success/30 bg-success/10 text-success hover:bg-success/20 hover:border-success/40"
                  onClick={(e) => { e.stopPropagation(); onCloseService(service); }}
                  title="Cerrar Servicio"
                >
                  <Check className="size-4" />
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="action-button border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/40"
                onClick={(e) => { e.stopPropagation(); onViewDetails(service); }}
                title="Ver detalles del servicio"
              >
                <Eye className="size-4" />
              </Button>

              {(service.purchaseOrderNumber || service.purchaseOrder) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="action-button border-success/30 bg-success/10 text-success hover:bg-success/20 hover:border-success/40"
                  onClick={async (e) => { e.stopPropagation();
                    const oc = service.purchaseOrderNumber || service.purchaseOrder;
                    const { data, error } = await supabase.functions.invoke('send-whatsapp-admin', {
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
                      logger.warn('WhatsApp admin no enviado:', error);
                      toast.error('No se pudo enviar la notificación');
                      return;
                    }

                    if ((data as { skipped?: boolean; reason?: string } | null)?.skipped) {
                      const reason = data?.reason;
                      logger.info('WhatsApp admin omitido:', reason);
                      if (reason === 'whatsapp_disabled') {
                        toast.warning('Envío de WhatsApp deshabilitado en Configuración');
                      } else {
                        toast.info('WhatsApp no enviado', { description: reason || 'Envío omitido por configuración' });
                      }
                      return;
                    }

                    toast.success('Administradores notificados por WhatsApp');
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
                    : "action-button border-info/30 bg-info/10 text-info hover:bg-info/20 hover:border-info/40"}
                  onClick={(e) => { e.stopPropagation(); onEdit(service); }}
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
                    : "action-button border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 hover:border-danger/40"}
                  onClick={isInvoiced ? undefined : (e) => { e.stopPropagation(); onDelete(service); }}
                  title={isInvoiced
                    ? "No se puede eliminar un servicio facturado"
                    : "Eliminar servicio"}
                  disabled={isInvoiced}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}

              {onWriteOff && service.status === 'completed' && !linkedServiceIds.has(service.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="action-button border-dashed border-danger/40 bg-danger/5 text-danger hover:bg-danger/15 hover:border-danger/50"
                  onClick={(e) => { e.stopPropagation(); onWriteOff(service); }}
                  title="Castigar servicio (incobrable)"
                >
                  <Ban className="size-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    );

    return cols;
  }, [onSelectionChange, onCloseService, onViewDetails, onEdit, onDelete, onWriteOff, linkedServiceIds, serviceCostTotals, costsError, isAdmin, sortField, sortDirection, onSort]);

  const table = useReactTable({
    data: services,
    columns,
    state: { rowSelection },
    getRowId: (row) => row.id,
    enableRowSelection: !!onSelectionChange,
    onRowSelectionChange: (updater) => {
      if (!onSelectionChange) return;
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onSelectionChange(new Set(Object.keys(next).filter(k => next[k])));
    },
    getCoreRowModel: getCoreRowModel(),
  });

  if (isMobile) {
    return (
      <Card className="services-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-4">
          <ServicesMobileView
            services={services}
            hasInitialServices={hasInitialServices}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onDelete={onDelete}
            onCloseService={onCloseService}
            onWriteOff={onWriteOff}
            onAddNewService={onAddNewService}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="services-panel border-border/70 bg-card/80 shadow-sm">
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
              {!hasInitialServices
                ? 'No hay servicios registrados'
                : 'No hay servicios que coincidan con los filtros'}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {!hasInitialServices
                ? 'Comienza agregando tu primer servicio de grúa'
                : 'Intenta ajustar los filtros de búsqueda'}
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
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/40">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())
                        }
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onViewDetails(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
