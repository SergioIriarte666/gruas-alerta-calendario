import { businessClock } from "@/utils/businessClock";

import { useMemo, useState } from "react";
import {
  useClientInvoices,
  type ClientInvoice,
} from "@/hooks/portal/useClientInvoices";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  AlertTriangle,
  FileText,
  Download,
  CalendarIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatForDisplay,
  safeParseDateOnly,
  safeDaysSince,
  getBusinessToday,
} from "@/utils/timezoneUtils";
import { useSettings } from "@/hooks/useSettings";
import { exportInvoiceReport } from "@/utils/reports/invoiceReportExporter";
import { formatCurrency } from "@/utils/statusHelpers";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";

const logger = createLogger("PortalInvoices");

const getStatusBadge = (status: string) => {
  const statusConfig: { [key: string]: { label: string; tone: StatusTone } } =
    {
      paid: { label: "Pagada", tone: "paid" },
      sent: { label: "Enviada", tone: "pending" },
      draft: { label: "Borrador", tone: "draft" },
      overdue: { label: "Vencida", tone: "overdue" },
      cancelled: { label: "Cancelada", tone: "cancelled" },
    };

  const config = statusConfig[status] || {
    label: status,
    tone: "neutral" as const,
  };
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
};

const calculateDaysUntilDue = (
  dueDate: string | null,
  status: string,
): JSX.Element => {
  // Si ya está pagada, no mostrar días de atraso
  if (status === "paid") {
    return <StatusBadge tone="paid">✓ Pagada</StatusBadge>;
  }

  if (!dueDate)
    return <StatusBadge tone="neutral">Sin fecha</StatusBadge>;

  try {
    const todayStr = getBusinessToday();
    const dueStr = (dueDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) {
      return <StatusBadge tone="neutral">Fecha inválida</StatusBadge>;
    }
    // safeDaysSince(dueStr, todayStr) = today - due. Invertimos: días hasta vencer = due - today.
    const days = -safeDaysSince(dueStr, todayStr);

    if (days > 7) {
      return <StatusBadge tone="completed">+{days} días</StatusBadge>;
    } else if (days >= 1 && days <= 7) {
      return <StatusBadge tone="pending">+{days} días</StatusBadge>;
    } else if (days === 0) {
      return <StatusBadge tone="pending">Hoy</StatusBadge>;
    } else {
      return <StatusBadge tone="overdue">{days} días</StatusBadge>;
    }
  } catch (error) {
    logger.error("Error calculating days until due:", error);
    return <StatusBadge tone="neutral">Error</StatusBadge>;
  }
};

