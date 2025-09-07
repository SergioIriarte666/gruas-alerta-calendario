import React, { useMemo } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Package,
  FileText,
  Timer,
  ShoppingCart,
  Quote
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ServicesPipelineMetricsProps {
  services: Service[];
}

export const ServicesPipelineMetrics: React.FC<ServicesPipelineMetricsProps> = ({
  services
}) => {
  const metrics = useMemo(() => {
    // Calcular métricas por estado
    const statusCounts = services.reduce((acc, service) => {
      acc[service.status] = (acc[service.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calcular valores totales por estado
    const statusValues = services.reduce((acc, service) => {
      acc[service.status] = (acc[service.status] || 0) + service.value;
      return acc;
    }, {} as Record<string, number>);

    // Cotizados
    const quoted = statusCounts['quoted'] || 0;
    const quotedValue = statusValues['quoted'] || 0;

    // Esperando O.C.
    const pendingOC = statusCounts['purchase_order_pending'] || 0;
    const pendingOCValue = statusValues['purchase_order_pending'] || 0;

    // Con O.C.
    const withOC = statusCounts['with_purchase_order'] || 0;
    const withOCValue = statusValues['with_purchase_order'] || 0;

    // Programados
    const pending = statusCounts['pending'] || 0;
    const pendingValue = statusValues['pending'] || 0;

    // En progreso
    const inProgress = statusCounts['in_progress'] || 0;
    const inProgressValue = statusValues['in_progress'] || 0;

    // Completados
    const completed = statusCounts['completed'] || 0;
    const completedValue = statusValues['completed'] || 0;

    // Facturados
    const invoiced = statusCounts['invoiced'] || 0;
    const invoicedValue = statusValues['invoiced'] || 0;

    // Tiempo promedio de procesamiento (días desde serviceDate)
    const avgProcessingTime = services.length > 0 ? Math.round(
      services.reduce((sum, service) => {
        const daysSince = Math.floor(
          (new Date().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + daysSince;
      }, 0) / services.length
    ) : 0;

    // Servicios con urgencia (más de 7 días)
    const urgentServices = services.filter(service => {
      if (service.status === 'invoiced' || service.status === 'completed') return false;
      const daysSince = Math.floor(
        (new Date().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince > 7;
    }).length;

    // Total en pipeline (excluyendo facturados)
    const totalInPipeline = quoted + pendingOC + withOC + pending + inProgress + completed;
    const totalPipelineValue = quotedValue + pendingOCValue + withOCValue + pendingValue + inProgressValue + completedValue;

    return {
      total: services.length,
      totalValue: services.reduce((sum, service) => sum + service.value, 0),
      quoted,
      quotedValue,
      pendingOC,
      pendingOCValue,
      withOC,
      withOCValue,
      pending,
      pendingValue,
      inProgress,
      inProgressValue,
      completed,
      completedValue,
      invoiced,
      invoicedValue,
      totalInPipeline,
      totalPipelineValue,
      avgProcessingTime,
      urgentServices
    };
  }, [services]);

  const metricCards = [
    {
      title: 'Cotizados',
      value: metrics.quoted,
      subtitle: `$${metrics.quotedValue.toLocaleString()}`,
      icon: <Quote className="w-5 h-5" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      title: 'Esperando O.C.',
      value: metrics.pendingOC,
      subtitle: `$${metrics.pendingOCValue.toLocaleString()}`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      urgent: metrics.pendingOC > 0
    },
    {
      title: 'Con O.C.',
      value: metrics.withOC,
      subtitle: `$${metrics.withOCValue.toLocaleString()}`,
      icon: <ShoppingCart className="w-5 h-5" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 border-green-500/20'
    },
    {
      title: 'En Pipeline',
      value: metrics.totalInPipeline,
      subtitle: `$${metrics.totalPipelineValue.toLocaleString()}`,
      icon: <Package className="w-5 h-5" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/20'
    },
    {
      title: 'Facturados',
      value: metrics.invoiced,
      subtitle: `$${metrics.invoicedValue.toLocaleString()}`,
      icon: <FileText className="w-5 h-5" />,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10 border-gray-500/20'
    },
    {
      title: 'Servicios Urgentes',
      value: metrics.urgentServices,
      subtitle: '+7 días',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/20',
      urgent: metrics.urgentServices > 0
    }
  ];

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <Card className="bg-white border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Resumen del Pipeline de Servicios
            </CardTitle>
            <Badge variant="outline" className="text-primary border-primary/30">
              Total: {metrics.total}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{metrics.total}</div>
              <div className="text-gray-600">Total Servicios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ${metrics.totalValue.toLocaleString()}
              </div>
              <div className="text-gray-600">Valor Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{metrics.totalInPipeline}</div>
              <div className="text-gray-600">En Proceso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.avgProcessingTime}d</div>
              <div className="text-gray-600">Tiempo Prom.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((metric, index) => (
          <Card 
            key={index} 
            className={`bg-white border ${metric.bgColor} ${metric.urgent ? 'animate-pulse' : ''}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={metric.color}>
                  {metric.icon}
                </div>
                {metric.urgent && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                    Urgente
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <div className={`text-xl font-bold ${metric.color}`}>
                  {metric.value}
                </div>
                <div className="text-xs text-gray-700 font-medium">
                  {metric.title}
                </div>
                <div className="text-xs text-gray-500">
                  {metric.subtitle}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};