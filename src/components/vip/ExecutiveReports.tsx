import { parseDateValue } from '@/utils/calendarDate';
import { businessClock } from '@/utils/businessClock';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Target,
  Award,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Service } from '@/types';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toTitleCase } from '@/lib/utils';
import { createLogger } from "@/lib/logger";
import {
  addReportFooter,
  addReportHeader,
  REPORT_PDF_COLORS,
} from '@/utils/pdf/reportPdfTheme';


const logger = createLogger("ExecutiveReports");
interface ExecutiveReportsProps {
  services: Service[];
  clientId: string;
  clientName: string;
}

interface ServiceMetrics {
  totalServices: number;
  totalRevenue: number;
  averageServiceTime: number;
  completionRate: number;
  averageResponseTime: number;
  customerSatisfaction: number;
}

interface TrendData {
  month: string;
  services: number;
  revenue: number;
  completionRate: number;
}

export const ExecutiveReports: React.FC<ExecutiveReportsProps> = ({
  services,
  clientId,
  clientName
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'30' | '90' | '180' | '365'>('90');
  const [reportType, setReportType] = useState<'summary' | 'performance' | 'trends' | 'detailed'>('summary');

  // Calculate metrics
  const calculateMetrics = (): ServiceMetrics => {
    const now = businessClock.todayDate();
    const periodDays = parseInt(selectedPeriod);
    const periodStart = subDays(now, periodDays);

    const periodServices = services.filter(s =>
      parseDateValue(s.serviceDate) >= periodStart
    );

    const completedServices = periodServices.filter(s =>
      ['completed', 'invoiced'].includes(s.status)
    );

    const totalRevenue = completedServices.reduce(
      (sum, service) => sum + getDisplayServiceValue(service, clientId),
      0,
    );

    // Calculate average service time (from pending to completed)
    const avgServiceTime = completedServices.length > 0
      ? completedServices.reduce((sum, s) => {
          // Simulate service duration based on status progression
          return sum + (s.status === 'completed' ? 2.5 : 4); // hours
        }, 0) / completedServices.length
      : 0;

    // Calculate completion rate
    const completionRate = periodServices.length > 0
      ? (completedServices.length / periodServices.length) * 100
      : 0;

    // Simulate response time (hours from quoted to purchase_order_pending)
    const avgResponseTime = periodServices.length > 0 ? 18 : 0; // hours

    return {
      totalServices: periodServices.length,
      totalRevenue,
      averageServiceTime: avgServiceTime,
      completionRate,
      averageResponseTime: avgResponseTime,
      customerSatisfaction: 4.7 // Simulated
    };
  };

  // Generate trend data
  const generateTrendData = (): TrendData[] => {
    const months = [];
    const now = businessClock.todayDate();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const monthServices = services.filter(s => {
        const serviceDate = parseDateValue(s.serviceDate);
        return serviceDate >= monthStart && serviceDate <= monthEnd;
      });

      const completedServices = monthServices.filter(s =>
        ['completed', 'invoiced'].includes(s.status)
      );

      const monthRevenue = completedServices.reduce(
        (sum, service) => sum + getDisplayServiceValue(service, clientId),
        0,
      );
      const completionRate = monthServices.length > 0
        ? (completedServices.length / monthServices.length) * 100
        : 0;

      months.push({
        month: format(monthDate, 'MMM yyyy', { locale: es }),
        services: monthServices.length,
        revenue: monthRevenue,
        completionRate
      });
    }

    return months;
  };

  const metrics = calculateMetrics();
  const trendData = generateTrendData();

  const statusDistribution = [
    { name: 'Completados', value: services.filter(s => s.status === 'completed').length, color: 'hsl(var(--chart-1))' },
    { name: 'En Progreso', value: services.filter(s => s.status === 'in_progress').length, color: 'hsl(var(--chart-5))' },
    { name: 'Pendientes', value: services.filter(s => s.status === 'pending').length, color: 'hsl(var(--chart-4))' },
    { name: 'Esperando O.C.', value: services.filter(s => s.status === 'purchase_order_pending').length, color: 'hsl(var(--chart-2))' },
    { name: 'Cotizados', value: services.filter(s => s.status === 'quoted').length, color: 'hsl(var(--text-muted))' }
  ];

  const performanceIndicators = [
    {
      title: 'Tiempo Respuesta Promedio',
      value: `${metrics.averageResponseTime}h`,
      trend: 'down',
      improvement: '15%',
      status: 'good'
    },
    {
      title: 'Tasa de Conversión O.C.',
      value: '87%',
      trend: 'up',
      improvement: '5%',
      status: 'excellent'
    },
    {
      title: 'Satisfacción Cliente',
      value: metrics.customerSatisfaction.toFixed(1),
      trend: 'up',
      improvement: '0.2',
      status: 'excellent'
    },
    {
      title: 'Servicios Sin Facturar',
      value: services.filter(s => s.status === 'completed').length.toString(),
      trend: 'up',
      improvement: '2',
      status: 'warning'
    }
  ];

  const exportReport = async (exportFormat: 'pdf' | 'excel') => {
    if (!services || services.length === 0) {
      toast.error('No hay servicios para exportar');
      return;
    }

    try {
      toast.loading(`Generando reporte ejecutivo en formato ${exportFormat.toUpperCase()}...`);

      const metrics = calculateMetrics();
      const currentDate = businessClock.today();
      const fileName = `reporte-ejecutivo-${clientName}-${currentDate}`;

      if (exportFormat === 'pdf') {
        await exportToPDF(metrics, fileName);
      } else {
        await exportToExcel(metrics, fileName);
      }

      toast.success(`Reporte ejecutivo exportado exitosamente como ${fileName}.${exportFormat}`);
    } catch (error) {
      logger.error('Error exportando reporte:', error);
      toast.error('Error al exportar el reporte. Intente nuevamente.');
    }
  };

  const exportToPDF = async (metrics: ServiceMetrics, fileName: string) => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    let yPosition = await addReportHeader(doc, { name: 'Grúas 5 Norte' });

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...REPORT_PDF_COLORS.ink);
    doc.text('Reporte ejecutivo', 14, yPosition);
    yPosition += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...REPORT_PDF_COLORS.muted);
    doc.text(`Cliente: ${toTitleCase(clientName)}`, 14, yPosition);
    yPosition += 12;

    // Métricas principales
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('MÉTRICAS PRINCIPALES', 14, yPosition);
    yPosition += 10;

    const metricsData = [
      ['Total de Servicios', metrics.totalServices.toString()],
      ['Ingresos Totales', `$${metrics.totalRevenue.toLocaleString('es-CL')}`],
      ['Tiempo Promedio de Servicio', `${metrics.averageServiceTime} días`],
      ['Tasa de Completación', `${metrics.completionRate}%`],
      ['Satisfacción del Cliente', `${metrics.customerSatisfaction.toFixed(1)}/5.0`]
    ];

    autoTable(doc, {
      body: metricsData,
      startY: yPosition,
      theme: 'grid',
      headStyles: { fillColor: REPORT_PDF_COLORS.primary },
      styles: { fontSize: 10 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Servicios por estado
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('DISTRIBUCIÓN POR ESTADO', 14, yPosition);
    yPosition += 10;

    const statusData = [
      ['Estado', 'Cantidad', 'Porcentaje'],
      ['Cotizados', services.filter(s => s.status === 'quoted').length.toString(),
       `${((services.filter(s => s.status === 'quoted').length / services.length) * 100).toFixed(1)}%`],
      ['Esperando O.C.', services.filter(s => s.status === 'purchase_order_pending').length.toString(),
       `${((services.filter(s => s.status === 'purchase_order_pending').length / services.length) * 100).toFixed(1)}%`],
      ['Programados', services.filter(s => s.status === 'pending').length.toString(),
       `${((services.filter(s => s.status === 'pending').length / services.length) * 100).toFixed(1)}%`],
      ['En Progreso', services.filter(s => s.status === 'in_progress').length.toString(),
       `${((services.filter(s => s.status === 'in_progress').length / services.length) * 100).toFixed(1)}%`],
      ['Completados', services.filter(s => s.status === 'completed').length.toString(),
       `${((services.filter(s => s.status === 'completed').length / services.length) * 100).toFixed(1)}%`],
      ['Facturados', services.filter(s => s.status === 'invoiced').length.toString(),
       `${((services.filter(s => s.status === 'invoiced').length / services.length) * 100).toFixed(1)}%`]
    ];

    autoTable(doc, {
      head: [statusData[0]],
      body: statusData.slice(1),
      startY: yPosition,
      theme: 'grid',
      headStyles: { fillColor: REPORT_PDF_COLORS.primary },
      styles: { fontSize: 9 }
    });

    addReportFooter(doc);
    doc.save(`${fileName}.pdf`);
  };

  const exportToExcel = async (metrics: ServiceMetrics, fileName: string) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen Ejecutivo
    const summaryData = [
      ['REPORTE EJECUTIVO - ' + toTitleCase(clientName)],
      [''],
      ['Fecha de Generación:', businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm')],
      [''],
      ['MÉTRICAS PRINCIPALES'],
      ['Total de Servicios', metrics.totalServices],
      ['Ingresos Totales', metrics.totalRevenue, `$${metrics.totalRevenue.toLocaleString('es-CL')}`],
      ['Tiempo Promedio de Servicio (días)', metrics.averageServiceTime],
      ['Tasa de Completación (%)', metrics.completionRate],
      ['Satisfacción del Cliente', metrics.customerSatisfaction.toFixed(1)],
      [''],
      ['DISTRIBUCIÓN POR ESTADO'],
      ['Estado', 'Cantidad', 'Porcentaje'],
      ['Cotizados', services.filter(s => s.status === 'quoted').length,
       `${((services.filter(s => s.status === 'quoted').length / services.length) * 100).toFixed(1)}%`],
      ['Esperando O.C.', services.filter(s => s.status === 'purchase_order_pending').length,
       `${((services.filter(s => s.status === 'purchase_order_pending').length / services.length) * 100).toFixed(1)}%`],
      ['Programados', services.filter(s => s.status === 'pending').length,
       `${((services.filter(s => s.status === 'pending').length / services.length) * 100).toFixed(1)}%`],
      ['En Progreso', services.filter(s => s.status === 'in_progress').length,
       `${((services.filter(s => s.status === 'in_progress').length / services.length) * 100).toFixed(1)}%`],
      ['Completados', services.filter(s => s.status === 'completed').length,
       `${((services.filter(s => s.status === 'completed').length / services.length) * 100).toFixed(1)}%`],
      ['Facturados', services.filter(s => s.status === 'invoiced').length,
       `${((services.filter(s => s.status === 'invoiced').length / services.length) * 100).toFixed(1)}%`]
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen Ejecutivo');

    // Hoja 2: Detalle de Servicios
    const servicesDetailData = services.map(service => ({
      'Folio': service.folio,
      'Fecha': businessClock.format(service.serviceDate, 'dd/MM/yyyy'),
      'Estado': service.status,
      'Tipo de Servicio': service.serviceType.name,
      'Valor': getDisplayServiceValue(service, clientId),
      'Cliente': toTitleCase(service.client.name),
      'Operador': service.operator?.name || 'Sin asignar',
      'Grúa': service.crane?.licensePlate || 'Sin asignar',
      'Origen': service.origin,
      'Destino': service.destination,
      'Observaciones': service.observations || ''
    }));

    const ws2 = XLSX.utils.json_to_sheet(servicesDetailData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle Servicios');

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-success-text';
      case 'good': return 'text-info-text';
      case 'warning': return 'text-warning-text';
      case 'critical': return 'text-danger-text';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Reportes Ejecutivos - {toTitleCase(clientName)}
          </h3>
          <p className="text-sm text-muted-foreground">
            Análisis avanzado y métricas de rendimiento
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
              <SelectItem value="180">6 meses</SelectItem>
              <SelectItem value="365">1 año</SelectItem>
            </SelectContent>
          </Select>

          <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
            <SelectTrigger className="w-40 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Resumen</SelectItem>
              <SelectItem value="performance">Rendimiento</SelectItem>
              <SelectItem value="trends">Tendencias</SelectItem>
              <SelectItem value="detailed">Detallado</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => exportReport('pdf')}
            className="border-primary/30 text-primary"
          >
            <Download className="size-4 mr-2" />
            PDF
          </Button>

          <Button
            variant="outline"
            onClick={() => exportReport('excel')}
            className="border-success/30 text-success-text"
          >
            <Download className="size-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info/20 rounded-lg">
                <Target className="size-5 text-info-text" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{metrics.totalServices}</p>
                <p className="text-xs text-info-text">Servicios Total</p>
                <p className="text-xs text-muted-foreground">{selectedPeriod} días</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <DollarSign className="size-5 text-success-text" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="text-xs text-success-text">Ingresos Total</p>
                <p className="text-xs text-muted-foreground">
                  Promedio: {formatCurrency(metrics.totalRevenue / Math.max(metrics.totalServices, 1))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Clock className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {metrics.averageServiceTime.toFixed(1)}h
                </p>
                <p className="text-xs text-primary">Tiempo Promedio</p>
                <p className="text-xs text-muted-foreground">Por servicio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/20 rounded-lg">
                <Award className="size-5 text-warning-text" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {metrics.completionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-warning-text">Tasa Completación</p>
                <p className="text-xs text-muted-foreground">
                  {services.filter(s => ['completed', 'invoiced'].includes(s.status)).length} de {metrics.totalServices}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <TrendingUp className="size-5 text-success-text" />
            Indicadores de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {performanceIndicators.map((indicator, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{indicator.title}</span>
                  {indicator.trend === 'up' ? (
                    <TrendingUp className="size-4 text-success-text" />
                  ) : (
                    <TrendingDown className="size-4 text-danger-text" />
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${getStatusColor(indicator.status)}`}>
                    {indicator.value}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      indicator.trend === 'up' ? 'text-success-text border-success/30' : 'text-danger-text border-danger/30'
                    }`}
                  >
                    {indicator.trend === 'up' ? '+' : '-'}{indicator.improvement}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Tendencia de Ingresos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--text-muted))" fontSize={12} />
                <YAxis stroke="hsl(var(--text-muted))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface-elevated))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(Number(value)) : value,
                    name === 'revenue' ? 'Ingresos' : 'Servicios'
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--surface-elevated))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend
                  wrapperStyle={{ color: 'hsl(var(--text))', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Performance Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground">Rendimiento Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--text-muted))" />
              <YAxis stroke="hsl(var(--text-muted))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--surface-elevated))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [
                  name === 'completionRate' ? `${value}%` : value,
                  name === 'services' ? 'Servicios' :
                  name === 'completionRate' ? 'Tasa Completación' : name
                ]}
              />
              <Legend wrapperStyle={{ color: 'hsl(var(--text))' }} />
              <Bar dataKey="services" fill="hsl(var(--chart-4))" name="Servicios" />
              <Bar dataKey="completionRate" fill="hsl(var(--chart-1))" name="Tasa Completación %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Report Summary */}
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Resumen Ejecutivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Destacados del Período</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Award className="size-4 text-success-text" />
                  Tasa de completación superior al 85%
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-info-text" />
                  Tiempo de respuesta mejorado en 15%
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="size-4 text-success-text" />
                  Ingresos estables con tendencia positiva
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Áreas de Mejora</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-warning-text" />
                  Reducir servicios completados sin facturar
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-warning-text" />
                  Optimizar proceso de órdenes de compra
                </li>
                <li className="flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  Implementar seguimiento automatizado
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Reporte generado el {businessClock.format(businessClock.now(), 'dd/MM/yyyy HH:mm')} •
              Datos de los últimos {selectedPeriod} días •
              {services.length} servicios analizados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
