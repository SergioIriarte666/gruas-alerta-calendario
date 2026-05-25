import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign,
  Activity,
  Users,
  Truck
} from 'lucide-react';
import { 
  useStockReport, 
  useMovementReport, 
  useCostAnalysisReport,
  usePredictiveAnalysis,
  InventoryReportFilters 
} from '@/hooks/useInventoryReports';
import { formatCurrency } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface ExecutiveDashboardProps {
  filters?: InventoryReportFilters;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ filters }) => {
  const { data: stockData, isLoading: stockLoading } = useStockReport(filters);
  const { data: movementData, isLoading: movementLoading } = useMovementReport(filters);
  const { data: costData, isLoading: costLoading } = useCostAnalysisReport(filters);
  const { data: predictiveData, isLoading: predictiveLoading } = usePredictiveAnalysis(filters);

  if (stockLoading || movementLoading || costLoading || predictiveLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full size-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Valor Total Inventario',
      value: formatCurrency(stockData?.totalValue || 0),
      icon: DollarSign,
      description: 'Valor total del inventario actual',
      trend: '+12.5%',
      trendUp: true
    },
    {
      title: 'Total de Productos',
      value: stockData?.totalItems || 0,
      icon: Package,
      description: 'Productos únicos en inventario',
      trend: '+3.2%',
      trendUp: true
    },
    {
      title: 'Productos con Stock Bajo',
      value: stockData?.lowStockItems || 0,
      icon: AlertTriangle,
      description: 'Requieren reposición urgente',
      trend: '-15.8%',
      trendUp: false
    },
    {
      title: 'Movimientos del Período',
      value: movementData?.totalMovements || 0,
      icon: Activity,
      description: 'Total de movimientos registrados',
      trend: '+8.7%',
      trendUp: true
    }
  ];

  const lowStockData = stockData?.lowStockAlert.slice(0, 5) || [];
  const topMovedItems = movementData?.topMovedItems.slice(0, 5) || [];
  const categoryData = stockData?.itemsByCategory.slice(0, 6) || [];
  const craneConsumption = predictiveData?.craneConsumption.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <span>{kpi.description}</span>
              </div>
              <div className="flex items-center mt-1">
                {kpi.trendUp ? (
                  <TrendingUp className="size-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="size-3 text-red-500 mr-1" />
                )}
                <span className={`text-xs ${kpi.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                  {kpi.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movement Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Movimientos</CardTitle>
            <CardDescription>Entradas vs Salidas por fecha</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={movementData?.movementsByDate || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="entries" 
                  stroke="hsl(var(--primary))" 
                  name="Entradas"
                />
                <Line 
                  type="monotone" 
                  dataKey="exits" 
                  stroke="hsl(var(--destructive))" 
                  name="Salidas"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Inventory by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Inventario por Categoría</CardTitle>
            <CardDescription>Distribución de valor por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, value }) => `${category}: ${formatCurrency(value)}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Moved Items */}
        <Card>
          <CardHeader>
            <CardTitle>Productos Más Movidos</CardTitle>
            <CardDescription>Ranking por cantidad de movimientos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topMovedItems}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="item_name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_quantity" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Crane Consumption */}
        <Card>
          <CardHeader>
            <CardTitle>Consumo por Grúa</CardTitle>
            <CardDescription>Consumo total de inventario por equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={craneConsumption}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="crane_license_plate" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_consumption" fill="hsl(var(--secondary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alert Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-orange-500" />
              Alertas de Stock Bajo
            </CardTitle>
            <CardDescription>Productos que requieren reposición inmediata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockData.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay productos con stock bajo
                </p>
              ) : (
                lowStockData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.location_name} • {item.category_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="mb-1">
                        {item.current_quantity} / {item.minimum_stock}
                      </Badge>
                      <div className="w-24">
                        <Progress 
                          value={(item.current_quantity / item.minimum_stock) * 100} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cost Analysis Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Costos</CardTitle>
            <CardDescription>Análisis financiero del inventario</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <span className="font-medium">Valor Total Inventario</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(costData?.totalInventoryValue || 0)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 border rounded-lg">
                <span className="font-medium">Costo Promedio Unitario</span>
                <span className="text-lg font-bold">
                  {formatCurrency(costData?.averageUnitCost || 0)}
                </span>
              </div>

              <div className="space-y-2">
                <span className="font-medium">Top Proveedores</span>
                {costData?.supplierAnalysis.slice(0, 3).map((supplier, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{supplier.supplier_name}</span>
                    <span className="font-medium">
                      {formatCurrency(supplier.total_spent)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};