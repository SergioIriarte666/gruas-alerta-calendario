import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';

interface DistributionChartsProps {
  metrics: ReportMetrics;
  servicesByStatusConfig: ChartConfig;
  craneUtilizationConfig: ChartConfig;
}

export const DistributionCharts = ({ metrics, servicesByStatusConfig, craneUtilizationConfig }: DistributionChartsProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">Distribución por Estado</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={servicesByStatusConfig} className="w-full h-72">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
            <Pie
              data={metrics.servicesByStatus}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ status, percentage }) => `${status}: ${percentage.toFixed(1)}%`}
            >
              {metrics.servicesByStatus.map((entry) => (
                <Cell key={`cell-${entry.status}`} fill={`var(--color-${entry.status})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>

    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">Utilización de Grúas</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={craneUtilizationConfig} className="w-full h-72">
           <BarChart data={metrics.craneUtilization} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis 
              dataKey="craneName" 
              type="category" 
              stroke="hsl(var(--muted-foreground))" 
              width={120}
              fontSize={12}
            />
            <ChartTooltip 
              cursor={false} 
              content={<ChartTooltipContent indicator="line" formatter={(value) => `${Number(value).toFixed(1)}%`} />} 
            />
            <Bar dataKey="utilization" fill="var(--color-utilization)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  </div>
);