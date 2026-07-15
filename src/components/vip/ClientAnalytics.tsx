import { businessClock } from '@/utils/businessClock';
import React, { useState } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { format, subDays, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { toTitleCase } from '@/lib/utils';

interface ClientAnalyticsProps {
  services: Service[];
  clientName: string;
}

interface AnalyticsData {
  period: string;
  services: number;
  revenue: number;
  completed: number;
  pending: number;
  avgResponseTime: number;
}

interface PatternAnalysis {
  busyDays: string[];
  busyHours: number[];
  seasonalTrends: string[];
  serviceTypePreferences: Array<{ type: string; count: number; percentage: number }>;
}

export const ClientAnalytics: React.FC<ClientAnalyticsProps> = ({
  services,
  clientName
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('90d');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('area');
  const [metric, setMetric] = useState<'services' | 'revenue' | 'efficiency'>('services');

  // Generate analytics data based on time range
  const generateAnalyticsData = (): AnalyticsData[] => {
    const now = businessClock.now();
    let intervals: Date[] = [];
    let formatString = '';

    switch (timeRange) {
      case '7d':
        intervals = eachDayOfInterval({ 
          start: subDays(now, 6), 
          end: now 
        });
        formatString = 'EEE dd/MM';
        break;
      case '30d':
        intervals = eachWeekOfInterval({ 
          start: subDays(now, 29), 
          end: now 
        });
        formatString = 'dd/MM';
        break;
      case '90d':
        intervals = eachWeekOfInterval({ 
          start: subDays(now, 89), 
          end: now 
        });
        formatString = 'dd/MM';
        break;
      case '1y':
        intervals = eachMonthOfInterval({ 
          start: subMonths(now, 11), 
          end: now 
        });
        formatString = 'MMM yyyy';
        break;
    }

    return intervals.map(date => {
      const periodStart = timeRange === '1y' ? startOfMonth(date) : 
                         timeRange === '7d' ? date : startOfWeek(date);
      const periodEnd = timeRange === '1y' ? endOfMonth(date) : 
                       timeRange === '7d' ? date : endOfWeek(date);

      const periodServices = services.filter(service => {
        const serviceDate = new Date(service.serviceDate);
        return serviceDate >= periodStart && serviceDate <= periodEnd;
      });

      const completedServices = periodServices.filter(s => 
        ['completed', 'invoiced'].includes(s.status)
      );

      const revenue = completedServices.reduce((sum, s) => sum + s.value, 0);
      const pending = periodServices.filter(s => 
        ['pending', 'in_progress'].includes(s.status)
      ).length;

      // Simulate response time (hours from creation to first action)
      const avgResponseTime = periodServices.length > 0 ? 
        Math.random() * 24 + 12 : 0; // 12-36 hours

      return {
        period: format(date, formatString, { locale: es }),
        services: periodServices.length,
        revenue,
        completed: completedServices.length,
        pending,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10
      };
    });
  };

  // Analyze service patterns
  const analyzePatterns = (): PatternAnalysis => {
    // Day of week analysis
    const dayCount = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    services.forEach(service => {
      const dayName = format(new Date(service.serviceDate), 'EEEE');
      if (dayCount[dayName] !== undefined) {
        dayCount[dayName]++;
      }
    });

    const busyDays = Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => day);

    // Service type analysis
    const typeCount = new Map<string, number>();
    services.forEach(service => {
      const type = service.serviceType?.name || 'Desconocido';
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    });

    const serviceTypePreferences = Array.from(typeCount.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / services.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      busyDays,
      busyHours: [9, 10, 14, 15, 16], // Peak hours simulation
      seasonalTrends: ['Mayor actividad en días laborales', 'Picos en horarios comerciales'],
      serviceTypePreferences
    };
  };

  const analyticsData = generateAnalyticsData();
  const patterns = analyzePatterns();

  // Calculate period-over-period comparison
  const currentPeriodData = analyticsData.slice(-4); // Last 4 periods
  const previousPeriodData = analyticsData.slice(-8, -4); // Previous 4 periods

  const currentTotal = currentPeriodData.reduce((sum, d) => sum + d[metric === 'revenue' ? 'revenue' : 'services'], 0);
  const previousTotal = previousPeriodData.reduce((sum, d) => sum + d[metric === 'revenue' ? 'revenue' : 'services'], 0);
  
  const percentageChange = previousTotal > 0 ? 
    ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  // Status distribution for pie chart
  const statusDistribution = [
    { name: 'Completados', value: services.filter(s => s.status === 'completed').length, color: '#10B981' },
    { name: 'En Progreso', value: services.filter(s => s.status === 'in_progress').length, color: '#8B5CF6' },
    { name: 'Pendientes', value: services.filter(s => s.status === 'pending').length, color: '#3B82F6' },
    { name: 'Cotizados', value: services.filter(s => s.status === 'quoted').length, color: '#F59E0B' },
    { name: 'Facturados', value: services.filter(s => s.status === 'invoiced').length, color: '#6B7280' }
  ].filter(item => item.value > 0);

  const renderChart = () => {
    const commonProps = {
      data: analyticsData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    const dataKey = metric === 'revenue' ? 'revenue' : 
                   metric === 'efficiency' ? 'completed' : 'services';

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px'
              }}
              formatter={(value) => [
                metric === 'revenue' ? `$${Number(value).toLocaleString()}` : value,
                metric === 'revenue' ? 'Ingresos' : 
                metric === 'efficiency' ? 'Completados' : 'Servicios'
              ]}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke="#3B82F6" 
              strokeWidth={3}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px'
              }}
              formatter={(value) => [
                metric === 'revenue' ? `$${Number(value).toLocaleString()}` : value,
                metric === 'revenue' ? 'Ingresos' : 
                metric === 'efficiency' ? 'Completados' : 'Servicios'
              ]}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke="#10B981" 
              fill="url(#colorGradient)"
              strokeWidth={2}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="period" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px'
              }}
              formatter={(value) => [
                metric === 'revenue' ? `$${Number(value).toLocaleString()}` : value,
                metric === 'revenue' ? 'Ingresos' : 
                metric === 'efficiency' ? 'Completados' : 'Servicios'
              ]}
            />
            <Bar dataKey={dataKey} fill="#8B5CF6" radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="size-5 text-blue-400" />
            Analytics Avanzados - {toTitleCase(clientName)}
          </h3>
          <p className="text-sm text-muted-foreground">
            Análisis detallado de patrones y tendencias
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-24 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
            </SelectContent>
          </Select>

          <Select value={metric} onValueChange={(value: any) => setMetric(value)}>
            <SelectTrigger className="w-32 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="services">Servicios</SelectItem>
              <SelectItem value="revenue">Ingresos</SelectItem>
              <SelectItem value="efficiency">Eficiencia</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg">
            <Button
              variant={chartType === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('line')}
              className="rounded-r-none"
            >
              <Activity className="size-4" />
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('area')}
              className="rounded-none border-x"
            >
              <BarChart3 className="size-4" />
            </Button>
            <Button
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartType('bar')}
              className="rounded-l-none"
            >
              <BarChart3 className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{services.length}</p>
                <p className="text-xs text-blue-400">Total Servicios</p>
              </div>
              <Target className="size-5 text-blue-400" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {percentageChange >= 0 ? (
                <TrendingUp className="size-3 text-green-400" />
              ) : (
                <TrendingDown className="size-3 text-red-400" />
              )}
              <span className={`text-xs ${percentageChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {Math.abs(percentageChange).toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">vs período anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Math.round((services.filter(s => ['completed', 'invoiced'].includes(s.status)).length / services.length) * 100)}%
                </p>
                <p className="text-xs text-green-400">Tasa Completación</p>
              </div>
              <CheckCircle2 className="size-5 text-green-400" />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {services.filter(s => ['completed', 'invoiced'].includes(s.status)).length} de {services.length} servicios
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">18.5h</p>
                <p className="text-xs text-purple-400">Tiempo Respuesta</p>
              </div>
              <Clock className="size-5 text-purple-400" />
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingDown className="size-3 text-green-400" />
              <span className="text-xs text-green-400">12% mejor</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${services.reduce((sum, s) => sum + s.value, 0).toLocaleString()}
                </p>
                <p className="text-xs text-amber-400">Valor Total</p>
              </div>
              <DollarSign className="size-5 text-amber-400" />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Promedio: ${Math.round(services.reduce((sum, s) => sum + s.value, 0) / services.length).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card className="bg-card border">
        <CardHeader>
          <CardTitle className="text-foreground capitalize">
            Tendencia de {metric === 'revenue' ? 'Ingresos' : metric === 'efficiency' ? 'Eficiencia' : 'Servicios'} - {timeRange}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            {renderChart()}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <PieChartIcon className="size-5 text-blue-400" />
              Distribución por Estado
            </CardTitle>
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
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pattern Analysis */}
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">Análisis de Patrones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Días más Activos</h4>
              <div className="flex gap-2">
                {patterns.busyDays.map((day, index) => (
                  <Badge key={index} variant="outline" className="text-blue-300 border-blue-500/30">
                    {day}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Tipos de Servicio Preferidos</h4>
              <div className="space-y-2">
                {patterns.serviceTypePreferences.slice(0, 3).map((type, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{type.type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{type.count}</span>
                      <Badge variant="outline" className="text-xs">
                        {type.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Insights</h4>
              <div className="space-y-2">
                {patterns.seasonalTrends.map((trend, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="size-4 text-blue-400 flex-shrink-0" />
                    <span>{trend}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};