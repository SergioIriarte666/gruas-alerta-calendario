import { useMemo } from 'react';
import { ReportMetrics } from '@/hooks/useReports';

export interface CostMetrics {
  totalCosts: number;
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
  costsByCategory: { categoryId: string; categoryName: string; total: number; percentage: number }[];
  costsByMonth: { month: string; total: number }[];
  averageCostPerService: number;
  costRevenueRatio: number;
  totalServices: number;
}

export const useCostMetrics = (metrics: ReportMetrics | null): CostMetrics | null => {
  return useMemo(() => {
    if (!metrics) return null;

    return {
      totalCosts: metrics.totalCosts,
      totalRevenue: metrics.totalRevenue,
      netProfit: metrics.netProfit,
      profitMargin: metrics.profitMargin,
      costsByCategory: metrics.costsByCategory,
      costsByMonth: metrics.costsByMonth,
      averageCostPerService: metrics.averageCostPerService,
      costRevenueRatio: metrics.costRevenueRatio,
      totalServices: metrics.totalServices,
    };
  }, [metrics]);
};