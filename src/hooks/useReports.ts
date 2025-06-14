
import { useState, useEffect } from 'react';
import { useServices } from './useServices';
import { useInvoices } from './useInvoices';
import { useClients } from './useClients';
import { useCranes } from './useCranes';
import { useOperators } from './useOperators';
import { Service } from '@/types';

interface ReportMetrics {
  totalServices: number;
  totalRevenue: number;
  averageServiceValue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  activeClients: number;
  activeCranes: number;
  activeOperators: number;
  servicesByMonth: { month: string; services: number; revenue: number }[];
  servicesByStatus: { status: string; count: number; percentage: number }[];
  topClients: { clientId: string; clientName: string; services: number; revenue: number }[];
  craneUtilization: { craneId: string; craneName: string; services: number; utilization: number }[];
}

export const useReports = (dateRange?: { from: string; to: string }) => {
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { services } = useServices();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();

  useEffect(() => {
    if (services.length > 0 && clients.length > 0) {
      calculateMetrics();
    }
  }, [services, invoices, clients, cranes, operators, dateRange]);

  const calculateMetrics = () => {
    setLoading(true);
    
    // Filtrar servicios por rango de fechas si se proporciona
    let filteredServices = services;
    if (dateRange) {
      filteredServices = services.filter(service => {
        const serviceDate = new Date(service.serviceDate);
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        return serviceDate >= fromDate && serviceDate <= toDate;
      });
    }

    // Calcular métricas básicas
    const totalServices = filteredServices.length;
    const totalRevenue = filteredServices.reduce((sum, service) => sum + service.value, 0);
    const averageServiceValue = totalServices > 0 ? totalRevenue / totalServices : 0;

    // Métricas de facturas
    const pendingInvoices = invoices.filter(inv => inv.status === 'pending').length;
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
      servicesByMonth,
      servicesByStatus,
      topClients,
      craneUtilization
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

  return {
    metrics,
    loading,
    refreshMetrics: calculateMetrics
  };
};
