import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { addDays, format, startOfWeek, endOfWeek, eachWeekOfInterval } from "date-fns";
import { es } from "date-fns/locale";

interface CashFlowChartProps {
  invoices: ProjectedInvoice[];
  dateRange: number;
}

export const CashFlowChart = ({ invoices, dateRange }: CashFlowChartProps) => {
  const today = new Date();
  const endDate = addDays(today, dateRange);

  // Generar semanas
  const weeks = eachWeekOfInterval(
    { start: today, end: endDate },
    { weekStartsOn: 1 }
  );

  // Calcular proyecciones por semana
  const chartData = weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    const weekInvoices = invoices.filter(inv => {
      const dueDate = new Date(inv.due_date);
      return dueDate >= weekStart && dueDate <= weekEnd;
    });

    const optimistic = weekInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
    const realistic = optimistic * 0.85; // 85% de probabilidad
    const pessimistic = optimistic * 0.70; // 70% de probabilidad

    return {
      week: format(weekStart, 'dd MMM', { locale: es }),
      optimista: Math.round(optimistic),
      realista: Math.round(realistic),
      pesimista: Math.round(pessimistic),
    };
  });

  const chartConfig = {
    optimista: {
      label: "Optimista",
      color: "hsl(var(--chart-2))",
    },
    realista: {
      label: "Realista",
      color: "hsl(var(--chart-3))",
    },
    pesimista: {
      label: "Pesimista",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de Caja Proyectado</CardTitle>
        <CardDescription>
          Proyección de ingresos por semana según diferentes escenarios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="optimista"
                stroke="var(--color-optimista)"
                strokeWidth={2}
                dot={{ fill: "var(--color-optimista)" }}
              />
              <Line
                type="monotone"
                dataKey="realista"
                stroke="var(--color-realista)"
                strokeWidth={2}
                dot={{ fill: "var(--color-realista)" }}
              />
              <Line
                type="monotone"
                dataKey="pesimista"
                stroke="var(--color-pesimista)"
                strokeWidth={2}
                dot={{ fill: "var(--color-pesimista)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
