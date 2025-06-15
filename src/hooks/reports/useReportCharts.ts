import * as React from 'react';
import { ChartConfig } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#a855f7', '#d946ef'];

export const useReportCharts = (metrics: ReportMetrics | null) => {
  const servicesByMonthConfig = { services: { label: 'Servicios', color: '#10b981' } } satisfies ChartConfig;
  const revenueByMonthConfig = { revenue: { label: 'Ingresos', color: '#3b82f6' } } satisfies ChartConfig;
  const craneUtilizationConfig = { utilization: { label: 'Utilización', color: '#f59e0b' } } satisfies ChartConfig;

  const servicesByStatusConfig = useMemo(() => {
    if (!metrics) return {};
    return metrics.servicesByStatus.reduce((acc, item, index) => {
        acc[item.status] = {
            label: item.status,
            color: COLORS[index % COLORS.length]
        };
        return acc;
    }, {} as ChartConfig);
  }, [metrics]);

  const costsByCategoryConfig = useMemo(() => {
    if (!metrics?.costsByCategory) return {};
    return metrics.costsByCategory.reduce((acc, item, index) => {
        acc[item.categoryName] = {
            label: item.categoryName,
            color: COLORS[index % COLORS.length]
        };
        return acc;
    }, {} as ChartConfig);
  }, [metrics]);

  return {
    servicesByMonthConfig,
    revenueByMonthConfig,
    craneUtilizationConfig,
    servicesByStatusConfig,
    costsByCategoryConfig
  };
};
