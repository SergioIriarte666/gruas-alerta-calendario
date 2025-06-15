
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';
import { ReportMetricCard } from './ReportMetricCard';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';

interface CostAnalysisProps {
  metrics: ReportMetrics;
}

const costsByMonthConfig = {
  total: { label: 'Costo Total', color: '#ef4444' }
} satisfies ChartConfig;

export const CostAnalysis = ({ metrics }: CostAnalysisProps) => {
  const formattedCostsByMonth = metrics.costsByMonth.map(item => ({
    ...item,
    month: formatDate(new Date(item.month + '-02T00:00:00'), "MMM yyyy", { locale: es }), // Adding day and time to parse correctly
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportMetricCard
          label="Costo Promedio por Servicio"
          value={`$${metrics.averageCostPerService.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description="Costo total / N° de servicios"
        />
        <ReportMetricCard
          label="Ratio Costo/Ingreso"
          value={`${metrics.costRevenueRatio.toFixed(1)}%`}
          description="Porcentaje de ingresos destinado a costos"
        />
      </div>
      
      {metrics.costsByMonth.length > 0 && (
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Tendencia de Costos Mensuales</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={costsByMonthConfig} className="w-full h-[300px]">
              <ResponsiveContainer>
                <LineChart data={formattedCostsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <ChartTooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                    content={<ChartTooltipContent 
                        indicator="dot" 
                        labelFormatter={(label) => <div className="font-bold">{label}</div>}
                        formatter={(value, name) => ([
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
