
import * as React from 'react';
import { ChartConfig } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';

const COLORS = [1, 2, 3, 4, 5, 6].map((index) => `hsl(var(--chart-${index}))`);

export const useReportCharts = (metrics: ReportMetrics | null) => {
  const servicesByMonthConfig = { services: { label: 'Servicios', color: 'hsl(var(--chart-1))' } } satisfies ChartConfig;
  const revenueByMonthConfig = { revenue: { label: 'Ingresos', color: 'hsl(var(--chart-4))' } } satisfies ChartConfig;
  const craneUtilizationConfig = { utilization: { label: 'Utilización', color: 'hsl(var(--chart-2))' } } satisfies ChartConfig;

  const servicesByStatusConfig = React.useMemo(() => {
    if (!metrics) return {};
    return metrics.servicesByStatus.reduce((acc, item, index) => {
        acc[item.status] = {
            label: item.status,
            color: COLORS[index % COLORS.length]
        };
        return acc;
    }, {} as ChartConfig);
  }, [metrics]);

  const costsByCategoryConfig = React.useMemo(() => {
    if (!metrics?.costsByCategory || !Array.isArray(metrics.costsByCategory)) return {};
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
