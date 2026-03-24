import { useEffect, useState } from 'react';
import { useServices } from './useServices';
import { useInvoices } from './useInvoices';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperatorsData } from './operators/useOperatorsData';
import { useCosts } from './useCosts';
import { useCostCategories } from './useCostCategories';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { Cost, CostCategory } from '@/types/costs';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';

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
}

export const useReports = (filters?: ReportFilters) => {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { services } = useServices();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { data: costs = [] } = useCosts();
  const { data: costCategories = [] } = useCostCategories();

  useEffect(() => {
    const calculateMetrics = async () => {
      setLoading(true);
    
      let filteredServices = services;
      if (filters) {
        const { dateRange, clientId, department, craneId, operatorId, costCategoryId } = filters;
        
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
          if (costCategoryId && costCategoryId !== 'all' && costCategories.find(c => c.id === costCategoryId)) {
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
        if (filters?.dateRange.from && filters?.dateRange.to) {
            if (cost.date < filters.dateRange.from || cost.date > filters.dateRange.to) return false;
        }
        if (filters?.costCategoryId && filters.costCategoryId !== 'all' && cost.category_id !== filters.costCategoryId) {
            return false;
        }
        // Filtrar costos por cliente: solo incluir costos cuyo servicio pertenezca al cliente
        if (filters?.clientId && filters.clientId !== 'all') {
            if (!cost.service_id) return false; // Costos sin servicio no son atribuibles
            const relatedService = filteredServices.find(s => s.id === cost.service_id);
            if (!relatedService) return false;
        }
        return true;
    });

    const totalCosts = Math.round(filteredCosts.reduce((sum, cost) => sum + Number(cost.amount), 0));
    const netProfit = Math.round(totalRevenue - totalCosts);
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const costsByCategory = await calculateCostsByCategory(filteredCosts, costCategories);
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
      averageCostPerService,
      costRevenueRatio,
    };

      setMetrics(calculatedMetrics);
      setLoading(false);
    };
    
    calculateMetrics();
    setLastUpdate(new Date());
  }, [clients, costCategories, costs, cranes, filters, invoices, operators, services, refreshKey]);

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
        const client = clients.find(c => c.id === clientId);
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
        const operator = operators.find(o => o.id === operatorId);
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

  const calculateCostsByCategory = async (costs: Cost[], categories: CostCategory[]) => {
    try {
      // Obtener todas las piezas de grúa para poder mostrar el proveedor real
      const { data: craneParts, error } = await supabase
        .from('crane_parts')
        .select('cost_id, supplier, part_name');

      if (error) {
        console.error('Error fetching crane parts for reports:', error);
      }

      // Crear un mapa de cost_id a datos de pieza para búsqueda rápida
      const partsMap = new Map();
      if (craneParts) {
        craneParts.forEach(part => {
          if (part.cost_id) {
            partsMap.set(part.cost_id, {
              supplier: part.supplier,
              partName: part.part_name
            });
          }
        });
      }

      const categoryData: { [key: string]: { total: number; name: string; supplierInfo?: string } } = {};
      
      costs.forEach(cost => {
        const categoryId = cost.category_id;
        let categoryName = categories.find(c => c.id === categoryId)?.name || cost.cost_categories?.name || 'Sin categoría';
        
        // Si este costo tiene una pieza asociada, mostrar el proveedor
        const partInfo = partsMap.get(cost.id);
        if (partInfo) {
          categoryName = `${categoryName} - ${partInfo.supplier}`;
        }

        if (!categoryData[categoryId]) {
          categoryData[categoryId] = { 
            total: 0, 
            name: categoryName,
            supplierInfo: partInfo?.supplier
          };
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
    } catch (error) {
      console.error('Error in calculateCostsByCategory:', error);
      // Retornar datos básicos en caso de error
      const categoryData: { [key: string]: { total: number; name: string } } = {};
      
      costs.forEach(cost => {
        const categoryId = cost.category_id;
        const categoryName = categories.find(c => c.id === categoryId)?.name || cost.cost_categories?.name || 'Sin categoría';

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
    }
  };

  const refreshMetrics = () => {
    setRefreshKey(prev => prev + 1);
  };

  const forceRefresh = () => {
    console.log('Manual reports refresh triggered');
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
