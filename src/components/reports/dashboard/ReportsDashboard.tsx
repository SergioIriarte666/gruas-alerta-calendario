import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { ReportMetrics } from '@/hooks/useReports';
import { ReportMetricCard } from '../shared/ReportMetricCard';

interface ReportsDashboardProps {
  metrics: ReportMetrics;
}

export const ReportsDashboard = ({ metrics }: ReportsDashboardProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard Ejecutivo</h2>
        <p className="text-gray-300">Resumen de métricas clave y indicadores de rendimiento</p>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportMetricCard
          icon={DollarSign}
          title="Ingresos Totales"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          description="Ingresos del período"
          valueClassName="text-green-400"
        />
        <ReportMetricCard
          icon={TrendingUp}
          title="Beneficio Neto"
          value={`$${metrics.netProfit.toLocaleString()}`}
          description={`Margen: ${metrics.profitMargin.toFixed(1)}%`}
          valueClassName={metrics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <ReportMetricCard
          icon={CheckCircle}
          title="Servicios Completados"
          value={metrics.totalServices}
          description={`Promedio: $${metrics.averageServiceValue.toLocaleString()}`}
          valueClassName="text-blue-400"
        />
        <ReportMetricCard
          icon={AlertTriangle}
          title="Facturas Pendientes"
          value={metrics.pendingInvoices}
          description={`${metrics.overdueInvoices} vencidas`}
          valueClassName="text-yellow-400"
        />
      </div>

      {/* Resumen por Estado */}
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Distribución de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.servicesByStatus.map((status) => (
              <div key={status.status} className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-white">{status.count}</div>
                <div className="text-sm text-gray-400 capitalize">{status.status}</div>
                <div className="text-xs text-gray-500">{status.percentage.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Recursos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Top 5 Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.topClients.slice(0, 5).map((client, index) => (
                <div key={client.clientId} className="flex items-center justify-between p-2 bg-white/5 rounded">
                  <div>
                    <div className="font-medium text-white">{client.clientName}{client.department ? ` — ${client.department}` : ''}</div>
                    <div className="text-sm text-gray-400">{client.services} servicios</div>
                  </div>
                  <div className="text-green-400 font-medium">
                    ${client.revenue.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Utilización de Grúas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.craneUtilization.slice(0, 5).map((crane) => (
                <div key={crane.craneId} className="flex items-center justify-between p-2 bg-white/5 rounded">
                  <div>
                    <div className="font-medium text-white">{crane.craneName}</div>
                    <div className="text-sm text-gray-400">{crane.services} servicios</div>
                  </div>
                  <div className="text-blue-400 font-medium">
                    {crane.utilization.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};