import { useState } from 'react';
import { SupplierPaymentWithDetails, SupplierPaymentReportFilters } from '@/types/suppliers';
import { exportSupplierPaymentReport } from '@/utils/reports/supplierPaymentReportExporter';
import { useToast } from '@/components/ui/custom-toast';
import { useSettings } from '@/hooks/useSettings';
import { addDays, isBefore, isAfter } from 'date-fns';

export const useSupplierPaymentExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();

  const exportPayments = async (
    payments: SupplierPaymentWithDetails[],
    suppliers: any[],
    filters: SupplierPaymentReportFilters,
    format: 'pdf' | 'excel'
  ) => {
    if (payments.length === 0) {
      toast({
        title: "Sin datos para exportar",
        description: "No hay pagos que coincidan con los filtros aplicados.",
        type: "error",
      });
      return;
    }

    if (!settings) {
      toast({
        title: "Error de configuración",
        description: "No se pudo cargar la configuración de la empresa.",
        type: "error",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Filtrar pagos según el tipo de reporte
      let filteredPayments = [...payments];
      
      if (filters.reportType === 'future') {
        const today = new Date();
        const futureDate = addDays(today, filters.daysAhead || 90);
        
        filteredPayments = payments.filter(payment => {
          if (payment.status !== 'pending') return false;
          
          const dueDate = new Date(payment.due_date);
          return isAfter(dueDate, today) && isBefore(dueDate, futureDate);
        });
      }

      const appliedFilters = {
        searchTerm: filters.searchTerm,
        status: filters.status !== 'all' ? filters.status : undefined,
        supplierId: filters.supplierId !== 'all' ? filters.supplierId : undefined,
        supplierName: filters.supplierName,
        reportType: filters.reportType,
        daysAhead: filters.daysAhead || 90,
      };

      await exportSupplierPaymentReport({
        format,
        payments: filteredPayments,
        suppliers,
        settings,
        appliedFilters,
      });

      const reportTypeLabel = filters.reportType === 'future' ? 'Pagos Futuros' : 'Listado Completo';
      
      toast({
        title: "Exportación exitosa",
        description: `Reporte "${reportTypeLabel}" exportado en formato ${format.toUpperCase()}`,
        type: "success",
      });
    } catch (error) {
      console.error('Error exporting supplier payments:', error);
      toast({
        title: "Error en la exportación",
        description: "No se pudo generar el reporte. Inténtalo nuevamente.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportPayments,
    isExporting,
  };
};