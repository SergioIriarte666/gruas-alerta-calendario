import { businessClock } from '@/utils/businessClock';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';
import { ReportMetricCard } from '../shared/ReportMetricCard';

import { es } from 'date-fns/locale';
import { DollarSign, Percent } from 'lucide-react';

interface CostAnalysisProps {
  metrics: ReportMetrics;
}

const costsByMonthConfig = {
  total: { label: 'Costo Total', color: 'hsl(var(--chart-3))' }
} satisfies ChartConfig;

export const CostAnalysis = ({ metrics }: CostAnalysisProps) => {
  const formattedCostsByMonth = metrics.costsByMonth.map(item => ({
    ...item,
    month: businessClock.format(`${item.month}-02`, "MMM yyyy", { locale: es }),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportMetricCard
          title="Costo Promedio por Servicio"
          icon={DollarSign}
          value={`$${metrics.averageCostPerService.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description="Costo total / N° de servicios"
        />
        <ReportMetricCard
          title="Ratio Costo/Ingreso"
          icon={Percent}
          value={`${metrics.costRevenueRatio.toFixed(1)}%`}
          description="Porcentaje de ingresos destinado a costos"
        />
      </div>
      
      {metrics.costsByMonth.length > 0 && (
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">Tendencia de Costos Mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={costsByMonthConfig} className="w-full h-72">
              <ResponsiveContainer>
                <LineChart data={formattedCostsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <ChartTooltip
                    cursor={{ stroke: 'hsl(var(--border-strong))', strokeWidth: 1 }}
                    content={<ChartTooltipContent 
                        indicator="dot" 
                        labelFormatter={(label) => <div className="font-bold">{label}</div>}
                        formatter={(value, _name) => ([
                          `$${Number(value).toLocaleString('es-CL')}`,
                          'Costo Total'
                        ])}
                    />}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-total)' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
