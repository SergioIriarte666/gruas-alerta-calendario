import { useState, useEffect } from 'react';
import { useServices } from './useServices';
import { useInvoices } from './useInvoices';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperators } from './useOperators';
import { useCosts } from './useCosts';
import { useCostCategories } from './useCostCategories';
import { Service } from '@/types';
import { Cost, CostCategory } from '@/types/costs';

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
  topClients: { clientId: string; clientName: string; services: number; revenue: number }[];
  craneUtilization: { craneId: string; craneName: string; services: number; utilization: number }[];
  costsByCategory: { categoryId: string; categoryName: string; total: number; percentage: number }[];
  costsByMonth: { month: string; total: number }[];
  averageCostPerService: number;
  costRevenueRatio: number;
}

export interface ReportFilters {
  dateRange: { from: string; to: string };
  clientId: string;
  craneId: string;
  operatorId: string;
  costCategoryId: string;
}

export const useReports = (filters?: ReportFilters) => {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { services } = useServices();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();
  const { data: costs = [] } = useCosts();
  const { data: costCategories = [] } = useCostCategories();

  useEffect(() => {
    if (services.length > 0 && clients.length > 0 && cranes.length > 0 && operators.length > 0 && costs && costCategories) {
      calculateMetrics();
    }
  }, [services, invoices, clients, cranes, operators, costs, costCategories, filters]);

  const calculateMetrics = () => {
    setLoading(true);
    
    let filteredServices = services;
    if (filters) {
      const { dateRange, clientId, craneId, operatorId, costCategoryId } = filters;
      
      filteredServices = services.filter(service => {
        if (dateRange && dateRange.from && dateRange.to) {
          if (service.serviceDate < dateRange.from || service.serviceDate > dateRange.to) {
            return false;
          }
        }
        if (clientId && clientId !== 'all' && service.client.id !== clientId) {
          return false;
        }
        if (craneId && craneId !== 'all' && service.crane.id !== craneId) {
          return false;
        }
        if (operatorId && operatorId !== 'all' && service.operator.id !== operatorId) {
          return false;
        }
        if (costCategoryId && costCategoryId !== 'all' && costCategories.find(c => c.id === costCategoryId)) {
          return false;
        }
        return true;
      });
    }

    // Calcular métricas básicas
    const totalServices = filteredServices.length;
    const totalRevenue = filteredServices.reduce((sum, service) => sum + service.value, 0);
    const averageServiceValue = totalServices > 0 ? totalRevenue / totalServices : 0;

    // Métricas de costos y rentabilidad
    const fromDate = filters ? new Date(filters.dateRange.from + 'T00:00:00Z') : null;
    const toDate = filters ? new Date(filters.dateRange.to + 'T23:59:59Z') : null;

    const filteredCosts = costs.filter(cost => {
        if (fromDate && toDate) {
            const costDate = new Date(cost.date);
            if (costDate < fromDate || costDate > toDate) return false;
        }
        if (filters?.costCategoryId && filters.costCategoryId !== 'all' && cost.category_id !== filters.costCategoryId) {
            return false;
        }
        return true;
    });

    const totalCosts = filteredCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const netProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const costsByCategory = calculateCostsByCategory(filteredCosts, costCategories);
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
      costsByCategory,
      costsByMonth,
      averageCostPerService,
      costRevenueRatio,
    };

    setMetrics(calculatedMetrics);
    setLoading(false);
  };

  const calculateServicesByMonth = (services: Service[]) => {
    const monthlyData: { [key: string]: { services: number; revenue: number } } = {};
    
    services.forEach(service => {
      const date = new Date(service.serviceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { services: 0, revenue: 0 };
      }
      
      monthlyData[monthKey].services += 1;
      monthlyData[monthKey].revenue += service.value;
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
      clientData[clientId].revenue += service.value;
    });

    return Object.entries(clientData)
      .map(([clientId, data]) => {
        const client = clients.find(c => c.id === clientId);
        return {
          clientId,
          clientName: client?.name || 'Cliente desconocido',
          ...data
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  const calculateCraneUtilization = (services: Service[]) => {
    const craneData: { [key: string]: number } = {};
    
    services.forEach(service => {
      const craneId = service.crane.id;
      craneData[craneId] = (craneData[craneId] || 0) + 1;
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

  const calculateCostsByCategory = (costs: Cost[], categories: CostCategory[]) => {
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
  };

  return {
    metrics,
    loading,
    refreshMetrics: calculateMetrics
  };
};
