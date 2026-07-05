import * as React from 'react';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useSettings } from '@/hooks/useSettings';
import { useCompanyProfiles } from '@/hooks/useCompanyProfiles';
import { useCosts } from '@/hooks/useCosts';
import { exportCostReport } from '@/utils/reports/costReportExporter';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import { CompanyReference, normalizeCompanyRut, resolveCanonicalCompany } from '@/utils/companyCanonicalization';
import { ReportMetrics } from '@/hooks/useReports';


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
  metrics?: ReportMetrics | null;
}

export const useCostReportActions = ({ costReportFilters, metrics }: UseCostReportActionsProps) => {
  const { settings } = useSettings();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { data: costCategories = [] } = useCostCategories();
  const { data: companyProfiles = [] } = useCompanyProfiles();
  const { data: allCosts = [] } = useCosts({
    dateFrom: costReportFilters?.dateRange?.from || undefined,
    dateTo:   costReportFilters?.dateRange?.to   || undefined,
  });

  const companyReferences = React.useMemo<CompanyReference[]>(() => {
    const references = new Map<string, CompanyReference>();

    const addReference = (rut?: string, name?: string) => {
      const normalizedRut = normalizeCompanyRut(rut);
      if (!normalizedRut) return;
      references.set(normalizedRut, {
        rut: rut!.trim(),
        name: name?.trim() || rut!.trim(),
      });
    };

    addReference(settings.company.taxId, settings.company.name);
    companyProfiles.forEach(profile => addReference(profile.rut, profile.name));

    return Array.from(references.values());
  }, [companyProfiles, settings.company.name, settings.company.taxId]);

  const mainCompany = React.useMemo(
    () => resolveCanonicalCompany(
      {
        rut: settings.company.taxId,
        name: settings.company.name,
      },
      companyReferences,
    ),
    [companyReferences, settings.company.name, settings.company.taxId],
  );

  const getFilteredCosts = () => {
    return allCosts.filter(cost => {
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
          const relatedCompany = resolveCanonicalCompany(
            {
              rut: relatedCrane?.ownerCompanyRut,
              name: relatedCrane?.ownerCompanyName,
            },
            companyReferences,
          );
          if (!relatedCompany?.rut || relatedCompany.rut !== costReportFilters.companyRut) return false;
        } else {
          if (!mainCompany?.rut || mainCompany.rut !== costReportFilters.companyRut) return false;
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
      if (mainCompany?.rut === rut) return `${mainCompany.name} (${rut})`;
      const profile = companyReferences.find(reference => reference.rut === rut);
      if (profile) return `${profile.name} (${profile.rut})`;
      const craneWithCompany = cranes.find(c => {
        const company = resolveCanonicalCompany(
          {
            rut: c.ownerCompanyRut,
            name: c.ownerCompanyName,
          },
          companyReferences,
        );
        return company?.rut === rut;
      });
      const company = resolveCanonicalCompany(
        {
          rut: craneWithCompany?.ownerCompanyRut,
          name: craneWithCompany?.ownerCompanyName,
        },
        companyReferences,
      );
      const name = company?.name || rut;
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
      
      if (selectedRut && selectedRut !== 'all' && selectedRut !== '__none__' && selectedRut !== mainCompany?.rut) {
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
        serviceDetails: metrics?.serviceDetails ?? [],
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