const PortalInvoices = () => {
  const { settings } = useSettings();
  const { data: invoices, isLoading, isError, error } = useClientInvoices();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter)
        return false;

      const issueDate = safeParseDateOnly(invoice.issue_date);
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo && issueDate > dateTo) return false;

      return true;
    });
  }, [invoices, statusFilter, dateFrom, dateTo]);

  const hasFilters = statusFilter !== "all" || dateFrom || dateTo;
  const pickerBaseClassName =
    "h-11 w-44 justify-start rounded-xl border-input px-3 text-left font-normal shadow-sm transition-colors hover:bg-muted/70";

  const handleClearFilters = () => {
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleDownloadInvoice = async (invoice: ClientInvoice) => {
    if (!settings) {
      toast.error("No se pudo exportar la factura", {
        description:
          "La configuración de la empresa todavía no está disponible.",
      });
      return;
    }

    try {
      await exportInvoiceReport({
        format: "pdf",
        invoices: [
          {
            id: invoice.id,
            folio: invoice.folio,
            client: invoice.client ?? undefined,
            numeroFiscal: invoice.numero_fiscal,
            issueDate: invoice.issue_date,
            dueDate: invoice.due_date,
            paymentDate: invoice.payment_date ?? undefined,
            subtotal: Number(invoice.subtotal || 0),
            vat: Number(invoice.vat || 0),
            total: Number(invoice.total || 0),
            paidAmount:
              Number(invoice.total || 0) -
              Number(invoice.remaining_amount || 0),
            remainingAmount: Number(invoice.remaining_amount || 0),
            notes: invoice.notes ?? undefined,
            productServiceDescription:
              invoice.product_service_description ?? "",
            status: invoice.status,
          },
        ],
        settings,
        appliedFilters: {
          clientName: invoice.client?.name,
          dateFrom: invoice.issue_date,
          dateTo: invoice.issue_date,
        },
        metrics: {
          totalInvoiced: Number(invoice.total || 0),
          totalPaid:
            Number(invoice.total || 0) - Number(invoice.remaining_amount || 0),
          pendingAmount: Number(invoice.remaining_amount || 0),
          overdueInvoices: invoice.status === "overdue" ? 1 : 0,
        },
      });
    } catch (downloadError) {
      logger.error("Error exporting portal invoice:", downloadError);
      toast.error("No se pudo exportar la factura", {
        description: "Intente nuevamente en unos segundos.",
      });
    }
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
          <AlertTriangle className="size-12 text-danger-text mb-4" />
          <h3 className="text-lg font-semibold text-foreground">
            Error al cargar facturas
          </h3>
          <p className="text-danger-text">
            {error?.message || "Ocurrió un error inesperado."}
          </p>
        </div>
      );
    }

    if (!filteredInvoices || filteredInvoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-8 text-center">
          <FileText className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            Sin facturas
          </h3>
          <p className="text-muted-foreground">
            {hasFilters
              ? "No encontramos facturas para los filtros seleccionados."
              : "No hemos encontrado facturas asociadas a su cuenta."}
          </p>
        </div>
      );
    }

    return (
      <div className="portal-data-panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">N° Fiscal</TableHead>
              <TableHead className="text-muted-foreground">
                Fecha Emisión
              </TableHead>
              <TableHead className="text-muted-foreground">
                Fecha Vencimiento
              </TableHead>
              <TableHead className="text-center text-muted-foreground">
                Días para Vencimiento
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                Total
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                Saldo pendiente
              </TableHead>
              <TableHead className="text-center text-muted-foreground">
                Estado
              </TableHead>
              <TableHead className="text-center text-muted-foreground">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className="border-border/60 bg-muted/40 hover:bg-accent/60"
              >
                <TableCell className="text-muted-foreground">
                  {invoice.numero_fiscal ? (
                    <span className="font-medium text-primary">
                      {invoice.numero_fiscal}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground">
                      Sin asignar
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatForDisplay(invoice.issue_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatForDisplay(invoice.due_date)}
                </TableCell>
                <TableCell className="text-center">
                  {calculateDaysUntilDue(invoice.due_date, invoice.status)}
                </TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className="text-right text-warning-text">
                  {Number(invoice.remaining_amount || 0) > 0 ? (
                    formatCurrency(invoice.remaining_amount || 0)
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(invoice.status)}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadInvoice(invoice)}
                    className="text-primary hover:bg-accent hover:text-primary/80"
                    title="Descargar PDF"
                  >
                    <Download className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const totalPorPagar = filteredInvoices
    .filter((invoice) => invoice.status === "sent")
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const totalVencido = filteredInvoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div className="portal-page portal-invoices-page">
      <PortalPageHeader
        eyebrow="Estado financiero"
        title="Mis facturas"
        description="Consulta vencimientos, saldos y descarga tus documentos tributarios."
        icon={FileText}
        actions={
          invoices ? (
          <span className="portal-count-badge">
            {filteredInvoices.length} factura
            {filteredInvoices.length !== 1 ? "s" : ""}
          </span>
          ) : undefined
        }
      />

      {/* Resumen de facturas */}
      {invoices && invoices.length > 0 && (
        <div className="portal-invoice-metrics">
          <div className="portal-invoice-metric is-warning">
            <small>Total por pagar</small>
            <strong>{formatCurrency(totalPorPagar)}</strong>
          </div>
          <div className="portal-invoice-metric is-danger">
            <small>Total vencido</small>
            <strong>{formatCurrency(totalVencido)}</strong>
          </div>
          <div className="portal-invoice-metric">
            <small>Facturas encontradas</small>
            <strong>{filteredInvoices.length}</strong>
          </div>
        </div>
      )}

      <div className="portal-filter-panel mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Filtros:
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 border-border bg-muted/40 text-left text-foreground">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Pendientes</SelectItem>
                <SelectItem value="paid">Pagadas</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Desde:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    pickerBaseClassName,
                    dateFrom
                      ? "border-primary/30 bg-accent text-foreground"
                      : "bg-muted/40 text-foreground",
                    !dateFrom && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateFrom ? (
                    format(dateFrom, "dd/MM/yyyy", { locale: es })
                  ) : (
                    <span>Seleccionar</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  disabled={(date) =>
                    date > businessClock.now() || (dateTo && date > dateTo)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hasta:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    pickerBaseClassName,
                    dateTo
                      ? "border-primary/30 bg-accent text-foreground"
                      : "bg-muted/40 text-foreground",
                    !dateTo && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateTo ? (
                    format(dateTo, "dd/MM/yyyy", { locale: es })
                  ) : (
                    <span>Seleccionar</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  disabled={(date) =>
                    date > businessClock.now() || (dateFrom && date < dateFrom)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-11 rounded-xl px-3 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <X className="mr-1 size-4" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {renderContent()}
    </div>
  );
};

export default PortalInvoices;
