import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Package, TrendingUp, MapPin } from 'lucide-react';
import { useStockReport, InventoryReportFilters } from '@/hooks/useInventoryReports';
import { formatCurrency } from '@/lib/utils';
import { stockCoveragePercent } from '@/utils/lowStock';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

interface StockReportViewProps {
  filters?: InventoryReportFilters;
}

const COLORS = Array.of(
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--muted))',
);

export const StockReportView: React.FC<StockReportViewProps> = ({ filters }) => {
  const { data: stockData, isLoading } = useStockReport(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full size-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stockData) {
    return <div>No hay datos disponibles</div>;
  }

  const stockStatusData = [
    { name: 'Normal', value: Math.max(0, stockData.totalItems - stockData.lowStockItems - stockData.outOfStockItems) },
    { name: 'Bajo mínimo', value: stockData.lowStockItems },
    { name: 'Sin stock (sin mínimo)', value: stockData.outOfStockItems }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Productos</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockData.totalItems}</div>
            <p className="text-xs text-muted-foreground">Productos únicos en inventario</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stockData.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Valor total del inventario</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bajo mínimo</CardTitle>
            <AlertTriangle className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stockData.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Con mínimo definido y por debajo de él</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin stock</CardTitle>
            <AlertTriangle className="size-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stockData.outOfStockItems}</div>
            <p className="text-xs text-muted-foreground">Agotados sin mínimo definido</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Inventario por Categoría</CardTitle>
            <CardDescription>Distribución de cantidad y valor por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockData.itemsByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'quantity' ? value : formatCurrency(Number(value)),
                    name === 'quantity' ? 'Cantidad' : 'Valor'
                  ]}
                />
                <Bar yAxisId="left" dataKey="quantity" fill="hsl(var(--primary))" name="quantity" />
                <Bar yAxisId="right" dataKey="value" fill="hsl(var(--secondary))" name="value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stock Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Stock</CardTitle>
            <CardDescription>Distribución por estado de stock</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {stockStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stock by Location */}
      <Card>
        <CardHeader>
          <CardTitle>Inventario por Ubicación</CardTitle>
          <CardDescription>Distribución de inventario por ubicación física</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stockData.itemsByLocation}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="location" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'quantity' ? value : formatCurrency(Number(value)),
                  name === 'quantity' ? 'Cantidad' : 'Valor'
                ]}
              />
              <Bar yAxisId="left" dataKey="quantity" fill="hsl(var(--primary))" name="quantity" />
              <Bar yAxisId="right" dataKey="value" fill="hsl(var(--accent))" name="value" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" />
            Productos bajo su mínimo
          </CardTitle>
          <CardDescription>
            Sólo productos activos con mínimo definido, sumando todas sus ubicaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockData.lowStockAlert.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-12 mx-auto mb-4 opacity-50" />
              <p>Ningún producto bajo su mínimo</p>
              <p className="text-sm">Se controlan sólo los productos con mínimo definido</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stockData.lowStockAlert.map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning-soft p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{item.item_name}</span>
                      <Badge variant="outline">{item.category_name}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {item.location_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {item.location_name}
                        </span>
                      )}
                      <span>Stock actual: {item.current_quantity}</span>
                      <span>Stock mínimo: {item.minimum_stock}</span>
                      <span>Faltan: {item.missing}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={item.current_quantity === 0 ? "destructive" : "secondary"}
                      className="mb-2"
                    >
                      {item.current_quantity === 0 ? "Agotado" : "Bajo mínimo"}
                    </Badge>
                    {(() => {
                      // Sin mínimo definido no hay porcentaje: dividir por cero daba
                      // Infinity/NaN en la barra. Ver @/utils/lowStock.
                      const coverage = stockCoveragePercent(item.current_quantity, item.minimum_stock);
                      if (coverage === null) return null;
                      return (
                        <div className="w-32">
                          <Progress value={coverage} className="h-2" />
                          <span className="text-xs text-muted-foreground">{coverage}%</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
