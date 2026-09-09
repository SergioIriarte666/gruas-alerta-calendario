import React, { useMemo } from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { businessClock } from '@/utils/businessClock';
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Package,
  FileText,
  Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { getVipPipelineDisplayStatus } from '@/utils/vipPipelineStatus';

import { toTitleCase } from '@/lib/utils';

interface PipelineMetricsProps {
  services: Service[];
  clientName: string;
  clientId?: string;
}

export const PipelineMetrics: React.FC<PipelineMetricsProps> = ({
  services,
  clientName,
  clientId
}) => {
  const metrics = useMemo(() => {
    // Calcular métricas por estado
    const statusCounts = services.reduce((acc, service) => {
      const displayStatus = getVipPipelineDisplayStatus(service);
      acc[displayStatus] = (acc[displayStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calcular valores totales por estado
    const statusValues = services.reduce((acc, service) => {
      const displayStatus = getVipPipelineDisplayStatus(service);
      acc[displayStatus] = (acc[displayStatus] || 0) + getDisplayServiceValue(service, clientId);
      return acc;
    }, {} as Record<string, number>);

    // Servicios pendientes de O.C.
    const pendingOC = statusCounts['purchase_order_pending'] || 0;
    const pendingOCValue = statusValues['purchase_order_pending'] || 0;

    // Servicios en proceso (cotizados + programados + en progreso)
    const inPipeline = (statusCounts['quoted'] || 0) +
                      (statusCounts['pending'] || 0) +
                      (statusCounts['in_progress'] || 0);
    const pipelineValue = (statusValues['quoted'] || 0) +
                         (statusValues['pending'] || 0) +
                         (statusValues['in_progress'] || 0);

    // Servicios completados
    const completed = statusCounts['completed'] || 0;
    const completedValue = statusValues['completed'] || 0;

    // Servicios facturados (total y parcialmente)
    const invoiced = statusCounts['invoiced'] || 0;
    const invoicedValue = statusValues['invoiced'] || 0;
    const partiallyInvoiced = statusCounts['partially_invoiced'] || 0;
    const partiallyInvoicedValue = statusValues['partially_invoiced'] || 0;

    // Tiempo promedio de procesamiento (días desde serviceDate)
    const avgProcessingTime = services.length > 0 ? Math.round(
      services.reduce((sum, service) => {
        const daysSince = Math.floor(
          (businessClock.todayDate().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + daysSince;
      }, 0) / services.length
    ) : 0;

    // Servicios con urgencia (más de 7 días)
    const urgentServices = services.filter(service => {
      const displayStatus = getVipPipelineDisplayStatus(service);
      if (displayStatus === 'invoiced' || displayStatus === 'completed') return false;
      const daysSince = Math.floor(
        (businessClock.todayDate().getTime() - new Date(service.serviceDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince > 7;
    }).length;

    return {
      total: services.length,
      totalValue: services.reduce((sum, service) => sum + getDisplayServiceValue(service, clientId), 0),
      pendingOC,
      pendingOCValue,
      inPipeline,
      pipelineValue,
      completed,
      completedValue,
      invoiced,
      invoicedValue,
      partiallyInvoiced,
      partiallyInvoicedValue,
      avgProcessingTime,
      urgentServices
    };
  }, [clientId, services]);

  const metricCards = [
    {
      title: 'Esperando O.C.',
      value: metrics.pendingOC,
      subtitle: `$${metrics.pendingOCValue.toLocaleString()}`,
      icon: <AlertTriangle className="size-5" />,
      color: 'text-warning-text',
      bgColor: 'bg-warning/10 border-warning/20',
      urgent: metrics.pendingOC > 0
    },
    {
      title: 'En Pipeline',
      value: metrics.inPipeline,
      subtitle: `$${metrics.pipelineValue.toLocaleString()}`,
      icon: <Package className="size-5" />,
      color: 'text-info-text',
      bgColor: 'bg-info/10 border-info/20'
    },
    {
      title: 'Completados',
      value: metrics.completed,
      subtitle: `$${metrics.completedValue.toLocaleString()}`,
      icon: <CheckCircle className="size-5" />,
      color: 'text-success-text',
      bgColor: 'bg-success/10 border-success/20'
    },
    {
      title: 'Parc. Facturados',
      value: metrics.partiallyInvoiced,
      subtitle: `$${metrics.partiallyInvoicedValue.toLocaleString()}`,
      icon: <FileText className="size-5" />,
      color: 'text-warning-text',
      bgColor: 'bg-warning/10 border-warning/20',
      urgent: metrics.partiallyInvoiced > 0
    },
    {
      title: 'Facturados',
      value: metrics.invoiced,
      subtitle: `$${metrics.invoicedValue.toLocaleString()}`,
      icon: <FileText className="size-5" />,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/10 border-border/20'
    },
    {
      title: 'Tiempo Promedio',
      value: `${metrics.avgProcessingTime}d`,
      subtitle: 'Procesamiento',
      icon: <Timer className="size-5" />,
      color: 'text-primary',
      bgColor: 'bg-primary/10 border-primary/20'
    },
    {
      title: 'Servicios Urgentes',
      value: metrics.urgentServices,
      subtitle: '+7 días',
      icon: <Clock className="size-5" />,
      color: 'text-danger-text',
      bgColor: 'bg-danger/10 border-danger/20',
      urgent: metrics.urgentServices > 0
    }
  ];

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <Card className="bg-card border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              Resumen del Pipeline
            </CardTitle>
            <Badge variant="outline" className="text-primary border-primary/30">
              {toTitleCase(clientName)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{metrics.total}</div>
              <div className="text-muted-foreground">Total Servicios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success-text">
                ${metrics.totalValue.toLocaleString()}
              </div>
              <div className="text-muted-foreground">Valor Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-info-text">{metrics.inPipeline}</div>
              <div className="text-muted-foreground">En Proceso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{metrics.avgProcessingTime}d</div>
              <div className="text-muted-foreground">Tiempo Prom.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((metric, index) => (
          <Card
            key={index}
            className={`bg-card border ${metric.bgColor} ${metric.urgent ? 'animate-pulse' : ''}`}
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
                <div className="text-xs text-muted-foreground font-medium">
                  {metric.title}
                </div>
                <div className="text-xs text-muted-foreground">
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
