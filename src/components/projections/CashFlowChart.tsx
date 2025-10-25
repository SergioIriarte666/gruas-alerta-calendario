import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CashFlowChartProps {
  invoices: ProjectedInvoice[];
  dateRange: number;
}

export const CashFlowChart = ({ invoices, dateRange }: CashFlowChartProps) => {
  // Agrupar facturas por fecha de vencimiento
  const invoicesByDate = invoices.reduce((acc, invoice) => {
    const dateKey = format(new Date(invoice.due_date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = 0;
    }
    acc[dateKey] += invoice.remaining_amount;
    return acc;
  }, {} as Record<string, number>);

  // Convertir a array y ordenar
  const chartData = Object.entries(invoicesByDate)
    .map(([date, amount]) => ({
      fecha: format(new Date(date), 'dd MMM', { locale: es }),
      monto: Math.round(amount),
      fullDate: date
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  const chartConfig = {
    monto: {
      label: "Ingresos Proyectados",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos Proyectados por Fecha de Vencimiento</CardTitle>
        <CardDescription>
          Montos pendientes de cobro según fecha de vencimiento de facturas
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
              <Line
                type="monotone"
                dataKey="monto"
                stroke="var(--color-monto)"
                strokeWidth={2}
                dot={{ fill: "var(--color-monto)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
