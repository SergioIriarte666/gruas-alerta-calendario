import { useState } from 'react';
import { Commission, CommissionFilters } from '@/types/commissions';
import { exportCommissionReport } from '@/utils/reportExporter';
import { useToast } from '@/components/ui/custom-toast';
import { useSettings } from '@/hooks/useSettings';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';

export const useCommissionExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { settings } = useSettings();

  const exportCommissions = async (
    commissions: Commission[],
    filters: CommissionFilters,
    format: 'pdf' | 'excel'
  ) => {
    if (commissions.length === 0) {
      toast({
        title: "Sin datos para exportar",
        description: "No hay comisiones que coincidan con los filtros aplicados.",
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
      // Determinar rango de fechas automáticamente si no están definidas
      const dateRange = getDateRange(commissions, filters);
      
      const appliedFilters = {
        status: filters.status !== 'all' ? filters.status : undefined,
        operatorId: filters.operator_id,
        operatorName: getOperatorName(commissions, filters.operator_id),
        clientName: filters.client_name,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        amountFrom: filters.amount_from,
        amountTo: filters.amount_to,
      };

      await exportCommissionReport({
        format,
        commissions,
        settings,
        appliedFilters,
      });

      toast({
        title: "Exportación exitosa",
        description: `Reporte de comisiones exportado en formato ${format.toUpperCase()}`,
        type: "success",
      });
    } catch (error) {
      console.error('Error exporting commissions:', error);
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
    exportCommissions,
    isExporting,
  };
};

// Funciones auxiliares
const getDateRange = (commissions: Commission[], filters: CommissionFilters) => {
  if (filters.date_from && filters.date_to) {
    return {
      from: formatDate(filters.date_from, 'dd/MM/yyyy', { locale: es }),
      to: formatDate(filters.date_to, 'dd/MM/yyyy', { locale: es })
    };
  }

  // Si no hay filtros de fecha, usar el rango de las comisiones
  if (commissions.length === 0) {
    const today = new Date();
    return {
      from: formatDate(today, 'dd/MM/yyyy', { locale: es }),
      to: formatDate(today, 'dd/MM/yyyy', { locale: es })
    };
  }

  const dates = commissions.map(c => {
    const serviceDate = c.services?.service_date;
    return serviceDate ? new Date(serviceDate) : new Date(c.date);
  }).sort((a, b) => a.getTime() - b.getTime());

  return {
    from: formatDate(dates[0], 'dd/MM/yyyy', { locale: es }),
    to: formatDate(dates[dates.length - 1], 'dd/MM/yyyy', { locale: es })
  };
};

const getOperatorName = (commissions: Commission[], operatorId?: string): string | undefined => {
  if (!operatorId) return undefined;
  
  const commission = commissions.find(c => c.operator_id === operatorId);
  return commission?.operators?.name;
};