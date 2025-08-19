import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  Clock,
  Activity,
  Bell
} from 'lucide-react';
import { useActiveAlerts, useAlertStats } from '@/hooks/useInventoryAlerts';
import { useInventoryStats } from '@/hooks/useInventory';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const AlertDashboard: React.FC = () => {
  const { data: activeAlerts = [] } = useActiveAlerts();
  const { data: alertStats } = useAlertStats();
  const { data: inventoryStats } = useInventoryStats();

  // Datos para gráficos
  const alertsByType = activeAlerts.reduce((acc, alert) => {
    const type = alert.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(alertsByType).map(([type, count]) => ({
    name: type === 'low_stock' ? 'Stock Bajo' : 
          type === 'expiring_soon' ? 'Próximo a Vencer' : 
          type === 'overstock' ? 'Sobrestock' : 
          type === 'no_movement' ? 'Sin Movimiento' : type,
    value: count
  }));

  const severityData = [
    { name: 'Críticas', value: activeAlerts.filter(a => a.severity === 'critical').length, color: '#ef4444' },
    { name: 'Advertencias', value: activeAlerts.filter(a => a.severity === 'warning').length, color: '#f59e0b' },
    { name: 'Información', value: activeAlerts.filter(a => a.severity === 'info').length, color: '#06b6d4' }
  ].filter(item => item.value > 0);

  const topCriticalItems = activeAlerts
    .filter(alert => alert.severity === 'critical')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Eficiencia del Sistema</p>
                <p className="text-2xl font-bold text-success">
                  {inventoryStats ? 
                    Math.round(((inventoryStats.totalItems - activeAlerts.length) / inventoryStats.totalItems) * 100) : 0
                  }%
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Productos Monitoreados</p>
                <p className="text-2xl font-bold text-foreground">
                  {inventoryStats?.totalItems || 0}
                </p>
              </div>
              <Package className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold text-foreground">{activeAlerts.length}</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas Críticas</p>
                <p className="text-2xl font-bold text-destructive">
                  {activeAlerts.filter(a => a.severity === 'critical').length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Alertas por Tipo
            </CardTitle>
            <CardDescription>
              Distribución de alertas activas por categoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>No hay alertas activas</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Severidad de Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Alertas por Severidad
            </CardTitle>
            <CardDescription>
              Distribución de alertas por nivel de criticidad
            </CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>No hay alertas activas</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Críticos */}
      {topCriticalItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Productos Críticos
            </CardTitle>
            <CardDescription>
              Productos que requieren atención inmediata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCriticalItems.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 border border-destructive/20 rounded-lg bg-destructive/5"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="font-medium text-foreground">{alert.item_name}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Crítico</Badge>
                    {alert.current_value !== undefined && alert.threshold_value !== undefined && (
                      <span className="text-sm text-muted-foreground">
                        {alert.current_value} / {alert.threshold_value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen de Configuraciones */}
      {alertStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Resumen del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Configuraciones Activas</span>
                <Badge variant="outline">{alertStats.activeConfigurations}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Total Configuradas</span>
                <Badge variant="outline">{alertStats.totalAlerts}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Alertas Detectadas</span>
                <Badge variant="outline">{alertStats.totalActiveAlerts}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};