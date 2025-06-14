
import React, { useState, useMemo } from 'react';
import { useReports, ReportFilters as ReportFiltersType } from '@/hooks/useReports';
import { ChartConfig } from "@/components/ui/chart";
import { ReportsHeader } from '@/components/reports/ReportsHeader';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { MainMetrics } from '@/components/reports/MainMetrics';
import { ProfitabilityMetrics } from '@/components/reports/ProfitabilityMetrics';
import { PrimaryCharts } from '@/components/reports/PrimaryCharts';
import { DistributionCharts } from '@/components/reports/DistributionCharts';
import { CostCharts } from '@/components/reports/CostCharts';
import { DetailTables } from '@/components/reports/DetailTables';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useSettings } from '@/hooks/useSettings';
import { exportReport } from '@/utils/reportExporter';

const Reports = () => {
  const defaultFilters: ReportFiltersType = {
    dateRange: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    },
    clientId: 'all',
    craneId: 'all',
    operatorId: 'all',
  };
  
  const [filters, setFilters] = useState<ReportFiltersType>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFiltersType>(defaultFilters);

  const { metrics, loading } = useReports(appliedFilters);
  const { settings } = useSettings();

  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleFilterChange = (field: 'clientId' | 'craneId' | 'operatorId', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = () => {
    setAppliedFilters(filters);
  };
  
  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const getAppliedFilterLabels = () => {
    const clientLabel = appliedFilters.clientId === 'all' 
        ? 'Todos los clientes' 
        : clients.find(c => c.id === appliedFilters.clientId)?.name || appliedFilters.clientId;
    const craneData = cranes.find(c => c.id === appliedFilters.craneId);
    const craneLabel = appliedFilters.craneId === 'all'
        ? 'Todas las grúas'
        : craneData ? `${craneData.brand} ${craneData.model} (${craneData.licensePlate})` : appliedFilters.craneId;
    const operatorLabel = appliedFilters.operatorId === 'all'
        ? 'Todos los operadores'
        : operators.find(o => o.id === appliedFilters.operatorId)?.name || appliedFilters.operatorId;

    return [
        [`Rango de Fechas: ${appliedFilters.dateRange.from} a ${appliedFilters.dateRange.to}`],
        [`Cliente: ${clientLabel}`],
        [`Grúa: ${craneLabel}`],
        [`Operador: ${operatorLabel}`]
    ];
  }

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!metrics || !settings) return;
    
    const filterLabels = getAppliedFilterLabels();
    
    await exportReport({
      format,
      metrics,
      settings,
      appliedFilters,
      filterLabels,
    });
  };

  const servicesByMonthConfig = { services: { label: 'Servicios', color: '#10b981' } } satisfies ChartConfig;
  const revenueByMonthConfig = { revenue: { label: 'Ingresos', color: '#3b82f6' } } satisfies ChartConfig;
  const craneUtilizationConfig = { utilization: { label: 'Utilización', color: '#f59e0b' } } satisfies ChartConfig;
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#a855f7', '#d946ef'];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Generando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsHeader onExport={handleExport} />
      <ReportFilters 
        filters={filters}
        onDateChange={handleDateChange}
        onFilterChange={handleFilterChange}
        onUpdate={handleUpdate}
        onClear={handleClearFilters}
      />

      {metrics && (
        <div className="space-y-6">
          <MainMetrics metrics={metrics} />
          <ProfitabilityMetrics metrics={metrics} />
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
          <CostCharts metrics={metrics} costsByCategoryConfig={costsByCategoryConfig} />
          <DetailTables metrics={metrics} />
        </div>
      )}
    </div>
  );
};

export default Reports;

