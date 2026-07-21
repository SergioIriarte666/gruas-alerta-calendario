import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Package, TrendingUp, MapPin } from 'lucide-react';
import { useStockReport, InventoryReportFilters } from '@/hooks/useInventoryReports';
import { formatCurrency } from '@/lib/utils';
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
    { name: 'Con Stock Normal', value: stockData.totalItems - stockData.lowStockItems - stockData.outOfStockItems },
    { name: 'Stock Bajo', value: stockData.lowStockItems },
    { name: 'Sin Stock', value: stockData.outOfStockItems }
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
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stockData.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Productos bajo mínimo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
            <AlertTriangle className="size-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stockData.outOfStockItems}</div>
            <p className="text-xs text-muted-foreground">Productos agotados</p>
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
            Alertas de Stock Bajo
          </CardTitle>
          <CardDescription>
            Productos que han alcanzado o están por debajo del stock mínimo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockData.lowStockAlert.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="size-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos con stock bajo</p>
              <p className="text-sm">Todos los productos tienen stock suficiente</p>
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
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {item.location_name}
                      </span>
                      <span>Stock actual: {item.current_quantity}</span>
                      <span>Stock mínimo: {item.minimum_stock}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={item.current_quantity === 0 ? "destructive" : "secondary"}
                      className="mb-2"
                    >
                      {item.current_quantity === 0 ? "Sin Stock" : "Stock Bajo"}
                    </Badge>
                    <div className="w-32">
                      <Progress 
                        value={Math.min((item.current_quantity / item.minimum_stock) * 100, 100)}
                        className="h-2"
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round((item.current_quantity / item.minimum_stock) * 100)}%
                      </span>
                    </div>
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
