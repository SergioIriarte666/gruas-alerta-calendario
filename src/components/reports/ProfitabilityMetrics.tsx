
import * as React from 'react';
import { ReportMetricCard } from './ReportMetricCard';
import { FileText, PiggyBank, Percent } from 'lucide-react';
import { ReportMetrics } from '@/hooks/useReports';

interface ProfitabilityMetricsProps {
  metrics: ReportMetrics;
}

export const ProfitabilityMetrics = ({ metrics }: ProfitabilityMetricsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <ReportMetricCard
      icon={FileText}
      title="Total Costos"
      value={`$${metrics.totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      description="Costos operativos en el período"
      valueClassName="text-yellow-400"
    />
    <ReportMetricCard
      icon={PiggyBank}
      title="Beneficio Neto"
      value={`$${metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      description="Ingresos menos costos"
      valueClassName={metrics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
    />
    <ReportMetricCard
      icon={Percent}
      title="Margen de Beneficio"
      value={`${metrics.profitMargin.toFixed(1)}%`}
      description="Porcentaje de beneficio sobre ingresos"
      valueClassName="text-blue-400"
    />
  </div>
);
