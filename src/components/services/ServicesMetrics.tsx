import React from 'react';
import { ReportMetricCard } from '../reports/shared/ReportMetricCard';
import { 
  Truck, 
  DollarSign, 
  TrendingDown, 
  TrendingUp,
  Calculator 
} from 'lucide-react';
import { ServicesMetrics as ServicesMetricsType } from '@/hooks/services/useServicesMetrics';
import { formatCurrency } from '@/lib/utils';

interface ServicesMetricsProps {
  metrics: ServicesMetricsType;
  showSensitiveData?: boolean;
}

export const ServicesMetrics = ({ metrics, showSensitiveData = true }: ServicesMetricsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      <ReportMetricCard
        icon={Truck}
        title="Total Servicios"
        value={`${metrics.totalServices} servicios`}
        description={`Valor: ${showSensitiveData ? formatCurrency(metrics.totalRevenue) : '••••••'}`}
        valueClassName="text-blue-400"
      />
      
      <ReportMetricCard
        icon={TrendingDown}
        title="Gastos"
        value={showSensitiveData ? formatCurrency(metrics.totalCosts) : '••••••'}
        description="Costos operativos del período"
        valueClassName="text-red-400"
      />
      
      <ReportMetricCard
        icon={DollarSign}
        title="Total Generado"
        value={showSensitiveData ? formatCurrency(metrics.totalRevenue) : '••••••'}
        description="Ingresos totales por servicios"
        valueClassName="text-green-400"
      />
      
      <ReportMetricCard
        icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown}
        title="Balance"
        value={showSensitiveData ? formatCurrency(metrics.netProfit) : '••••••'}
        description={`Margen: ${showSensitiveData ? metrics.profitMargin.toFixed(1) + '%' : '••••'}`}
        valueClassName="text-violet-600"
      />
    </div>
  );
};