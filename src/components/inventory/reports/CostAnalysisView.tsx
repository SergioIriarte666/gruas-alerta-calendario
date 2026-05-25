import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';
import { useCostAnalysisReport, InventoryReportFilters } from '@/hooks/useInventoryReports';
import { formatCurrency } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface CostAnalysisViewProps {
  filters?: InventoryReportFilters;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const CostAnalysisView: React.FC<CostAnalysisViewProps> = ({ filters }) => {
  const { data: costData, isLoading } = useCostAnalysisReport(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full size-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!costData) {
    return <div>No hay datos disponibles</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Inventario</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(costData.totalInventoryValue)}</div>
            <p className="text-xs text-muted-foreground">Valor total basado en movimientos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Promedio Unitario</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(costData.averageUnitCost)}</div>
            <p className="text-xs text-muted-foreground">Promedio por movimiento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores Únicos</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costData.supplierAnalysis.length}</div>
            <p className="text-xs text-muted-foreground">Proveedores registrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Costos por Categoría</CardTitle>
          <CardDescription>Distribución de costos y promedios por categoría de producto</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costData.costByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === 'total_cost' ? 'Costo Total' : 'Costo Promedio'
                ]}
              />
              <Bar yAxisId="left" dataKey="total_cost" fill="hsl(var(--primary))" name="total_cost" />
              <Bar yAxisId="right" dataKey="avg_cost" fill="hsl(var(--secondary))" name="avg_cost" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supplier Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Proveedores</CardTitle>
          <CardDescription>Ranking de proveedores por gastos y frecuencia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {costData.supplierAnalysis.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="size-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos de proveedores</p>
                <p className="text-sm">Los datos aparecerán cuando se registren movimientos con proveedores</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {costData.supplierAnalysis
                  .sort((a, b) => b.total_spent - a.total_spent)
                  .slice(0, 10)
                  .map((supplier, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center size-8 bg-primary/10 text-primary rounded-full font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{supplier.supplier_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {supplier.movement_count} movimientos
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {formatCurrency(supplier.total_spent)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Promedio: {formatCurrency(supplier.avg_cost)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Costos</CardTitle>
          <CardDescription>Evolución de costos por mes</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costData.costTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'movement_count' ? value : formatCurrency(Number(value)),
                  name === 'movement_count' ? 'Movimientos' : 'Costo Total'
                ]}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="total_cost" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="total_cost"
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="movement_count" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                name="movement_count"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Cost Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Costos</CardTitle>
          <CardDescription>Participación por categoría en el costo total</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={costData.costByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, total_cost }) => `${category}: ${formatCurrency(total_cost)}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="total_cost"
              >
                {costData.costByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};