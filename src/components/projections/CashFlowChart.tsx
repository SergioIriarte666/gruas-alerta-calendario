import { businessClock } from '@/utils/businessClock';
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { format, isBefore, startOfDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface CashFlowChartProps {
  invoices: ProjectedInvoice[];
  dateRange: number;
}

export const CashFlowChart = ({ invoices, dateRange }: CashFlowChartProps) => {
  const [zoomDays, setZoomDays] = useState(dateRange);
  useEffect(() => {
    setZoomDays(dateRange);
  }, [dateRange]);
  const today = startOfDay(businessClock.now());

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

  // Crear dataset combinado con acumulado
  const sortedData = Array.from(allDates)
    .map(date => ({
      fecha: format(new Date(date), 'dd MMM', { locale: es }),
      vencidas: overdueByDate[date] ? Math.round(overdueByDate[date]) : null,
      proximas: upcomingByDate[date] ? Math.round(upcomingByDate[date]) : null,
      fullDate: date
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  // Calcular acumulado proyectado
  let accumulated = 0;
  const chartData = sortedData.map(item => {
    const dayAmount = (item.vencidas || 0) + (item.proximas || 0);
    accumulated += dayAmount;
    return {
      ...item,
      acumulado: accumulated,
    };
  });

  // Filtrar por zoom
  const cutoffDate = addDays(today, -60); // Mostrar últimos 60 días de vencidas
  const futureDate = addDays(today, zoomDays);
  const filteredData = chartData.filter(item => {
    const itemDate = new Date(item.fullDate);
    return itemDate >= cutoffDate && itemDate <= futureDate;
  });

  const chartConfig = {
    vencidas: {
      label: "Facturas Vencidas",
      color: "hsl(var(--destructive))",
    },
    proximas: {
      label: "Facturas Próximas",
      color: "hsl(var(--chart-1))",
    },
    acumulado: {
      label: "Acumulado Proyectado",
      color: "hsl(var(--primary))",
    },
  };

  const zoomOptions = [
    { days: 7, label: '7d' },
    { days: 30, label: '30d' },
    { days: 60, label: '60d' },
    { days: 90, label: '90d' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle>Ingresos Proyectados por Fecha de Vencimiento</CardTitle>
            <CardDescription>
              Facturas vencidas (rojo) vs próximas (azul) • Línea acumulada (primario) • Línea vertical = Hoy
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {zoomOptions.map(option => (
              <Button
                key={option.days}
                variant={zoomDays === option.days ? "default" : "outline"}
                size="sm"
                onClick={() => setZoomDays(option.days)}
                className="h-8 px-3"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-80 w-full sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="fecha" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tick={{ fill: 'hsl(var(--primary))' }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value, name) => [
                    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(Number(value)),
                    name
                  ]}
                />} 
              />
              <ReferenceLine
                yAxisId="left"
                x={format(today, 'dd MMM', { locale: es })}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{ value: 'Hoy', position: 'top', fill: 'hsl(var(--muted-foreground))' }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="vencidas"
                stroke="var(--color-vencidas)"
                strokeWidth={2}
                dot={{ fill: "var(--color-vencidas)", r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="proximas"
                stroke="var(--color-proximas)"
                strokeWidth={2}
                dot={{ fill: "var(--color-proximas)", r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acumulado"
                stroke="var(--color-acumulado)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
