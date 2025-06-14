
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { ReportMetrics } from '@/hooks/useReports';

interface CostChartsProps {
  metrics: ReportMetrics;
  costsByCategoryConfig: ChartConfig;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export const CostCharts = ({ metrics, costsByCategoryConfig }: CostChartsProps) => {
  if (!metrics.costsByCategory || metrics.costsByCategory.length === 0) {
    return null;
  }
  
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="bg-white/10 border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Distribución de Costos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={costsByCategoryConfig} className="w-full h-[350px]">
            <PieChart>
              <ChartTooltip 
                cursor={false}
                content={<ChartTooltipContent 
                  formatter={(value, name) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="text-muted-foreground">{`$${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</span>
                    </div>
                  )}
                />}
              />
              <Pie
                data={metrics.costsByCategory}
                dataKey="total"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {metrics.costsByCategory.map((entry, index) => (
                  <Cell key={`cell-${entry.categoryName}`} fill={`var(--color-${entry.categoryName})`} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="categoryName" layout="vertical" align="right" verticalAlign="middle" />}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
