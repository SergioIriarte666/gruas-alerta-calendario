import { useClientMetrics } from '@/hooks/useClientMetrics';
import { Client } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  BarChart3,
  Activity
} from 'lucide-react';
import { formatForDisplay } from '@/utils/timezoneUtils';

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard = ({ icon: Icon, title, value, description, trend }: MetricCardProps) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4">
      <div className="flex items-center gap-x-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            {trend && (
              <TrendingUp 
                className={`size-3 ${
                  trend === 'up' ? 'text-success' :
                  trend === 'down' ? 'text-danger rotate-180' :
                  'text-muted-foreground'
                }`} 
              />
            )}
          </div>
          <p className="text-lg font-semibold text-foreground">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const ClientMetricsOverview = ({ client }: { client: Client }) => {
  const { metrics, loading } = useClientMetrics(client.id);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-20 rounded bg-muted"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay datos suficientes para mostrar métricas del cliente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          title="Valor Total Histórico"
          value={formatCurrency(metrics.totalLifetimeValue)}
          description="Facturación acumulada"
          trend="up"
        />
        <MetricCard
          icon={BarChart3}
          title="Ticket Promedio"
          value={formatCurrency(metrics.avgServiceValue)}
          description="Valor promedio por servicio"
        />
        <MetricCard
          icon={CheckCircle}
          title="Servicios Completados"
          value={metrics.completedServicesCount}
          description={`de ${metrics.totalServices} totales`}
        />
        <MetricCard
          icon={Activity}
          title="Tasa de Éxito"
          value={`${metrics.serviceSuccessRate.toFixed(1)}%`}
          description="Servicios completados exitosamente"
          trend={metrics.serviceSuccessRate > 90 ? 'up' : metrics.serviceSuccessRate > 70 ? 'neutral' : 'down'}
        />
      </div>

      {/* Estado Financiero */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="size-5" />
            Estado Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Facturado</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(metrics.totalInvoiced)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Pagado</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(metrics.totalPaid)}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Pendiente de Pago</p>
                {metrics.pendingAmount > 0 && (
                  <AlertTriangle className="size-4 text-warning" />
                )}
              </div>
              <p className={`text-2xl font-bold ${
                metrics.pendingAmount > 0 ? 'text-warning' : 'text-muted-foreground'
              }`}>
                {formatCurrency(metrics.pendingAmount)}
              </p>
            </div>
          </div>
          {metrics.avgPaymentTime > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Tiempo promedio de pago: {metrics.avgPaymentTime} días
                </span>
                <Badge variant={metrics.avgPaymentTime <= 30 ? "default" : "destructive"}>
                  {metrics.avgPaymentTime <= 30 ? "Buen pagador" : "Pago lento"}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado Actual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={Clock}
          title="Solicitudes Activas"
          value={metrics.activeRequests}
          description="Pendientes de atención"
        />
        <MetricCard
          icon={AlertTriangle}
          title="Facturas Vencidas"
          value={metrics.overdueInvoices}
          description="Requieren seguimiento"
        />
        <MetricCard
          icon={Calendar}
          title="Cierres Abiertos"
          value={metrics.openClosures}
          description="Pendientes de facturar"
        />
      </div>

      {/* Actividad Reciente */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Activity className="size-5" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.lastServiceDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Último servicio</span>
                <span className="text-sm font-medium text-foreground">
                  {formatForDisplay(new Date(metrics.lastServiceDate))}
                </span>
              </div>
            )}
            {metrics.lastInvoiceDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Última factura</span>
                <span className="text-sm font-medium text-foreground">
                  {formatForDisplay(new Date(metrics.lastInvoiceDate))}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tendencia Mensual (si hay datos) */}
      {metrics.monthlyTrend.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Tendencia de Facturación (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.monthlyTrend.map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {new Date(month.month + '-01').toLocaleDateString('es-CL', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(month.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
