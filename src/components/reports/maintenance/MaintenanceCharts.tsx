import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaintenanceReportData } from '@/hooks/reports/useMaintenanceReport';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

interface MaintenanceChartsProps {
  data: MaintenanceReportData;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

export const MaintenanceCharts = ({ data }: MaintenanceChartsProps) => {
  const monthlyTrendsConfig: ChartConfig = {
    maintenanceCost: {
      label: "Mantenimiento",
      color: "#10b981",
    },
    partsCost: {
      label: "Partes",
      color: "#f59e0b",
    },
    interventionCount: {
      label: "Intervenciones",
      color: "#3b82f6",
    },
  };

  const maintenanceTypeConfig: ChartConfig = {
    cost: {
      label: "Costo",
      color: "#10b981",
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
          <CardTitle className="text-white">Tendencias Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyTrendsConfig} className="h-80 w-full">
            <LineChart data={data.monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="month" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
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
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="partsCost" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top 10 Cranes by Cost */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-white">Top 10 Grúas por Costo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyTrendsConfig} className="h-80 w-full">
            <BarChart data={craneCostData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={formatCurrency}
              />
              <YAxis 
                type="category"
                dataKey="crane" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                width={60}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value) => [formatCurrency(Number(value)), 'Costo Total']}
                />} 
              />
              <Bar dataKey="totalCost" fill="#10b981" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Maintenance by Type */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-white">Mantenimiento por Tipo</CardTitle>
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
                fill="#8884d8"
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