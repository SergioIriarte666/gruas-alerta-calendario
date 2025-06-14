import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Truck, FileText, DollarSign, Clock } from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ReportsHeader } from '@/components/reports/ReportsHeader';
import { DateRangeFilter } from '@/components/reports/DateRangeFilter';
import { ReportMetricCard } from '@/components/reports/ReportMetricCard';

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const { metrics, loading } = useReports(dateRange);

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const exportReport = () => {
    if (!metrics) return;
    
    const reportData = {
      periodo: dateRange,
      metricas: metrics,
      fechaGeneracion: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `reporte-${dateRange.from}-${dateRange.to}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const servicesByMonthConfig = { services: { label: 'Servicios', color: '#10b981' } } satisfies ChartConfig;
  const revenueByMonthConfig = { revenue: { label: 'Ingresos', color: '#3b82f6' } } satisfies ChartConfig;
  const craneUtilizationConfig = { utilization: { label: 'Utilización', color: '#f59e0b' } } satisfies ChartConfig;
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  const servicesByStatusConfig = useMemo(() => {
    if (!metrics) return {};
    return metrics.servicesByStatus.reduce((acc, item, index) => {
        acc[item.status] = {
            label: item.status,
            color: COLORS[index % COLORS.length]
        };
        return acc;
    }, {} as ChartConfig);
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Generando reportes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsHeader onExport={exportReport} />
      <DateRangeFilter dateRange={dateRange} onDateChange={handleDateChange} onUpdate={() => {}} />

      {metrics && (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ReportMetricCard
              icon={Truck}
              title="Total Servicios"
              value={metrics.totalServices}
              description="Servicios realizados en el período"
            />
            <ReportMetricCard
              icon={DollarSign}
              title="Ingresos Totales"
              value={`$${metrics.totalRevenue.toLocaleString()}`}
              description="Ingresos generados en el período"
              valueClassName="text-green-400"
            />
            <ReportMetricCard
              icon={TrendingUp}
              title="Valor Promedio"
              value={`$${metrics.averageServiceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              description="Promedio por servicio"
              valueClassName="text-blue-400"
            />
            <ReportMetricCard
              icon={Clock}
              title="Facturas Pendientes"
              value={metrics.pendingInvoices}
              description={`${metrics.overdueInvoices} vencidas`}
              valueClassName="text-yellow-400"
            />
          </div>

          {/* Gráficos principales */}
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

          {/* Gráficos de distribución */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Distribución por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={servicesByStatusConfig} className="w-full h-[300px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                    <Pie
                      data={metrics.servicesByStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ status, percentage }) => `${status}: ${percentage.toFixed(1)}%`}
                    >
                      {metrics.servicesByStatus.map((entry) => (
                        <Cell key={`cell-${entry.status}`} fill={`var(--color-${entry.status})`} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Utilización de Grúas</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={craneUtilizationConfig} className="w-full h-[300px]">
                   <BarChart data={metrics.craneUtilization} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9CA3AF" />
                    <YAxis 
                      dataKey="craneName" 
                      type="category" 
                      stroke="#9CA3AF" 
                      width={120}
                      fontSize={12}
                    />
                    <ChartTooltip 
                      cursor={false} 
                      content={<ChartTooltipContent indicator="line" formatter={(value) => `${Number(value).toFixed(1)}%`} />} 
                    />
                    <Bar dataKey="utilization" fill="var(--color-utilization)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tablas de detalles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top clientes */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Top Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.topClients.map((client, index) => (
                    <div key={client.clientId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{client.clientName}</p>
                        <p className="text-sm text-gray-400">{client.services} servicios</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-400">${client.revenue.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">#{index + 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recursos activos */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Recursos Activos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-blue-400 mr-3" />
                      <span className="text-white">Clientes Activos</span>
                    </div>
                    <span className="font-medium text-blue-400">{metrics.activeClients}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center">
                      <Truck className="w-5 h-5 text-green-400 mr-3" />
                      <span className="text-white">Grúas Activas</span>
                    </div>
                    <span className="font-medium text-green-400">{metrics.activeCranes}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-yellow-400 mr-3" />
                      <span className="text-white">Operadores Activos</span>
                    </div>
                    <span className="font-medium text-yellow-400">{metrics.activeOperators}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
