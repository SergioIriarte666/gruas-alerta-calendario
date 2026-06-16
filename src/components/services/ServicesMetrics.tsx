import React from 'react';
import { MetricCard } from '@/components/ui/metric-card';
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

export const ServicesMetrics = React.memo(({ metrics, showSensitiveData = true }: ServicesMetricsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      <MetricCard
        icon={Truck}
        title="Total Servicios"
        value={metrics.totalServices}
        description={`Valor: ${showSensitiveData ? formatCurrency(metrics.totalRevenue) : '••••••'}`}
        tone="info"
      />
      
      <MetricCard
        icon={TrendingDown}
        title="Gastos"
        value={showSensitiveData ? formatCurrency(metrics.totalCosts) : '••••••'}
        description="Costos operativos del período"
        tone="danger"
      />
      
      <MetricCard
        icon={DollarSign}
        title="Total Generado"
        value={showSensitiveData ? formatCurrency(metrics.totalRevenue) : '••••••'}
        description="Ingresos totales por servicios"
        tone="success"
      />
      
      <MetricCard
        icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown}
        title="Balance"
        value={showSensitiveData ? formatCurrency(metrics.netProfit) : '••••••'}
        description={`Margen: ${showSensitiveData ? metrics.profitMargin.toFixed(1) + '%' : '••••'}`}
        tone={metrics.netProfit >= 0 ? 'primary' : 'danger'}
      />
    </div>
  );
});