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
import { BarChart3, TrendingUp, DollarSign, Wrench, CheckCircle, AlertTriangle } from 'lucide-react';
import { ReportMetricCard } from './shared/ReportMetricCard';

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
    <div className="space-y-4">
      <ReportsHeader 
        onExport={handleExport} 
        onExportServiceReport={handleExportServiceReport} 
        onExportCostReport={handleExportCostReport}
        onRefresh={forceRefresh}
        isLoading={loading}
        lastUpdate={lastUpdate}
      />

      {/* KPIs de resumen rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ReportMetricCard
          icon={DollarSign}
          title="Ingresos Totales"
          value={`$${displayMetrics.totalRevenue.toLocaleString()}`}
          description="Ingresos del período"
          valueClassName="text-green-600 dark:text-green-400"
        />
        <ReportMetricCard
          icon={TrendingUp}
          title="Beneficio Neto"
          value={`$${displayMetrics.netProfit.toLocaleString()}`}
          description={`Margen: ${displayMetrics.profitMargin.toFixed(1)}%`}
          valueClassName={displayMetrics.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
        />
        <ReportMetricCard
          icon={CheckCircle}
          title="Servicios"
          value={displayMetrics.totalServices}
          description={`Promedio: $${displayMetrics.averageServiceValue.toLocaleString()}`}
          valueClassName="text-violet-600 dark:text-violet-400"
        />
        <ReportMetricCard
          icon={AlertTriangle}
          title="Facturas Pendientes"
          value={displayMetrics.pendingInvoices}
          description={`${displayMetrics.overdueInvoices} vencidas`}
          valueClassName="text-yellow-600 dark:text-yellow-400"
        />
      </div>
      
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-muted/50 rounded-md p-0.5 grid w-full grid-cols-4 h-9">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="operational" className="flex items-center gap-1.5 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            Operacional
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-1.5 text-xs">
            <DollarSign className="w-3.5 h-3.5" />
            Costos
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-1.5 text-xs">
            <Wrench className="w-3.5 h-3.5" />
            Mantenimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <ReportsDashboard metrics={displayMetrics} />
        </TabsContent>

        <TabsContent value="operational" className="space-y-4">
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

        <TabsContent value="costs" className="space-y-4">
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

        <TabsContent value="maintenance" className="space-y-4">
          <MaintenanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;