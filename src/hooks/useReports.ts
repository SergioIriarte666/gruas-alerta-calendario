import { businessClock } from '@/utils/businessClock';
import { useEffect, useMemo, useState } from 'react';
import { useServices } from './useServices';
import { useInvoices } from './useInvoices';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperatorsData } from './operators/useOperatorsData';
import { useCosts } from './useCosts';
import { useCostCategories } from './useCostCategories';
import { useSettings } from './useSettings';
import { useCompanyProfiles } from './useCompanyProfiles';
import { supabase } from '@/integrations/supabase/client';
import { Operator, Service } from '@/types';
import { Cost, CostCategory } from '@/types/costs';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';
import { createLogger } from "@/lib/logger";
import { CompanyReference, normalizeCompanyRut, resolveCanonicalCompany } from '@/utils/companyCanonicalization';


const logger = createLogger("useReports");
const EMPTY_OPERATORS: Operator[] = [];
const EMPTY_COSTS: Cost[] = [];
const EMPTY_CATEGORIES: CostCategory[] = [];
const EMPTY_REFERENCES: CompanyReference[] = [];
export interface ReportMetrics {
  totalServices: number;
  totalRevenue: number;
  averageServiceValue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  activeClients: number;
  activeCranes: number;
  activeOperators: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  servicesByMonth: { month: string; services: number; revenue: number }[];
  servicesByStatus: { status: string; count: number; percentage: number }[];
  topClients: { clientId: string; clientName: string; department: string; services: number; revenue: number }[];
  craneUtilization: { craneId: string; craneName: string; services: number; utilization: number }[];
  operatorUtilization: { operatorId: string; operatorName: string; services: number; utilization: number }[];
  costsByCategory: { categoryId: string; categoryName: string; total: number; percentage: number }[];
  costsByMonth: { month: string; total: number }[];
  serviceDetails: {
    id: string;
    folio: string;
    serviceDate: string;
    clientName: string;
    serviceTypeName: string;
    operatorName: string;
    craneName: string;
    origin: string;
    destination: string;
    status: string;
    value: number;
  }[];
  averageCostPerService: number;
  costRevenueRatio: number;
}

export interface ReportFilters {
  dateRange: { from: string; to: string };
  clientId: string;
  department: string;
  craneId: string;
  operatorId: string;
  costCategoryId: string;
  companyRut?: string;
}

