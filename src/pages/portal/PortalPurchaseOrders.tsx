import { differenceInCalendarDates } from '@/utils/calendarDate';
import { parseDateValue } from '@/utils/calendarDate';
import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle,
  FileWarning as FileAlert,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useClientServices } from "@/hooks/portal/useClientServices";
import { formatCurrency, formatVehicleInfo } from "@/utils/statusHelpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { safeParseDateOnly } from "@/utils/timezoneUtils";
import { getPurchaseOrderPendingServices } from "./portalServices.utils";
import { businessClock } from "@/utils/businessClock";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";

const daysPending = (serviceDate: string): number => {
  const svc = parseDateValue(serviceDate);
  const today = businessClock.todayDate();
  today.setHours(0, 0, 0, 0);
  svc.setHours(0, 0, 0, 0);
  return differenceInCalendarDates(today, svc);
};

const getDaysPendingClassName = (days: number) => {
  if (days > 30) return "text-danger-text";
  if (days > 14) return "text-warning-text";
  return "text-muted-foreground";
};

type PurchaseOrderSortField =
  "folio" | "service_date" | "vehicle" | "route" | "value" | "days_pending";
type SortDirection = "asc" | "desc";

const PortalPurchaseOrders: React.FC = () => {
  const { data: services, isLoading, isError, error } = useClientServices();
  const [tableSortField, setTableSortField] =
    useState<PurchaseOrderSortField>("service_date");
  const [tableSortDirection, setTableSortDirection] =
    useState<SortDirection>("asc");

  const pendingPurchaseOrders = useMemo(
    () =>
      getPurchaseOrderPendingServices(services || []).sort(
        (a, b) =>
          safeParseDateOnly(a.service_date).getTime() -
          safeParseDateOnly(b.service_date).getTime(),
      ),
    [services],
  );

  const sortedPendingPurchaseOrders = useMemo(() => {
    return [...pendingPurchaseOrders].sort((a, b) => {
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
            safeParseDateOnly(a.service_date).getTime() -
            safeParseDateOnly(b.service_date).getTime();
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
        case "days_pending":
          comparison =
            daysPending(a.service_date) - daysPending(b.service_date);
          break;
      }

      return tableSortDirection === "asc" ? comparison : -comparison;
    });
  }, [pendingPurchaseOrders, tableSortField, tableSortDirection]);

  const handleTableSort = (field: PurchaseOrderSortField) => {
    if (tableSortField === field) {
      setTableSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setTableSortField(field);
    setTableSortDirection(
      field === "service_date"
        ? "asc"
        : field === "value" || field === "days_pending"
          ? "desc"
          : "asc",
    );
  };

  const renderSortIcon = (field: PurchaseOrderSortField) => {
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
    field: PurchaseOrderSortField,
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

  if (isLoading) {
    return (
      <div className="portal-page space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="portal-page flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger-soft p-8 text-center">
        <AlertTriangle className="mb-4 size-12 text-danger-text" />
        <h2 className="text-lg font-semibold text-danger-text">
          Error al cargar las OC pendientes
        </h2>
        <p className="mt-1 text-sm text-danger-text">
          {error?.message || "Ocurrio un error inesperado."}
        </p>
      </div>
    );
  }

  return (
    <div className="portal-page portal-purchase-orders-page space-y-6">
      <PortalPageHeader
        eyebrow="Bandeja documental"
        title="Órdenes de compra"
        description="Regulariza los servicios cotizados que necesitan una O.C. para continuar su proceso administrativo."
        icon={FileAlert}
        actions={
          <span className="portal-count-badge is-warning">
          {pendingPurchaseOrders.length} pendiente
          {pendingPurchaseOrders.length !== 1 ? "s" : ""}
          </span>
        }
      />

      <Card className="portal-oc-guide border-warning/30 bg-warning-soft shadow-none">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-warning-soft">
            <FileAlert className="size-5 text-warning-text" />
          </div>
          <div>
            <p className="text-sm font-medium text-warning-text">
              Servicios cotizados sin orden de compra
            </p>
            <p className="mt-1 text-sm text-warning-text">
              Estos servicios estan en estado cotizado y necesitan el registro
              de la orden de compra para continuar con su proceso administrativo
              y operativo.
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingPurchaseOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
          <CheckCircle className="mb-4 size-14 text-success-text" />
          <h2 className="text-lg font-medium text-foreground">Todo al dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No tienes ordenes de compra pendientes.
          </p>
        </div>
      ) : (
        <Card className="portal-data-panel border-0 bg-card shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">
              Servicios pendientes de OC
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Los servicios mas antiguos aparecen primero para ayudarte a
              priorizar el envio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    {renderSortableTableHead("Folio", "folio")}
                    {renderSortableTableHead(
                      "Fecha del servicio",
                      "service_date",
                    )}
                    {renderSortableTableHead("Vehiculo", "vehicle")}
                    {renderSortableTableHead("Ruta", "route")}
                    {renderSortableTableHead("Valor", "value", "right")}
                    {renderSortableTableHead(
                      "Dias sin OC",
                      "days_pending",
                      "center",
                    )}
                    <TableHead className="text-muted-foreground">
                      Seguimiento
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPendingPurchaseOrders.map((service) => {
                    const pendingDays = daysPending(service.service_date);

                    return (
                      <TableRow
                        key={service.id}
                        className="border-border/60 bg-muted/40 hover:bg-accent/60"
                      >
                        <TableCell className="font-medium text-primary">
                          {service.folio}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(
                            safeParseDateOnly(service.service_date),
                            "dd/MM/yyyy",
                            { locale: es },
                          )}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {formatVehicleInfo(service)}
                        </TableCell>
                        <TableCell className="max-w-md text-muted-foreground">
                          {service.origin} → {service.destination}
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatCurrency(service.value)}
                        </TableCell>
                        <TableCell
                          className={`text-center font-medium ${getDaysPendingClassName(pendingDays)}`}
                        >
                          {pendingDays} dias
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className="w-fit border-warning/30 bg-warning-soft text-warning-text">
                              Falta orden de compra
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Coordina el envio de la O.C. con nuestro equipo
                              para continuar con el proceso
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
