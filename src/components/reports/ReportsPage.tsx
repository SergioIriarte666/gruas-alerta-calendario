import * as React from 'react';
import { useState, useMemo } from 'react';
import { useReports } from '@/hooks/useReports';
import { ReportsHeader } from './shared/ReportsHeader';
import { ReportsDashboard } from './dashboard/ReportsDashboard';
import { OperationalReports } from './operational/OperationalReports';
import { CostAnalysisReports } from './cost-analysis/CostAnalysisReports';
import { MaintenanceReport } from './MaintenanceReport';
import { ReportMetricCard } from './shared/ReportMetricCard';
import { useReportFilters } from '@/hooks/reports/useReportFilters';
import { useReportActions } from '@/hooks/reports/useReportActions';
import { useReportCharts } from '@/hooks/reports/useReportCharts';
import { useCostReportActions } from '@/hooks/reports/useCostReportActions';
import { useReportsRealtime } from '@/hooks/reports/useReportsRealtime';
import { ReportFilters } from './shared/ReportFilters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3, TrendingUp, Users, HardHat, Truck, DollarSign, Receipt,
  Download, FileText, FileSpreadsheet, Calendar, RefreshCw, Wrench,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

const tabs = [
  { id: 'servicios', label: 'Servicios', icon: BarChart3 },
  { id: 'ingresos', label: 'Ingresos', icon: TrendingUp },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'operadores', label: 'Operadores', icon: HardHat },
  { id: 'flota', label: 'Flota', icon: Truck },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign },
  { id: 'costos', label: 'Costos', icon: Receipt },
] as const;

type TabId = typeof tabs[number]['id'];

const periodOptions = [
  { value: 'today', label: 'Hoy' },
  { value: 'last7', label: 'Últimos 7 días' },
  { value: 'last30', label: 'Últimos 30 días' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'last3months', label: 'Últimos 3 meses' },
  { value: 'this_year', label: 'Este año' },
];

const getPeriodDates = (period: string) => {
  const today = new Date();
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'last7': return { from: subDays(today, 7), to: today };
    case 'last30': return { from: subDays(today, 30), to: today };
    case 'this_month': return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'last_month': {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'last3months': return { from: subMonths(today, 3), to: today };
    case 'this_year': return { from: startOfYear(today), to: today };
    default: return { from: startOfMonth(today), to: endOfMonth(today) };
  }
};

