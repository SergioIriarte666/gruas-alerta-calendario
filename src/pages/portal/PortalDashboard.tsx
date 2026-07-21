import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  FileWarning as FileAlert,
  History,
  PlusCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useClientServices } from "@/hooks/portal/useClientServices";
import { useClientInvoices } from "@/hooks/portal/useClientInvoices";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency, getServiceStatusBadge } from "@/utils/statusHelpers";
import {
  getBusinessToday,
  safeDaysSince,
  safeParseDateOnly,
} from "@/utils/timezoneUtils";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PortalDashboard");

const calculateDaysUntilDue = (
  dueDate: string | null,
  status: string,
): JSX.Element => {
  if (status === "paid") {
    return <StatusBadge tone="paid">Pagada</StatusBadge>;
  }

  if (!dueDate) {
    return <StatusBadge tone="neutral">Sin fecha</StatusBadge>;
  }

  try {
    const todayStr = getBusinessToday();
    const dueStr = dueDate.slice(0, 10);
    const days = -safeDaysSince(dueStr, todayStr);

    if (days > 7) {
      return <StatusBadge tone="completed">+{days} dias</StatusBadge>;
    }

    if (days >= 1) {
      return <StatusBadge tone="pending">+{days} dias</StatusBadge>;
    }

    if (days === 0) {
      return <StatusBadge tone="pending">Hoy</StatusBadge>;
    }

    return <StatusBadge tone="overdue">{days} dias</StatusBadge>;
  } catch (error) {
    logger.error("Error calculating days until due:", error);
    return <StatusBadge tone="neutral">Error</StatusBadge>;
  }
};

