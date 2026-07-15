import * as React from 'react';
import { ReportMetricCard } from '../shared/ReportMetricCard';
import { TrendingDown, Percent, PiggyBank, Calculator, BarChart3 } from 'lucide-react';
import { CostMetrics } from '@/hooks/reports/useCostMetrics';

interface CostMetricsProps {
  metrics: CostMetrics;
}

export const CostMetricsComponent = ({ metrics }: CostMetricsProps) => (
  <div className="space-y-6">
    {/* Métricas principales de costos */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <ReportMetricCard
        icon={TrendingDown}
        title="Total Costos"
        value={`$${metrics.totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Costos operativos en el período"
        valueClassName="text-red-400"
      />
      <ReportMetricCard
        icon={Calculator}
        title="Costo Promedio por Servicio"
        value={`$${metrics.averageCostPerService.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Costo total dividido por servicios"
        valueClassName="text-orange-400"
      />
      <ReportMetricCard
        icon={Percent}
        title="Ratio Costo/Ingreso"
        value={`${metrics.costRevenueRatio.toFixed(1)}%`}
        description="Porcentaje de ingresos destinado a costos"
        valueClassName="text-yellow-400"
      />
      <ReportMetricCard
        icon={BarChart3}
        title="Categorías de Costo"
        value={metrics.costsByCategory.length}
        description="Categorías con gastos registrados"
        valueClassName="text-purple-400"
      />
    </div>

    {/* Métricas de rentabilidad relacionadas con costos */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ReportMetricCard
        icon={PiggyBank}
        title="Beneficio Neto"
        value={`$${metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Ingresos menos costos totales"
        valueClassName={metrics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
      />
      <ReportMetricCard
        icon={TrendingDown}
        title="Margen de Beneficio"
        value={`${metrics.profitMargin.toFixed(1)}%`}
        description="Porcentaje de beneficio sobre ingresos"
        valueClassName={metrics.profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}
      />
    </div>
  </div>
);