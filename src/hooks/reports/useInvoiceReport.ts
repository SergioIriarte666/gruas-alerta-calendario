import { useSettings } from '@/hooks/useSettings';
import { exportInvoiceReport } from '@/utils/reports/invoiceReportExporter';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useInvoiceReport");
interface InvoiceReportFilters {
  clientId?: string;
  clientName?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  includePaymentHistory?: boolean;
}

interface UseInvoiceReportProps {
  invoices: any[];
  metrics?: {
    totalInvoiced: number;
    totalPaid: number;
    pendingAmount: number;
    overdueInvoices: number;
  };
}

export const useInvoiceReport = ({ invoices, metrics }: UseInvoiceReportProps) => {
  const { settings } = useSettings();

  const handleExportInvoiceReport = async (
    format: 'pdf' | 'excel',
    filters: InvoiceReportFilters = {}
  ) => {
    if (!settings) {
      toast.error('Error', { 
        description: 'No se pudo cargar la configuración de la empresa' 
      });
      return;
    }

    toast.info('Generando informe de facturas...', {
      description: `Tu informe de facturas se está procesando en formato ${format.toUpperCase()}.`,
    });

    try {
      // Las facturas ya vienen filtradas desde el modal
      const filteredInvoices = invoices;
      
      logger.debug('🔍 Exportando facturas:', {
        totalInvoices: invoices.length,
        firstInvoice: invoices[0],
        filters,
        metrics
      });

      await exportInvoiceReport({
        format,
        invoices: filteredInvoices,
        settings,
        appliedFilters: {
          clientId: filters.clientId,
          clientName: filters.clientName,
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          includePaymentHistory: filters.includePaymentHistory
        },
        metrics: metrics || {
          totalInvoiced: filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0),
          totalPaid: filteredInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0),
          pendingAmount: filteredInvoices.reduce((sum, inv) => sum + Number(inv.remainingAmount || 0), 0),
          overdueInvoices: filteredInvoices.filter(inv => inv.status === 'overdue').length
        }
      });

      toast.success('Informe generado exitosamente', {
        description: `Se ha descargado el informe de facturas en formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      logger.error('Error al generar informe de facturas:', error);
      toast.error('Error al generar informe', {
        description: 'Hubo un problema al generar el informe de facturas. Inténtalo de nuevo.',
      });
    }
  };

  return { 
    handleExportInvoiceReport
  };
};
