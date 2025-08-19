import * as React from 'react';
import { useReports } from '@/hooks/useReports';
import { ReportsHeader } from './shared/ReportsHeader';
import { ReportFilters } from './shared/ReportFilters';
import { ReportsDashboard } from './dashboard/ReportsDashboard';
import { OperationalReports } from './operational/OperationalReports';
import { CostAnalysisReports } from './cost-analysis/CostAnalysisReports';
import { MaintenanceReport } from './MaintenanceReport';
import { useReportFilters } from '@/hooks/reports/useReportFilters';
import { useReportActions } from '@/hooks/reports/useReportActions';
import { useReportCharts } from '@/hooks/reports/useReportCharts';
import { useCostReportActions } from '@/hooks/reports/useCostReportActions';
import { useReportsRealtime } from '@/hooks/reports/useReportsRealtime';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, DollarSign, Wrench } from 'lucide-react';

const ReportsPage = () => {
  // Enable realtime updates for reports
  useReportsRealtime();
  
  const {
    filters,
    appliedFilters,
    serviceReportFilters,
    costReportFilters,
    handleDateChange,
    handleFilterChange,
    handleServiceReportDateChange,
    handleServiceReportFilterChange,
    handleCostReportDateChange,
    handleCostReportFilterChange,
    handleUpdate,
    handleClearFilters,
  } = useReportFilters();

  const { metrics, loading, lastUpdate, forceRefresh } = useReports(appliedFilters);

  const { handleExport, handleExportServiceReport } = useReportActions({
    appliedFilters,
    serviceReportFilters,
    metrics,
  });

  const { handleExportCostReport } = useCostReportActions({
    costReportFilters,
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
      <ReportsHeader 
        onExport={handleExport} 
        onExportServiceReport={handleExportServiceReport} 
        onExportCostReport={handleExportCostReport}
        onRefresh={forceRefresh}
        isLoading={loading}
        lastUpdate={lastUpdate}
      />
      
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="operational" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Operacional
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Costos
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Mantenimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {metrics && <ReportsDashboard metrics={metrics} />}
        </TabsContent>

        <TabsContent value="operational" className="space-y-6">
          <ReportFilters 
            filters={filters}
            onDateChange={handleDateChange}
            onFilterChange={handleFilterChange}
            onUpdate={handleUpdate}
            onClear={handleClearFilters}
            serviceReportFilters={serviceReportFilters}
            onServiceReportDateChange={handleServiceReportDateChange}
            onServiceReportFilterChange={handleServiceReportFilterChange}
            costReportFilters={costReportFilters}
            onCostReportDateChange={handleCostReportDateChange}
            onCostReportFilterChange={handleCostReportFilterChange}
            sections={['services']}
          />

          {metrics && (
            <OperationalReports
              metrics={metrics}
              servicesByMonthConfig={servicesByMonthConfig}
              revenueByMonthConfig={revenueByMonthConfig}
              servicesByStatusConfig={servicesByStatusConfig}
              craneUtilizationConfig={craneUtilizationConfig}
            />
          )}
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <ReportFilters 
            filters={filters}
            onDateChange={handleDateChange}
            onFilterChange={handleFilterChange}
            onUpdate={handleUpdate}
            onClear={handleClearFilters}
            serviceReportFilters={serviceReportFilters}
            onServiceReportDateChange={handleServiceReportDateChange}
            onServiceReportFilterChange={handleServiceReportFilterChange}
            costReportFilters={costReportFilters}
            onCostReportDateChange={handleCostReportDateChange}
            onCostReportFilterChange={handleCostReportFilterChange}
            sections={['metrics', 'costs']}
          />

          {metrics && (
            <CostAnalysisReports
              metrics={metrics}
              costsByCategoryConfig={costsByCategoryConfig}
            />
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <MaintenanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;