import * as React from 'react';
import { ReportMetrics } from '@/hooks/useReports';
import { ChartConfig } from "@/components/ui/chart";
import { useCostMetrics } from '@/hooks/reports/useCostMetrics';
import { CostMetricsComponent } from './CostMetrics';
import { CostAnalysis } from './CostAnalysis';
import { CostCharts } from './CostCharts';
import { CostTable } from './CostTable';

interface CostAnalysisReportsProps {
  metrics: ReportMetrics;
  costsByCategoryConfig: ChartConfig;
}

export const CostAnalysisReports = ({ metrics, costsByCategoryConfig }: CostAnalysisReportsProps) => {
  const costMetrics = useCostMetrics(metrics);

  if (!costMetrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Cargando métricas de costos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Análisis de Costos</h2>
        <p className="text-gray-300">Análisis detallado de gastos, categorías y control de costos</p>
      </div>

      <CostMetricsComponent metrics={costMetrics} />
      
      {/* Solo análisis específico de costos */}
      <CostAnalysis metrics={metrics} />
      
      {/* Solo gráficos de costos por categoría */}
      <CostCharts metrics={metrics} costsByCategoryConfig={costsByCategoryConfig} />

      {/* Tabla detallada de costos */}
      <CostTable metrics={costMetrics} />
    </div>
  );
};