const ReportsPage = () => {
  useReportsRealtime();

  const [activeTab, setActiveTab] = useState<TabId>('servicios');
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');

  const periodDates = useMemo(() => getPeriodDates(selectedPeriod), [selectedPeriod]);

  const {
    filters, appliedFilters, serviceReportFilters, costReportFilters,
    handleDateChange, handleFilterChange, handleServiceReportDateChange,
    handleServiceReportFilterChange, handleCostReportDateChange,
    handleCostReportFilterChange, handleUpdate, handleClearFilters,
  } = useReportFilters();

  const effectiveFilters = useMemo(() => ({
    ...appliedFilters,
    dateRange: {
      from: format(periodDates.from, 'yyyy-MM-dd'),
      to: format(periodDates.to, 'yyyy-MM-dd'),
    },
  }), [appliedFilters, periodDates]);

  const { metrics, loading, lastUpdate, forceRefresh } = useReports(effectiveFilters);

  const { handleExport, handleExportServiceReport } = useReportActions({
    appliedFilters, serviceReportFilters, metrics,
  });

  const { handleExportCostReport } = useCostReportActions({ costReportFilters });

  const {
    servicesByMonthConfig, revenueByMonthConfig, craneUtilizationConfig,
    servicesByStatusConfig, costsByCategoryConfig,
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

  const m = metrics || defaultMetrics;

  const dateLabel = `${format(periodDates.from, 'dd MMM', { locale: es })} - ${format(periodDates.to, 'dd MMM yyyy', { locale: es })}`;

  const renderKPIs = () => {
    switch (activeTab) {
      case 'servicios':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <ReportMetricCard title="Total Servicios" value={m.totalServices} />
            <ReportMetricCard title="Completados" value={m.servicesByStatus.find(s => s.status === 'completed')?.count || 0} valueClassName="text-green-600 dark:text-green-400" />
            <ReportMetricCard title="Cancelados" value={m.servicesByStatus.find(s => s.status === 'cancelled')?.count || 0} valueClassName="text-red-600 dark:text-red-400" />
            <ReportMetricCard title="Ingresos" value={`$${m.totalRevenue.toLocaleString()}`} valueClassName="text-green-600 dark:text-green-400" />
            <ReportMetricCard title="Ticket Promedio" value={`$${m.averageServiceValue.toLocaleString()}`} />
          </div>
        );
      case 'ingresos':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ReportMetricCard title="Ingresos Totales" value={`$${m.totalRevenue.toLocaleString()}`} valueClassName="text-green-600 dark:text-green-400" />
            <ReportMetricCard title="Ingreso Promedio" value={`$${m.averageServiceValue.toLocaleString()}`} />
            <ReportMetricCard title="Total Servicios" value={m.totalServices} />
            <ReportMetricCard title="Beneficio Neto" value={`$${m.netProfit.toLocaleString()}`} valueClassName={m.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
          </div>
        );
      case 'clientes':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ReportMetricCard title="Total Clientes" value={m.activeClients} />
            <ReportMetricCard title="Ingresos Totales" value={`$${m.totalRevenue.toLocaleString()}`} valueClassName="text-green-600 dark:text-green-400" />
            <ReportMetricCard title="Ingreso Promedio" value={`$${m.activeClients > 0 ? Math.round(m.totalRevenue / m.activeClients).toLocaleString() : 0}`} />
            <ReportMetricCard title="Top Clientes" value={m.topClients.length} description="Con servicios en el período" />
          </div>
        );
      case 'operadores':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <ReportMetricCard title="Total Operadores" value={m.activeOperators} />
            <ReportMetricCard title="Servicios/Operador" value={m.activeOperators > 0 ? (m.totalServices / m.activeOperators).toFixed(1) : '0'} />
            <ReportMetricCard title="Total Servicios" value={m.totalServices} />
          </div>
        );
      case 'flota':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <ReportMetricCard title="Total Grúas" value={m.activeCranes} />
            <ReportMetricCard title="Utilización Prom." value={m.craneUtilization.length > 0 ? `${(m.craneUtilization.reduce((a, c) => a + c.utilization, 0) / m.craneUtilization.length).toFixed(1)}%` : '0%'} />
            <ReportMetricCard title="Grúa Más Activa" value={m.craneUtilization[0]?.craneName?.split(' ')[0] || '-'} description={m.craneUtilization[0] ? `${m.craneUtilization[0].services} servicios` : ''} />
          </div>
        );
      case 'finanzas':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ReportMetricCard title="Beneficio Neto" value={`$${m.netProfit.toLocaleString()}`} valueClassName={m.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
            <ReportMetricCard title="Margen" value={`${m.profitMargin.toFixed(1)}%`} />
            <ReportMetricCard title="Facturas Pendientes" value={m.pendingInvoices} valueClassName="text-yellow-600 dark:text-yellow-400" />
            <ReportMetricCard title="Vencidas" value={m.overdueInvoices} valueClassName="text-red-600 dark:text-red-400" />
          </div>
        );
      case 'costos':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ReportMetricCard title="Total Costos" value={`$${m.totalCosts.toLocaleString()}`} valueClassName="text-red-600 dark:text-red-400" />
            <ReportMetricCard title="Costo/Servicio" value={`$${m.averageCostPerService.toLocaleString()}`} />
            <ReportMetricCard title="Ratio Costo/Ingreso" value={`${m.costRevenueRatio.toFixed(1)}%`} />
            <ReportMetricCard title="Categorías" value={m.costsByCategory.length} />
          </div>
        );
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'servicios':
      case 'ingresos':
      case 'clientes':
      case 'operadores':
      case 'flota':
        return <ReportsDashboard metrics={m} />;
      case 'finanzas':
        return (
          <>
            <ReportFilters
              filters={filters} onDateChange={handleDateChange} onFilterChange={handleFilterChange}
              onUpdate={handleUpdate} onClear={handleClearFilters}
              serviceReportFilters={serviceReportFilters}
              onServiceReportDateChange={handleServiceReportDateChange}
              onServiceReportFilterChange={handleServiceReportFilterChange}
              costReportFilters={costReportFilters}
              onCostReportDateChange={handleCostReportDateChange}
              onCostReportFilterChange={handleCostReportFilterChange}
              sections={['services']}
            />
            <OperationalReports
              metrics={m}
              servicesByMonthConfig={servicesByMonthConfig}
              revenueByMonthConfig={revenueByMonthConfig}
              servicesByStatusConfig={servicesByStatusConfig}
              craneUtilizationConfig={craneUtilizationConfig}
            />
          </>
        );
      case 'costos':
        return (
          <>
            <ReportFilters
              filters={filters} onDateChange={handleDateChange} onFilterChange={handleFilterChange}
              onUpdate={handleUpdate} onClear={handleClearFilters}
              serviceReportFilters={serviceReportFilters}
              onServiceReportDateChange={handleServiceReportDateChange}
              onServiceReportFilterChange={handleServiceReportFilterChange}
              costReportFilters={costReportFilters}
              onCostReportDateChange={handleCostReportDateChange}
              onCostReportFilterChange={handleCostReportFilterChange}
              sections={['metrics', 'costs']}
            />
            <CostAnalysisReports metrics={m} costsByCategoryConfig={costsByCategoryConfig} />
          </>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <ReportsHeader />

      {/* Card Navigation */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-card text-foreground border-border hover:bg-muted/50 hover:border-violet-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[180px] h-9 text-sm bg-card border">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border z-50">
            {periodOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="h-9 px-3 text-xs font-normal text-muted-foreground border-border bg-card">
          {dateLabel}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={forceRefresh}
            disabled={loading}
            className="h-9 border-input"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 bg-violet-600 hover:bg-violet-700 text-white">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border z-50">
              <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
                <BarChart3 className="w-3.5 h-3.5" />
                Métricas Generales
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
                <Truck className="w-3.5 h-3.5" />
                Informe de Servicios
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExportServiceReport('pdf')}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportServiceReport('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-3.5 h-3.5" />
                Informe de Costos
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleExportCostReport('pdf')}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCostReport('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Contextual KPIs */}
      {renderKPIs()}

      {/* Tab Content */}
      <div className="space-y-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default ReportsPage;
