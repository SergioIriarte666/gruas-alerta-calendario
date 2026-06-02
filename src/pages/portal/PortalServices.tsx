
import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useClientServices } from '@/hooks/portal/useClientServices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatForDisplay } from '@/utils/timezoneUtils';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Grid,
  History,
  LayoutList,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortalServiceCard } from '@/components/portal/PortalServiceCard';
import { useClientServiceExport } from '@/hooks/portal/useClientServiceExport';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  formatCurrency,
  formatVehicleInfo,
  getServiceStatusBadge,
  getServiceStatusLabel,
} from '@/utils/statusHelpers';
import {
  getMonthBounds,
  getMonthStatusCounts,
  getServiceDateKey,
  getServicesForMonth,
} from './portalServices.utils';

type ServiceSortField = 'folio' | 'service_date' | 'vehicle' | 'service_type_name' | 'route' | 'value' | 'status';
type SortDirection = 'asc' | 'desc';

const PortalServices = () => {
  const { data: services, isLoading, isError, error } = useClientServices();
  const [viewMode, setViewMode] = useState<'month' | 'table' | 'grid'>('table');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tableSortField, setTableSortField] = useState<ServiceSortField>('service_date');
  const [tableSortDirection, setTableSortDirection] = useState<SortDirection>('desc');

  const monthServices = useMemo(
    () => getServicesForMonth(services || [], currentMonth, statusFilter),
    [services, currentMonth, statusFilter]
  );

  const sortedServices = useMemo(() => {
    return [...monthServices].sort((a, b) => {
      if (a.is_portal_request && !b.is_portal_request) return -1;
      if (!a.is_portal_request && b.is_portal_request) return 1;
      return new Date(b.service_date).getTime() - new Date(a.service_date).getTime();
    });
  }, [monthServices]);

  const monthStatusCounts = useMemo(
    () => getMonthStatusCounts(services || [], currentMonth),
    [services, currentMonth]
  );

  const availableStatuses = useMemo(() => {
    return Object.entries(monthStatusCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [monthStatusCounts]);

  const { start: monthStart, end: monthEnd } = getMonthBounds(currentMonth);
  const { exportToPDF, exportToExcel, isLoadingServices } = useClientServiceExport(
    sortedServices,
    monthStart,
    monthEnd
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = start;

    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [currentMonth]);

  const servicesByDate = useMemo(() => {
    return sortedServices.reduce<Record<string, typeof sortedServices>>((accumulator, service) => {
      const key = getServiceDateKey(service.service_date);
      accumulator[key] = [...(accumulator[key] || []), service];
      return accumulator;
    }, {});
  }, [sortedServices]);

  const sortedTableServices = useMemo(() => {
    return [...sortedServices].sort((a, b) => {
      let comparison = 0;

      switch (tableSortField) {
        case 'folio':
          comparison = a.folio.localeCompare(b.folio, 'es', { numeric: true, sensitivity: 'base' });
          break;
        case 'service_date':
          comparison = new Date(a.service_date).getTime() - new Date(b.service_date).getTime();
          break;
        case 'vehicle':
          comparison = formatVehicleInfo(a).localeCompare(formatVehicleInfo(b), 'es', {
            numeric: true,
            sensitivity: 'base',
          });
          break;
        case 'service_type_name':
          comparison = a.service_type_name.localeCompare(b.service_type_name, 'es', {
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
        case 'status':
          comparison = getServiceStatusLabel(a.status).localeCompare(getServiceStatusLabel(b.status), 'es', {
            numeric: true,
            sensitivity: 'base',
          });
          break;
      }

      return tableSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sortedServices, tableSortField, tableSortDirection]);

  const mobileMonthDays = useMemo(() => {
    return calendarDays.filter((day) => isSameMonth(day, currentMonth));
  }, [calendarDays, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((previousMonth) =>
      direction === 'prev' ? subMonths(previousMonth, 1) : addMonths(previousMonth, 1)
    );
  };

  const resetToCurrentMonth = () => {
    setCurrentMonth(startOfMonth(new Date()));
  };

  const handleTableSort = (field: ServiceSortField) => {
    if (tableSortField === field) {
      setTableSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setTableSortField(field);
    setTableSortDirection(field === 'service_date' || field === 'value' ? 'desc' : 'asc');
  };

  const renderSortIcon = (field: ServiceSortField) => {
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
    field: ServiceSortField,
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

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white p-8 text-center">
      <History className="mb-4 size-12 text-[#94a3b8]" />
      <h3 className="text-lg font-semibold text-[#0f172a]">Sin servicios en este mes</h3>
      <p className="text-[#94a3b8]">
        No encontramos servicios para {format(currentMonth, 'MMMM yyyy', { locale: es })} con el filtro aplicado.
      </p>
    </div>
  );

  const renderMonthView = () => {
    if (sortedServices.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="space-y-4">
        <div className="hidden overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white md:block">
          <div className="grid grid-cols-7 border-b border-[#e2e8f0] bg-[#f8fafc]">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dayLabel) => (
              <div key={dayLabel} className="px-3 py-2 text-center text-xs font-medium text-[#64748b]">
                {dayLabel}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayServices = servicesByDate[dayKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={dayKey}
                  className={`min-h-[148px] border-b border-r border-[#f1f5f9] p-2 ${
                    isCurrentMonth ? 'bg-white' : 'bg-[#f8fafc]/70'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                        isToday(day)
                          ? 'bg-violet-600 text-white'
                          : isCurrentMonth
                          ? 'text-[#0f172a]'
                          : 'text-[#cbd5e1]'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayServices.length > 0 && (
                      <Badge variant="outline" className="border-violet-200 text-[10px] text-violet-700">
                        {dayServices.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {dayServices.slice(0, 2).map((service) => (
                      <div key={service.id} className="rounded-[8px] border border-[#f1f5f9] bg-[#f8fafc] p-2">
                        <p className="truncate text-[11px] font-medium text-violet-700">{service.folio}</p>
                        <p className="truncate text-[10px] text-[#64748b]">{formatVehicleInfo(service)}</p>
                        <p className="truncate text-[10px] text-[#94a3b8]">
                          {service.origin} → {service.destination}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-[#0f172a]">
                            {formatCurrency(service.value)}
                          </span>
                          {getServiceStatusBadge(service.status)}
                        </div>
                      </div>
                    ))}
                    {dayServices.length > 2 && (
                      <p className="text-[10px] text-[#94a3b8]">+{dayServices.length - 2} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {mobileMonthDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayServices = servicesByDate[dayKey] || [];

            if (dayServices.length === 0) return null;

            return (
              <div key={dayKey} className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#0f172a] capitalize">
                      {format(day, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-xs text-[#94a3b8]">{dayServices.length} servicio(s)</p>
                  </div>
                  {isToday(day) && (
                    <Badge className="border-violet-200 bg-violet-50 text-violet-700">Hoy</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {dayServices.map((service) => (
                    <div key={service.id} className="rounded-[8px] border border-[#f1f5f9] bg-[#f8fafc] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-violet-700">{service.folio}</p>
                        {getServiceStatusBadge(service.status)}
                      </div>
                      <p className="mt-1 text-xs text-[#64748b]">{formatVehicleInfo(service)}</p>
                      <p className="mt-1 text-xs text-[#94a3b8]">{service.service_type_name}</p>
                      <p className="mt-1 text-xs text-[#94a3b8]">
                        {service.origin} → {service.destination}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[#0f172a]">
                        {formatCurrency(service.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    if (sortedServices.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="overflow-x-auto rounded-[10px] border border-[#e2e8f0] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e2e8f0] hover:bg-transparent">
              {renderSortableTableHead('Folio', 'folio')}
              {renderSortableTableHead('Fecha', 'service_date')}
              {renderSortableTableHead('Vehículo', 'vehicle')}
              {renderSortableTableHead('Tipo', 'service_type_name')}
              {renderSortableTableHead('Ruta', 'route')}
              {renderSortableTableHead('Valor', 'value', 'right')}
              {renderSortableTableHead('Estado', 'status', 'center')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTableServices.map((service) => (
              <TableRow key={service.id} className="border-[#f1f5f9] bg-[#f8fafc] hover:bg-[#f5f3ff]">
                <TableCell className="font-medium text-violet-700">{service.folio}</TableCell>
                <TableCell className="text-[#64748b]">{formatForDisplay(service.service_date)}</TableCell>
                <TableCell className="text-[#0f172a]">{formatVehicleInfo(service)}</TableCell>
                <TableCell className="text-[#64748b]">{service.service_type_name}</TableCell>
                <TableCell className="max-w-xs truncate text-[#64748b]" title={`${service.origin} → ${service.destination}`}>
                  {service.origin} → {service.destination}
                </TableCell>
                <TableCell className="text-right font-semibold text-[#0f172a]">{formatCurrency(service.value)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {getServiceStatusBadge(service.status)}
                    {service.is_portal_request && (
                      <Badge className="border-amber-200 bg-amber-50 text-xs text-amber-700">
                        Solicitud pendiente de asignación
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderGridView = () => {
    if (sortedServices.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedServices.map((service) => (
          <PortalServiceCard key={service.id} service={service} />
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-[#e2e8f0]" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mb-4 size-12 text-red-500" />
          <h3 className="text-lg font-semibold text-[#0f172a]">Error al cargar servicios</h3>
          <p className="text-red-600">{error?.message || 'Ocurrió un error inesperado.'}</p>
        </div>
      );
    }

    if (!services || services.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white p-8 text-center">
          <History className="mb-4 size-12 text-[#94a3b8]" />
          <h3 className="text-lg font-semibold text-[#0f172a]">Sin servicios registrados</h3>
          <p className="text-[#94a3b8]">No hemos encontrado servicios asociados a tu cuenta.</p>
        </div>
      );
    }

    if (viewMode === 'month') {
      return renderMonthView();
    }

    if (viewMode === 'grid') {
      return renderGridView();
    }

    return renderTableView();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Mis Servicios</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">
            Vista de listado por defecto con navegación mensual y filtros por estado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-violet-200 text-violet-700">
            {sortedServices.length} servicio{sortedServices.length !== 1 ? 's' : ''}
          </Badge>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={isLoadingServices || sortedServices.length === 0}
            >
              <Download className="size-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={isLoadingServices || sortedServices.length === 0}
            >
              <FileSpreadsheet className="size-4 mr-2" />
              Excel
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
              aria-label="Vista calendario"
            >
              <LayoutList className="mr-2 size-4" />
              Calendario
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              aria-label="Vista listado"
            >
              <List className="mr-2 size-4" />
              Listado
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              aria-label="Vista tarjetas"
            >
              <Grid className="mr-2 size-4" />
              Tarjetas
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-[180px] text-center">
              <p className="text-sm font-medium capitalize text-[#0f172a]">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </p>
              <p className="text-xs text-[#94a3b8]">Servicios del mes seleccionado</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetToCurrentMonth} className="ml-2">
              Mes actual
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todos ({getServicesForMonth(services || [], currentMonth, 'all').length})
            </Button>
            {availableStatuses.map(([status, count]) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {getServiceStatusLabel(status)} ({count})
              </Button>
            ))}
          </div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
};

export default PortalServices;
