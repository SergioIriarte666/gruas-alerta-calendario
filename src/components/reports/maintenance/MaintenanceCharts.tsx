import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaintenanceReportData } from '@/hooks/reports/useMaintenanceReport';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

interface MaintenanceChartsProps {
  data: MaintenanceReportData;
}

const COLORS = [1, 2, 3, 4, 5, 6].map((index) => `hsl(var(--chart-${index}))`);

export const MaintenanceCharts = ({ data }: MaintenanceChartsProps) => {
  const monthlyTrendsConfig: ChartConfig = {
    maintenanceCost: {
      label: "Mantenimiento",
      color: "hsl(var(--chart-1))",
    },
    partsCost: {
      label: "Partes",
      color: "hsl(var(--chart-2))",
    },
    interventionCount: {
      label: "Intervenciones",
      color: "hsl(var(--chart-4))",
    },
  };

  const maintenanceTypeConfig: ChartConfig = {
    cost: {
      label: "Costo",
      color: "hsl(var(--chart-1))",
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Prepare crane cost distribution data
  const craneCostData = data.craneAnalysis
    .sort((a, b) => (b.totalMaintenanceCost + b.totalPartsCost) - (a.totalMaintenanceCost + a.totalPartsCost))
    .slice(0, 10)
    .map(crane => ({
      crane: crane.licensePlate,
      totalCost: crane.totalMaintenanceCost + crane.totalPartsCost,
      maintenanceCost: crane.totalMaintenanceCost,
      partsCost: crane.totalPartsCost,
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly Trends */}
      <Card className="bg-card/50 border-border lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-foreground">Tendencias Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyTrendsConfig} className="h-80 w-full">
            <LineChart data={data.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={formatCurrency}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value, name) => [
                    name === 'interventionCount' ? value : formatCurrency(Number(value)),
                    monthlyTrendsConfig[name as keyof typeof monthlyTrendsConfig]?.label || name
                  ]}
                />} 
              />
              <Line 
                type="monotone" 
                dataKey="maintenanceCost" 
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="partsCost" 
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top 10 Cranes by Cost */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Top 10 Grúas por Costo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyTrendsConfig} className="h-80 w-full">
            <BarChart data={craneCostData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={formatCurrency}
              />
              <YAxis 
                type="category"
                dataKey="crane" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={60}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value) => [formatCurrency(Number(value)), 'Costo Total']}
                />} 
              />
              <Bar dataKey="totalCost" fill="hsl(var(--chart-1))" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Maintenance by Type */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Mantenimiento por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={maintenanceTypeConfig} className="h-80 w-full">
            <PieChart>
              <Pie
                data={data.maintenanceByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="hsl(var(--primary))"
                dataKey="cost"
              >
                {data.maintenanceByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value) => [formatCurrency(Number(value)), 'Costo']}
                />} 
              />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
