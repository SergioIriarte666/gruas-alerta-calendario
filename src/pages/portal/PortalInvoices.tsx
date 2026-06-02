
import { useMemo, useState } from 'react';
import { useClientInvoices, type ClientInvoice } from '@/hooks/portal/useClientInvoices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, Download, CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatForDisplay, safeParseDateOnly, safeDaysSince, getBusinessToday } from '@/utils/timezoneUtils';
import { useSettings } from '@/hooks/useSettings';
import { exportInvoiceReport } from '@/utils/reports/invoiceReportExporter';
import { formatCurrency } from '@/utils/statusHelpers';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PortalInvoices");

const getStatusBadge = (status: string) => {
  const statusConfig: { [key: string]: { label: string; className: string } } = {
    paid: { label: 'Pagada', className: 'bg-green-500' },
    sent: { label: 'Enviada', className: 'bg-blue-500' },
    draft: { label: 'Borrador', className: 'bg-gray-500' },
    overdue: { label: 'Vencida', className: 'bg-red-500' },
    cancelled: { label: 'Cancelada', className: 'bg-gray-500' },
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-500' };
  return <Badge className={`${config.className} text-white`}>{config.label}</Badge>;
};

const calculateDaysUntilDue = (dueDate: string | null, status: string): JSX.Element => {
  // Si ya está pagada, no mostrar días de atraso
  if (status === 'paid') {
    return <Badge className="bg-green-500 text-white">✓ Pagada</Badge>;
  }

  if (!dueDate) return <Badge className="bg-gray-500 text-white">Sin fecha</Badge>;
  
  try {
    const todayStr = getBusinessToday();
    const dueStr = (dueDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueStr)) {
      return <Badge className="bg-gray-500 text-white">Fecha inválida</Badge>;
    }
    // safeDaysSince(dueStr, todayStr) = today - due. Invertimos: días hasta vencer = due - today.
    const days = -safeDaysSince(dueStr, todayStr);
    
    if (days > 7) {
      return <Badge className="bg-green-500 text-white">+{days} días</Badge>;
    } else if (days >= 1 && days <= 7) {
      return <Badge className="bg-yellow-500 text-white">+{days} días</Badge>;
    } else if (days === 0) {
      return <Badge className="bg-orange-500 text-white">Hoy</Badge>;
    } else {
      return <Badge className="bg-red-500 text-white">{days} días</Badge>;
    }
  } catch (error) {
    logger.error('Error calculating days until due:', error);
    return <Badge className="bg-gray-500 text-white">Error</Badge>;
  }
};

