
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
            <Skeleton key={i} className="h-12 w-full bg-[#e2e8f0]" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="size-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-[#0f172a]">Error al cargar facturas</h3>
          <p className="text-red-600">{error?.message || 'Ocurrió un error inesperado.'}</p>
        </div>
      );
    }

    if (!filteredInvoices || filteredInvoices.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white p-8 text-center">
          <FileText className="mb-4 size-12 text-[#94a3b8]" />
          <h3 className="text-lg font-semibold text-[#0f172a]">Sin facturas</h3>
          <p className="text-[#94a3b8]">
            {hasFilters
              ? 'No encontramos facturas para los filtros seleccionados.'
              : 'No hemos encontrado facturas asociadas a su cuenta.'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-[10px] border border-[#e2e8f0] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e2e8f0] hover:bg-transparent">
              <TableHead className="text-[#64748b]">N° Fiscal</TableHead>
              <TableHead className="text-[#64748b]">Fecha Emisión</TableHead>
              <TableHead className="text-[#64748b]">Fecha Vencimiento</TableHead>
              <TableHead className="text-center text-[#64748b]">Días para Vencimiento</TableHead>
              <TableHead className="text-right text-[#64748b]">Total</TableHead>
              <TableHead className="text-right text-[#64748b]">Saldo pendiente</TableHead>
              <TableHead className="text-center text-[#64748b]">Estado</TableHead>
              <TableHead className="text-center text-[#64748b]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice) => (
              <TableRow key={invoice.id} className="border-[#f1f5f9] bg-[#f8fafc] hover:bg-[#f5f3ff]">
                <TableCell className="text-[#64748b]">
                  {invoice.numero_fiscal ? (
                    <span className="font-medium text-violet-700">{invoice.numero_fiscal}</span>
                  ) : (
                    <span className="italic text-[#94a3b8]">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="text-[#64748b]">
                  {formatForDisplay(invoice.issue_date)}
                </TableCell>
                <TableCell className="text-[#64748b]">
                  {formatForDisplay(invoice.due_date)}
                </TableCell>
                <TableCell className="text-center">
                  {calculateDaysUntilDue(invoice.due_date, invoice.status)}
                </TableCell>
                <TableCell className="text-right font-semibold text-[#0f172a]">
                  {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell className="text-right text-amber-600">
                  {Number(invoice.remaining_amount || 0) > 0
                    ? formatCurrency(invoice.remaining_amount || 0)
                    : <span className="text-[#94a3b8]">-</span>}
                </TableCell>
                <TableCell className="text-center">{getStatusBadge(invoice.status)}</TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadInvoice(invoice)}
                    className="text-violet-700 hover:bg-violet-50 hover:text-violet-800"
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
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Mis Facturas</h1>
        {invoices && (
          <Badge variant="outline" className="border-violet-200 text-violet-700">
            {filteredInvoices.length} factura{filteredInvoices.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Resumen de facturas */}
      {invoices && invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
            <h3 className="mb-1 text-[11px] text-[#94a3b8]">Total por pagar</h3>
            <p className="text-[20px] font-medium text-amber-600">{formatCurrency(totalPorPagar)}</p>
          </div>
          <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
            <h3 className="mb-1 text-[11px] text-[#94a3b8]">Total vencido</h3>
            <p className="text-[20px] font-medium text-red-600">{formatCurrency(totalVencido)}</p>
          </div>
          <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
            <h3 className="mb-1 text-[11px] text-[#94a3b8]">Total facturas</h3>
            <p className="text-[20px] font-medium text-[#0f172a]">{filteredInvoices.length}</p>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-[10px] border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-sm font-medium text-[#64748b]">Filtros:</h3>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[#94a3b8]">Estado:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] border-[#e2e8f0] bg-[#f8fafc] text-left text-[#0f172a]">
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
            <span className="text-sm text-[#94a3b8]">Desde:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[140px] justify-start border-[#e2e8f0] bg-[#f8fafc] text-left font-normal text-[#0f172a]',
                    !dateFrom && 'text-[#94a3b8]'
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
            <span className="text-sm text-[#94a3b8]">Hasta:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[140px] justify-start border-[#e2e8f0] bg-[#f8fafc] text-left font-normal text-[#0f172a]',
                    !dateTo && 'text-[#94a3b8]'
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
              className="text-[#94a3b8] hover:bg-slate-50 hover:text-[#334155]"
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
