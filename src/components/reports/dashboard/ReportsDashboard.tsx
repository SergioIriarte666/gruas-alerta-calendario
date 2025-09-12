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
        <h2 className="text-2xl font-bold text-foreground mb-2">Dashboard Ejecutivo</h2>
        <p className="text-muted-foreground">Resumen de métricas clave y indicadores de rendimiento</p>
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
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="text-foreground">Distribución de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.servicesByStatus.map((status) => (
              <div key={status.status} className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-foreground">{status.count}</div>
                <div className="text-sm text-black capitalize">{status.status}</div>
                <div className="text-xs text-black">{status.percentage.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Recursos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">Top 5 Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.topClients.slice(0, 5).map((client, index) => (
                <div key={client.clientId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div>
                    <div className="font-medium text-foreground">{client.clientName}{client.department ? ` — ${client.department}` : ''}</div>
                    <div className="text-sm text-black">{client.services} servicios</div>
                  </div>
                  <div className="text-violet-600 font-medium">
                    ${client.revenue.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">Utilización de Grúas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.craneUtilization.slice(0, 5).map((crane) => (
                <div key={crane.craneId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div>
                    <div className="font-medium text-foreground">{crane.craneName}</div>
                    <div className="text-sm text-black">{crane.services} servicios</div>
                  </div>
                  <div className="text-secondary font-medium">
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