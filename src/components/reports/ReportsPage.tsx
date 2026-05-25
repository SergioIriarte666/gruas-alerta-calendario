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
import { useClients } from '@/hooks/useClients';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { useSettings } from '@/hooks/useSettings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, toTitleCase } from '@/lib/utils';
import {
  BarChart3, TrendingUp, Users, HardHat, Truck, DollarSign, Receipt,
  Download, FileText, FileSpreadsheet, Calendar, RefreshCw, Wrench, Trophy,
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
  { value: 'custom', label: 'Personalizado' },
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

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  scheduled: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

const statusLabels: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  cancelled: 'Cancelado',
  scheduled: 'Programado',
};

const rankBadgeColors = [
  'bg-yellow-500 text-white',
  'bg-gray-400 text-white',
  'bg-amber-700 text-white',
];

const ReportsPage = () => {
  useReportsRealtime();

  const [activeTab, setActiveTab] = useState<TabId>('servicios');
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());

  const { clients } = useClients();
  const { data: costCategories = [] } = useCostCategories();
  const [selectedCostCategoryId, setSelectedCostCategoryId] = useState<string>('all');
  const { cranes } = useCranes();
  const [selectedCompanyRut, setSelectedCompanyRut] = useState<string>('all');
  const { settings } = useSettings();

  const periodDates = useMemo(() => {
    if (selectedPeriod === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    return getPeriodDates(selectedPeriod);
  }, [selectedPeriod, customFrom, customTo]);

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
    clientId: (activeTab === 'clientes' || activeTab === 'servicios') ? selectedClientId : appliedFilters.clientId,
    costCategoryId: activeTab === 'costos' ? selectedCostCategoryId : 'all',
    companyRut: selectedCompanyRut,
  }), [appliedFilters, periodDates, selectedClientId, selectedCostCategoryId, activeTab, selectedCompanyRut]);

  const { metrics, loading, lastUpdate, forceRefresh } = useReports(effectiveFilters);

  const effectiveServiceFilters = useMemo(() => ({
    dateRange: {
      from: format(periodDates.from, 'yyyy-MM-dd'),
      to: format(periodDates.to, 'yyyy-MM-dd'),
    },
    clientId: selectedClientId,
  }), [periodDates, selectedClientId]);

  const { handleExport, handleExportServiceReport } = useReportActions({
    appliedFilters: effectiveFilters, serviceReportFilters: effectiveServiceFilters, metrics,
  });

  const effectiveCostFilters = useMemo(() => ({
    dateRange: {
      from: format(periodDates.from, 'yyyy-MM-dd'),
      to: format(periodDates.to, 'yyyy-MM-dd'),
    },
    categoryId: selectedCostCategoryId,
    craneId: 'all',
    operatorId: 'all',
    companyRut: selectedCompanyRut,
  }), [periodDates, selectedCostCategoryId, selectedCompanyRut]);

  const { handleExportCostReport } = useCostReportActions({ costReportFilters: effectiveCostFilters });

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
    operatorUtilization: [], costsByCategory: [], costsByMonth: [],
    averageCostPerService: 0, costRevenueRatio: 0,
  };

  const m = metrics || defaultMetrics;

  // Client-specific metrics for Clientes tab
  const selectedClientData = useMemo(() => {
    if (selectedClientId === 'all' || !m.topClients.length) return null;
    return m.topClients.find(c => c.clientId === selectedClientId) || null;
  }, [selectedClientId, m.topClients]);

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
        if (selectedClientData) {
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ReportMetricCard title="Cliente" value={toTitleCase(selectedClientData.clientName)} />
              <ReportMetricCard title="Servicios" value={selectedClientData.services} />
              <ReportMetricCard title="Ingresos" value={`$${selectedClientData.revenue.toLocaleString()}`} valueClassName="text-green-600 dark:text-green-400" />
              <ReportMetricCard title="Ticket Promedio" value={`$${selectedClientData.services > 0 ? Math.round(selectedClientData.revenue / selectedClientData.services).toLocaleString() : 0}`} />
            </div>
          );
        }
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

  const renderExportMenu = () => {
    switch (activeTab) {
      case 'servicios':
        return (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
              <Truck className="size-3.5" />
              Informe de Servicios
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExportServiceReport('pdf')}>
              <FileText className="size-4 mr-2" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportServiceReport('excel')}>
              <FileSpreadsheet className="size-4 mr-2" /> Excel
            </DropdownMenuItem>
          </>
        );
      case 'costos':
        return (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="size-3.5" />
              Informe de Costos
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExportCostReport('pdf')}>
              <FileText className="size-4 mr-2" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportCostReport('excel')}>
              <FileSpreadsheet className="size-4 mr-2" /> Excel
            </DropdownMenuItem>
          </>
        );
      case 'clientes':
        return (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-3.5" />
              {selectedClientData ? `Informe: ${toTitleCase(selectedClientData.clientName)}` : 'Informe de Clientes'}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="size-4 mr-2" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="size-4 mr-2" /> Excel
            </DropdownMenuItem>
          </>
        );
      default: {
        const tabLabel = tabs.find(t => t.id === activeTab)?.label || 'General';
        const TabIcon = tabs.find(t => t.id === activeTab)?.icon || BarChart3;
        return (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
              <TabIcon className="size-3.5" />
              Métricas de {tabLabel}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="size-4 mr-2" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="size-4 mr-2" /> Excel
            </DropdownMenuItem>
          </>
        );
      }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'servicios':
        return (
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground">Distribución de Servicios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {m.servicesByStatus.map((status) => (
                  <div key={status.status} className="text-center p-4 bg-muted/50 rounded-lg space-y-2">
                    <div className="text-2xl font-bold text-foreground">{status.count}</div>
                    <Badge className={`${statusColors[status.status] || 'bg-muted text-foreground'} text-xs`}>
                      {statusLabels[status.status] || status.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{status.percentage.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'ingresos':
        return (
          <OperationalReports
            metrics={m}
            servicesByMonthConfig={servicesByMonthConfig}
            revenueByMonthConfig={revenueByMonthConfig}
            servicesByStatusConfig={servicesByStatusConfig}
            craneUtilizationConfig={craneUtilizationConfig}
          />
        );

      case 'clientes': {
        const maxClientRevenue = m.topClients.length > 0 ? m.topClients[0].revenue : 1;
        const clientList = selectedClientData ? [selectedClientData] : m.topClients;
        return (
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Trophy className="size-5 text-yellow-500" />
                {selectedClientData ? `Detalle: ${toTitleCase(selectedClientData.clientName)}` : 'Ranking de Clientes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clientList.map((client, index) => {
                  const globalIndex = selectedClientData ? m.topClients.findIndex(c => c.clientId === client.clientId) : index;
                  return (
                    <div key={client.clientId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0 ${globalIndex < 3 ? rankBadgeColors[globalIndex] : 'bg-muted text-muted-foreground'}`}>
                            {globalIndex + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground text-sm truncate">
                              {toTitleCase(client.clientName)}
                            </div>
                            {client.department && client.department !== 'General' && (
                              <div className="text-xs text-muted-foreground truncate">{client.department}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-sm font-bold text-violet-600 dark:text-violet-400">
                            ${client.revenue.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">{client.services} servicios</div>
                        </div>
                      </div>
                      <Progress
                        value={(client.revenue / maxClientRevenue) * 100}
                        className="h-1.5"
                      />
                    </div>
                  );
                })}
                {clientList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay datos de clientes para el período seleccionado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      }

      case 'operadores': {
        const maxOperatorServices = m.operatorUtilization.length > 0 ? m.operatorUtilization[0].services : 1;
        return (
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Trophy className="size-5 text-yellow-500" />
                Ranking de Operadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {m.operatorUtilization.map((op, index) => {
                  const utilizationColor = op.utilization >= 30
                    ? 'text-green-600 dark:text-green-400'
                    : op.utilization >= 15
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400';
                  return (
                    <div key={op.operatorId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0 ${index < 3 ? rankBadgeColors[index] : 'bg-muted text-muted-foreground'}`}>
                            {index + 1}
                          </span>
                          <div className="font-medium text-foreground text-sm truncate">{op.operatorName}</div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className={`text-sm font-bold ${utilizationColor}`}>
                            {op.utilization.toFixed(1)}%
                          </span>
                          <div className="text-xs text-muted-foreground">{op.services} servicios</div>
                        </div>
                      </div>
                      <Progress
                        value={(op.services / maxOperatorServices) * 100}
                        className="h-1.5"
                      />
                    </div>
                  );
                })}
                {m.operatorUtilization.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay datos de operadores para el período seleccionado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      }

      case 'flota': {
        const maxCraneServices = m.craneUtilization.length > 0 ? m.craneUtilization[0].services : 1;
        return (
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground">Utilización de Grúas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {m.craneUtilization.map((crane) => {
                  const utilizationColor = crane.utilization >= 50
                    ? 'text-green-600 dark:text-green-400'
                    : crane.utilization >= 20
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400';
                  return (
                    <div key={crane.craneId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground text-sm truncate">{crane.craneName}</div>
                          <div className="text-xs text-muted-foreground">{crane.services} servicios</div>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ml-2 ${utilizationColor}`}>
                          {crane.utilization.toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={(crane.services / maxCraneServices) * 100}
                        className="h-1.5"
                      />
                    </div>
                  );
                })}
                {m.craneUtilization.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No hay datos de utilización para el período seleccionado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      }

      case 'finanzas':
        return (
          <OperationalReports
            metrics={m}
            servicesByMonthConfig={servicesByMonthConfig}
            revenueByMonthConfig={revenueByMonthConfig}
            servicesByStatusConfig={servicesByStatusConfig}
            craneUtilizationConfig={craneUtilizationConfig}
          />
        );
      case 'costos':
        return (
          <CostAnalysisReports metrics={m} costsByCategoryConfig={costsByCategoryConfig} />
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <ReportsHeader />

      {/* Card Navigation */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-7 gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'clientes' && tab.id !== 'servicios') setSelectedClientId('all');
              }}
              className={`flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-lg border text-sm font-medium transition-all duration-200 min-w-0 ${
                isActive
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                  : 'bg-card text-foreground border-border hover:bg-muted/50 hover:border-violet-300'
              }`}
            >
              <Icon className="size-4 sm:size-5" />
              <span className="text-[10px] sm:text-xs leading-tight truncate w-full text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap overflow-x-auto">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-card border">
            <Calendar className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border z-50">
            {periodOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom date pickers - only visible when 'Personalizado' is selected */}
        {selectedPeriod === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm bg-card border justify-start font-normal w-full sm:w-[150px]", !customFrom && "text-muted-foreground")}>
                  <Calendar className="size-3.5 mr-1.5" />
                  {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'Desde'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border z-50" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm bg-card border justify-start font-normal w-full sm:w-[150px]", !customTo && "text-muted-foreground")}>
                  <Calendar className="size-3.5 mr-1.5" />
                  {customTo ? format(customTo, 'dd/MM/yyyy') : 'Hasta'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border z-50" align="start">
                <CalendarComponent
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Client selector - only visible on Clientes tab */}
        {(activeTab === 'clientes' || activeTab === 'servicios') && (
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm bg-card border">
              <Users className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent className="bg-popover border z-50">
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients
                .filter(c => c.isActive)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {toTitleCase(client.name)}
                    {client.department && client.department !== 'General' && (
                      <span className="text-xs text-muted-foreground ml-1">({client.department})</span>
                    )}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {/* Company selector */}
        <Select value={selectedCompanyRut} onValueChange={setSelectedCompanyRut}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm bg-card border">
            <Truck className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Todas las empresas" />
          </SelectTrigger>
          <SelectContent className="bg-popover border z-50">
            <SelectItem value="all">Todas las empresas</SelectItem>
            <SelectItem value="__none__">Sin empresa</SelectItem>
            {(() => {
              const map = new Map<string, string>();
              if (settings.company.taxId) {
                map.set(settings.company.taxId, settings.company.name || settings.company.taxId);
              }
              cranes
                .filter(c => !!c.ownerCompanyRut)
                .forEach(c => {
                  const rut = c.ownerCompanyRut as string;
                  const name = c.ownerCompanyName || rut;
                  if (!map.has(rut)) map.set(rut, name);
                });
              return Array.from(map.entries())
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([rut, name]) => (
                  <SelectItem key={rut} value={rut}>
                    {`${name} (${rut})`}
                  </SelectItem>
                ));
            })()}
          </SelectContent>
        </Select>

        {/* Cost category selector - only visible on Costos tab */}
        {activeTab === 'costos' && (
          <Select value={selectedCostCategoryId} onValueChange={setSelectedCostCategoryId}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm bg-card border">
              <Receipt className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent className="bg-popover border z-50">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {costCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 bg-violet-600 hover:bg-violet-700 text-white">
                <Download className="size-3.5 mr-1.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border z-50">
              {renderExportMenu()}
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
