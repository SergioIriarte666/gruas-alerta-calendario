import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useMovementReport, InventoryReportFilters } from '@/hooks/useInventoryReports';
import { formatCurrency } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';

interface MovementReportViewProps {
  filters?: InventoryReportFilters;
}

export const MovementReportView: React.FC<MovementReportViewProps> = ({ filters }) => {
  const { data: movementData, isLoading } = useMovementReport(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full size-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!movementData) {
    return <div>No hay datos disponibles</div>;
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM');
    } catch {
      return dateString;
    }
  };

  const chartData = movementData.movementsByDate.map(item => ({
    ...item,
    date: formatDate(item.date)
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Movimientos</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movementData.totalMovements}</div>
            <p className="text-xs text-muted-foreground">Movimientos del período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <ArrowUpRight className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{movementData.entriesCount}</div>
            <p className="text-xs text-muted-foreground">
              Valor: {formatCurrency(movementData.totalEntriesValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salidas</CardTitle>
            <ArrowDownLeft className="size-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{movementData.exitsCount}</div>
            <p className="text-xs text-muted-foreground">
              Valor: {formatCurrency(movementData.totalExitsValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
            {movementData.entriesCount >= movementData.exitsCount ? (
              <TrendingUp className="size-4 text-success" />
            ) : (
              <TrendingDown className="size-4 text-danger" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              movementData.entriesCount >= movementData.exitsCount ? 'text-success' : 'text-danger'
            }`}>
              {movementData.entriesCount - movementData.exitsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Diferencia entre entradas y salidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Movement Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Movimientos</CardTitle>
          <CardDescription>Evolución de entradas y salidas por fecha</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value,
                  name === 'entries' ? 'Entradas' : 'Salidas'
                ]}
              />
              <Area 
                type="monotone" 
                dataKey="entries" 
                stackId="1"
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--primary))" 
                fillOpacity={0.6}
                name="entries"
              />
              <Area 
                type="monotone" 
                dataKey="exits" 
                stackId="2"
                stroke="hsl(var(--destructive))" 
                fill="hsl(var(--destructive))" 
                fillOpacity={0.6}
                name="exits"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Value Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Valor de Movimientos</CardTitle>
          <CardDescription>Evolución del valor monetario de entradas y salidas</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === 'entries_value' ? 'Valor Entradas' : 'Valor Salidas'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="entries_value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="entries_value"
              />
              <Line 
                type="monotone" 
                dataKey="exits_value" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="exits_value"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Movement Types Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por Tipo de Movimiento</CardTitle>
          <CardDescription>Cantidad y valor por tipo de movimiento</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={movementData.movementsByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="movement_type" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'count' ? value : formatCurrency(Number(value)),
                  name === 'count' ? 'Cantidad' : 'Valor Total'
                ]}
              />
              <Bar yAxisId="left" dataKey="count" fill="hsl(var(--primary))" name="count" />
              <Bar yAxisId="right" dataKey="total_value" fill="hsl(var(--secondary))" name="total_value" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Moved Items */}
      <Card>
        <CardHeader>
          <CardTitle>Productos Más Movidos</CardTitle>
          <CardDescription>Ranking de productos por cantidad total movida</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {movementData.topMovedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="size-12 mx-auto mb-4 opacity-50" />
                <p>No hay movimientos registrados</p>
                <p className="text-sm">Los movimientos aparecerán aquí cuando se registren</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {movementData.topMovedItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-8 bg-primary/10 text-primary rounded-full font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.movement_count} movimientos
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {item.total_quantity.toLocaleString()} unidades
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(item.total_value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
