import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';

interface PrimaryChartsProps {
  metrics: ReportMetrics;
  servicesByMonthConfig: ChartConfig;
  revenueByMonthConfig: ChartConfig;
}

export const PrimaryCharts = ({ metrics, servicesByMonthConfig, revenueByMonthConfig }: PrimaryChartsProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">Servicios por Mes</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={servicesByMonthConfig} className="w-full h-72">
          <BarChart data={metrics.servicesByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="services" fill="var(--color-services)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>

    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">Ingresos por Mes</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueByMonthConfig} className="w-full h-72">
          <LineChart data={metrics.servicesByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
            <ChartTooltip 
              cursor={false}
              content={<ChartTooltipContent indicator="line" formatter={(value) => `$${Number(value).toLocaleString()}`} />}
            />
            <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={3} dot={{ fill: 'var(--color-revenue)', r: 5 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  </div>
);