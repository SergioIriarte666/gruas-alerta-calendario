
import React, { useState, useMemo } from 'react';
import { useReports } from '@/hooks/useReports';
import { ChartConfig } from "@/components/ui/chart";
import { ReportsHeader } from '@/components/reports/ReportsHeader';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { MainMetrics } from '@/components/reports/MainMetrics';
import { PrimaryCharts } from '@/components/reports/PrimaryCharts';
import { DistributionCharts } from '@/components/reports/DistributionCharts';
import { DetailTables } from '@/components/reports/DetailTables';

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const { metrics, loading } = useReports(dateRange);

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const exportReport = () => {
    if (!metrics) return;
    
    const reportData = {
      periodo: dateRange,
      metricas: metrics,
      fechaGeneracion: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `reporte-${dateRange.from}-${dateRange.to}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const servicesByMonthConfig = { services: { label: 'Servicios', color: '#10b981' } } satisfies ChartConfig;
  const revenueByMonthConfig = { revenue: { label: 'Ingresos', color: '#3b82f6' } } satisfies ChartConfig;
  const craneUtilizationConfig = { utilization: { label: 'Utilización', color: '#f59e0b' } } satisfies ChartConfig;
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Generando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsHeader onExport={exportReport} />
      <DateRangeFilter dateRange={dateRange} onDateChange={handleDateChange} onUpdate={() => {}} />

      {metrics && (
        <div className="space-y-6">
          <MainMetrics metrics={metrics} />
          <PrimaryCharts 
            metrics={metrics} 
            servicesByMonthConfig={servicesByMonthConfig} 
            revenueByMonthConfig={revenueByMonthConfig}
          />
          <DistributionCharts 
            metrics={metrics}
            servicesByStatusConfig={servicesByStatusConfig}
            craneUtilizationConfig={craneUtilizationConfig}
          />
          <DetailTables metrics={metrics} />
        </div>
      )}
    </div>
  );
};

export default Reports;
