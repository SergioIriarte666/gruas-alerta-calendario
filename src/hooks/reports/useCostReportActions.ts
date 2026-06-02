import * as React from 'react';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useSettings } from '@/hooks/useSettings';
import { useCosts } from '@/hooks/useCosts';
import { exportCostReport } from '@/utils/reports/costReportExporter';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCostReportActions");
interface CostReportFilters {
  dateRange: { from: string; to: string };
  categoryId: string;
  craneId: string;
  operatorId: string;
  companyRut?: string;
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
      
      // Filtro por empresa
      if (costReportFilters.companyRut && costReportFilters.companyRut !== 'all') {
        // Caso "Sin empresa": incluir costos sin grúa asociada
        if (costReportFilters.companyRut === '__none__') {
          if (cost.crane_id) return false;
          return true;
        }
        // Con empresa específica:
        // - Si el costo tiene grúa, validar empresa de la grúa
        // - Si el costo no tiene grúa, solo incluir si es la empresa principal (settings.company.taxId)
        if (cost.crane_id) {
          const relatedCrane = cranes.find(c => c.id === cost.crane_id);
          if (!relatedCrane || relatedCrane.ownerCompanyRut !== costReportFilters.companyRut) return false;
        } else {
          if (settings.company.taxId !== costReportFilters.companyRut) return false;
        }
      }
      
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
    
    const companyLabel = (() => {
      const rut = costReportFilters.companyRut;
      if (!rut || rut === 'all') return 'Todas las empresas';
      if (rut === '__none__') return 'Sin empresa';
      // Buscar nombre por configuración (empresa principal) o por grúas
      if (settings.company.taxId === rut) return `${settings.company.name} (${rut})`;
      const craneWithCompany = cranes.find(c => c.ownerCompanyRut === rut);
      const name = craneWithCompany?.ownerCompanyName || rut;
      return `${name} (${rut})`;
    })();

    return {
      categoryName: categoryLabel,
      craneName: craneLabel,
      operatorName: operatorLabel,
      companyName: companyLabel
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
      const selectedRut = costReportFilters.companyRut;
      let headerCompany = settings.company;
      let headerLogoUrl: string | null | undefined = undefined;
      
      if (selectedRut && selectedRut !== 'all' && selectedRut !== '__none__' && selectedRut !== settings.company.taxId) {
        const { data } = await supabase
          .from('company_profiles')
          .select('rut, name, address, phone, email, logo_url')
          .eq('rut', selectedRut)
          .maybeSingle();
        
        if (data) {
          headerCompany = {
            ...settings.company,
            name: data.name,
            taxId: data.rut,
            address: data.address || '',
            phone: data.phone || '',
            email: data.email || '',
            logo: data.logo_url || undefined
          };
          headerLogoUrl = data.logo_url || null;
        } else {
          headerCompany = {
            ...settings.company,
            name: (filterLabels.companyName || selectedRut).replace(` (${selectedRut})`, ''),
            taxId: selectedRut,
            logo: undefined
          };
          headerLogoUrl = null;
        }
      } else if (selectedRut === '__none__') {
        headerCompany = settings.company;
        headerLogoUrl = settings.company.logo || undefined;
      } else {
        headerCompany = settings.company;
        headerLogoUrl = settings.company.logo || undefined;
      }
      
      await exportCostReport({
        format,
        costs: filteredCosts,
        settings,
        headerCompany,
        headerLogoUrl,
        appliedFilters: {
          dateRange: costReportFilters.dateRange,
          categoryId: costReportFilters.categoryId,
          categoryName: filterLabels.categoryName,
          craneId: costReportFilters.craneId,
          craneName: filterLabels.craneName,
          operatorId: costReportFilters.operatorId,
          operatorName: filterLabels.operatorName,
          companyRut: costReportFilters.companyRut,
          companyName: filterLabels.companyName,
        }
      });

      toast.success('Informe generado exitosamente', {
        description: `Se ha descargado el informe de costos en formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      logger.error('Error al generar informe de costos:', error);
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
