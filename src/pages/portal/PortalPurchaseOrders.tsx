import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle, FileWarning as FileAlert } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { formatCurrency, formatVehicleInfo } from '@/utils/statusHelpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { getPurchaseOrderPendingServices } from './portalServices.utils';
import { businessClock } from '@/utils/businessClock';

const daysPending = (serviceDate: string): number => {
  const svc = new Date(serviceDate);
  const today = businessClock.todayDate();
  today.setHours(0, 0, 0, 0);
  svc.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - svc.getTime()) / (1000 * 60 * 60 * 24));
};

const getDaysPendingClassName = (days: number) => {
  if (days > 30) return 'text-red-600';
  if (days > 14) return 'text-amber-600';
  return 'text-slate-500';
};

type PurchaseOrderSortField = 'folio' | 'service_date' | 'vehicle' | 'route' | 'value' | 'days_pending';
type SortDirection = 'asc' | 'desc';

const PortalPurchaseOrders: React.FC = () => {
  const { data: services, isLoading, isError, error } = useClientServices();
  const [tableSortField, setTableSortField] = useState<PurchaseOrderSortField>('service_date');
  const [tableSortDirection, setTableSortDirection] = useState<SortDirection>('asc');

  const pendingPurchaseOrders = useMemo(
    () =>
      getPurchaseOrderPendingServices(services || [])
        .sort(
          (a, b) =>
            safeParseDateOnly(a.service_date).getTime() - safeParseDateOnly(b.service_date).getTime()
        ),
    [services]
  );

  const sortedPendingPurchaseOrders = useMemo(() => {
    return [...pendingPurchaseOrders].sort((a, b) => {
      let comparison = 0;

      switch (tableSortField) {
        case 'folio':
          comparison = a.folio.localeCompare(b.folio, 'es', { numeric: true, sensitivity: 'base' });
          break;
        case 'service_date':
          comparison = safeParseDateOnly(a.service_date).getTime() - safeParseDateOnly(b.service_date).getTime();
          break;
        case 'vehicle':
          comparison = formatVehicleInfo(a).localeCompare(formatVehicleInfo(b), 'es', {
            numeric: true,
            sensitivity: 'base',
          });
          break;
        case 'route': {
          const routeA = `${a.origin} ${a.destination}`;
          const routeB = `${b.origin} ${b.destination}`;
          comparison = routeA.localeCompare(routeB, 'es', { numeric: true, sensitivity: 'base' });
          break;
        }
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'days_pending':
          comparison = daysPending(a.service_date) - daysPending(b.service_date);
          break;
      }

      return tableSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [pendingPurchaseOrders, tableSortField, tableSortDirection]);

  const handleTableSort = (field: PurchaseOrderSortField) => {
    if (tableSortField === field) {
      setTableSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setTableSortField(field);
    setTableSortDirection(field === 'service_date' ? 'asc' : field === 'value' || field === 'days_pending' ? 'desc' : 'asc');
  };

  const renderSortIcon = (field: PurchaseOrderSortField) => {
    if (tableSortField !== field) {
      return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
    }

    return tableSortDirection === 'asc' ? (
      <ArrowUp className="ml-2 size-4 text-violet-700" />
    ) : (
      <ArrowDown className="ml-2 size-4 text-violet-700" />
    );
  };

  const renderSortableTableHead = (
    label: string,
    field: PurchaseOrderSortField,
    align: 'left' | 'right' | 'center' = 'left'
  ) => {
    const justifyClassName =
      align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    const headClassName =
      align === 'right' ? 'text-right text-[#64748b]' : align === 'center' ? 'text-center text-[#64748b]' : 'text-[#64748b]';

    return (
      <TableHead className={headClassName}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleTableSort(field)}
          className={`h-auto w-full px-0 py-0 font-medium text-inherit hover:bg-transparent ${justifyClassName}`}
        >
          {label}
          {renderSortIcon(field)}
        </Button>
      </TableHead>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertTriangle className="mb-4 size-12 text-red-500" />
        <h2 className="text-lg font-semibold text-red-900">Error al cargar las OC pendientes</h2>
        <p className="mt-1 text-sm text-red-700">{error?.message || 'Ocurrio un error inesperado.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[17px] font-medium text-[#0f172a]">Ordenes de compra pendientes</h1>
          <p className="text-[11px] text-[#94a3b8]">Servicios cotizados que requieren tu OC para continuar el flujo administrativo</p>
        </div>
        <Badge className="w-fit border border-amber-200 bg-amber-50 text-amber-800">
          {pendingPurchaseOrders.length} pendiente{pendingPurchaseOrders.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card className="border border-amber-200 bg-amber-50 shadow-none">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <FileAlert className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900">Servicios cotizados sin orden de compra</p>
            <p className="mt-1 text-sm text-amber-700">
              Estos servicios estan en estado cotizado y necesitan el registro de la orden de compra para continuar con su proceso administrativo y operativo.
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingPurchaseOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-white px-6 py-16 text-center">
          <CheckCircle className="mb-4 size-14 text-green-500" />
          <h2 className="text-lg font-medium text-[#0f172a]">Todo al dia</h2>
          <p className="mt-1 text-sm text-[#94a3b8]">No tienes ordenes de compra pendientes.</p>
        </div>
      ) : (
        <Card className="border border-[#e2e8f0] bg-white shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#0f172a]">Servicios pendientes de OC</CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Los servicios mas antiguos aparecen primero para ayudarte a priorizar el envio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#e2e8f0] hover:bg-transparent">
                    {renderSortableTableHead('Folio', 'folio')}
                    {renderSortableTableHead('Fecha del servicio', 'service_date')}
                    {renderSortableTableHead('Vehiculo', 'vehicle')}
                    {renderSortableTableHead('Ruta', 'route')}
                    {renderSortableTableHead('Valor', 'value', 'right')}
                    {renderSortableTableHead('Dias sin OC', 'days_pending', 'center')}
                    <TableHead className="text-[#64748b]">Seguimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPendingPurchaseOrders.map((service) => {
                    const pendingDays = daysPending(service.service_date);

                    return (
                      <TableRow key={service.id} className="border-[#f1f5f9] bg-[#f8fafc] hover:bg-[#f5f3ff]">
                        <TableCell className="font-medium text-violet-700">{service.folio}</TableCell>
                        <TableCell className="text-[#64748b]">
                          {format(safeParseDateOnly(service.service_date), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-[#0f172a]">{formatVehicleInfo(service)}</TableCell>
                        <TableCell className="max-w-md text-[#64748b]">
                          {service.origin} → {service.destination}
                        </TableCell>
                        <TableCell className="text-right font-medium text-[#0f172a]">
                          {formatCurrency(service.value)}
                        </TableCell>
                        <TableCell className={`text-center font-medium ${getDaysPendingClassName(pendingDays)}`}>
                          {pendingDays} dias
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-800">
                              Falta orden de compra
                            </Badge>
                            <span className="text-xs text-[#94a3b8]">
                              Coordina el envio de la O.C. con nuestro equipo para continuar con el proceso
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PortalPurchaseOrders;