const PortalInvoices = () => {
  const { settings } = useSettings();
  const { data: invoices, isLoading, isError, error } = useClientInvoices();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false;

      const issueDate = safeParseDateOnly(invoice.issue_date);
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo && issueDate > dateTo) return false;

      return true;
    });
  }, [invoices, statusFilter, dateFrom, dateTo]);

  const hasFilters = statusFilter !== 'all' || dateFrom || dateTo;

  const handleClearFilters = () => {
    setStatusFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleDownloadInvoice = async (invoice: ClientInvoice) => {
    if (!settings) {
      toast.error('No se pudo exportar la factura', {
        description: 'La configuración de la empresa todavía no está disponible.',
      });
      return;
    }

    try {
      await exportInvoiceReport({
        format: 'pdf',
        invoices: [{
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
          paidAmount: Number(invoice.total || 0) - Number(invoice.remaining_amount || 0),
          remainingAmount: Number(invoice.remaining_amount || 0),
          notes: invoice.notes ?? undefined,
          productServiceDescription: invoice.product_service_description ?? '',
          status: invoice.status,
        }],
        settings,
        appliedFilters: {
          clientName: invoice.client?.name,
          dateFrom: invoice.issue_date,
          dateTo: invoice.issue_date,
        },
        metrics: {
          totalInvoiced: Number(invoice.total || 0),
          totalPaid: Number(invoice.total || 0) - Number(invoice.remaining_amount || 0),
          pendingAmount: Number(invoice.remaining_amount || 0),
          overdueInvoices: invoice.status === 'overdue' ? 1 : 0,
        },
      });
    } catch (downloadError) {
      logger.error('Error exporting portal invoice:', downloadError);
      toast.error('No se pudo exportar la factura', {
        description: 'Intente nuevamente en unos segundos.',
      });
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-gray-700" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-900/20 rounded-lg">
          <AlertTriangle className="size-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-white">Error al cargar facturas</h3>
          <p className="text-red-400">{error?.message || 'Ocurrió un error inesperado.'}</p>
        </div>
      );
    }

    if (!filteredInvoices || filteredInvoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800/50 rounded-lg">
          <FileText className="size-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-white">Sin facturas</h3>
          <p className="text-gray-400">
            {hasFilters
              ? 'No encontramos facturas para los filtros seleccionados.'
              : 'No hemos encontrado facturas asociadas a su cuenta.'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-gray-800/50">
              <TableHead className="text-gray-300">Folio</TableHead>
              <TableHead className="text-gray-300">N° Fiscal</TableHead>
              <TableHead className="text-gray-300">Fecha Emisión</TableHead>
              <TableHead className="text-gray-300">Fecha Vencimiento</TableHead>
              <TableHead className="text-gray-300 text-center">Días para Vencimiento</TableHead>
              <TableHead className="text-gray-300 text-right">Total</TableHead>
              <TableHead className="text-gray-300 text-right">Saldo pendiente</TableHead>
              <TableHead className="text-gray-300 text-center">Estado</TableHead>
              <TableHead className="text-gray-300 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => (
              <TableRow key={invoice.id} className="border-gray-700 hover:bg-gray-800/50">
                <TableCell className="font-medium text-tms-green">{invoice.folio}</TableCell>
                <TableCell className="text-gray-300">
                  {invoice.numero_fiscal ? (
                    <span className="text-tms-green font-medium">{invoice.numero_fiscal}</span>
                  ) : (
                    <span className="text-gray-500 italic">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="text-gray-300">
                  {formatForDisplay(invoice.issue_date)}
                </TableCell>
                <TableCell className="text-gray-300">
                  {formatForDisplay(invoice.due_date)}
                </TableCell>
                <TableCell className="text-center">
                  {calculateDaysUntilDue(invoice.due_date, invoice.status)}
                </TableCell>
                <TableCell className="text-gray-300 font-semibold text-right">
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className="text-right text-yellow-400">
                  {Number(invoice.remaining_amount || 0) > 0
                    ? formatCurrency(invoice.remaining_amount || 0)
                    : <span className="text-gray-500">-</span>}
                </TableCell>
                <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadInvoice(invoice)}
                    className="text-tms-green hover:text-white"
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

  const totalPorPagar = filteredInvoices.filter((invoice) => invoice.status === 'sent').reduce((sum, invoice) => sum + invoice.total, 0);
  const totalVencido = filteredInvoices.filter((invoice) => invoice.status === 'overdue').reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Mis Facturas</h1>
        {invoices && (
          <Badge variant="outline" className="text-tms-green border-tms-green">
            {filteredInvoices.length} factura{filteredInvoices.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Resumen de facturas */}
      {invoices && invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400">Total por Pagar</h3>
            <p className="text-xl font-bold text-yellow-500">{formatCurrency(totalPorPagar)}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400">Total Vencido</h3>
            <p className="text-xl font-bold text-red-500">{formatCurrency(totalVencido)}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-400">Total Facturas</h3>
            <p className="text-xl font-bold text-white">{filteredInvoices.length}</p>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-sm font-medium text-gray-300">Filtros:</h3>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Estado:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-background text-left text-white">
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
            <span className="text-sm text-gray-400">Desde:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateFrom ? (
                    format(dateFrom, 'dd/MM/yyyy', { locale: es })
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
                  disabled={(date) => date > new Date() || (dateTo && date > dateTo)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Hasta:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateTo ? (
                    format(dateTo, 'dd/MM/yyyy', { locale: es })
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
                  disabled={(date) => date > new Date() || (dateFrom && date < dateFrom)}
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
              className="text-gray-400 hover:text-white"
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
