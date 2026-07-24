import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDollarSign,
  FileText,
  FileWarning as FileAlert,
  History,
  Navigation,
  PackageCheck,
  Plus,
  RefreshCw,
  Route,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useClientServices } from "@/hooks/portal/useClientServices";
import { useClientInvoices } from "@/hooks/portal/useClientInvoices";
import { useClientBranding } from "@/hooks/portal/useClientBranding";
import { useUser } from "@/contexts/UserContext";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, getServiceStatusBadge } from "@/utils/statusHelpers";
import { safeParseDateOnly } from "@/utils/timezoneUtils";
import { createLogger } from "@/lib/logger";
import { businessClock } from "@/utils/businessClock";

const logger = createLogger("PortalDashboard");

const PortalDashboard: React.FC = () => {
  const { user } = useUser();
  const { data: branding } = useClientBranding();
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

  const totalServices = services?.length || 0;
  const purchaseOrdersPending =
    services?.filter((service) => service.needs_purchase_order).length || 0;
  const pendingInvoices =
    invoices
      ?.filter((invoice) => invoice.status === "sent")
      .reduce((sum, invoice) => sum + invoice.total, 0) || 0;
  const overdueInvoices =
    invoices
      ?.filter((invoice) => invoice.status === "overdue")
      .reduce((sum, invoice) => sum + invoice.total, 0) || 0;
  const openBalance = pendingInvoices + overdueInvoices;
  const recentServices = services?.slice(0, 4) || [];
  const overdueInvoice = invoices?.find(
    (invoice) => invoice.status === "overdue",
  );
  const activeService = services?.find(
    (service) => service.status === "in_progress",
  );
  const companyName = branding?.companyName || "Cliente";
  const companyGreeting = /[.!?]$/.test(companyName)
    ? companyName
    : `${companyName}.`;
  const currentHour = businessClock.now().getHours();
  const greeting =
    currentHour < 12
      ? "Buenos días"
      : currentHour < 20
        ? "Buenas tardes"
        : "Buenas noches";
  const attentionCount =
    purchaseOrdersPending + (overdueInvoice ? 1 : 0) + (servicesError ? 1 : 0);

  const handleRetryServices = () => {
    logger.debug("Retrying services fetch...");
    refetchServices();
  };

  const metricCards = [
    {
      label: "Servicios registrados",
      value: servicesLoading ? "…" : totalServices.toLocaleString("es-CL"),
      detail:
        totalServices > 0
          ? "Historial disponible"
          : "Aún sin movimientos",
      icon: Route,
      tone: "primary",
    },
    {
      label: "Órdenes pendientes",
      value: servicesLoading ? "…" : purchaseOrdersPending.toLocaleString("es-CL"),
      detail:
        purchaseOrdersPending > 0 ? "Requieren tu atención" : "Documentos al día",
      icon: FileAlert,
      tone: purchaseOrdersPending > 0 ? "warning" : "success",
    },
    {
      label: "Saldo por pagar",
      value: invoicesLoading ? "…" : formatCurrency(openBalance),
      detail:
        overdueInvoices > 0
          ? `${formatCurrency(overdueInvoices)} vencido`
          : "Sin facturas vencidas",
      icon: CircleDollarSign,
      tone: overdueInvoices > 0 ? "danger" : "success",
    },
  ];

  return (
    <div className="portal-page portal-dashboard">
      <header className="portal-dashboard-heading">
        <div>
          <span className="portal-dashboard-heading__eyebrow">
            Panel de operación
          </span>
          <h1>{greeting}, {companyGreeting}</h1>
          {user?.email && (
            <span className="portal-dashboard-heading__email">
              {user.email}
            </span>
          )}
          <p>
            {attentionCount > 0
              ? `Tu operación está activa. Hay ${attentionCount} elemento${attentionCount !== 1 ? "s" : ""} que requiere${attentionCount === 1 ? "" : "n"} atención.`
              : "Tu operación y tus documentos se encuentran al día."}
          </p>
        </div>
        <Button asChild className="portal-dashboard-heading__action">
          <Link to="/portal/request-service">
            <Plus />
            Solicitar servicio
          </Link>
        </Button>
      </header>

      <section className="portal-dashboard-overview">
        {activeService ? (
          <article className="portal-active-service">
            <div className="portal-active-service__header">
              <div>
                <span className="portal-active-service__kicker">
                  <i />
                  Servicio en curso
                </span>
                <h2>
                  <span>{activeService.origin || "Origen por confirmar"}</span>
                  <ArrowRight />
                  <span>{activeService.destination || "Destino por confirmar"}</span>
                </h2>
              </div>
              <StatusBadge tone="in_progress">En traslado</StatusBadge>
            </div>

            <div className="portal-service-journey" aria-label="Progreso del servicio">
              <div className="portal-service-journey__step is-complete">
                <span><Check /></span>
                <div>
                  <strong>Servicio confirmado</strong>
                  <small>{activeService.folio}</small>
                </div>
              </div>
              <i className="is-complete" />
              <div className="portal-service-journey__step is-complete">
                <span><Check /></span>
                <div>
                  <strong>Vehículo retirado</strong>
                  <small>{activeService.crane_license_plate || "Grúa asignada"}</small>
                </div>
              </div>
              <i className="is-progress" />
              <div className="portal-service-journey__step is-current">
                <span><Truck /></span>
                <div>
                  <strong>En camino al destino</strong>
                  <small>Operador {activeService.operator_name || "asignado"}</small>
                </div>
              </div>
              <i />
              <div className="portal-service-journey__step">
                <span><PackageCheck /></span>
                <div>
                  <strong>Entrega en destino</strong>
                  <small>Pendiente de confirmación</small>
                </div>
              </div>
            </div>

            <div className="portal-active-service__footer">
              <div>
                <span className="portal-active-service__vehicle">
                  <Truck />
                </span>
                <p>
                  <small>Vehículo trasladado</small>
                  <strong>
                    {[activeService.vehicle_brand, activeService.vehicle_model]
                      .filter(Boolean)
                      .join(" ") || "Información no registrada"}
                  </strong>
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/portal/services">
                  <Navigation />
                  Ver seguimiento
                </Link>
              </Button>
            </div>
          </article>
        ) : (
          <article className="portal-ready-state">
            <div className="portal-ready-state__mark">
              <Truck />
            </div>
            <div>
              <span className="portal-ready-state__eyebrow">
                Operación disponible
              </span>
              <h2>Listos para tu próximo traslado.</h2>
              <p>
                No tienes servicios en curso. Puedes revisar tu historial o
                crear una nueva solicitud cuando lo necesites.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/portal/services">
                Ver historial
                <ArrowRight />
              </Link>
            </Button>
          </article>
        )}

        <div className="portal-dashboard-metrics">
          {metricCards.map((metric) => {
            const Icon = metric.icon;

            return (
              <article
                className={`portal-dashboard-metric is-${metric.tone}`}
                key={metric.label}
              >
                <span className="portal-dashboard-metric__icon">
                  <Icon />
                </span>
                <div>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </div>
                <em>{metric.detail}</em>
              </article>
            );
          })}
        </div>
      </section>

      <section className="portal-dashboard-lower">
        <article className="portal-dashboard-panel portal-dashboard-recent">
          <div className="portal-section-heading">
            <div>
              <span className="portal-section-heading__eyebrow">
                Actividad reciente
              </span>
              <h2>Últimos servicios</h2>
            </div>
            <Link to="/portal/services">
              Ver todos
              <ArrowRight />
            </Link>
          </div>

          {servicesLoading ? (
            <div className="portal-dashboard-loading">
              Cargando servicios…
            </div>
          ) : servicesError ? (
            <div className="portal-dashboard-error">
              <AlertTriangle />
              <div>
                <strong>No pudimos cargar los servicios</strong>
                <small>Comprueba tu conexión e inténtalo nuevamente.</small>
              </div>
              <Button variant="outline" size="sm" onClick={handleRetryServices}>
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : recentServices.length > 0 ? (
            <div className="portal-dashboard-service-list">
              {recentServices.map((service) => (
                <div className="portal-dashboard-service-row" key={service.id}>
                  <span className="portal-dashboard-service-row__icon">
                    <Truck />
                  </span>
                  <div className="portal-dashboard-service-row__route">
                    <strong>
                      {service.origin || "Origen por confirmar"} →{" "}
                      {service.destination || "Destino por confirmar"}
                    </strong>
                    <small>
                      {service.folio} ·{" "}
                      {[service.vehicle_brand, service.vehicle_model]
                        .filter(Boolean)
                        .join(" ") || service.service_type_name}
                    </small>
                  </div>
                  <div className="portal-dashboard-service-row__value">
                    <strong>{formatCurrency(service.value)}</strong>
                    <small>
                      {format(
                        safeParseDateOnly(service.service_date),
                        "dd MMM yyyy",
                        { locale: es },
                      )}
                    </small>
                  </div>
                  <div className="portal-dashboard-service-row__status">
                    {getServiceStatusBadge(service.status)}
                  </div>
                  <ChevronLink />
                </div>
              ))}
            </div>
          ) : (
            <div className="portal-dashboard-empty">
              <History />
              <strong>Aún no hay servicios registrados</strong>
              <small>Tu actividad aparecerá aquí.</small>
            </div>
          )}
        </article>

        <article className="portal-dashboard-panel portal-dashboard-attention">
          <div className="portal-section-heading">
            <div>
              <span className="portal-section-heading__eyebrow">
                Bandeja de acción
              </span>
              <h2>Requiere tu atención</h2>
            </div>
            <span className="portal-dashboard-attention__count">
              {attentionCount}
            </span>
          </div>

          <div className="portal-dashboard-task-list">
            {purchaseOrdersPending > 0 && (
              <Link
                to="/portal/purchase-orders"
                className="portal-dashboard-task"
              >
                <span className="portal-dashboard-task__icon is-warning">
                  <FileAlert />
                </span>
                <div>
                  <strong>
                    {purchaseOrdersPending} servicio
                    {purchaseOrdersPending !== 1 ? "s" : ""} sin O.C.
                  </strong>
                  <small>Adjunta los documentos para continuar.</small>
                </div>
                <ArrowRight />
              </Link>
            )}
            {overdueInvoice && (
              <Link to="/portal/invoices" className="portal-dashboard-task">
                <span className="portal-dashboard-task__icon is-danger">
                  <FileText />
                </span>
                <div>
                  <strong>Factura {overdueInvoice.folio} vencida</strong>
                  <small>
                    Saldo de {formatCurrency(overdueInvoice.total)}
                  </small>
                </div>
                <ArrowRight />
              </Link>
            )}
            {invoicesError && (
              <div className="portal-dashboard-task">
                <span className="portal-dashboard-task__icon is-danger">
                  <AlertTriangle />
                </span>
                <div>
                  <strong>No pudimos consultar tus facturas</strong>
                  <small>Intenta nuevamente en unos minutos.</small>
                </div>
              </div>
            )}
            {attentionCount === 0 && !invoicesError && (
              <div className="portal-dashboard-clear">
                <span><Check /></span>
                <div>
                  <strong>Todo al día</strong>
                  <small>No tienes acciones pendientes.</small>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/portal/request-service"
            className="portal-dashboard-new-service"
          >
            <span><Plus /></span>
            <div>
              <strong>Solicitar nuevo servicio</strong>
              <small>Disponible las 24 horas</small>
            </div>
            <ArrowRight />
          </Link>
        </article>
      </section>
    </div>
  );
};

const ChevronLink = () => (
  <span className="portal-dashboard-service-row__arrow">
    <ArrowRight />
  </span>
);

export default PortalDashboard;
