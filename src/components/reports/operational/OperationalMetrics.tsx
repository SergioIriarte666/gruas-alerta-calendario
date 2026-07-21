import * as React from 'react';
import { ReportMetricCard } from '../shared/ReportMetricCard';
import { Truck, DollarSign, TrendingUp, Clock, Users, Settings, User } from 'lucide-react';
import { OperationalMetrics } from '@/hooks/reports/useOperationalMetrics';

interface OperationalMetricsProps {
  metrics: OperationalMetrics;
}

export const OperationalMetricsComponent = ({ metrics }: OperationalMetricsProps) => (
  <div className="space-y-6">
    {/* Métricas principales de servicios */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <ReportMetricCard
        icon={Truck}
        title="Total Servicios"
        value={metrics.totalServices}
        description="Servicios realizados en el período"
        valueClassName="text-info-text"
      />
      <ReportMetricCard
        icon={DollarSign}
        title="Ingresos Totales"
        value={`$${metrics.totalRevenue.toLocaleString()}`}
        description="Ingresos generados en el período"
        valueClassName="text-success-text"
      />
      <ReportMetricCard
        icon={TrendingUp}
        title="Valor Promedio"
        value={`$${metrics.averageServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        description="Promedio por servicio"
        valueClassName="text-primary"
      />
      <ReportMetricCard
        icon={Clock}
        title="Facturas Pendientes"
        value={metrics.pendingInvoices}
        description={`${metrics.overdueInvoices} vencidas`}
        valueClassName="text-warning-text"
      />
    </div>

    {/* Métricas de recursos activos */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ReportMetricCard
        icon={Users}
        title="Clientes Activos"
        value={metrics.activeClients}
        description="Clientes con servicios en el período"
        valueClassName="text-success-text"
      />
      <ReportMetricCard
        icon={Settings}
        title="Grúas Activas"
        value={metrics.activeCranes}
        description="Grúas disponibles para servicios"
        valueClassName="text-info-text"
      />
      <ReportMetricCard
        icon={User}
        title="Operadores Activos"
        value={metrics.activeOperators}
        description="Operadores disponibles"
        valueClassName="text-primary"
      />
    </div>
  </div>
);