const PortalDashboard: React.FC = () => {
  const { user } = useUser();
  const {
    data: services,
    isLoading: servicesLoading,
    error: servicesError,
    refetch: refetchServices,
  } = useClientServices();
  const {
    data: invoices,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useClientInvoices();

  const totalServicios = services?.length || 0;
  const serviciosSinOC =
    services?.filter((service) => service.needs_purchase_order).length || 0;
  const facturasPendientes =
    invoices
      ?.filter((invoice) => invoice.status === "sent")
      .reduce((sum, invoice) => sum + invoice.total, 0) || 0;
  const facturasVencidas =
    invoices
      ?.filter((invoice) => invoice.status === "overdue")
      .reduce((sum, invoice) => sum + invoice.total, 0) || 0;
  const serviciosRecientes = services?.slice(0, 5) || [];
  const facturasRecientes =
    invoices
      ?.filter(
        (invoice) => invoice.status === "sent" || invoice.status === "overdue",
      )
      .slice(0, 3) || [];
  const firstName = user?.name?.split(" ")[0] || "Cliente";

  const handleRetryServices = () => {
    logger.debug("Retrying services fetch...");
    refetchServices();
  };

  const metricCards = [
    {
      label: "Total servicios",
      value: servicesLoading ? "..." : totalServicios,
      accentClass: "bg-primary",
      iconBg: "bg-accent",
      iconColor: "text-primary",
      valueColor: "text-foreground",
      delta:
        totalServicios > 0
          ? `+${Math.min(totalServicios, 3)} este mes`
          : "Sin movimientos",
      deltaColor:
        totalServicios > 0 ? "text-success-text" : "text-muted-foreground",
      icon: History,
    },
    {
      label: "Sin orden de compra",
      value: servicesLoading ? "..." : serviciosSinOC,
      accentClass: "bg-warning",
      iconBg: "bg-warning-soft",
      iconColor: "text-warning-text",
      valueColor:
        serviciosSinOC > 0 ? "text-warning-text" : "text-muted-foreground",
      delta: serviciosSinOC > 0 ? "Requieren OC" : "Al dia",
      deltaColor:
        serviciosSinOC > 0 ? "text-warning-text" : "text-success-text",
      icon: FileAlert,
    },
    {
      label: "Facturas pendientes",
      value: invoicesLoading ? "..." : formatCurrency(facturasPendientes),
      accentClass: "bg-warning",
      iconBg: "bg-warning-soft",
      iconColor: "text-warning-text",
      valueColor: "text-warning-text",
      delta: facturasPendientes > 0 ? "Por regularizar" : "Al dia",
      deltaColor:
        facturasPendientes > 0 ? "text-warning-text" : "text-success-text",
      icon: Clock,
    },
    {
      label: "Facturas vencidas",
      value: invoicesLoading ? "..." : formatCurrency(facturasVencidas),
      accentClass: "bg-danger",
      iconBg: "bg-danger-soft",
      iconColor: "text-danger-text",
      valueColor: "text-danger-text",
      delta: facturasVencidas > 0 ? "Requieren atencion" : "Sin atraso",
      deltaColor:
        facturasVencidas > 0 ? "text-danger-text" : "text-success-text",
      icon: AlertTriangle,
    },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-medium text-foreground">
          Buenos dias, {firstName}
        </h1>
        <p className="mb-5 text-xs text-muted-foreground">
          Resumen de tu cuenta actualizado
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.label}
              className="relative overflow-hidden rounded-lg border border-border bg-card p-3"
            >
              <div className={`absolute bottom-0 left-0 top-0 w-1 ${metric.accentClass}`} />
              <div
                className={`mb-2.5 flex h-7 w-7 items-center justify-center rounded-md ${metric.iconBg}`}
              >
                <Icon className={`size-3.5 ${metric.iconColor}`} />
              </div>
              <p
                className={`mb-1 text-lg font-medium leading-none ${metric.valueColor}`}
              >
                {metric.value}
              </p>
              <p className="mb-1 text-xs text-muted-foreground">
                {metric.label}
              </p>
              <p
                className={`flex items-center gap-1 text-xs ${metric.deltaColor}`}
              >
                <TrendingUp className="size-3" />
                {metric.delta}
              </p>
            </div>
          );
        })}
      </div>

      {serviciosSinOC > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-warning">
            <FileAlert className="size-4 text-warning-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-text">
              {serviciosSinOC} servicio{serviciosSinOC !== 1 ? "s" : ""}{" "}
              esperando orden de compra
            </p>
            <p className="mt-0.5 text-xs text-warning-text">
              Envia tu OC para que podamos emitir la factura correspondiente
            </p>
            <div className="mt-3 space-y-2">
              {services
                ?.filter((service) => service.needs_purchase_order)
                .slice(0, 2)
                .map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between rounded-lg border border-warning/30 bg-card px-3 py-2"
                  >
                    <div>
                      <span className="text-xs font-medium text-warning-text">
                        {service.folio}
                      </span>
                      <span className="ml-2 text-xs text-warning-text">
                        {service.origin} → {service.destination}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-warning-text">
                        {formatCurrency(service.value)}
                      </span>
                      <Link to="/portal/purchase-orders">
                        <button
                          type="button"
                          className="rounded-md bg-warning px-2 py-1 text-xs font-medium text-warning-foreground hover:bg-warning/90"
                        >
                          Enviar OC
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              {serviciosSinOC > 2 && (
                <Link
                  to="/portal/purchase-orders"
                  className="text-xs text-warning-text underline"
                >
                  Ver los {serviciosSinOC - 2} restantes →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border border-border bg-card shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-foreground">
              Servicios Recientes
              <div className="flex items-center gap-2">
                {servicesError && (
                  <Button
                    onClick={handleRetryServices}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    <RefreshCw className="size-3 mr-1" />
                    Reintentar
                  </Button>
                )}
                <Link
                  to="/portal/services"
                  className="text-sm text-primary hover:text-primary"
                >
                  <span className="text-sm">Ver todos</span>
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="text-muted-foreground">Cargando servicios...</div>
            ) : servicesError ? (
              <div className="text-center py-8">
                <AlertTriangle className="size-12 mx-auto mb-4 text-danger-text" />
                <p className="mb-2 text-danger-text">
                  Error al cargar servicios
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  No se pudieron cargar tus servicios
                </p>
                <Button
                  onClick={handleRetryServices}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="size-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            ) : serviciosRecientes.length > 0 ? (
              <div className="space-y-1.5">
                {serviciosRecientes.map((service) => (
                  <div
                    key={service.id}
                    className={`flex items-center justify-between rounded-md border px-2.5 py-2 ${
                      service.status === "in_progress"
                        ? "border-primary/25 bg-accent"
                        : "border-border/60 bg-muted/40"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-primary">
                        {service.folio}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {service.origin} → {service.destination}
                      </p>
                      <p className="text-xs text-muted-foreground/50">
                        {format(
                          safeParseDateOnly(service.service_date),
                          "dd/MM/yyyy",
                          { locale: es },
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">
                        {formatCurrency(service.value)}
                      </p>
                      {service.is_portal_request ? (
                        <div className="mt-1 flex justify-end gap-2">
                          {getServiceStatusBadge(service.status)}
                          <Badge className="border-warning/30 bg-warning-soft text-xs text-warning-text">
                            Solicitud pendiente de asignacion
                          </Badge>
                        </div>
                      ) : (
                        getServiceStatusBadge(service.status)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <History className="mx-auto mb-4 size-12 opacity-50" />
                <p>No hay servicios registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-foreground">
                Facturas Recientes
                <Link
                  to="/portal/invoices"
                  className="text-sm text-primary hover:text-primary"
                >
                  <span className="text-sm">Ver todas</span>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="text-muted-foreground">
                  Cargando facturas...
                </div>
              ) : invoicesError ? (
                <div className="text-center py-6">
                  <AlertTriangle className="size-10 mx-auto mb-3 text-danger-text" />
                  <p className="text-sm text-danger-text">
                    No se pudieron cargar las facturas
                  </p>
                </div>
              ) : facturasRecientes.length > 0 ? (
                <div className="space-y-3">
                  {facturasRecientes.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="rounded-lg border border-border/60 bg-muted/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {invoice.folio}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Emision{" "}
                            {format(
                              safeParseDateOnly(invoice.issue_date),
                              "dd/MM/yyyy",
                              { locale: es },
                            )}
                          </p>
                        </div>
                        <p
                          className={`font-bold ${invoice.status === "overdue" ? "text-danger-text" : "text-warning-text"}`}
                        >
                          {formatCurrency(invoice.total)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusBadge tone={invoice.status === "overdue" ? "overdue" : "pending"}>
                          {invoice.status === "overdue"
                            ? "Vencida"
                            : "Pendiente"}
                        </StatusBadge>
                        {calculateDaysUntilDue(
                          invoice.due_date,
                          invoice.status,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-3 size-10 opacity-50" />
                  <p>No hay facturas pendientes o vencidas</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Link
            to="/portal/request-service"
            className="flex items-center gap-3 rounded-lg bg-gradient-primary p-3.5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary-foreground/15">
              <PlusCircle className="size-4 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-primary-foreground">
                Solicitar nuevo servicio
              </p>
              <p className="text-xs text-primary-foreground/70">Disponible las 24 horas</p>
            </div>
            <ArrowRight className="size-4 text-primary-foreground/75" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PortalDashboard;
