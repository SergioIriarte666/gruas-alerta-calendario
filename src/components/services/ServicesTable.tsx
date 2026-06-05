import { useMemo, useState } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Edit, Trash2, Truck, Check, MessageCircle } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { useUser } from '@/contexts/UserContext';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ServicesMobileView } from './ServicesMobileView';
import { formatVehicleInfo, getServiceStatusBadge, formatCurrency } from '@/utils/statusHelpers';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  RowSelectionState,
} from '@tanstack/react-table';
import {
  DataGrid,
  DataGridContainer,
} from '@/components/reui/data-grid/data-grid';
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table';
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header';
import { DataGridTableRowSelect, DataGridTableRowSelectAll } from '@/components/reui/data-grid/data-grid-table';

const logger = createLogger("ServicesTable");

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

  const [sorting, setSorting] = useState<SortingState>([]);

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
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
      });
    }

    cols.push(
      {
        id: 'folio',
        accessorKey: 'folio',
        enableSorting: true,
        size: 100,
        meta: { headerTitle: 'Folio' },
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Folio" />
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
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Fecha Servicio" />
        ),
        cell: ({ row }) =>
          formatForDisplay(parseFromDatabase(row.original.serviceDate)),
      },
      {
        id: 'client',
        enableSorting: false,
        size: 180,
        meta: { headerTitle: 'Cliente' },
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Cliente" />
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
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Vehículo" />
        ),
        cell: ({ row }) => <span>{formatVehicleInfo(row.original)}</span>,
      },
      {
        id: 'originDestination',
        enableSorting: false,
        size: 180,
        meta: { headerTitle: 'Origen/Destino' },
        header: () => (
          <span className="text-secondary-foreground/80 text-[0.8125rem] font-normal">
            Origen/Destino
          </span>
        ),
        cell: ({ row }) => (
          <div className="max-w-48">
            <div className="truncate">{row.original.origin}</div>
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
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Grúa" />
        ),
        cell: ({ row }) =>
          row.original.crane?.licensePlate || 'Sin asignar',
      },
      {
        id: 'operator',
        enableSorting: false,
        size: 130,
        meta: { headerTitle: 'Operador' },
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Operador" />
        ),
        cell: ({ row }) =>
          row.original.operator?.name || 'Sin asignar',
      },
      {
        id: 'value',
        enableSorting: true,
        size: 110,
        meta: { headerTitle: 'Valor' },
        sortingFn: (a, b) =>
          getDisplayServiceValue(a.original) - getDisplayServiceValue(b.original),
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Valor" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(getDisplayServiceValue(row.original))}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        enableSorting: true,
        size: 120,
        meta: { headerTitle: 'Estado' },
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Estado" />
        ),
        cell: ({ row }) => getServiceStatusBadge(row.original.status),
      },
      {
        id: 'actions',
        enableSorting: false,
        size: 160,
        meta: { headerTitle: 'Acciones' },
        header: () => (
          <span className="text-secondary-foreground/80 text-[0.8125rem] font-normal">
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
                      logger.warn('WhatsApp admin no enviado:', error);
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
          );
        },
      },
    );

    return cols;
  }, [onSelectionChange, onCloseService, onViewDetails, onEdit, onDelete, isAdmin]);

  const table = useReactTable({
    data: services,
    columns,
    state: { sorting, rowSelection },
    getRowId: (row) => row.id,
    enableRowSelection: !!onSelectionChange,
    onRowSelectionChange: (updater) => {
      if (!onSelectionChange) return;
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onSelectionChange(new Set(Object.keys(next).filter(k => next[k])));
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
          <DataGridContainer border={false}>
            <DataGrid
              table={table}
              recordCount={services.length}
              tableLayout={{
                rowBorder: true,
                headerBackground: true,
                headerBorder: true,
                width: 'auto',
              }}
              emptyMessage="No hay servicios"
            >
              <DataGridTable />
            </DataGrid>
          </DataGridContainer>
        )}
      </CardContent>
    </Card>
  );
};
