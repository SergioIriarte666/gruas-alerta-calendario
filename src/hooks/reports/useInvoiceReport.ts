import { useSettings } from '@/hooks/useSettings';
import { exportInvoiceReport } from '@/utils/reports/invoiceReportExporter';
import { toast } from 'sonner';

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
      // Filtrar facturas si se proporcionaron filtros adicionales
      let filteredInvoices = [...invoices];
      
      if (filters.status && filters.status !== 'all') {
        filteredInvoices = filteredInvoices.filter(inv => inv.status === filters.status);
      }
      
      if (filters.dateFrom) {
        filteredInvoices = filteredInvoices.filter(
          inv => new Date(inv.issue_date) >= new Date(filters.dateFrom!)
        );
      }
      
      if (filters.dateTo) {
        filteredInvoices = filteredInvoices.filter(
          inv => new Date(inv.issue_date) <= new Date(filters.dateTo!)
        );
      }

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
          totalPaid: filteredInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0),
          pendingAmount: filteredInvoices.reduce((sum, inv) => sum + Number(inv.remaining_amount || 0), 0),
          overdueInvoices: filteredInvoices.filter(inv => inv.status === 'overdue').length
        }
      });

      toast.success('Informe generado exitosamente', {
        description: `Se ha descargado el informe de facturas en formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error('Error al generar informe de facturas:', error);
      toast.error('Error al generar informe', {
        description: 'Hubo un problema al generar el informe de facturas. Inténtalo de nuevo.',
      });
    }
  };

  return { 
    handleExportInvoiceReport
  };
};
