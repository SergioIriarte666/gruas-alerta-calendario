import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, FileText, DollarSign, Users } from 'lucide-react';

interface HistoricalSalesStatsProps {
  invoices: Invoice[];
}

export const HistoricalSalesStats = ({ invoices }: HistoricalSalesStatsProps) => {
  const stats = useMemo(() => {
    const totalSales = invoices.reduce((acc, inv) => acc + inv.total, 0);
    const totalInvoices = invoices.length;
    const averageTicket = totalInvoices > 0 ? totalSales / totalInvoices : 0;
    
    // Calculate unique clients
    const uniqueClients = new Set(invoices.map(inv => inv.client?.id || inv.client?.name)).size;

    // Prepare chart data (Last 6 months)
    const today = new Date();
    const chartData = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(today, i);
      const monthLabel = format(date, 'MMM', { locale: es });
      const monthKey = format(date, 'yyyy-MM');
      
      const monthTotal = invoices
        .filter(inv => isSameMonth(new Date(inv.issueDate), date))
        .reduce((acc, inv) => acc + inv.total, 0);
        
      chartData.push({
        name: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        total: monthTotal,
        fullDate: monthKey
      });
    }

    return {
      totalSales,
      totalInvoices,
      averageTicket,
      uniqueClients,
      chartData
    };
  }, [invoices]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
          <p className="text-xs text-muted-foreground">
            En {stats.totalInvoices} facturas
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.averageTicket)}</div>
          <p className="text-xs text-muted-foreground">
            Promedio por factura
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
          <Users className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueClients}</div>
          <p className="text-xs text-muted-foreground">
            Clientes distintos en el periodo
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-1 md:col-span-2 lg:col-span-1">
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tendencia (Últimos 6 meses)</CardTitle>
          <FileText className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData}>
              <XAxis 
                dataKey="name" 
                stroke="#888888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Ventas
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {formatCurrency(payload[0].value as number)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="total"
                fill="currentColor"
                radius={[4, 4, 0, 0]}
                className="fill-primary"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