export const useReports = (filters?: ReportFilters) => {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(businessClock.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [craneParts, setCraneParts] = useState<Array<{
    cost_id: string | null;
    supplier: string | null;
    part_name: string | null;
  }>>([]);
  
  const { services } = useServices();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operatorsData } = useOperatorsData();
  const operators = operatorsData ?? EMPTY_OPERATORS;
  const { data: costsData } = useCosts({
    dateFrom: filters?.dateRange?.from || undefined,
    dateTo:   filters?.dateRange?.to   || undefined,
  });
  const costs = costsData ?? EMPTY_COSTS;
  const { data: costCategoriesData } = useCostCategories();
  const costCategories = costCategoriesData ?? EMPTY_CATEGORIES;
  const { settings } = useSettings();
  const { data: companyProfilesData } = useCompanyProfiles();
  const companyProfiles = companyProfilesData ?? EMPTY_REFERENCES;

  const companyReferences = useMemo<CompanyReference[]>(() => {
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

  const clientsById = useMemo(
    () => new Map(clients.map(client => [client.id, client])),
    [clients],
  );

  const cranesById = useMemo(
    () => new Map(cranes.map(crane => [crane.id, crane])),
    [cranes],
  );

  const operatorsById = useMemo(
    () => new Map(operators.map(operator => [operator.id, operator])),
    [operators],
  );

  const validCostCategoryIds = useMemo(
    () => new Set(costCategories.map(category => category.id)),
    [costCategories],
  );

  const cranePartsByCostId = useMemo(() => {
    const partsMap = new Map<string, { supplier: string | null; partName: string | null }>();

    craneParts.forEach(part => {
      if (!part.cost_id) return;
      partsMap.set(part.cost_id, {
        supplier: part.supplier,
        partName: part.part_name,
      });
    });

    return partsMap;
  }, [craneParts]);

  useEffect(() => {
    let isMounted = true;

    const loadCraneParts = async () => {
      try {
        const { data, error } = await supabase
          .from('crane_parts')
          .select('cost_id, supplier, part_name');

        if (error) {
          logger.error('Error fetching crane parts for reports:', error);
          return;
        }

        if (isMounted) {
          setCraneParts(data ?? []);
        }
      } catch (error) {
        logger.error('Unexpected error fetching crane parts for reports:', error);
      }
    };

    void loadCraneParts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const calculateMetrics = async () => {
      if (isMounted) {
        setLoading(true);
      }

      try {
        let filteredServices = services;
        if (filters) {
          const { dateRange, clientId, department, craneId, operatorId, costCategoryId, companyRut } = filters;
          
          filteredServices = services.filter(service => {
            if (dateRange && dateRange.from && dateRange.to) {
              if (service.serviceDate < dateRange.from || service.serviceDate > dateRange.to) {
                return false;
              }
            }
            if (clientId && clientId !== 'all' && service.client.id !== clientId) {
              return false;
            }
            if (department && department !== 'all' && service.client.department !== department) {
              return false;
            }
            if (craneId && craneId !== 'all' && service.crane?.id !== craneId) {
              return false;
            }
            if (operatorId && operatorId !== 'all' && service.operator?.id !== operatorId) {
              return false;
            }
            if (companyRut && companyRut !== 'all') {
              const serviceCompany = resolveCanonicalCompany(
                {
                  rut: service.companyRut || service.crane?.ownerCompanyRut,
                  name: service.companyName || service.crane?.ownerCompanyName,
                },
                companyReferences,
              );
              if (companyRut === '__none__') {
                if (serviceCompany?.rut) return false;
              } else {
                if (!serviceCompany?.rut || serviceCompany.rut !== companyRut) {
                  return false;
                }
              }
            }
            if (costCategoryId && costCategoryId !== 'all' && validCostCategoryIds.has(costCategoryId)) {
              return false;
            }
            return true;
          });
        }

        // Excluir servicios cancelados de todos los cálculos
        filteredServices = filteredServices.filter(s => s.status !== 'cancelled');

        // Calcular métricas básicas
        const totalServices = filteredServices.length;
        const totalRevenue = Math.round(filteredServices.reduce((sum, service) => sum + getServiceValueForClosure(service), 0));
        const averageServiceValue = totalServices > 0 ? totalRevenue / totalServices : 0;

        // Métricas de costos y rentabilidad
        const filteredCosts = costs.filter(cost => {
            if (filters?.costCategoryId && filters.costCategoryId !== 'all' && cost.category_id !== filters.costCategoryId) {
                return false;
            }
            // Filtrar costos por cliente: solo incluir costos cuyo servicio pertenezca al cliente
            if (filters?.clientId && filters.clientId !== 'all') {
                if (!cost.service_id) return false; // Costos sin servicio no son atribuibles
                const relatedService = filteredServices.find(s => s.id === cost.service_id);
                if (!relatedService) return false;
            }
            // Filtrar costos por empresa (dueña de la grúa del costo)
            if (filters?.companyRut && filters.companyRut !== 'all') {
                if (!cost.crane_id) return false;
                const relatedCrane = cranesById.get(cost.crane_id);
              const relatedCompany = resolveCanonicalCompany(
                {
                  rut: relatedCrane?.ownerCompanyRut,
                  name: relatedCrane?.ownerCompanyName,
                },
                companyReferences,
              );
              if (!relatedCompany?.rut || relatedCompany.rut !== filters.companyRut) return false;
            }
            return true;
        });

        const totalCosts = Math.round(filteredCosts.reduce((sum, cost) => sum + Number(cost.amount), 0));
        const netProfit = Math.round(totalRevenue - totalCosts);
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
        const costsByCategory = calculateCostsByCategory(filteredCosts, costCategories, cranePartsByCostId);
        const averageCostPerService = totalServices > 0 ? totalCosts / totalServices : 0;
        const costRevenueRatio = totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : 0;
        const costsByMonth = calculateCostsByMonth(filteredCosts);

        // Métricas de facturas
        const pendingInvoices = invoices.filter(inv => inv.status === 'draft').length;
        const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;

        // Contadores activos
        const activeClients = clients.filter(c => c.isActive).length;
        const activeCranes = cranes.filter(c => c.isActive).length;
        const activeOperators = operators.filter(o => o.isActive).length;

        // Servicios por mes
        const servicesByMonth = calculateServicesByMonth(filteredServices);

        // Servicios por estado
        const servicesByStatus = calculateServicesByStatus(filteredServices);

        // Top clientes
        const topClients = calculateTopClients(filteredServices);

        // Utilización de grúas
        const craneUtilization = calculateCraneUtilization(filteredServices);

        // Utilización de operadores
        const operatorUtilization = calculateOperatorUtilization(filteredServices);

        // Detalle de servicios filtrados
        const serviceDetails = calculateServiceDetails(filteredServices);

        const calculatedMetrics: ReportMetrics = {
          totalServices,
          totalRevenue,
          averageServiceValue,
          pendingInvoices,
          overdueInvoices,
          activeClients,
          activeCranes,
          activeOperators,
          totalCosts,
          netProfit,
          profitMargin,
          servicesByMonth,
          servicesByStatus,
          topClients,
          craneUtilization,
          operatorUtilization,
          costsByCategory,
          costsByMonth,
          serviceDetails,
          averageCostPerService,
          costRevenueRatio,
        };

        if (isMounted) {
          setMetrics(calculatedMetrics);
        }
      } catch (error) {
        logger.error('Error calculating report metrics:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    calculateMetrics();
    if (isMounted) {
      setLastUpdate(businessClock.now());
    }

    return () => {
      isMounted = false;
    };
  }, [
    clients,
    costCategories,
    costs,
    cranePartsByCostId,
    cranes,
    cranesById,
    filters,
    invoices,
    operators,
    services,
    refreshKey,
    validCostCategoryIds,
  ]);

  const calculateServicesByMonth = (services: Service[]) => {
    const monthlyData: { [key: string]: { services: number; revenue: number } } = {};
    
    services.forEach(service => {
      const date = new Date(service.serviceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { services: 0, revenue: 0 };
      }
      
      monthlyData[monthKey].services += 1;
      monthlyData[monthKey].revenue += getServiceValueForClosure(service);
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const calculateServicesByStatus = (services: Service[]) => {
    const statusCounts = services.reduce((acc, service) => {
      acc[service.status] = (acc[service.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const total = services.length;
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count: Number(count),
      percentage: total > 0 ? (Number(count) / total) * 100 : 0
    }));
  };

  const calculateTopClients = (services: Service[]) => {
    const clientData: { [key: string]: { services: number; revenue: number } } = {};
    
    services.forEach(service => {
      const clientId = service.client.id;
      if (!clientData[clientId]) {
        clientData[clientId] = { services: 0, revenue: 0 };
      }
      clientData[clientId].services += 1;
      clientData[clientId].revenue += getServiceValueForClosure(service);
    });

    return Object.entries(clientData)
      .map(([clientId, data]) => {
        const client = clientsById.get(clientId);
        return {
          clientId,
          clientName: client?.name || 'Cliente desconocido',
          department: client?.department || 'General',
          ...data
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  const calculateCraneUtilization = (services: Service[]) => {
    const craneData: { [key: string]: number } = {};
    
    services.forEach(service => {
      // Solo procesar servicios que tienen grúa asignada
      if (service.crane?.id) {
        const craneId = service.crane.id;
        craneData[craneId] = (craneData[craneId] || 0) + 1;
      }
    });

    const totalServices = services.length;
    
    return Object.entries(craneData)
      .map(([craneId, serviceCount]) => {
        const crane = cranes.find(c => c.id === craneId);
        const servicesNum = Number(serviceCount);
        return {
          craneId,
          craneName: crane ? `${crane.brand} ${crane.model} (${crane.licensePlate})` : 'Grúa desconocida',
          services: servicesNum,
          utilization: totalServices > 0 ? (servicesNum / totalServices) * 100 : 0
        };
      })
      .sort((a, b) => b.services - a.services);
  };

  const calculateOperatorUtilization = (services: Service[]) => {
    const operatorData: { [key: string]: number } = {};
    
    services.forEach(service => {
      if (service.operator?.id) {
        const operatorId = service.operator.id;
        operatorData[operatorId] = (operatorData[operatorId] || 0) + 1;
      }
    });

    const totalServices = services.length;
    
    return Object.entries(operatorData)
      .map(([operatorId, serviceCount]) => {
        const operator = operatorsById.get(operatorId);
        const servicesNum = Number(serviceCount);
        return {
          operatorId,
          operatorName: operator?.name || 'Operador desconocido',
          services: servicesNum,
          utilization: totalServices > 0 ? (servicesNum / totalServices) * 100 : 0
        };
      })
      .sort((a, b) => b.services - a.services);
  };

  const calculateCostsByMonth = (costs: Cost[]) => {
    const monthlyData: { [key: string]: { total: number } } = {};
    
    costs.forEach(cost => {
      const date = new Date(cost.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0 };
      }
      
      monthlyData[monthKey].total += Number(cost.amount);
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  };

  const calculateServiceDetails = (services: Service[]) => {
    return [...services]
      .sort((a, b) => {
        const dateA = new Date(a.serviceDate).getTime();
        const dateB = new Date(b.serviceDate).getTime();
        return dateB - dateA;
      })
      .map(service => ({
        id: service.id,
        folio: service.folio || '-',
        serviceDate: service.serviceDate,
        clientName: service.client?.name || 'Cliente desconocido',
        serviceTypeName: service.serviceType?.name || 'Sin tipo',
        operatorName: service.operator?.name || 'Sin operador',
        craneName: service.crane
          ? `${service.crane.brand} ${service.crane.model} (${service.crane.licensePlate})`
          : 'Sin grúa',
        origin: service.origin || '-',
        destination: service.destination || '-',
        status: service.status,
        value: getServiceValueForClosure(service),
      }));
  };

  const calculateCostsByCategory = (
    costs: Cost[],
    categories: CostCategory[],
    partsMap: Map<string, { supplier: string | null; partName: string | null }>,
  ) => {
    const categoryData: { [key: string]: { total: number; name: string } } = {};
    
    costs.forEach(cost => {
      const categoryId = cost.category_id;
      let categoryName = categories.find(c => c.id === categoryId)?.name || cost.cost_categories?.name || 'Sin categoría';
      
      const partInfo = partsMap.get(cost.id);
      if (partInfo?.supplier) {
        categoryName = `${categoryName} - ${partInfo.supplier}`;
      }

      if (!categoryData[categoryId]) {
        categoryData[categoryId] = { total: 0, name: categoryName };
      }
      categoryData[categoryId].total += Number(cost.amount);
    });

    const total = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
    
    return Object.entries(categoryData)
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        total: data.total,
        percentage: total > 0 ? (data.total / total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  };

  const refreshMetrics = () => {
    setRefreshKey(prev => prev + 1);
  };

  const forceRefresh = () => {
    logger.debug('Manual reports refresh triggered');
    refreshMetrics();
  };

  return {
    metrics,
    loading,
    lastUpdate,
    refreshMetrics,
    forceRefresh
  };
};
