import { useMemo } from 'react';
import { ReportMetrics } from '@/hooks/useReports';

export interface OperationalMetrics {
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
  topClients: { clientId: string; clientName: string; department: string; services: number; revenue: number }[];
  craneUtilization: { craneId: string; craneName: string; services: number; utilization: number }[];
  netProfit: number;
  profitMargin: number;
}

export const useOperationalMetrics = (metrics: ReportMetrics | null): OperationalMetrics | null => {
  return useMemo(() => {
    if (!metrics) return null;

    return {
      totalServices: metrics.totalServices,
      totalRevenue: metrics.totalRevenue,
      averageServiceValue: metrics.averageServiceValue,
      pendingInvoices: metrics.pendingInvoices,
      overdueInvoices: metrics.overdueInvoices,
      activeClients: metrics.activeClients,
      activeCranes: metrics.activeCranes,
      activeOperators: metrics.activeOperators,
      servicesByMonth: metrics.servicesByMonth,
      servicesByStatus: metrics.servicesByStatus,
      topClients: metrics.topClients,
      craneUtilization: metrics.craneUtilization,
      netProfit: metrics.netProfit,
      profitMargin: metrics.profitMargin,
    };
  }, [metrics]);
};