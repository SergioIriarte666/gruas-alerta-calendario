import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface CashFlowChartProps {
  invoices: ProjectedInvoice[];
  dateRange: number;
}

export const CashFlowChart = ({ invoices, dateRange }: CashFlowChartProps) => {
  const today = startOfDay(new Date());

  // Separar facturas vencidas y próximas
  const overdueInvoices = invoices.filter(inv => isBefore(new Date(inv.due_date), today));
  const upcomingInvoices = invoices.filter(inv => !isBefore(new Date(inv.due_date), today));

  // Agrupar facturas vencidas por fecha
  const overdueByDate = overdueInvoices.reduce((acc, invoice) => {
    const dateKey = format(new Date(invoice.due_date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = 0;
    }
    acc[dateKey] += invoice.remaining_amount;
    return acc;
  }, {} as Record<string, number>);

  // Agrupar facturas próximas por fecha
  const upcomingByDate = upcomingInvoices.reduce((acc, invoice) => {
    const dateKey = format(new Date(invoice.due_date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = 0;
    }
    acc[dateKey] += invoice.remaining_amount;
    return acc;
  }, {} as Record<string, number>);

  // Combinar todas las fechas únicas
  const allDates = new Set([
    ...Object.keys(overdueByDate),
    ...Object.keys(upcomingByDate)
  ]);

  // Crear dataset combinado
  const chartData = Array.from(allDates)
    .map(date => ({
      fecha: format(new Date(date), 'dd MMM', { locale: es }),
      vencidas: overdueByDate[date] ? Math.round(overdueByDate[date]) : null,
      proximas: upcomingByDate[date] ? Math.round(upcomingByDate[date]) : null,
      fullDate: date
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  const chartConfig = {
    vencidas: {
      label: "Facturas Vencidas",
      color: "hsl(var(--destructive))",
    },
    proximas: {
      label: "Facturas Próximas",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos Proyectados por Fecha de Vencimiento</CardTitle>
        <CardDescription>
          Facturas vencidas (rojo) vs próximas (azul) • Línea vertical = Hoy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="fecha" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine
                x={format(today, 'dd MMM', { locale: es })}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{ value: 'Hoy', position: 'top', fill: 'hsl(var(--muted-foreground))' }}
              />
              <Line
                type="monotone"
                dataKey="vencidas"
                stroke="var(--color-vencidas)"
                strokeWidth={2}
                dot={{ fill: "var(--color-vencidas)", r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="proximas"
                stroke="var(--color-proximas)"
                strokeWidth={2}
                dot={{ fill: "var(--color-proximas)", r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
