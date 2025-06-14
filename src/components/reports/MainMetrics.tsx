
import * as React from 'react';
import { ReportMetricCard } from './ReportMetricCard';
import { Truck, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { ReportMetrics } from '@/hooks/useReports';

interface MainMetricsProps {
  metrics: ReportMetrics;
}

export const MainMetrics = ({ metrics }: MainMetricsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <ReportMetricCard
      icon={Truck}
      title="Total Servicios"
      value={metrics.totalServices}
      description="Servicios realizados en el período"
    />
    <ReportMetricCard
      icon={DollarSign}
      title="Ingresos Totales"
      value={`$${metrics.totalRevenue.toLocaleString()}`}
      description="Ingresos generados en el período"
      valueClassName="text-green-400"
    />
    <ReportMetricCard
      icon={TrendingUp}
      title="Valor Promedio"
      value={`$${metrics.averageServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      description="Promedio por servicio"
      valueClassName="text-blue-400"
    />
    <ReportMetricCard
      icon={Clock}
      title="Facturas Pendientes"
      value={metrics.pendingInvoices}
      description={`${metrics.overdueInvoices} vencidas`}
      valueClassName="text-yellow-400"
    />
  </div>
);
