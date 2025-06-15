import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useSettings } from '@/hooks/useSettings';
import { exportReport } from '@/utils/reportExporter';
import { generateServiceReport } from '@/utils/serviceReportGenerator';
import { toast } from 'sonner';
import { ReportFilters, ReportMetrics } from '@/hooks/useReports';

interface UseReportActionsProps {
  appliedFilters: ReportFilters;
  serviceReportFilters: {
    dateRange: { from: string; to: string };
    clientId: string;
  };
  metrics: ReportMetrics | null;
}

export const useReportActions = ({ appliedFilters, serviceReportFilters, metrics }: UseReportActionsProps) => {
  const { settings } = useSettings();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { data: costCategories = [] } = useCostCategories();

  const getAppliedFilterLabels = () => {
    const clientLabel = appliedFilters.clientId === 'all' 
        ? 'Todos los clientes' 
        : clients.find(c => c.id === appliedFilters.clientId)?.name || appliedFilters.clientId;
    const craneData = cranes.find(c => c.id === appliedFilters.craneId);
    const craneLabel = appliedFilters.craneId === 'all'
        ? 'Todas las grúas'
        : craneData ? `${craneData.brand} ${craneData.model} (${craneData.licensePlate})` : appliedFilters.craneId;
    const operatorLabel = appliedFilters.operatorId === 'all'
        ? 'Todos los operadores'
        : operators.find(o => o.id === appliedFilters.operatorId)?.name || appliedFilters.operatorId;
    const costCategoryLabel = appliedFilters.costCategoryId === 'all'
        ? 'Todas las categorías'
        : costCategories.find(c => c.id === appliedFilters.costCategoryId)?.name || appliedFilters.costCategoryId;

    return [
        [`Rango de Fechas: ${appliedFilters.dateRange.from} a ${appliedFilters.dateRange.to}`],
        [`Cliente: ${clientLabel}`],
        [`Grúa: ${craneLabel}`],
        [`Operador: ${operatorLabel}`],
        [`Categoría de Costo: ${costCategoryLabel}`]
    ];
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!metrics || !settings) return;
    
    const filterLabels = getAppliedFilterLabels();
    
    await exportReport({
      format,
      metrics,
      settings,
      appliedFilters,
      filterLabels,
      costCategories,
    });
  };

  const handleExportServiceReport = async (format: 'pdf' | 'excel') => {
    toast.info('Generando informe...', {
      description: 'Tu informe de servicios se está procesando y la descarga comenzará en breve.',
    });
    try {
      await generateServiceReport({
        format,
        filters: {
          dateFrom: new Date(serviceReportFilters.dateRange.from),
          dateTo: new Date(serviceReportFilters.dateRange.to),
          clientId: serviceReportFilters.clientId === 'all' ? undefined : serviceReportFilters.clientId,
        }
      });
    } catch (error) {
      toast.error('Error al generar informe', {
        description: 'Hubo un problema al generar el informe. Inténtalo de nuevo.',
      });
    }
  };

  return { handleExport, handleExportServiceReport };
};
