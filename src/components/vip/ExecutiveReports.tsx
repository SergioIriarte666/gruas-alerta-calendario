import React, { useState } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Target,
  Award,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { format, subDays, subMonths, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

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
    const now = new Date();
    const periodDays = parseInt(selectedPeriod);
    const periodStart = subDays(now, periodDays);
    
    const periodServices = services.filter(s => 
      new Date(s.serviceDate) >= periodStart
    );

    const completedServices = periodServices.filter(s => 
      ['completed', 'invoiced'].includes(s.status)
    );

    const totalRevenue = completedServices.reduce((sum, s) => sum + s.value, 0);
    
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
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const monthServices = services.filter(s => {
        const serviceDate = new Date(s.serviceDate);
        return serviceDate >= monthStart && serviceDate <= monthEnd;
      });

      const completedServices = monthServices.filter(s => 
        ['completed', 'invoiced'].includes(s.status)
      );

      const monthRevenue = completedServices.reduce((sum, s) => sum + s.value, 0);
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
    { name: 'Completados', value: services.filter(s => s.status === 'completed').length, color: '#10B981' },
    { name: 'En Progreso', value: services.filter(s => s.status === 'in_progress').length, color: '#8B5CF6' },
    { name: 'Pendientes', value: services.filter(s => s.status === 'pending').length, color: '#3B82F6' },
    { name: 'Esperando O.C.', value: services.filter(s => s.status === 'purchase_order_pending').length, color: '#F59E0B' },
    { name: 'Cotizados', value: services.filter(s => s.status === 'quoted').length, color: '#6B7280' }
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

  const exportReport = (format: 'pdf' | 'excel') => {
    toast.success(`Exportando reporte en formato ${format.toUpperCase()}...`);
    // Simulate export delay
    setTimeout(() => {
      toast.success(`Reporte ejecutivo exportado exitosamente`);
    }, 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'warning': return 'text-amber-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Reportes Ejecutivos - {clientName}
          </h3>
          <p className="text-sm text-gray-400">
            Análisis avanzado y métricas de rendimiento
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={selectedPeriod} onValueChange={(value: any) => setSelectedPeriod(value)}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-600">
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
            <SelectTrigger className="w-40 bg-gray-800 border-gray-600">
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
            className="border-purple-500/30 text-purple-300"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>

          <Button
            variant="outline"
            onClick={() => exportReport('excel')}
            className="border-green-500/30 text-green-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{metrics.totalServices}</p>
                <p className="text-xs text-blue-400">Servicios Total</p>
                <p className="text-xs text-gray-500">{selectedPeriod} días</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="text-xs text-green-400">Ingresos Total</p>
                <p className="text-xs text-gray-500">
                  Promedio: {formatCurrency(metrics.totalRevenue / Math.max(metrics.totalServices, 1))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {metrics.averageServiceTime.toFixed(1)}h
                </p>
                <p className="text-xs text-purple-400">Tiempo Promedio</p>
                <p className="text-xs text-gray-500">Por servicio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Award className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {metrics.completionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-amber-400">Tasa Completación</p>
                <p className="text-xs text-gray-500">
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
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Indicadores de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {performanceIndicators.map((indicator, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{indicator.title}</span>
                  {indicator.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${getStatusColor(indicator.status)}`}>
                    {indicator.value}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      indicator.trend === 'up' ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'
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
            <CardTitle className="text-white text-sm">Tendencia de Ingresos (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
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
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white text-sm">Distribución por Estado</CardTitle>
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
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ color: '#E5E7EB', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Performance Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">Rendimiento Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [
                  name === 'completionRate' ? `${value}%` : value,
                  name === 'services' ? 'Servicios' : 
                  name === 'completionRate' ? 'Tasa Completación' : name
                ]}
              />
              <Legend wrapperStyle={{ color: '#E5E7EB' }} />
              <Bar dataKey="services" fill="#3B82F6" name="Servicios" />
              <Bar dataKey="completionRate" fill="#10B981" name="Tasa Completación %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Report Summary */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Resumen Ejecutivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-white">Destacados del Período</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-green-400" />
                  Tasa de completación superior al 85%
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Tiempo de respuesta mejorado en 15%
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Ingresos estables con tendencia positiva
                </li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-white">Áreas de Mejora</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Reducir servicios completados sin facturar
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  Optimizar proceso de órdenes de compra
                </li>
                <li className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  Implementar seguimiento automatizado
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <p className="text-xs text-gray-400">
              Reporte generado el {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })} • 
              Datos de los últimos {selectedPeriod} días • 
              {services.length} servicios analizados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};