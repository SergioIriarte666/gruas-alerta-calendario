import * as React from 'react';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useSettings } from '@/hooks/useSettings';
import { useCosts } from '@/hooks/useCosts';
import { exportCostReport } from '@/utils/reports/costReportExporter';
import { toast } from 'sonner';

interface CostReportFilters {
  dateRange: { from: string; to: string };
  categoryId: string;
  craneId: string;
  operatorId: string;
}

interface UseCostReportActionsProps {
  costReportFilters: CostReportFilters;
}

export const useCostReportActions = ({ costReportFilters }: UseCostReportActionsProps) => {
  const { settings } = useSettings();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { data: costCategories = [] } = useCostCategories();
  const { data: allCosts = [] } = useCosts();

  const getFilteredCosts = () => {
    return allCosts.filter(cost => {
      const costDate = new Date(cost.date);
      const fromDate = new Date(costReportFilters.dateRange.from);
      const toDate = new Date(costReportFilters.dateRange.to);
      
      // Filtro por fecha
      if (costDate < fromDate || costDate > toDate) return false;
      
      // Filtro por categoría
      if (costReportFilters.categoryId !== 'all' && cost.category_id !== costReportFilters.categoryId) return false;
      
      // Filtro por grúa
      if (costReportFilters.craneId !== 'all' && cost.crane_id !== costReportFilters.craneId) return false;
      
      // Filtro por operador
      if (costReportFilters.operatorId !== 'all' && cost.operator_id !== costReportFilters.operatorId) return false;
      
      return true;
    });
  };

  const getAppliedCostFilterLabels = () => {
    const categoryLabel = costReportFilters.categoryId === 'all' 
        ? 'Todas las categorías' 
        : costCategories.find(c => c.id === costReportFilters.categoryId)?.name || costReportFilters.categoryId;
    
    const craneData = cranes.find(c => c.id === costReportFilters.craneId);
    const craneLabel = costReportFilters.craneId === 'all'
        ? 'Todas las grúas'
        : craneData ? `${craneData.brand} ${craneData.model} (${craneData.licensePlate})` : costReportFilters.craneId;
    
    const operatorLabel = costReportFilters.operatorId === 'all'
        ? 'Todos los operadores'
        : operators.find(o => o.id === costReportFilters.operatorId)?.name || costReportFilters.operatorId;

    return {
      categoryName: categoryLabel,
      craneName: craneLabel,
      operatorName: operatorLabel
    };
  };

  const handleExportCostReport = async (format: 'pdf' | 'excel') => {
    if (!settings) {
      toast.error('Error', { description: 'No se pudo cargar la configuración de la empresa' });
      return;
    }

    toast.info('Generando informe de costos...', {
      description: 'Tu informe de costos se está procesando y la descarga comenzará en breve.',
    });

    try {
      const filteredCosts = getFilteredCosts();
      const filterLabels = getAppliedCostFilterLabels();
      
      await exportCostReport({
        format,
        costs: filteredCosts,
        settings,
        appliedFilters: {
          dateRange: costReportFilters.dateRange,
          categoryId: costReportFilters.categoryId,
          categoryName: filterLabels.categoryName,
          craneId: costReportFilters.craneId,
          craneName: filterLabels.craneName,
          operatorId: costReportFilters.operatorId,
          operatorName: filterLabels.operatorName,
        }
      });

      toast.success('Informe generado exitosamente', {
        description: `Se ha descargado el informe de costos en formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error('Error al generar informe de costos:', error);
      toast.error('Error al generar informe', {
        description: 'Hubo un problema al generar el informe de costos. Inténtalo de nuevo.',
      });
    }
  };

  return { 
    handleExportCostReport,
    getFilteredCosts,
    costsCount: getFilteredCosts().length,
    totalAmount: getFilteredCosts().reduce((sum, cost) => sum + Number(cost.amount), 0)
  };
};