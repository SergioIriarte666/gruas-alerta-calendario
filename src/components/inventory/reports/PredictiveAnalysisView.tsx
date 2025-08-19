import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, AlertTriangle, Calendar, Zap, Truck, Package } from 'lucide-react';
import { usePredictiveAnalysis, InventoryReportFilters } from '@/hooks/useInventoryReports';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, AreaChart, Area } from 'recharts';

interface PredictiveAnalysisViewProps {
  filters?: InventoryReportFilters;
}

export const PredictiveAnalysisView: React.FC<PredictiveAnalysisViewProps> = ({ filters }) => {
  const { data: predictiveData, isLoading } = usePredictiveAnalysis(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!predictiveData) {
    return <div>No hay datos disponibles</div>;
  }

  const criticalItems = predictiveData.consumptionPatterns
    .filter(item => item.days_until_stockout < 30)
    .sort((a, b) => a.days_until_stockout - b.days_until_stockout);

  const topConsumption = predictiveData.consumptionPatterns
    .sort((a, b) => b.avg_monthly_consumption - a.avg_monthly_consumption)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Analizados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictiveData.consumptionPatterns.length}</div>
            <p className="text-xs text-muted-foreground">Productos con historial</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riesgo Crítico</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalItems.length}</div>
            <p className="text-xs text-muted-foreground">Quiebre en &lt; 30 días</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grúas Monitoreadas</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictiveData.craneConsumption.length}</div>
            <p className="text-xs text-muted-foreground">Con consumo registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Períodos Analizados</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictiveData.seasonalTrends.length}</div>
            <p className="text-xs text-muted-foreground">Meses de datos</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Stock Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Alertas Críticas de Stock
          </CardTitle>
          <CardDescription>
            Productos que podrían agotarse en los próximos 30 días
          </CardDescription>
        </CardHeader>
        <CardContent>
          {criticalItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos en riesgo crítico</p>
              <p className="text-sm">Todos los productos tienen stock suficiente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {criticalItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
                  <div className="flex-1">
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Consumo promedio: {item.avg_monthly_consumption.toFixed(1)}/mes
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-2">
                      {Math.round(item.days_until_stockout)} días
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Stock actual: {item.current_stock}
                    </div>
                    <div className="text-sm font-medium text-primary">
                      Reorden: {Math.round(item.recommended_reorder)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consumption Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Patrones de Consumo</CardTitle>
          <CardDescription>Top 10 productos por consumo mensual promedio</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topConsumption}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="item_name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `${Number(value).toFixed(1)} unidades/mes`,
                  'Consumo Promedio'
                ]}
              />
              <Bar dataKey="avg_monthly_consumption" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Seasonal Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencias Estacionales</CardTitle>
          <CardDescription>Evolución del consumo total por mes</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={predictiveData.seasonalTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="total_consumption" 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Crane Consumption Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Consumo por Grúa</CardTitle>
          <CardDescription>Consumo promedio mensual por equipo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictiveData.craneConsumption.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos de consumo por grúa</p>
                <p className="text-sm">Los datos aparecerán cuando se registren movimientos con grúas</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {predictiveData.craneConsumption
                  .sort((a, b) => b.total_consumption - a.total_consumption)
                  .map((crane, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{crane.crane_license_plate}</CardTitle>
                          <Badge variant="outline">
                            {crane.total_consumption.toLocaleString()} unidades
                          </Badge>
                        </div>
                        <CardDescription>
                          Promedio mensual: {crane.avg_monthly.toFixed(1)} unidades
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <span className="text-sm font-medium">Top productos consumidos:</span>
                          {crane.top_items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex justify-between text-sm">
                              <span>{item.item_name}</span>
                              <span className="font-medium">{item.quantity} unidades</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reorder Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones de Reposición</CardTitle>
          <CardDescription>Productos que requieren reposición basado en patrones de consumo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictiveData.consumptionPatterns
              .filter(item => item.current_stock < item.recommended_reorder)
              .sort((a, b) => (a.current_stock / a.recommended_reorder) - (b.current_stock / b.recommended_reorder))
              .slice(0, 20)
              .map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Consumo: {item.avg_monthly_consumption.toFixed(1)}/mes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm mb-1">
                      Stock: {item.current_stock} / Recomendado: {Math.round(item.recommended_reorder)}
                    </div>
                    <Progress 
                      value={(item.current_stock / item.recommended_reorder) * 100} 
                      className="w-24 h-2"
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};