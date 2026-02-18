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

  const defaultMetrics: typeof metrics = {
    totalServices: 0, totalRevenue: 0, averageServiceValue: 0,
    pendingInvoices: 0, overdueInvoices: 0, activeClients: 0,
    activeCranes: 0, activeOperators: 0, totalCosts: 0,
    netProfit: 0, profitMargin: 0, servicesByMonth: [],
    servicesByStatus: [], topClients: [], craneUtilization: [],
    costsByCategory: [], costsByMonth: [], averageCostPerService: 0,
    costRevenueRatio: 0,
  };

  const displayMetrics = metrics || defaultMetrics;

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
        <TabsList className="bg-muted/50 rounded-md p-1 grid w-full grid-cols-4">
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
          <ReportsDashboard metrics={displayMetrics} />
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

          <OperationalReports
            metrics={displayMetrics}
            servicesByMonthConfig={servicesByMonthConfig}
            revenueByMonthConfig={revenueByMonthConfig}
            servicesByStatusConfig={servicesByStatusConfig}
            craneUtilizationConfig={craneUtilizationConfig}
          />
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

          <CostAnalysisReports
            metrics={displayMetrics}
            costsByCategoryConfig={costsByCategoryConfig}
          />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <MaintenanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;