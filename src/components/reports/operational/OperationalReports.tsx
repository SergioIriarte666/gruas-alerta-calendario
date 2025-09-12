import * as React from 'react';
import { ReportMetrics } from '@/hooks/useReports';
import { ChartConfig } from "@/components/ui/chart";
import { useOperationalMetrics } from '@/hooks/reports/useOperationalMetrics';
import { OperationalMetricsComponent } from './OperationalMetrics';
import { PrimaryCharts } from './PrimaryCharts';
import { DistributionCharts } from './DistributionCharts';
import { DetailTables } from './DetailTables';

interface OperationalReportsProps {
  metrics: ReportMetrics;
  servicesByMonthConfig: ChartConfig;
  revenueByMonthConfig: ChartConfig;
  servicesByStatusConfig: ChartConfig;
  craneUtilizationConfig: ChartConfig;
}

export const OperationalReports = ({
  metrics,
  servicesByMonthConfig,
  revenueByMonthConfig,
  servicesByStatusConfig,
  craneUtilizationConfig
}: OperationalReportsProps) => {
  const operationalMetrics = useOperationalMetrics(metrics);

  if (!operationalMetrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando métricas operacionales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Reportes Operacionales</h2>
        <p className="text-muted-foreground">Análisis de servicios, ingresos, recursos y operaciones</p>
      </div>

      <OperationalMetricsComponent metrics={operationalMetrics} />
      
      {/* Solo gráficos relacionados con servicios e ingresos */}
      <PrimaryCharts 
        metrics={metrics} 
        servicesByMonthConfig={servicesByMonthConfig} 
        revenueByMonthConfig={revenueByMonthConfig}
      />
      
      {/* Solo distribución de servicios y utilización */}
      <DistributionCharts 
        metrics={metrics}
        servicesByStatusConfig={servicesByStatusConfig}
        craneUtilizationConfig={craneUtilizationConfig}
      />

      {/* Solo tablas de clientes y grúas */}
      <DetailTables metrics={metrics} />
    </div>
  );
};