
import * as React from 'react';
import { useReports } from '@/hooks/useReports';
import { ReportsHeader } from '@/components/reports/ReportsHeader';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { MainMetrics } from '@/components/reports/MainMetrics';
import { ProfitabilityMetrics } from '@/components/reports/ProfitabilityMetrics';
import { PrimaryCharts } from '@/components/reports/PrimaryCharts';
import { DistributionCharts } from '@/components/reports/DistributionCharts';
import { CostAnalysis } from '@/components/reports/CostAnalysis';
import { CostCharts } from '@/components/reports/CostCharts';
import { DetailTables } from '@/components/reports/DetailTables';
import { useReportFilters } from '@/hooks/reports/useReportFilters';
import { useReportActions } from '@/hooks/reports/useReportActions';
import { useReportCharts } from '@/hooks/reports/useReportCharts';

const Reports = () => {
  const {
    filters,
    appliedFilters,
    serviceReportFilters,
    handleDateChange,
    handleFilterChange,
    handleServiceReportDateChange,
    handleServiceReportFilterChange,
    handleUpdate,
    handleClearFilters,
  } = useReportFilters();

  const { metrics, loading } = useReports(appliedFilters);

  const { handleExport, handleExportServiceReport } = useReportActions({
    appliedFilters,
    serviceReportFilters,
    metrics,
  });

  const {
    servicesByMonthConfig,
    revenueByMonthConfig,
    craneUtilizationConfig,
    servicesByStatusConfig,
    costsByCategoryConfig
  } = useReportCharts(metrics);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Generando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsHeader onExport={handleExport} onExportServiceReport={handleExportServiceReport} />
      <ReportFilters 
        filters={filters}
        onDateChange={handleDateChange}
        onFilterChange={handleFilterChange}
        onUpdate={handleUpdate}
        onClear={handleClearFilters}
        serviceReportFilters={serviceReportFilters}
        onServiceReportDateChange={handleServiceReportDateChange}
        onServiceReportFilterChange={handleServiceReportFilterChange}
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

          <h2 className="text-2xl font-bold text-white pt-6 border-t border-white/20">Análisis de Costos</h2>
          <CostAnalysis metrics={metrics} />
          <CostCharts metrics={metrics} costsByCategoryConfig={costsByCategoryConfig} />

          <DetailTables metrics={metrics} />
        </div>
      )}
    </div>
  );
};

export default Reports;
