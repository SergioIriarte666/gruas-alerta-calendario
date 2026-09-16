import { parseDateValue } from '@/utils/calendarDate';
import { useMemo, useState } from "react";
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
} from "date-fns";
import { es } from "date-fns/locale";
import { useClientServices } from "@/hooks/portal/useClientServices";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatForDisplay } from "@/utils/timezoneUtils";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalServiceCard } from "@/components/portal/PortalServiceCard";
import { useClientServiceExport } from "@/hooks/portal/useClientServiceExport";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  formatCurrency,
  formatVehicleInfo,
  getServiceStatusBadge,
  getServiceStatusLabel,
} from "@/utils/statusHelpers";
import { businessClock } from "@/utils/businessClock";
import {
  getMonthBounds,
  getMonthStatusCounts,
  getServiceDateKey,
  getServicesForMonth,
} from "./portalServices.utils";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";

type ServiceSortField =
  | "folio"
  | "service_date"
  | "vehicle"
  | "service_type_name"
  | "route"
  | "value"
  | "status";
type SortDirection = "asc" | "desc";

const PortalServices = () => {
  const { data: services, isLoading, isError, error } = useClientServices();
  const [viewMode, setViewMode] = useState<"month" | "table" | "grid">("table");
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(businessClock.todayDate()),
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tableSortField, setTableSortField] =
    useState<ServiceSortField>("service_date");
  const [tableSortDirection, setTableSortDirection] =
    useState<SortDirection>("desc");

  const monthServices = useMemo(
    () => getServicesForMonth(services || [], currentMonth, statusFilter),
    [services, currentMonth, statusFilter],
  );

  const sortedServices = useMemo(() => {
    return [...monthServices].sort((a, b) => {
      if (a.is_portal_request && !b.is_portal_request) return -1;
      if (!a.is_portal_request && b.is_portal_request) return 1;
      return (
        parseDateValue(b.service_date).getTime() - parseDateValue(a.service_date).getTime()
      );
    });
  }, [monthServices]);

  const monthStatusCounts = useMemo(
    () => getMonthStatusCounts(services || [], currentMonth),
    [services, currentMonth],
  );

  const availableStatuses = useMemo(() => {
    return Object.entries(monthStatusCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [monthStatusCounts]);

  const { start: monthStart, end: monthEnd } = getMonthBounds(currentMonth);
  const { exportToPDF, exportToExcel, isLoadingServices } =
    useClientServiceExport(sortedServices, monthStart, monthEnd);

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
    return sortedServices.reduce<Record<string, typeof sortedServices>>(
      (accumulator, service) => {
        const key = getServiceDateKey(service.service_date);
        accumulator[key] = [...(accumulator[key] || []), service];
        return accumulator;
      },
      {},
    );
  }, [sortedServices]);

  const sortedTableServices = useMemo(() => {
    return [...sortedServices].sort((a, b) => {
      let comparison = 0;

      switch (tableSortField) {
        case "folio":
          comparison = a.folio.localeCompare(b.folio, "es", {
            numeric: true,
            sensitivity: "base",
          });
          break;
        case "service_date":
          comparison =
            parseDateValue(a.service_date).getTime() -
            parseDateValue(b.service_date).getTime();
          break;
        case "vehicle":
          comparison = formatVehicleInfo(a).localeCompare(
            formatVehicleInfo(b),
            "es",
            {
              numeric: true,
              sensitivity: "base",
            },
          );
          break;
        case "service_type_name":
          comparison = a.service_type_name.localeCompare(
            b.service_type_name,
            "es",
            {
              numeric: true,
              sensitivity: "base",
            },
          );
          break;
        case "route": {
          const routeA = `${a.origin} ${a.destination}`;
          const routeB = `${b.origin} ${b.destination}`;
          comparison = routeA.localeCompare(routeB, "es", {
            numeric: true,
            sensitivity: "base",
          });
          break;
        }
        case "value":
          comparison = a.value - b.value;
          break;
        case "status":
          comparison = getServiceStatusLabel(a.status).localeCompare(
            getServiceStatusLabel(b.status),
            "es",
            {
              numeric: true,
              sensitivity: "base",
            },
          );
          break;
      }

      return tableSortDirection === "asc" ? comparison : -comparison;
    });
  }, [sortedServices, tableSortField, tableSortDirection]);

  const mobileMonthDays = useMemo(() => {
    return calendarDays.filter((day) => isSameMonth(day, currentMonth));
  }, [calendarDays, currentMonth]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((previousMonth) =>
      direction === "prev"
        ? subMonths(previousMonth, 1)
        : addMonths(previousMonth, 1),
    );
  };

  const resetToCurrentMonth = () => {
    setCurrentMonth(startOfMonth(businessClock.todayDate()));
  };

  const handleTableSort = (field: ServiceSortField) => {
    if (tableSortField === field) {
      setTableSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setTableSortField(field);
    setTableSortDirection(
      field === "service_date" || field === "value" ? "desc" : "asc",
    );
  };

  const renderSortIcon = (field: ServiceSortField) => {
    if (tableSortField !== field) {
      return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
    }

    return tableSortDirection === "asc" ? (
      <ArrowUp className="ml-2 size-4 text-primary" />
    ) : (
      <ArrowDown className="ml-2 size-4 text-primary" />
    );
  };

  const renderSortableTableHead = (
    label: string,
    field: ServiceSortField,
    align: "left" | "right" | "center" = "left",
  ) => {
    const justifyClassName =
      align === "right"
        ? "justify-end"
        : align === "center"
          ? "justify-center"
          : "justify-start";
    const headClassName =
      align === "right"
        ? "text-right text-muted-foreground"
        : align === "center"
          ? "text-center text-muted-foreground"
          : "text-muted-foreground";

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
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
      <History className="mb-4 size-12 text-muted-foreground" />
      <h3 className="text-lg font-semibold text-foreground">
        Sin servicios en este mes
      </h3>
      <p className="text-muted-foreground">
        No encontramos servicios para{" "}
        {format(currentMonth, "MMMM yyyy", { locale: es })} con el filtro
        aplicado.
      </p>
    </div>
  );

  const renderMonthView = () => {
    if (sortedServices.length === 0) {
      return renderEmptyState();
    }

    return (
      <div className="space-y-4">
        <div className="portal-data-panel hidden md:block">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
              (dayLabel) => (
                <div
                  key={dayLabel}
                  className="px-3 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {dayLabel}
                </div>
              ),
            )}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayServices = servicesByDate[dayKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={dayKey}
                  className={`min-h-36 border-b border-r border-border/60 p-2 ${
                    isCurrentMonth ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {dayServices.length > 0 && (
                      <Badge
                        variant="outline"
                        className="border-primary/25 text-xs text-primary"
                      >
                        {dayServices.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {dayServices.slice(0, 2).map((service) => (
                      <div
                        key={service.id}
                        className="rounded-lg border border-border/60 bg-muted/40 p-2"
                      >
                        <p className="truncate text-xs font-medium text-primary">
                          {service.folio}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatVehicleInfo(service)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {service.origin} → {service.destination}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {formatCurrency(service.value)}
                          </span>
                          {getServiceStatusBadge(service.status)}
                        </div>
                      </div>
                    ))}
                    {dayServices.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{dayServices.length - 2} más
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {mobileMonthDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayServices = servicesByDate[dayKey] || [];

            if (dayServices.length === 0) return null;

            return (
              <div
                key={dayKey}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {format(day, "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dayServices.length} servicio(s)
                    </p>
                  </div>
                  {isToday(day) && (
                    <Badge className="border-primary/25 bg-accent text-primary">
                      Hoy
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {dayServices.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-lg border border-border/60 bg-muted/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-primary">
                          {service.folio}
                        </p>
                        {getServiceStatusBadge(service.status)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatVehicleInfo(service)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {service.service_type_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {service.origin} → {service.destination}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
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
      <div className="portal-data-panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {renderSortableTableHead("Folio", "folio")}
              {renderSortableTableHead("Fecha", "service_date")}
              {renderSortableTableHead("Vehículo", "vehicle")}
              {renderSortableTableHead("Tipo", "service_type_name")}
              {renderSortableTableHead("Ruta", "route")}
              {renderSortableTableHead("Valor", "value", "right")}
              {renderSortableTableHead("Estado", "status", "center")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTableServices.map((service) => (
              <TableRow
                key={service.id}
                className="border-border/60 bg-muted/40 hover:bg-accent/60"
              >
                <TableCell className="font-medium text-primary">
                  {service.folio}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatForDisplay(service.service_date)}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatVehicleInfo(service)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {service.service_type_name}
                </TableCell>
                <TableCell
                  className="max-w-xs truncate text-muted-foreground"
                  title={`${service.origin} → ${service.destination}`}
                >
                  {service.origin} → {service.destination}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatCurrency(service.value)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {getServiceStatusBadge(service.status)}
                    {service.is_portal_request && (
                      <Badge className="border-warning/30 bg-warning-soft text-xs text-warning-text">
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
            <Skeleton key={i} className="h-12 w-full bg-muted" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-soft p-8 text-center">
          <AlertTriangle className="mb-4 size-12 text-danger-text" />
          <h3 className="text-lg font-semibold text-foreground">
            Error al cargar servicios
          </h3>
          <p className="text-danger-text">
            {error?.message || "Ocurrió un error inesperado."}
          </p>
        </div>
      );
    }

    if (!services || services.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
          <History className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Sin servicios registrados
          </h3>
          <p className="text-muted-foreground">
            No hemos encontrado servicios asociados a tu cuenta.
          </p>
        </div>
      );
    }

    if (viewMode === "month") {
      return renderMonthView();
    }

    if (viewMode === "grid") {
      return renderGridView();
    }

    return renderTableView();
  };

  return (
    <div className="portal-page portal-services-page space-y-6">
      <PortalPageHeader
        eyebrow="Historial operacional"
        title="Mis servicios"
        description="Consulta traslados, estados, vehículos y valores desde una vista unificada."
        icon={History}
        actions={
          <>
          <span className="portal-count-badge">
            {sortedServices.length} servicio
            {sortedServices.length !== 1 ? "s" : ""}
          </span>
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
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
              aria-label="Vista calendario"
            >
              <LayoutList className="mr-2 size-4" />
              Calendario
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
              aria-label="Vista listado"
            >
              <List className="mr-2 size-4" />
              Listado
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              aria-label="Vista tarjetas"
            >
              <Grid className="mr-2 size-4" />
              Tarjetas
            </Button>
          </div>
          </>
        }
      />

      <div className="portal-filter-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-44 text-center">
              <p className="text-sm font-medium capitalize text-foreground">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground">
                Servicios del mes seleccionado
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToCurrentMonth}
              className="ml-2"
            >
              Mes actual
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              Todos (
              {getServicesForMonth(services || [], currentMonth, "all").length})
            </Button>
            {availableStatuses.map(([status, count]) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
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
