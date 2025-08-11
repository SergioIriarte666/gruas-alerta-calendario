
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
    <Card className="bg-white/10 border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Servicios por Mes</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={servicesByMonthConfig} className="w-full h-[300px]">
          <BarChart data={metrics.servicesByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="services" fill="var(--color-services)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>

    <Card className="bg-white/10 border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Ingresos por Mes</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueByMonthConfig} className="w-full h-[300px]">
          <LineChart data={metrics.servicesByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
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
